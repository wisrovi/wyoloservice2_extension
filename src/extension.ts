import * as vscode from 'vscode';
import { ClusterTreeProvider } from './clusterTreeProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "neuralforge" is now active!');

	const clusterProvider = new ClusterTreeProvider();
	vscode.window.registerTreeDataProvider('neuralforgeCluster', clusterProvider);

	const disposableCluster = vscode.commands.registerCommand('neuralforge.viewClusterStatus', () => {
		clusterProvider.refresh();
		vscode.window.showInformationMessage('Cluster Status refreshed.');
	});

	const disposableLaunch = vscode.commands.registerCommand('neuralforge.launchTraining', () => {
		vscode.window.showInformationMessage('Triggering NeuralForge Training via MCP...');
	});

	const disposableReport = vscode.commands.registerCommand('neuralforge.viewEDAReport', () => {
		vscode.window.showInformationMessage('Opening EDA Report...');
	});

	const disposableDownload = vscode.commands.registerCommand('neuralforge.downloadTrialArtifacts', async () => {
		// Mock logic for downloading artifacts via MCP
		const studyId = await vscode.window.showInputBox({ prompt: 'Enter the NeuralForge Study ID (from the YAML)' });
		if (studyId) {
			vscode.window.showInformationMessage(`Downloading all trial artifacts for study ${studyId} via MCP...`);
			// TODO: Call MCP download_mlflow_study_artifacts tool here
			// Once downloaded, prompt user to save the ZIP file
			vscode.window.showSaveDialog({ filters: { 'ZIP files': ['zip'] }, defaultUri: vscode.Uri.file(`study_artifacts_${studyId}.zip`) }).then(uri => {
				if (uri) {
					vscode.window.showInformationMessage(`Study artifacts saved to ${uri.fsPath}`);
				}
			});
		}
	});

	const disposableWizard = vscode.commands.registerCommand('neuralforge.createConfigWizard', () => {
		const { showYamlWizard } = require('./yamlWizard');
		showYamlWizard(context);
	});

	context.subscriptions.push(disposableCluster, disposableLaunch, disposableReport, disposableDownload, disposableWizard);
}

// This method is called when your extension is deactivated
export function deactivate() {}
