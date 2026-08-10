import * as vscode from 'vscode';
import * as cp from 'child_process';

export function registerLocalTools(context: vscode.ExtensionContext) {
    // Command 1: View Local Invoker Logs
    const viewLogsCmd = vscode.commands.registerCommand('neuralforge.local.viewLogs', () => {
        const terminal = vscode.window.createTerminal('NeuralForge Local Logs');
        terminal.show();
        // Assuming celery logs or docker logs
        terminal.sendText('echo "Streaming local invoker logs..."');
        terminal.sendText('tail -f /var/log/celery/worker.log || echo "No Celery log found. Try docker logs."');
    });

    // Command 2: Run Local E2E Test
    const runTestCmd = vscode.commands.registerCommand('neuralforge.local.runTest', () => {
        vscode.window.showInformationMessage('Starting Local E2E Test for Invoker...');
        const terminal = vscode.window.createTerminal('NeuralForge Local Test');
        terminal.show();
        terminal.sendText('DOCKER_BUILDKIT=0 docker build --no-cache -t wisrovi/train_service:worker_executor_v1.0.0 -f Dockerfile .');
        terminal.sendText('python send_task.py');
    });

    context.subscriptions.push(viewLogsCmd, runTestCmd);
}

export class LocalToolsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            const logsItem = new vscode.TreeItem('View Live Logs', vscode.TreeItemCollapsibleState.None);
            logsItem.command = { command: 'neuralforge.local.viewLogs', title: 'View Logs' };
            logsItem.iconPath = new vscode.ThemeIcon('terminal');

            const testItem = new vscode.TreeItem('Run Local E2E Test', vscode.TreeItemCollapsibleState.None);
            testItem.command = { command: 'neuralforge.local.runTest', title: 'Run Test' };
            testItem.iconPath = new vscode.ThemeIcon('beaker');

            return Promise.resolve([logsItem, testItem]);
        }
        return Promise.resolve([]);
    }
}
