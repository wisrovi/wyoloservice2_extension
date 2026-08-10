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

	const disposableDownload = vscode.commands.registerCommand('neuralforge.downloadTrialArtifacts', async () => {
		// Mock logic for downloading artifacts via MCP
		const runId = await vscode.window.showInputBox({ prompt: 'Enter the MLflow Run ID' });
		if (runId) {
			vscode.window.showInformationMessage(`Downloading artifacts for trial ${runId} via MCP...`);
			// TODO: Call MCP download_mlflow_trial_artifacts tool here
			// Once downloaded, prompt user to save the ZIP file
			vscode.window.showSaveDialog({ filters: { 'ZIP files': ['zip'] }, defaultUri: vscode.Uri.file(`artifacts_${runId}.zip`) }).then(uri => {
				if (uri) {
					vscode.window.showInformationMessage(`Artifacts saved to ${uri.fsPath}`);
				}
			});
		}
	});

	context.subscriptions.push(disposableCluster, disposableLaunch, disposableReport, disposableDownload);
}

// This method is called when your extension is deactivated
export function deactivate() {}
