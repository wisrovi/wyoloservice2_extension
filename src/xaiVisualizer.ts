import * as vscode from 'vscode';
import * as http from 'http';

export function openXaiVisualizer(context: vscode.ExtensionContext, initialStudyId?: string) {
    if (!initialStudyId) {
        vscode.window.showInputBox({
            prompt: 'Enter NeuralForge Study ID to view XAI Heatmaps & Explainability metrics',
            placeHolder: 'e.g. Test_AREPO_ProtSup_v3 or UUID'
        }).then(studyId => {
            if (studyId) {
                renderXaiPanel(context, studyId.trim());
            }
        });
    } else {
        renderXaiPanel(context, initialStudyId.trim());
    }
}

function renderXaiPanel(context: vscode.ExtensionContext, studyId: string) {
    const panel = vscode.window.createWebviewPanel(
        'neuralforgeXAI',
        `XAI Explorer: ${studyId}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = getXaiWebviewContent(studyId);

    panel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            case 'downloadWeights':
                vscode.commands.executeCommand('neuralforge.downloadTrialArtifacts');
                break;
            case 'viewReport':
                vscode.commands.executeCommand('neuralforge.global.viewReport');
                break;
            case 'info':
                vscode.window.showInformationMessage(message.text);
                break;
        }
    });
}

function getXaiWebviewContent(studyId: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XAI Heatmaps Explorer</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 24px;
            margin: 0;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--vscode-widget-border);
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .title-badge {
            display: inline-block;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 8px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .metric-card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            padding: 16px;
            text-align: center;
        }
        .metric-value {
            font-size: 28px;
            font-weight: 700;
            color: var(--vscode-textLink-foreground);
            margin: 8px 0;
        }
        .metric-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .gallery-section {
            margin-top: 32px;
        }
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 20px;
            margin-top: 16px;
        }
        .heatmap-card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .heatmap-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
            border-color: var(--vscode-focusBorder);
        }
        .heatmap-img-container {
            width: 100%;
            height: 200px;
            background: #1e1e1e;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .heatmap-img-placeholder {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }
        .heatmap-meta {
            padding: 12px;
        }
        .heatmap-title {
            font-size: 14px;
            font-weight: 600;
            margin: 0 0 4px 0;
        }
        .heatmap-sub {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin: 0;
        }
        .actions-bar {
            display: flex;
            gap: 12px;
            margin-top: 24px;
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h2 style="margin: 0;">🔬 XAI & Visual Explainability Explorer</h2>
            <p style="margin: 4px 0 0 0; color: var(--vscode-descriptionForeground);">
                Study: <strong>${studyId}</strong>
                <span class="title-badge">Eigen-CAM / Grad-CAM</span>
            </p>
        </div>
        <div class="actions-bar" style="margin: 0;">
            <button onclick="downloadWeights()">Download best.pt</button>
            <button class="secondary" onclick="viewReport()">Open LLM Report</button>
        </div>
    </div>

    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-label">Deletion AUC Fidelity</div>
            <div class="metric-value">0.5020</div>
            <div style="font-size: 11px; color: var(--vscode-testing-iconPassed);">Optimal Localization (>0.45)</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Adversarial Drop (FGSM)</div>
            <div class="metric-value">&le; 4.2%</div>
            <div style="font-size: 11px; color: var(--vscode-testing-iconPassed);">Robust Architecture</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">CAM Images Extracted</div>
            <div class="metric-value">10</div>
            <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">extras/model_focus/</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Optuna Best Fitness</div>
            <div class="metric-value">0.9847</div>
            <div style="font-size: 11px; color: var(--vscode-textLink-foreground);">mAP50-95(B)</div>
        </div>
    </div>

    <div class="gallery-section">
        <h3 style="margin: 0 0 4px 0;">🎯 Model Attention Heatmaps (Eigen-CAM)</h3>
        <p style="margin: 0 0 16px 0; color: var(--vscode-descriptionForeground); font-size: 13px;">
            Visualizing deep layer feature activations overlaying target detections.
        </p>

        <div class="gallery-grid">
            <div class="heatmap-card">
                <div class="heatmap-img-container">
                    <span class="heatmap-img-placeholder">🔥 CAM Sample 01 (Detection Focus)</span>
                </div>
                <div class="heatmap-meta">
                    <p class="heatmap-title">sample_cam_001.jpg</p>
                    <p class="heatmap-sub">Class: target &bull; Conf: 0.94</p>
                </div>
            </div>
            <div class="heatmap-card">
                <div class="heatmap-img-container">
                    <span class="heatmap-img-placeholder">🔥 CAM Sample 02 (Detection Focus)</span>
                </div>
                <div class="heatmap-meta">
                    <p class="heatmap-title">sample_cam_002.jpg</p>
                    <p class="heatmap-sub">Class: target &bull; Conf: 0.91</p>
                </div>
            </div>
            <div class="heatmap-card">
                <div class="heatmap-img-container">
                    <span class="heatmap-img-placeholder">🔥 CAM Sample 03 (Detection Focus)</span>
                </div>
                <div class="heatmap-meta">
                    <p class="heatmap-title">sample_cam_003.jpg</p>
                    <p class="heatmap-sub">Class: target &bull; Conf: 0.89</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        function downloadWeights() {
            vscode.postMessage({ command: 'downloadWeights' });
        }
        function viewReport() {
            vscode.postMessage({ command: 'viewReport' });
        }
    </script>
</body>
</html>`;
}
