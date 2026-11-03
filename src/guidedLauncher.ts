import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ClusterApiClient } from './clusterApiClient';
import { LogStreamer } from './logStreamer';

export function openGuidedLauncher(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'neuralforgeGuidedLaunch',
        '🚀 NeuralForge: Training Studio Hub',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // Initial connection settings
    const config = vscode.workspace.getConfiguration('neuralforge');
    const initialSettings = {
        controlHost: config.get<string>('controlHost', '192.168.10.252'),
        controlPort: config.get<number>('controlPort', 23442),
        sambaHost: context.globalState.get<string>('neuralforge.sambaHost', '192.168.10.250'),
        sambaUser: context.globalState.get<string>('neuralforge.sambaUser', 'cifs_worker'),
        sambaPass: context.globalState.get<string>('neuralforge.sambaPass', '')
    };

    panel.webview.html = getGuidedLauncherHtml(initialSettings);

    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'saveSettings') {
            const { controlHost, controlPort, sambaHost, sambaUser, sambaPass } = message.payload;
            try {
                await config.update('controlHost', controlHost, vscode.ConfigurationTarget.Global);
                await config.update('controlPort', Number(controlPort), vscode.ConfigurationTarget.Global);
                await context.globalState.update('neuralforge.sambaHost', sambaHost);
                await context.globalState.update('neuralforge.sambaUser', sambaUser);
                await context.globalState.update('neuralforge.sambaPass', sambaPass);
                panel.webview.postMessage({
                    command: 'settingsSaved',
                    message: '✅ Connection & Samba credentials saved successfully.'
                });
                vscode.window.showInformationMessage('NeuralForge cluster & storage settings saved.');
            } catch (err: any) {
                panel.webview.postMessage({
                    command: 'error',
                    message: `Failed to save settings: ${err.message}`
                });
            }
            return;
        }

        if (message.command === 'generateYamlOnly' || message.command === 'submitTraining') {
            const { 
                dataset, 
                task, 
                family,
                model, 
                studyName, 
                author,
                description, 
                epochs, 
                imgsz,
                optimizer,
                sweeperTrials, 
                sweeperSampler, 
                sweeperMetric 
            } = message.payload;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            const targetFolder = workspaceFolders && workspaceFolders.length > 0
                ? workspaceFolders[0].uri.fsPath
                : process.cwd();

            const sanitizedStudy = (studyName || `study_${task}_${Date.now().toString(36)}`)
                .replace(/[^a-zA-Z0-9_-]/g, '_');
            const configFileName = `neuralforge_${sanitizedStudy}.yaml`;
            const configFilePath = path.join(targetFolder, configFileName);

            // Determine official fitness metric based on task if not explicitly chosen
            let fitnessMetric = sweeperMetric;
            if (!fitnessMetric || fitnessMetric === 'auto') {
                if (task === 'segment') {
                    fitnessMetric = 'metrics/mAP50(M)';
                } else if (task === 'classify') {
                    fitnessMetric = 'metrics/accuracy_top1';
                } else if (task === 'pose') {
                    fitnessMetric = 'metrics/mAP50-95(P)';
                } else {
                    fitnessMetric = 'metrics/mAP50-95(B)';
                }
            }

            // Generate search_space model choices dynamically based on family and task
            const fam = family || 'yolo26';
            let modelChoices: string[] = [];
            if (fam === 'rtdetr') {
                modelChoices = ['rtdetr-l.pt', 'rtdetr-x.pt'];
            } else if (fam === 'custom') {
                modelChoices = [model];
            } else {
                let suffix = '';
                if (task === 'segment') {
                    suffix = '-seg';
                } else if (task === 'classify') {
                    suffix = '-cls';
                } else if (task === 'obb') {
                    suffix = '-obb';
                } else if (task === 'pose') {
                    suffix = '-pose';
                }
                modelChoices = [
                    `${fam}n${suffix}.pt`,
                    `${fam}s${suffix}.pt`,
                    `${fam}m${suffix}.pt`
                ];
            }

            const modelChoicesYaml = modelChoices.map(m => `    - ${m}`).join('\n');

            // Standard train_service2 official live YAML format
            const yamlContent = `model: "${model}"
type: "yolo"
task: "${task || 'detect'}"

train:
  data: ${dataset}
  epochs: ${epochs || 5}
  imgsz: ${imgsz || 640}
  device: 0
  optimizer: ${optimizer || 'AdamW'}

sweeper:
  debug: "192.168.1.68"
  version: 1
  algorithm: optuna
  direction: maximize
  fitness: "${fitnessMetric}"
  study_name: "${sanitizedStudy}"
  sampler: "${sweeperSampler || 'TPESampler'}"
  n_trials: ${sweeperTrials || 2}
  priority: "low"

  search_space:
    model:
    - choice
${modelChoicesYaml}
    train:
      imgsz:
      - choice
      - 640
      - 768
      - 1024
      lr0:
      - loguniform
      - 0.0001
      - 0.01

extras:
  gpu:
    id: 0
    limit: 0.60

metadata:
  author: "${author || 'William Rodriguez'}"
  content: "${description || 'Entrenamiento de modelo YOLO con NeuralForge'}"
  documentation: "Configuración generada desde NeuralForge Training Studio Hub"
`;

            try {
                fs.writeFileSync(configFilePath, yamlContent, 'utf-8');
            } catch (err: any) {
                panel.webview.postMessage({ command: 'error', message: `Failed to write YAML: ${err.message}` });
                return;
            }

            // Save YAML and open side-by-side in editor with active CodeLens
            panel.webview.postMessage({
                command: 'yamlGenerated',
                filePath: configFilePath,
                message: `✅ YAML configuration saved to ${configFileName}`
            });

            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configFilePath));
            await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
            vscode.window.showInformationMessage(`📄 Configuration opened: ${configFileName}. Review parameters and click "▷ Launch Training on Cluster" in the CodeLens.`);
        }
    }, undefined, context.subscriptions);
}

