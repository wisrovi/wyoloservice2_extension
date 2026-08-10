import * as vscode from 'vscode';

export function openCeleryDashboard(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'celeryDashboard',
        'Celery Task Manager',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Celery Mission Control</title>
    <style>
        body { 
            font-family: 'Inter', sans-serif; 
            padding: 20px; 
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        h2 { border-bottom: 2px solid var(--vscode-focusBorder); padding-bottom: 10px; }
        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 20px;
        }
        .card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .card h3 { margin-top: 0; color: var(--vscode-textLink-foreground); }
        .status-active { color: var(--vscode-testing-iconPassed); font-weight: bold; }
        .btn-cancel {
            background: var(--vscode-testing-iconFailed);
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
            font-weight: bold;
        }
        .btn-cancel:hover { opacity: 0.8; }
    </style>
</head>
<body>
    <h2>🚀 Celery Mission Control (NeuralForge)</h2>
    <div class="dashboard-grid">
        <div class="card">
            <h3>Worker Status</h3>
            <p>Node: <strong>celery@NAS_Train_service (Manager)</strong></p>
            <p>Status: <span class="status-active">Online</span></p>
            <p>Active Invokers: 2</p>
        </div>
        <div class="card">
            <h3>Active Studies</h3>
            <p>Study: <strong>arepo_cicatrices</strong></p>
            <p>Progress: Trial 2 of 3</p>
            <p>ETA: 45 mins</p>
            <button class="btn-cancel" onclick="cancel()">Stop Study (Cancel MCP)</button>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        function cancel() {
            vscode.postMessage({ command: 'cancelStudy' });
        }
    </script>
</body>
</html>`;

    panel.webview.onDidReceiveMessage(
        message => {
            if (message.command === 'cancelStudy') {
                vscode.window.showWarningMessage('Invoking cancel_study MCP tool to abort training globally!');
            }
        },
        undefined,
        context.subscriptions
    );
}
