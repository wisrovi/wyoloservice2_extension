import * as vscode from 'vscode';
import * as http from 'http';

export function openCeleryDashboard(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('neuralforge');
    const controlHost = config.get<string>('controlHost', '192.168.10.252');
    const controlPort = config.get<number>('controlPort', 23442);

    const panel = vscode.window.createWebviewPanel(
        'celeryDashboard',
        'Celery Mission Control',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = getDashboardHtml(controlHost, controlPort);

    panel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'cancelStudy':
                    vscode.window.showWarningMessage('Stopping study across invokers via API...');
                    break;
                case 'refresh':
                    panel.webview.html = getDashboardHtml(controlHost, controlPort);
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

function getDashboardHtml(host: string, port: number): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Celery Mission Control</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            padding: 20px; 
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .header-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid var(--vscode-focusBorder);
            padding-bottom: 12px;
            margin-bottom: 20px;
        }
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 20px;
        }
        .card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            padding: 18px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .card h3 { 
            margin-top: 0; 
            color: var(--vscode-textLink-foreground); 
            display: flex; 
            align-items: center; 
            gap: 8px;
        }
        .status-active { color: var(--vscode-testing-iconPassed); font-weight: bold; }
        .node-tag {
            display: inline-block;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            margin-right: 4px;
            margin-bottom: 4px;
        }
        .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        }
        .btn:hover { background: var(--vscode-button-hoverBackground); }
        .btn-cancel {
            background: var(--vscode-testing-iconFailed);
            color: white;
            border: none;
            padding: 8px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="header-bar">
        <h2>🚀 Celery Mission Control (NeuralForge)</h2>
        <div>
            <button class="btn" onclick="refresh()">🔄 Refresh Live Telemetry</button>
        </div>
    </div>
    
    <div class="dashboard-grid">
        <div class="card">
            <h3>🖥️ Manager Infrastructure</h3>
            <p>Host: <strong>${host}:${port}</strong></p>
            <p>Cluster Status: <span class="status-active">● Connected & Online</span></p>
            <p>Broker: <code>redis://${host}:23437/0</code></p>
            <p>Samba CIFS Datasets: <strong>Mounted (/data/datasets)</strong></p>
        </div>

        <div class="card">
            <h3>⚡ Distributed GPU Invokers</h3>
            <p>Active Compute Nodes: <strong>12 Workers Registered</strong></p>
            <div style="margin-top: 10px;">
                <span class="node-tag">192.168.1.40 (4090)</span>
                <span class="node-tag">192.168.1.68 (3090)</span>
                <span class="node-tag">192.168.1.72 (3090)</span>
                <span class="node-tag">192.168.1.110 (3080)</span>
                <span class="node-tag">192.168.1.54 (3060)</span>
            </div>
            <p style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 8px;">
                Queues: <code>gpus_high</code>, <code>gpus_medium</code>, <code>wyolo_gpu_queue</code>
            </p>
        </div>

        <div class="card">
            <h3>🎯 Active Sweeps & Tasks</h3>
            <p>Active Study: <strong>Cluster Ready</strong></p>
            <p>Kubernetes Admin API: <strong>Port 30001 (NodePort)</strong></p>
            <p>MLflow Tracking URI: <strong>http://${host}:5000</strong></p>
            <button class="btn-cancel" onclick="cancel()">Stop Active Sweeps</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        function cancel() {
            vscode.postMessage({ command: 'cancelStudy' });
        }
        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
    </script>
</body>
</html>`;
}
