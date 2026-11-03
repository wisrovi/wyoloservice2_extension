import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface PreflightValidationResult {
    valid: boolean;
    reason?: string;
    details?: string;
    fixSuggestion?: string;
    problemLine?: number;
    field?: string;
}

/**
 * Pre-flight validator for NeuralForge YOLO training configurations.
 * Intercepts submissions "al vuelo" and validates dataset paths, models, and YAML structure
 * before reserving cluster resources or dispatching Celery tasks.
 */
export async function validateTrainingPreflight(
    filePath: string,
    yamlContent: string
): Promise<PreflightValidationResult> {
    if (!yamlContent || !yamlContent.trim()) {
        return {
            valid: false,
            reason: 'The YAML configuration file is completely empty.',
            details: 'A valid training configuration requires at minimum a model architecture and a dataset path.',
            fixSuggestion: 'Use the "NeuralForge: Guided Training Studio" or "NeuralForge: Create Training Configuration" commands to generate a valid YAML.',
            problemLine: 1,
            field: 'content'
        };
    }

    const lines = yamlContent.split(/\r?\n/);

    // 1. Validate 'model:' field
    let modelValue = '';
    let modelLine = -1;
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^[ \t]*model:\s*["']?([^"'\r\n#]+)["']?/);
        if (match) {
            modelValue = match[1].trim();
            modelLine = i + 1;
            break;
        }
    }

    if (!modelValue) {
        return {
            valid: false,
            reason: "Missing required 'model:' field in configuration.",
            details: "Ultralytics YOLO requires a base model checkpoint (e.g. 'yolo26n.pt', 'yolo11s.pt', 'yolov8m.pt') to initialize weights.",
            fixSuggestion: "Add 'model: \"yolo26n.pt\"' at the root of your configuration YAML.",
            problemLine: 1,
            field: 'model'
        };
    }

    if (isPlaceholder(modelValue)) {
        return {
            valid: false,
            reason: `Model field contains an unconfigured placeholder: '${modelValue}'.`,
            details: "The model parameter must point to a real checkpoint filename or pretrained weights tag.",
            fixSuggestion: "Replace the placeholder with an official checkpoint like 'yolo26n.pt', 'yolo11s.pt', or 'yolov8n.pt'.",
            problemLine: modelLine > 0 ? modelLine : 1,
            field: 'model'
        };
    }

    // 2. Validate 'data:' / 'dataset:' field
    let dataValue = '';
    let dataLine = -1;
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^[ \t]*(?:data|dataset):\s*["']?([^"'\r\n#]+)["']?/);
        if (match) {
            dataValue = match[1].trim();
            dataLine = i + 1;
            break;
        }
    }

    if (!dataValue) {
        return {
            valid: false,
            reason: "Missing required dataset path ('data:' field) in YAML.",
            details: "Training cannot proceed without an input dataset. Neither 'train.data' nor 'data' was found in the configuration.",
            fixSuggestion: "Add 'train:\n  data: \"/datasets/<project>/data.yaml\"' pointing to your Samba CIFS or local dataset descriptor.",
            problemLine: 1,
            field: 'data'
        };
    }

    // 2a. Placeholder check
    if (isPlaceholder(dataValue)) {
        return {
            valid: false,
            reason: `Dataset path contains an unconfigured placeholder: '${dataValue}'.`,
            details: "Dispatching this study to the cluster will fail immediately when the worker container attempts to mount the dataset.",
            fixSuggestion: "Replace the placeholder with a valid Samba CIFS path (e.g., '/datasets/AREPO/protesis/data.yaml') or a local YAML path.",
            problemLine: dataLine > 0 ? dataLine : 1,
            field: 'data'
        };
    }

    // 2b. Disallowed file extension check
    const invalidExtensions = ['.txt', '.csv', '.png', '.jpg', '.jpeg', '.json', '.pt', '.pth', '.onnx', '.py', '.sh'];
    const ext = path.extname(dataValue).toLowerCase();
    if (invalidExtensions.includes(ext)) {
        return {
            valid: false,
            reason: `Invalid dataset descriptor file extension ('${ext}').`,
            details: `The path '${dataValue}' points to a '${ext}' file. YOLO training requires a YAML configuration file (.yaml or .yml) defining train/val splits, or a dataset directory.`,
            fixSuggestion: "Point to the 'data.yaml' or 'dataset.yaml' file inside your dataset folder.",
            problemLine: dataLine > 0 ? dataLine : 1,
            field: 'data'
        };
    }

    // 2c. Remote Samba CIFS path validation (/datasets/...)
    if (dataValue.startsWith('/datasets')) {
        const normalized = dataValue.replace(/\\/g, '/').replace(/\/+$/, '');
        if (normalized === '/datasets' || normalized === '/datasets/data.yaml' || normalized === '/datasets/dataset.yaml') {
            return {
                valid: false,
                reason: `Dataset path '${dataValue}' is too generic or points directly to root /datasets.`,
                details: "Individual datasets on the cluster storage are located inside project subfolders (e.g. '/datasets/AREPO/...', '/datasets/examples/...').",
                fixSuggestion: "Specify the full project path, for example: '/datasets/AREPO/protesis/Detector_ProtesisSuperior_261061/data.yaml'.",
                problemLine: dataLine > 0 ? dataLine : 1,
                field: 'data'
            };
        }
    } else {
        // 2d. Local filesystem path validation
        const isRelative = dataValue.startsWith('.') || !path.isAbsolute(dataValue);
        const resolvedPath = isRelative && filePath
            ? path.resolve(path.dirname(filePath), dataValue)
            : dataValue;

        // If it looks like a local filesystem path (starts with /home, /Users, C:, ./, ../, etc.)
        if (path.isAbsolute(resolvedPath) && (resolvedPath.startsWith('/home') || resolvedPath.startsWith('/Users') || /^[a-zA-Z]:/.test(resolvedPath) || isRelative)) {
            if (!fs.existsSync(resolvedPath)) {
                return {
                    valid: false,
                    reason: `Local dataset path does not exist on disk.`,
                    details: `The specified dataset target was not found:\n'${resolvedPath}'.\n\nIf this dataset is hosted on the cluster Samba CIFS storage, prefix the path with '/datasets/'.`,
                    fixSuggestion: "Verify the directory path on your disk or update the path to the cluster Samba share '/datasets/...'.",
                    problemLine: dataLine > 0 ? dataLine : 1,
                    field: 'data'
                };
            }

            // If it is a local YAML file, verify that it defines train/val splits
            try {
                if (fs.statSync(resolvedPath).isFile()) {
                    const dsContent = fs.readFileSync(resolvedPath, 'utf-8');
                    const hasTrain = /^[ \t]*train:\s*\S+/m.test(dsContent);
                    const hasVal = /^[ \t]*(?:val|test|validation):\s*\S+/m.test(dsContent);

                    if (!hasTrain || !hasVal) {
                        return {
                            valid: false,
                            reason: `Dataset YAML '${path.basename(resolvedPath)}' is missing required splits.`,
                            details: `A valid YOLO dataset configuration must specify both a 'train:' directory and a 'val:' (or 'test:') directory for evaluation.`,
                            fixSuggestion: "Add 'train:' and 'val:' image paths inside your dataset descriptor YAML.",
                            problemLine: dataLine > 0 ? dataLine : 1,
                            field: 'data'
                        };
                    }
                }
            } catch (err: any) {
                return {
                    valid: false,
                    reason: `Failed to read local dataset descriptor: ${err.message}`,
                    details: `Could not verify '${resolvedPath}'. Check file permissions.`,
                    fixSuggestion: "Ensure the dataset YAML has read permissions.",
                    problemLine: dataLine > 0 ? dataLine : 1,
                    field: 'data'
                };
            }
        }
    }

    return { valid: true };
}

