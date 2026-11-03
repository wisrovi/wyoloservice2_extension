"""Unit tests for NeuralForge pre-flight fail-fast dataset and configuration validation.

This module validates that invalid training configurations (such as missing dataset paths,
unconfigured placeholder values, wrong file extensions, missing models, and non-existent
local paths) are detected and rejected on the fly before cluster dispatch.
"""

import os
import re
import pytest


def validate_training_preflight_python(yaml_content: str, file_path: str = "") -> dict:
    """Python reference mirror of preflightValidator.ts for test validation.

    Args:
        yaml_content (str): The raw text of the training YAML configuration.
        file_path (str): The filesystem path where the YAML is located.

    Returns:
        dict: Validation result with keys 'valid', 'reason', 'field'.
    """
    if not yaml_content or not yaml_content.strip():
        return {
            "valid": False,
            "reason": "The YAML configuration file is completely empty.",
            "field": "content",
        }

    lines = yaml_content.splitlines()

    # 1. Validate 'model:' field
    model_value = ""
    for line in lines:
        m = re.match(r"^[ \t]*model:\s*[\"']?([^\"'\r\n#]+)[\"']?", line)
        if m:
            model_value = m.group(1).strip()
            break

    if not model_value:
        return {
            "valid": False,
            "reason": "Missing required 'model:' field in configuration.",
            "field": "model",
        }

    if is_placeholder(model_value):
        return {
            "valid": False,
            "reason": f"Model field contains an unconfigured placeholder: '{model_value}'.",
            "field": "model",
        }

    # 2. Validate 'data:' / 'dataset:' field
    data_value = ""
    for line in lines:
        m = re.match(r"^[ \t]*(?:data|dataset):\s*[\"']?([^\"'\r\n#]+)[\"']?", line)
        if m:
            data_value = m.group(1).strip()
            break

    if not data_value:
        return {
            "valid": False,
            "reason": "Missing required dataset path ('data:' field) in YAML.",
            "field": "data",
        }

    if is_placeholder(data_value):
        return {
            "valid": False,
            "reason": f"Dataset path contains an unconfigured placeholder: '{data_value}'.",
            "field": "data",
        }

    invalid_extensions = [".txt", ".csv", ".png", ".jpg", ".jpeg", ".json", ".pt", ".pth", ".onnx", ".py"]
    _, ext = os.path.splitext(data_value.lower())
    if ext in invalid_extensions:
        return {
            "valid": False,
            "reason": f"Invalid dataset descriptor file extension ('{ext}').",
            "field": "data",
        }

    if data_value.startswith("/datasets"):
        norm = data_value.replace("\\", "/").rstrip("/")
        if norm in ("/datasets", "/datasets/data.yaml", "/datasets/dataset.yaml"):
            return {
                "valid": False,
                "reason": f"Dataset path '{data_value}' is too generic or points directly to root /datasets.",
                "field": "data",
            }
    else:
        # Local path check
        is_relative = data_value.startswith(".") or not os.path.isabs(data_value)
        resolved = (
            os.path.normpath(os.path.join(os.path.dirname(file_path), data_value))
            if is_relative and file_path
            else data_value
        )
        if os.path.isabs(resolved) and (resolved.startswith(("/home", "/tmp", "/var")) or is_relative):
            if not os.path.exists(resolved):
                return {
                    "valid": False,
                    "reason": "Local dataset path does not exist on disk.",
                    "field": "data",
                }

    return {"valid": True}


def is_placeholder(val: str) -> bool:
    """Helper to detect template placeholders in configuration fields."""
    v = val.lower().strip()
    if not v:
        return True
    if v.startswith("<") and v.endswith(">"):
        return True
    if "your_dataset" in v or "your_model" in v or "path/to/" in v:
        return True
    return v in ("todo", "dummy", "undefined", "null")


class TestPreflightValidation:
    """Test suite for on-the-fly training rejection and pre-flight validation."""

    def test_reject_empty_yaml(self):
        """Validates that a blank or whitespace-only YAML file is immediately rejected."""
        res = validate_training_preflight_python("")
        assert not res["valid"]
        assert "empty" in res["reason"]
        assert res["field"] == "content"

    def test_reject_missing_model(self):
        """Validates that a configuration missing the 'model:' key is rejected on the fly."""
        yaml_text = """
train:
  data: "/datasets/AREPO/protesis/data.yaml"
  epochs: 5
"""
        res = validate_training_preflight_python(yaml_text)
        assert not res["valid"]
        assert res["field"] == "model"
        assert "Missing required 'model:'" in res["reason"]

    def test_reject_placeholder_model(self):
        """Validates that template placeholders in model field (e.g. <model>) are rejected."""
        yaml_text = """
model: "<YOUR_MODEL_HERE>"
train:
  data: "/datasets/AREPO/protesis/data.yaml"
"""
        res = validate_training_preflight_python(yaml_text)
        assert not res["valid"]
        assert "placeholder" in res["reason"]
        assert res["field"] == "model"

    def test_reject_missing_dataset(self):
        """Validates that a configuration without any 'data:' or 'dataset:' field is rejected."""
        yaml_text = """
model: "yolo26n.pt"
train:
  epochs: 5
  imgsz: 640
"""
        res = validate_training_preflight_python(yaml_text)
        assert not res["valid"]
        assert res["field"] == "data"
        assert "Missing required dataset path" in res["reason"]

    def test_reject_placeholder_dataset(self):
        """Validates that placeholders like <path_to_dataset> or TODO are rejected on the fly."""
        yaml_text = """
model: "yolo26n.pt"
train:
  data: "<path/to/dataset.yaml>"
"""
        res = validate_training_preflight_python(yaml_text)
        assert not res["valid"]
        assert res["field"] == "data"
        assert "placeholder" in res["reason"]

    def test_reject_invalid_file_extension(self):
        """Validates that pointing to raw images (.jpg), weights (.pt), or code (.py) is rejected."""
        yaml_text = """
model: "yolo26n.pt"
train:
  data: "/datasets/AREPO/protesis/image01.jpg"
"""
        res = validate_training_preflight_python(yaml_text)
        assert not res["valid"]
        assert res["field"] == "data"
        assert "Invalid dataset descriptor file extension" in res["reason"]

    def test_reject_generic_root_datasets(self):
        """Validates that pointing vaguely to '/datasets' or '/datasets/data.yaml' without project subpath is rejected."""
        yaml_text = """
model: "yolo26n.pt"
train:
  data: "/datasets/data.yaml"
"""
        res = validate_training_preflight_python(yaml_text)
        assert not res["valid"]
        assert res["field"] == "data"
        assert "too generic" in res["reason"]

    def test_reject_non_existent_local_path(self):
        """Validates that non-existent local file paths are immediately caught without waiting for container boot."""
        yaml_text = """
model: "yolo26n.pt"
train:
  data: "/tmp/this_dataset_does_not_exist_at_all_12345/data.yaml"
"""
        res = validate_training_preflight_python(yaml_text)
        assert not res["valid"]
        assert res["field"] == "data"
        assert "does not exist on disk" in res["reason"]

    def test_accept_valid_remote_dataset_configuration(self):
        """Validates that a correctly specified remote CIFS dataset passes pre-flight checks."""
        yaml_text = """
model: "yolo26s.pt"
style: "detect"
train:
  data: "/datasets/AREPO/protesis/Detector_ProtesisSuperior_261061/data.yaml"
  epochs: 5
  imgsz: 640
sweeper:
  study_name: "test_valid_study"
"""
        res = validate_training_preflight_python(yaml_text)
        assert res["valid"]
