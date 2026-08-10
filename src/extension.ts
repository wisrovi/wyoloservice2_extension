import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "neuralforge" is now active!');

	const disposableCluster = vscode.commands.registerCommand('neuralforge.viewClusterStatus', () => {
		vscode.window.showInformationMessage('Cluster Status: Active (1 Manager, 3 Invokers)');
	});

	const disposableLaunch = vscode.commands.registerCommand('neuralforge.launchTraining', () => {
		vscode.window.showInformationMessage('Triggering NeuralForge Training via MCP...');
	});

	const disposableReport = vscode.commands.registerCommand('neuralforge.viewEDAReport', () => {
		vscode.window.showInformationMessage('Opening EDA Report...');
	});

	context.subscriptions.push(disposableCluster, disposableLaunch, disposableReport);
}

// This method is called when your extension is deactivated
export function deactivate() {}
