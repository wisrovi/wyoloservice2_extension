---
name: agy-neuralforge-doctor
description: Diagnoses failed NeuralForge training runs
---

# NeuralForge Doctor

Use this skill when a training run fails or Celery task hangs.
1. Read the Celery logs from the invoker node.
2. Identify memory issues or missing docker images.
3. Suggest a fix or trigger `force_docker_pull`.