/**
 * Handles rejection UI: displays modal error explaining why training was rejected "al vuelo"
 * and provides navigation straight to the offending line in the YAML file.
 */
export async function handlePreflightRejection(
    result: PreflightValidationResult,
    filePath: string
): Promise<void> {
    const errorTitle = `🚫 Training Rejected (Pre-flight Fail-Fast): ${result.reason}`;
    const modalDetail = `${result.details || ''}\n\n💡 How to fix:\n${result.fixSuggestion || 'Update the configuration and retry.'}`;

    const action = await vscode.window.showErrorMessage(
        errorTitle,
        { modal: true, detail: modalDetail },
        '📝 Jump to Problem in YAML',
        '🔍 Run Dataset Validator'
    );

    if (action === '📝 Jump to Problem in YAML' && filePath && fs.existsSync(filePath)) {
        try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Active });
            const line = Math.max(0, (result.problemLine || 1) - 1);
            const pos = new vscode.Position(line, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        } catch {
            // Ignore error opening editor
        }
    } else if (action === '🔍 Run Dataset Validator') {
        vscode.commands.executeCommand('neuralforge.validateDataset', vscode.Uri.file(filePath));
    }
}

function isPlaceholder(value: string): boolean {
    const v = value.toLowerCase().trim();
    if (!v) return true;
    if (v.startsWith('<') && v.endsWith('>')) return true;
    if (v.includes('your_dataset') || v.includes('your_model') || v.includes('path/to/')) return true;
    if (v === 'todo' || v === 'dummy' || v === 'undefined' || v === 'null') return true;
    return false;
}
