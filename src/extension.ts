import * as vscode from 'vscode';
import { ClusterTreeProvider } from './clusterTreeProvider';
import { registerLocalTools, LocalToolsProvider } from './localTools';
import { registerGlobalTools, MLflowArtifactsProvider } from './globalTools';
import { YamlCodeLensProvider } from './yamlCodeLensProvider';
import { openCeleryDashboard } from './celeryDashboard';
import { openMiniEDA } from './miniEDA';
import { openChatAssistant } from './openCodeChat';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "neuralforge" is now active!');

	// Register Global Cluster Status
	const clusterProvider = new ClusterTreeProvider();
	vscode.window.registerTreeDataProvider('neuralforgeCluster', clusterProvider);

	// Register Local Tools View
	const localProvider = new LocalToolsProvider();
	vscode.window.registerTreeDataProvider('neuralforgeLocal', localProvider);

	// Register MLflow Global Artifacts View
	const mlflowProvider = new MLflowArtifactsProvider();
	vscode.window.registerTreeDataProvider('neuralforgeArtifacts', mlflowProvider);

	// Register CodeLens for YAML
	vscode.languages.registerCodeLensProvider({ language: 'yaml' }, new YamlCodeLensProvider());

	const disposableCluster = vscode.commands.registerCommand('neuralforge.viewClusterStatus', () => {
		clusterProvider.refresh();
		vscode.window.showInformationMessage('Cluster Status refreshed.');
	});

	const disposableLaunch = vscode.commands.registerCommand('neuralforge.launchTraining', (uri?: vscode.Uri) => {
		const target = uri ? uri.fsPath : 'current config';
		vscode.window.showInformationMessage(`Triggering NeuralForge Training via MCP for ${target}...`);
	});

	const disposableReport = vscode.commands.registerCommand('neuralforge.viewEDAReport', () => {
		vscode.window.showInformationMessage('Opening EDA Report...');
	});

	const disposableDownload = vscode.commands.registerCommand('neuralforge.downloadTrialArtifacts', async () => {
		const studyId = await vscode.window.showInputBox({ prompt: 'Enter the NeuralForge Study ID (from the YAML)' });
		if (studyId) {
			vscode.window.showInformationMessage(`Downloading all trial artifacts for study ${studyId} via MCP...`);
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

	// New Commands
	const disposablePreviewEDA = vscode.commands.registerCommand('neuralforge.local.previewEDA', (uri?: vscode.Uri) => {
		if (uri) {
			openMiniEDA(context, uri);
		} else {
			vscode.window.showWarningMessage('Please run this command from a YAML file (e.g. via CodeLens).');
		}
	});

	const disposableDashboard = vscode.commands.registerCommand('neuralforge.global.celeryDashboard', () => {
		openCeleryDashboard(context);
	});

	const disposableChat = vscode.commands.registerCommand('neuralforge.global.openCodeChat', () => {
		openChatAssistant(context);
	});

	context.subscriptions.push(
		disposableCluster, 
		disposableLaunch, 
		disposableReport, 
		disposableDownload, 
		disposableWizard,
		disposablePreviewEDA,
		disposableDashboard,
		disposableChat
	);

	// Register our new separated logic
	registerLocalTools(context);
	registerGlobalTools(context);
}

export function deactivate() {}

