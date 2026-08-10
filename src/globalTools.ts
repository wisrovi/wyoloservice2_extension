import * as vscode from 'vscode';

export function registerGlobalTools(context: vscode.ExtensionContext) {
    // Command 1: View Global MLflow Report
    const viewReportCmd = vscode.commands.registerCommand('neuralforge.global.viewReport', async () => {
        const runId = await vscode.window.showInputBox({ prompt: 'Enter the MLflow Run ID' });
        if (runId) {
            vscode.window.showInformationMessage(`Fetching EDA/Post-Train reports for run ${runId} from MLflow...`);
            // Create a webview panel to display the markdown
            const panel = vscode.window.createWebviewPanel(
                'mlflowReport',
                `Report: ${runId}`,
                vscode.ViewColumn.One,
                {}
            );
            panel.webview.html = `<h1>Report for Run ${runId}</h1><p>Downloading from MLflow API...</p>`;
        }
    });

    // Command 2: Deploy WPipe Scaffolding
    const wpipeScaffoldCmd = vscode.commands.registerCommand('neuralforge.global.wpipeScaffold', () => {
        vscode.window.showInformationMessage('Calling global MCP tool to deploy WPipe scaffolding...');
        // Here we would use MCP wpipe-mcp tool deploy_wpipe_scaffolding
    });

    context.subscriptions.push(viewReportCmd, wpipeScaffoldCmd);
}

export class MLflowArtifactsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            const reportItem = new vscode.TreeItem('Fetch MLflow Report', vscode.TreeItemCollapsibleState.None);
            reportItem.command = { command: 'neuralforge.global.viewReport', title: 'View Report' };
            reportItem.iconPath = new vscode.ThemeIcon('book');

            const wpipeItem = new vscode.TreeItem('Deploy WPipe Scaffolding', vscode.TreeItemCollapsibleState.None);
            wpipeItem.command = { command: 'neuralforge.global.wpipeScaffold', title: 'Deploy WPipe' };
            wpipeItem.iconPath = new vscode.ThemeIcon('rocket');

            return Promise.resolve([reportItem, wpipeItem]);
        }
        return Promise.resolve([]);
    }
}
