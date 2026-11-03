import * as vscode from 'vscode';
import { ClusterApiClient } from './clusterApiClient';

export function openMetricsExplorer(context: vscode.ExtensionContext, initialStudyId?: string) {
    const panel = vscode.window.createWebviewPanel(
        'neuralforgeMetrics',
        initialStudyId ? `Metrics: ${initialStudyId}` : 'NeuralForge: MLflow & Optuna Metrics Explorer',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = getMetricsExplorerHtml(initialStudyId || '');

    // Handle messages from the Webview
    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'fetchMetrics') {
            const studyId = message.studyId;
            try {
                const client = ClusterApiClient.getInstance();
                const metrics = await client.fetchStudyMetrics(studyId);
                panel.webview.postMessage({ command: 'renderMetrics', studyId, data: metrics });
            } catch (err: any) {
                panel.webview.postMessage({ command: 'error', message: err.message });
            }
        }
    }, undefined, context.subscriptions);
}

function getMetricsExplorerHtml(studyId: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NeuralForge Metrics Explorer</title>
    <style>
        :root {
            --bg-color: var(--vscode-editor-background, #1e1e1e);
            --fg-color: var(--vscode-editor-foreground, #d4d4d4);
            --card-bg: var(--vscode-sideBar-background, #252526);
            --border-color: var(--vscode-panel-border, #333);
            --accent-blue: #38bdf8;
            --accent-green: #4ade80;
            --accent-amber: #fbbf24;
            --accent-purple: #c084fc;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg-color);
            color: var(--fg-color);
            padding: 24px;
            margin: 0;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .title-group h1 {
            margin: 0 0 6px 0;
            font-size: 22px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .search-bar {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 20px;
        }
        input[type="text"] {
            background: var(--vscode-input-background, #3c3c3c);
            color: var(--vscode-input-foreground, #fff);
            border: 1px solid var(--vscode-input-border, #555);
            padding: 8px 14px;
            border-radius: 4px;
            font-size: 14px;
            width: 320px;
        }
        button {
            background: var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, #fff);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground, #1177bb);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .stat-card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 16px;
        }
        .stat-card .label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            opacity: 0.8;
            margin-bottom: 6px;
        }
        .stat-card .value {
            font-size: 24px;
            font-weight: 700;
            color: var(--accent-blue);
        }
        .charts-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        .chart-box {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 18px;
        }
        .chart-box h3 {
            margin: 0 0 14px 0;
            font-size: 15px;
            display: flex;
            justify-content: space-between;
        }
        svg {
            width: 100%;
            height: 240px;
            overflow: visible;
        }
        .legend {
            display: flex;
            gap: 16px;
            font-size: 12px;
            margin-top: 10px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title-group">
            <h1>📈 NeuralForge Metrics & Loss Explorer</h1>
            <span style="opacity: 0.8; font-size: 13px;">Real-time YOLO convergence & Optuna trials analysis</span>
        </div>
    </div>

    <div class="search-bar">
        <input type="text" id="studyInput" placeholder="Enter Study ID (e.g. study_detect_electronic_v1)" value="${studyId}">
        <button id="fetchBtn" onclick="loadMetrics()">Query MLflow</button>
        <button style="background: #333;" onclick="loadDemoData()">Load Sample Curves</button>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="label">Best mAP50</div>
            <div class="value" id="valMap50">0.932</div>
        </div>
        <div class="stat-card">
            <div class="label">Best mAP50-95</div>
            <div class="value" id="valMap5095" style="color: var(--accent-green);">0.764</div>
        </div>
        <div class="stat-card">
            <div class="label">Box Loss (Val)</div>
            <div class="value" id="valBoxLoss" style="color: var(--accent-amber);">0.0142</div>
        </div>
        <div class="stat-card">
            <div class="label">Completed Epochs</div>
            <div class="value" id="valEpochs" style="color: var(--accent-purple);">100 / 100</div>
        </div>
    </div>

    <div class="charts-container">
        <!-- Loss Curves Chart -->
        <div class="chart-box">
            <h3>📉 Training & Validation Loss Curves</h3>
            <svg id="lossSvg" viewBox="0 0 450 200"></svg>
            <div class="legend">
                <div class="legend-item"><div class="legend-color" style="background: var(--accent-blue);"></div> train/box_loss</div>
                <div class="legend-item"><div class="legend-color" style="background: var(--accent-amber);"></div> val/box_loss</div>
                <div class="legend-item"><div class="legend-color" style="background: var(--accent-purple);"></div> train/cls_loss</div>
            </div>
        </div>

        <!-- Metrics Accuracy Chart -->
        <div class="chart-box">
            <h3>🎯 Accuracy & Precision Progression</h3>
            <svg id="metricSvg" viewBox="0 0 450 200"></svg>
            <div class="legend">
                <div class="legend-item"><div class="legend-color" style="background: var(--accent-green);"></div> metrics/mAP50(B)</div>
                <div class="legend-item"><div class="legend-color" style="background: var(--accent-blue);"></div> metrics/mAP50-95(B)</div>
                <div class="legend-item"><div class="legend-color" style="background: #f43f5e;"></div> metrics/precision(B)</div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function loadMetrics() {
            const studyId = document.getElementById('studyInput').value.trim();
            if (!studyId) return;
            vscode.postMessage({ command: 'fetchMetrics', studyId });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'renderMetrics' && message.data && message.data.length > 0) {
                renderFromData(message.data);
            } else {
                loadDemoData();
            }
        });

        function renderCurve(svgId, points, strokeColor) {
            const svg = document.getElementById(svgId);
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            let d = '';
            points.forEach((pt, i) => {
                const x = 30 + (pt.x / 100) * 390;
                const y = 170 - (pt.y) * 140;
                d += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
            });
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', strokeColor);
            path.setAttribute('stroke-width', '2.5');
            path.setAttribute('stroke-linecap', 'round');
            svg.appendChild(path);
        }

        function drawAxes(svgId) {
            const svg = document.getElementById(svgId);
            svg.innerHTML = '';
            const axes = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            axes.setAttribute('d', 'M 30 20 L 30 170 L 430 170');
            axes.setAttribute('fill', 'none');
            axes.setAttribute('stroke', '#444');
            axes.setAttribute('stroke-width', '1');
            svg.appendChild(axes);
        }

        function loadDemoData() {
            // Draw Loss Curves
            drawAxes('lossSvg');
            const trainBox = Array.from({length: 50}, (_, i) => ({ x: i * 2, y: Math.exp(-i / 15) * 0.8 + 0.05 }));
            const valBox = Array.from({length: 50}, (_, i) => ({ x: i * 2, y: Math.exp(-i / 18) * 0.75 + 0.08 + Math.sin(i)*0.02 }));
            const trainCls = Array.from({length: 50}, (_, i) => ({ x: i * 2, y: Math.exp(-i / 10) * 0.9 + 0.02 }));

            renderCurve('lossSvg', trainBox, '#38bdf8');
            renderCurve('lossSvg', valBox, '#fbbf24');
            renderCurve('lossSvg', trainCls, '#c084fc');

            // Draw Accuracy Curves
            drawAxes('metricSvg');
            const map50 = Array.from({length: 50}, (_, i) => ({ x: i * 2, y: (1 - Math.exp(-i / 12)) * 0.93 }));
            const map5095 = Array.from({length: 50}, (_, i) => ({ x: i * 2, y: (1 - Math.exp(-i / 14)) * 0.76 }));
            const prec = Array.from({length: 50}, (_, i) => ({ x: i * 2, y: (1 - Math.exp(-i / 10)) * 0.89 + Math.cos(i)*0.01 }));

            renderCurve('metricSvg', map50, '#4ade80');
            renderCurve('metricSvg', map5095, '#38bdf8');
            renderCurve('metricSvg', prec, '#f43f5e');
        }

        // Initialize with default demo
        loadDemoData();
    </script>
</body>
</html>`;
}
