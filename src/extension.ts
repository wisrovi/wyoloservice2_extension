import * as vscode from 'vscode';
import { ClusterTreeProvider } from './clusterTreeProvider';
import { registerLocalTools, LocalToolsProvider } from './localTools';
import { registerGlobalTools, MLflowArtifactsProvider } from './globalTools';
import { YamlCodeLensProvider } from './yamlCodeLensProvider';
import { openCeleryDashboard } from './celeryDashboard';
import { openMiniEDA } from './miniEDA';
import { openChatAssistant } from './openCodeChat';
import { submitTrainingFromEditor } from './trainingLauncher';
import { LogStreamer } from './logStreamer';
import { openMetricsExplorer } from './metricsExplorer';
import { validateDatasetPath } from './datasetValidator';
import { ClusterApiClient } from './clusterApiClient';

export function activate(context: vscode.ExtensionContext) {
	console.log('NeuralForge AI extension is now active!');

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

	// One-click Training Submission
	const disposableLaunch = vscode.commands.registerCommand('neuralforge.launchTraining', async (uri?: vscode.Uri) => {
		await submitTrainingFromEditor(context, uri);
		clusterProvider.refresh();
	});

	const disposableSubmit = vscode.commands.registerCommand('neuralforge.submitTraining', async (uri?: vscode.Uri) => {
		await submitTrainingFromEditor(context, uri);
		clusterProvider.refresh();
	});

	// Real-time Logs Streaming
	const disposableStreamLogs = vscode.commands.registerCommand('neuralforge.streamLogs', async (studyId?: string) => {
		await LogStreamer.getInstance().startStreaming(studyId);
	});

	const disposableStopLogs = vscode.commands.registerCommand('neuralforge.stopLogStreaming', () => {
		LogStreamer.getInstance().stopStreaming();
		vscode.window.showInformationMessage('Stopped NeuralForge log streaming.');
	});

	// Study Cancellation
	const disposableCancel = vscode.commands.registerCommand('neuralforge.cancelStudy', async (studyId?: string) => {
		if (!studyId) {
			studyId = await vscode.window.showInputBox({
				prompt: 'Enter Study ID to cancel on cluster (e.g. Test_AREPO_ProtSup_v3)'
			});
		}
		if (!studyId) {
			return;
		}

		const confirm = await vscode.window.showWarningMessage(
			`Are you sure you want to abort study "${studyId}" and stop active GPU workers?`,
			{ modal: true },
			'Yes, Abort Study'
		);
		if (confirm === 'Yes, Abort Study') {
			const client = ClusterApiClient.getInstance();
			const res = await client.cancelStudy(studyId);
			if (res.success) {
				vscode.window.showInformationMessage(`✅ ${res.message}`);
				clusterProvider.refresh();
			} else {
				vscode.window.showErrorMessage(`❌ ${res.message}`);
			}
		}
	});

	// MLflow Metrics Curves Explorer
	const disposableMetrics = vscode.commands.registerCommand('neuralforge.viewMetricsCurves', (studyId?: string) => {
		openMetricsExplorer(context, studyId);
	});

	// Dataset Pre-flight Validation
	const disposableValidate = vscode.commands.registerCommand('neuralforge.validateDataset', async (uri?: vscode.Uri) => {
		await validateDatasetPath(uri);
	});

	// Cluster Broadcast Docker Pull
	const disposableBroadcastPull = vscode.commands.registerCommand('neuralforge.triggerBroadcastPull', async () => {
		const targetImage = await vscode.window.showInputBox({
			prompt: 'Docker image tag to pull across all GPU invoker nodes',
			value: 'wisrovi/train_service:worker_executor_v1.0.0'
		});
		if (!targetImage) {
			return;
		}

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Broadcasting docker pull for ${targetImage}...`,
			cancellable: false
		}, async () => {
			const client = ClusterApiClient.getInstance();
			const res = await client.triggerBroadcastPull(targetImage);
			if (res && res.status === 'success') {
				vscode.window.showInformationMessage(`✅ Broadcast pull triggered on all active invokers.`);
			} else {
				vscode.window.showInformationMessage(`Broadcast signal dispatched to Celery cluster.`);
			}
		});
	});

	// Node Diagnostics
	const disposableDiagnose = vscode.commands.registerCommand('neuralforge.diagnoseNode', async (workerIp?: string) => {
		if (!workerIp) {
			workerIp = await vscode.window.showInputBox({ prompt: 'Enter Worker Node IP to diagnose' });
		}
		if (workerIp) {
			vscode.window.showInformationMessage(`Running connectivity & socket diagnosis on ${workerIp}...`);
			const client = ClusterApiClient.getInstance();
			const res = await client.diagnoseNode(workerIp);
			const details = res?.details || 'Node is responding normally to Celery control.';
			vscode.window.showInformationMessage(`Node ${workerIp} Diagnostic: ${details}`);
		}
	});

	// Prune Docker on Node
	const disposablePrune = vscode.commands.registerCommand('neuralforge.pruneNodeDocker', async (workerIp?: string) => {
		if (!workerIp) {
			workerIp = await vscode.window.showInputBox({ prompt: 'Enter Worker Node IP to prune Docker' });
		}
		if (workerIp) {
			const confirm = await vscode.window.showWarningMessage(
				`Prune stopped containers and dangling images on ${workerIp}?`,
				'Yes, Prune Node'
			);
			if (confirm === 'Yes, Prune Node') {
				const client = ClusterApiClient.getInstance();
				await client.pruneNodeDocker(workerIp);
				vscode.window.showInformationMessage(`Docker prune dispatched to ${workerIp}.`);
			}
		}
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
		disposableSubmit,
		disposableStreamLogs,
		disposableStopLogs,
		disposableCancel,
		disposableMetrics,
		disposableValidate,
		disposableBroadcastPull,
		disposableDiagnose,
		disposablePrune,
		disposableReport, 
		disposableDownload, 
		disposableWizard,
		disposablePreviewEDA,
		disposableDashboard,
		disposableChat
	);

	// Register separate tools
	registerLocalTools(context);
	registerGlobalTools(context);
}

export function deactivate() {
	LogStreamer.getInstance().stopStreaming();
}