function getGuidedLauncherHtml(settings: any): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NeuralForge Studio Hub</title>
    <style>
        :root {
            --bg: var(--vscode-editor-background, #1e1e1e);
            --fg: var(--vscode-editor-foreground, #d4d4d4);
            --card-bg: var(--vscode-sideBar-background, #252526);
            --border: var(--vscode-panel-border, #3a3a3a);
            --accent: #38bdf8;
            --accent-green: #4ade80;
            --btn-blue: #0284c7;
            --btn-blue-hover: #0369a1;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--fg);
            margin: 0;
            padding: 24px;
            max-width: 860px;
            margin: 0 auto;
            line-height: 1.5;
        }
        .header {
            margin-bottom: 24px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 16px;
        }
        .header h1 {
            margin: 0 0 6px 0;
            font-size: 22px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .section {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 18px 20px;
            margin-bottom: 20px;
        }
        .section-title {
            font-size: 15px;
            font-weight: 600;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .chips-container {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 12px;
        }
        .chip {
            border: 1px solid var(--border);
            background: rgba(255,255,255,0.03);
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.15s;
        }
        .chip:hover {
            border-color: #777;
        }
        .chip.active {
            border-color: var(--accent);
            background: rgba(56, 189, 248, 0.15);
            color: #fff;
            font-weight: 600;
        }
        .input-group {
            margin-bottom: 12px;
        }
        .input-group label {
            display: block;
            font-size: 12px;
            margin-bottom: 4px;
            font-weight: 600;
            opacity: 0.9;
        }
        input[type="text"], input[type="password"], input[type="number"], select {
            width: 100%;
            background: var(--vscode-input-background, #3c3c3c);
            color: var(--vscode-input-foreground, #fff);
            border: 1px solid var(--vscode-input-border, #555);
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            box-sizing: border-box;
        }
        input:focus, select:focus {
            outline: 1px solid var(--accent);
            border-color: var(--accent);
        }
        .presets {
            display: flex;
            gap: 6px;
            margin-top: 6px;
            flex-wrap: wrap;
        }
        .preset-chip {
            background: #333;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
        }
        .preset-chip:hover {
            background: #444;
        }
        .toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 0;
        }
        .collapsible-trigger {
            font-size: 12px;
            color: var(--accent);
            cursor: pointer;
            text-decoration: underline;
        }
        .collapsible-content {
            display: none;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--border);
        }
        .collapsible-content.open {
            display: block;
        }
        .action-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 18px;
        }
        .btn {
            border: none;
            padding: 13px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.15s ease;
        }
        .btn-primary {
            background: var(--btn-blue);
            color: #fff;
        }
        .btn-primary:hover {
            background: var(--btn-blue-hover);
        }
        .btn-secondary {
            background: #374151;
            color: #f3f4f6;
            border: 1px solid #4b5563;
        }
        .btn-secondary:hover {
            background: #4b5563;
        }
        .status-msg {
            margin-top: 14px;
            padding: 12px;
            border-radius: 6px;
            display: none;
            font-size: 13px;
        }
        .status-msg.success {
            display: block;
            background: rgba(74, 222, 128, 0.12);
            border: 1px solid var(--accent-green);
            color: var(--accent-green);
        }
        .status-msg.error {
            display: block;
            background: rgba(239, 68, 68, 0.12);
            border: 1px solid #ef4444;
            color: #f87171;
        }
        .model-preview-badge {
            display: inline-block;
            background: rgba(56, 189, 248, 0.15);
            border: 1px solid var(--accent);
            color: var(--accent);
            padding: 4px 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 13px;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 NeuralForge Training Studio</h1>
        <div style="opacity: 0.8; font-size: 13px;">Official train_service2 YAML generator & cluster execution hub</div>
    </div>

    <!-- 1. Dataset & Samba Storage -->
    <div class="section">
        <div class="section-title">
            <span>📁 1. Dataset & Samba CIFS Storage</span>
            <span class="collapsible-trigger" onclick="toggleSettings()">⚙️ Connection & Samba Credentials</span>
        </div>
        <div class="input-group">
            <label>Dataset data.yaml Path (accessible by cluster invokers)</label>
            <input type="text" id="datasetPath" value="/datasets/examples/detection/eletronic_components/data.yaml" placeholder="e.g. /datasets/examples/detection/eletronic_components/data.yaml">
            <div class="presets">
                <span class="preset-chip" onclick="setDataset('/datasets/examples/detection/eletronic_components/data.yaml', 'detect')">📦 Electronic Components (Detection)</span>
                <span class="preset-chip" onclick="setDataset('/datasets/examples/segmentation/architecture_plan/data.yaml', 'segment')">📐 Architecture Plan (Segmentation)</span>
                <span class="preset-chip" onclick="setDataset('/datasets/examples/clasification/colorball.v8i.multiclass', 'classify')">🎨 Colorball (Classification)</span>
            </div>
        </div>

        <!-- Collapsible Connection & Samba Config -->
        <div id="connSettingsPanel" class="collapsible-content">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                <div class="input-group">
                    <label>Manager API Host / IP</label>
                    <input type="text" id="cfgControlHost" value="${settings.controlHost}">
                </div>
                <div class="input-group">
                    <label>API Port</label>
                    <input type="number" id="cfgControlPort" value="${settings.controlPort}">
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                <div class="input-group">
                    <label>Samba CIFS Server</label>
                    <input type="text" id="cfgSambaHost" value="${settings.sambaHost}">
                </div>
                <div class="input-group">
                    <label>CIFS Username</label>
                    <input type="text" id="cfgSambaUser" value="${settings.sambaUser}">
                </div>
                <div class="input-group">
                    <label>CIFS Password</label>
                    <input type="password" id="cfgSambaPass" value="${settings.sambaPass}" placeholder="••••••••">
                </div>
            </div>
            <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="saveConnectionSettings()">
                💾 Save Connection Defaults
            </button>
        </div>
    </div>

    <!-- 2. Task Type & Multi-Generation Model Architecture -->
    <div class="section">
        <div class="section-title">
            <span>🎯 2. CV Task Type & Model Family / Architecture</span>
        </div>
        
        <!-- Task Selection Chips -->
        <label style="font-size: 12px; font-weight: 600; margin-bottom: 4px; display: block;">Task Type:</label>
        <div class="chips-container" id="taskChips">
            <div class="chip active" onclick="selectTask('detect', this)">🎯 Object Detection</div>
            <div class="chip" onclick="selectTask('segment', this)">✂️ Instance Segmentation</div>
            <div class="chip" onclick="selectTask('classify', this)">🏷️ Image Classification</div>
            <div class="chip" onclick="selectTask('obb', this)">📐 Oriented BBox (OBB)</div>
            <div class="chip" onclick="selectTask('pose', this)">🏃 Pose Estimation</div>
        </div>

        <!-- Model Family Generation Selector -->
        <label style="font-size: 12px; font-weight: 600; margin-bottom: 4px; display: block;">Model Family / Generation:</label>
        <div class="chips-container" id="familyChips">
            <div class="chip active" onclick="selectFamily('yolo26', this)">🚀 YOLO26 (Next-Gen)</div>
            <div class="chip" onclick="selectFamily('yolo11', this)">⚡ YOLO11 (Ultralytics)</div>
            <div class="chip" onclick="selectFamily('yolov10', this)">⚡ YOLOv10</div>
            <div class="chip" onclick="selectFamily('yolov9', this)">⚡ YOLOv9</div>
            <div class="chip" onclick="selectFamily('yolov8', this)">📦 YOLOv8 (Standard)</div>
            <div class="chip" onclick="selectFamily('rtdetr', this)">🎯 RT-DETR</div>
            <div class="chip" onclick="selectFamily('custom', this)">✏️ Custom Weights</div>
        </div>

        <!-- Model Scale Selector -->
        <div id="scaleSection">
            <label style="font-size: 12px; font-weight: 600; margin-bottom: 4px; display: block;">Model Scale / Capacity:</label>
            <div class="chips-container" id="scaleChips">
                <div class="chip" onclick="selectScaleCapacity('n', this)">Nano (n) • ~3M</div>
                <div class="chip active" onclick="selectScaleCapacity('s', this)">Small (s) • ~9M</div>
                <div class="chip" onclick="selectScaleCapacity('m', this)">Medium (m) • ~22M</div>
                <div class="chip" onclick="selectScaleCapacity('l', this)">Large (l) • ~44M</div>
                <div class="chip" onclick="selectScaleCapacity('x', this)">X-Large (x) • ~68M</div>
            </div>
        </div>

        <!-- Custom Model Input -->
        <div id="customModelSection" style="display: none; margin-top: 8px;">
            <label style="font-size: 12px; font-weight: 600; margin-bottom: 4px; display: block;">Custom Model Weights File / Path:</label>
            <input type="text" id="customModelInput" placeholder="e.g. yolo11x-seg.pt or weights/best.pt" oninput="updateModelPreview()">
        </div>

        <div>
            <span style="font-size: 12px; opacity: 0.8;">Generated Model Weight: </span>
            <span id="modelPreviewBadge" class="model-preview-badge">yolo26s.pt</span>
        </div>
    </div>

    <!-- 3. Experiment Metadata & Routing -->
    <div class="section">
        <div class="section-title">
            <span>📋 3. Experiment Metadata & Node Routing</span>
        </div>
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
            <div class="input-group">
                <label>Study Name (sweeper.study_name)</label>
                <input type="text" id="studyName" placeholder="e.g. study_detect_electronic_v1">
            </div>
            <div class="input-group">
                <label>Author / Researcher</label>
                <input type="text" id="studyAuthor" value="William Rodriguez" placeholder="Author name">
            </div>
        </div>
        <div class="input-group" style="margin-bottom: 0;">
            <label>Experiment Content & Documentation (metadata.content)</label>
            <input type="text" id="studyDesc" placeholder="e.g. YOLO26 model training on cluster dataset">
        </div>
    </div>

    <!-- 4. Fully Adjustable Training Hyperparameters -->
    <div class="section">
        <div class="section-title">
            <span>⚡ 4. Training Hyperparameters (train & sweeper)</span>
        </div>

        <!-- Mode Toggle Chips -->
        <div class="chips-container" style="margin-bottom: 12px;">
            <div id="modeSingleChip" class="chip active" onclick="selectMode('single')">⚡ Single Training Run</div>
            <div id="modeSweeperChip" class="chip" onclick="selectMode('sweeper')">🧪 Optuna Hyperparameter Sweeper</div>
        </div>

        <!-- Training Hyperparameters Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
            <div class="input-group">
                <label>Epochs (train.epochs)</label>
                <input type="number" id="trainEpochs" value="5" min="1" max="1000">
                <div class="presets">
                    <span class="preset-chip" onclick="setEpochs(5)">5 (Quick Test)</span>
                    <span class="preset-chip" onclick="setEpochs(50)">50</span>
                    <span class="preset-chip" onclick="setEpochs(100)">100</span>
                    <span class="preset-chip" onclick="setEpochs(300)">300</span>
                </div>
            </div>
            <div class="input-group">
                <label>Image Size (train.imgsz)</label>
                <input type="number" id="trainImgsz" value="640" min="128" max="2560" step="32">
                <div class="presets">
                    <span class="preset-chip" onclick="setImgsz(640)">640 Standard</span>
                    <span class="preset-chip" onclick="setImgsz(768)">768</span>
                    <span class="preset-chip" onclick="setImgsz(1024)">1024 High-Res</span>
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 12px;">
            <div class="input-group">
                <label>Optimizer (train.optimizer)</label>
                <select id="trainOptimizer">
                    <option value="AdamW" selected>AdamW (Standard train_service)</option>
                    <option value="auto">auto</option>
                    <option value="SGD">SGD</option>
                    <option value="Adam">Adam</option>
                    <option value="RMSProp">RMSProp</option>
                </select>
            </div>
        </div>

        <!-- Sweeper Controls Panel (hidden by default) -->
        <div id="sweeperPanel" style="display: none; margin-bottom: 14px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 6px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                <div class="input-group">
                    <label>Trials Count (sweeper.n_trials)</label>
                    <input type="number" id="sweeperTrials" value="2" min="1" max="100">
                </div>
                <div class="input-group">
                    <label>Sampler (sweeper.sampler)</label>
                    <select id="sweeperSampler">
                        <option value="TPESampler" selected>TPESampler</option>
                        <option value="CmaEsSampler">CmaEsSampler</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Fitness Metric (sweeper.fitness)</label>
                    <select id="sweeperMetric">
                        <option value="auto" selected>Auto by Task</option>
                        <option value="metrics/mAP50-95(B)">metrics/mAP50-95(B) [Detect Box]</option>
                        <option value="metrics/mAP50(B)">metrics/mAP50(B) [Detect mAP50]</option>
                        <option value="metrics/mAP50(M)">metrics/mAP50(M) [Segment Mask]</option>
                        <option value="metrics/accuracy_top1">metrics/accuracy_top1 [Classify]</option>
                    </select>
                </div>
            </div>
        </div>
    </div>

    <!-- Action Button -->
    <div class="action-buttons" style="display: flex; justify-content: center;">
        <button class="btn btn-primary" style="width: 100%; max-width: 500px;" onclick="generateYaml()">
            <span>📄 Generate YAML & Open in Editor</span>
        </button>
    </div>

    <div id="statusBox" class="status-msg"></div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentTask = 'detect';
        let currentFamily = 'yolo26';
        let currentScale = 's';
        let isSweeperMode = false;

        function updateModelPreview() {
            let modelName = '';
            if (currentFamily === 'custom') {
                modelName = document.getElementById('customModelInput').value.trim() || 'custom_model.pt';
            } else if (currentFamily === 'rtdetr') {
                const rScale = (currentScale === 'x' || currentScale === 'l') ? currentScale : 'l';
                modelName = \`rtdetr-\${rScale}.pt\`;
            } else {
                let suffix = '';
                if (currentTask === 'segment') suffix = '-seg';
                else if (currentTask === 'classify') suffix = '-cls';
                else if (currentTask === 'obb') suffix = '-obb';
                else if (currentTask === 'pose') suffix = '-pose';

                modelName = \`\${currentFamily}\${currentScale}\${suffix}.pt\`;
            }

            document.getElementById('modelPreviewBadge').innerText = modelName;
            updateStudyNameSuggestion(modelName);
            return modelName;
        }

        function selectTask(task, el) {
            currentTask = task;
            document.querySelectorAll('#taskChips .chip').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
            updateModelPreview();
        }

        function selectFamily(family, el) {
            currentFamily = family;
            document.querySelectorAll('#familyChips .chip').forEach(c => c.classList.remove('active'));
            el.classList.add('active');

            if (family === 'custom') {
                document.getElementById('scaleSection').style.display = 'none';
                document.getElementById('customModelSection').style.display = 'block';
            } else if (family === 'rtdetr') {
                document.getElementById('scaleSection').style.display = 'block';
                document.getElementById('customModelSection').style.display = 'none';
            } else {
                document.getElementById('scaleSection').style.display = 'block';
                document.getElementById('customModelSection').style.display = 'none';
            }
            updateModelPreview();
        }

        function selectScaleCapacity(scale, el) {
            currentScale = scale;
            document.querySelectorAll('#scaleChips .chip').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
            updateModelPreview();
        }

        function setEpochs(val) {
            document.getElementById('trainEpochs').value = val;
        }

        function setBatch(val) {
            document.getElementById('trainBatch').value = val;
        }

        function setImgsz(val) {
            document.getElementById('trainImgsz').value = val;
        }

        function setDataset(path, task) {
            document.getElementById('datasetPath').value = path;
            if (task) {
                const chip = Array.from(document.querySelectorAll('#taskChips .chip')).find(c => c.innerText.toLowerCase().includes(task));
                if (chip) selectTask(task, chip);
            }
        }

        function selectMode(mode) {
            isSweeperMode = (mode === 'sweeper');
            document.getElementById('modeSingleChip').className = 'chip' + (!isSweeperMode ? ' active' : '');
            document.getElementById('modeSweeperChip').className = 'chip' + (isSweeperMode ? ' active' : '');
            document.getElementById('sweeperPanel').style.display = isSweeperMode ? 'block' : 'none';
        }

        function toggleSettings() {
            const panel = document.getElementById('connSettingsPanel');
            panel.classList.toggle('open');
        }

        function saveConnectionSettings() {
            const payload = {
                controlHost: document.getElementById('cfgControlHost').value.trim(),
                controlPort: document.getElementById('cfgControlPort').value.trim(),
                sambaHost: document.getElementById('cfgSambaHost').value.trim(),
                sambaUser: document.getElementById('cfgSambaUser').value.trim(),
                sambaPass: document.getElementById('cfgSambaPass').value
            };
            vscode.postMessage({ command: 'saveSettings', payload });
        }

        function updateStudyNameSuggestion(modelName) {
            const nameInput = document.getElementById('studyName');
            if (!nameInput.dataset.touched) {
                const cleanModel = (modelName || updateModelPreview()).replace('.pt', '');
                nameInput.value = \`study_\${currentTask}_\${cleanModel}_v1\`;
            }
        }

        document.getElementById('studyName').addEventListener('input', function() {
            this.dataset.touched = 'true';
        });

        function collectPayload() {
            const model = updateModelPreview();
            const dataset = document.getElementById('datasetPath').value.trim();
            const studyName = document.getElementById('studyName').value.trim() || \`study_\${currentTask}_\${model.replace('.pt', '')}_v1\`;
            const author = document.getElementById('studyAuthor').value.trim();
            const description = document.getElementById('studyDesc').value.trim();
            const epochs = parseInt(document.getElementById('trainEpochs').value, 10) || 5;
            const imgsz = parseInt(document.getElementById('trainImgsz').value, 10) || 640;
            const optimizer = document.getElementById('trainOptimizer').value;

            return {
                dataset,
                task: currentTask,
                family: currentFamily,
                model,
                studyName,
                author,
                description,
                epochs,
                imgsz,
                optimizer,
                isSweeper: isSweeperMode,
                sweeperTrials: parseInt(document.getElementById('sweeperTrials').value, 10) || 2,
                sweeperSampler: document.getElementById('sweeperSampler').value,
                sweeperMetric: document.getElementById('sweeperMetric').value
            };
        }

        function generateYaml() {
            const payload = collectPayload();
            if (!payload.dataset) {
                showStatus('Please specify a dataset path.', 'error');
                return;
            }
            showStatus('Writing official train_service YAML specification to workspace...', 'success');
            vscode.postMessage({ command: 'generateYamlOnly', payload });
        }

        function showStatus(msg, type) {
            const box = document.getElementById('statusBox');
            box.className = 'status-msg ' + type;
            box.innerText = msg;
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'submitted' || message.command === 'yamlGenerated' || message.command === 'settingsSaved') {
                showStatus(message.message, 'success');
            } else if (message.command === 'error') {
                showStatus(message.message, 'error');
            }
        });

        // Initialize preview
        updateModelPreview();
    </script>
</body>
</html>`;
}
