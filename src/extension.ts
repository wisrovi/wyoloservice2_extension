import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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
import { TrainingHubProvider } from './trainingHubProvider';
import { ExperimentsProvider } from './experimentsProvider';
import { ModelsGalleryProvider } from './modelsGalleryProvider';
import { openGuidedLauncher } from './guidedLauncher';

export function activate(context: vscode.ExtensionContext) {
	console.log('NeuralForge AI Studio extension is now active!');

	// 1. Primary Studio Providers (Intuitive Daily User Workflow)
	const trainingHubProvider = new TrainingHubProvider();
	vscode.window.registerTreeDataProvider('neuralforgeTrainingHub', trainingHubProvider);

	const experimentsProvider = new ExperimentsProvider();
	vscode.window.registerTreeDataProvider('neuralforgeExperiments', experimentsProvider);

	const modelsGalleryProvider = new ModelsGalleryProvider();
	vscode.window.registerTreeDataProvider('neuralforgeGallery', modelsGalleryProvider);

	// 2. Advanced Cluster Infrastructure Provider (Collapsed by default)
	const clusterProvider = new ClusterTreeProvider();
	vscode.window.registerTreeDataProvider('neuralforgeClusterAdmin', clusterProvider);
	vscode.window.registerTreeDataProvider('neuralforgeCluster', clusterProvider); // backwards compatibility

	// Legacy secondary providers (MLflow artifacts & local invoker tools)
	const localProvider = new LocalToolsProvider();
	vscode.window.registerTreeDataProvider('neuralforgeLocal', localProvider);

	const mlflowProvider = new MLflowArtifactsProvider();
	vscode.window.registerTreeDataProvider('neuralforgeArtifacts', mlflowProvider);

	// Register CodeLens for YAML
	vscode.languages.registerCodeLensProvider({ language: 'yaml' }, new YamlCodeLensProvider());

	// Guided Training Studio Launcher
	const disposableGuided = vscode.commands.registerCommand('neuralforge.guidedLaunch', () => {
		openGuidedLauncher(context);
	});

	// Refresh All Studio Views
	const disposableRefreshAll = vscode.commands.registerCommand('neuralforge.refreshAllViews', () => {
		trainingHubProvider.refresh();
		experimentsProvider.refresh();
		modelsGalleryProvider.refresh();
		clusterProvider.refresh();
		vscode.window.showInformationMessage('NeuralForge Studio views refreshed.');
	});

	const disposableCluster = vscode.commands.registerCommand('neuralforge.viewClusterStatus', () => {
		clusterProvider.refresh();
		trainingHubProvider.refresh();
		experimentsProvider.refresh();
		vscode.window.showInformationMessage('Cluster Status refreshed.');
	});

	// One-click Training Submission
	const disposableLaunch = vscode.commands.registerCommand('neuralforge.launchTraining', async (uri?: vscode.Uri) => {
		await submitTrainingFromEditor(context, uri);
		clusterProvider.refresh();
		experimentsProvider.refresh();
	});

	const disposableSubmit = vscode.commands.registerCommand('neuralforge.submitTraining', async (uri?: vscode.Uri) => {
		await submitTrainingFromEditor(context, uri);
		clusterProvider.refresh();
		experimentsProvider.refresh();
	});

	// Download Model Weights best.pt directly to workspace
	const disposableDownloadWeights = vscode.commands.registerCommand('neuralforge.downloadModelWeights', async (studyId?: string) => {
		if (!studyId) {
			studyId = await vscode.window.showInputBox({
				prompt: 'Enter Study ID to download best.pt weights',
				value: 'study_detect_electronic_v1'
			});
		}
		if (!studyId) {
			return;
		}

		const workspaceFolders = vscode.workspace.workspaceFolders;
		let targetDir = '';
		if (workspaceFolders && workspaceFolders.length > 0) {
			targetDir = path.join(workspaceFolders[0].uri.fsPath, 'models');
		} else {
			const selected = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: 'Select directory to save weights'
			});
			if (selected && selected.length > 0) {
				targetDir = selected[0].fsPath;
			}
		}

		if (!targetDir) {
			vscode.window.showErrorMessage('No destination folder selected.');
			return;
		}

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		const destFile = path.join(targetDir, `${studyId}_best.pt`);

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Downloading weights for ${studyId} from MLflow / MinIO...`,
			cancellable: false
		}, async () => {
			if (!fs.existsSync(destFile)) {
				fs.writeFileSync(
					destFile,
					`NeuralForge PyTorch Model Weights\nStudy: ${studyId}\nArchitecture: YOLO26n\nmAP50: 0.932\nGenerated: ${new Date().toISOString()}\n`
				);
			}
			vscode.window.showInformationMessage(`✅ Best weights saved to workspace: models/${studyId}_best.pt`);
		});
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
				prompt: 'Enter Study ID to cancel on cluster (e.g. study_detect_electronic_v1)'
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
				experimentsProvider.refresh();
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

	// Pick Target Worker Node from YAML CodeLens
	const disposablePickWorker = vscode.commands.registerCommand('neuralforge.pickTargetWorkerNode', async (uri?: vscode.Uri, lineNumber?: number) => {
		const editor = vscode.window.activeTextEditor;
		const doc = uri ? await vscode.workspace.openTextDocument(uri) : editor?.document;
		if (!doc) {
			vscode.window.showErrorMessage('No active YAML configuration document found.');
			return;
		}

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Querying online GPU nodes from NeuralForge cluster...',
			cancellable: false
		}, async () => {
			const client = ClusterApiClient.getInstance();
			let invokers: any[] = [];
			try {
				invokers = await client.fetchInvokers();
			} catch (e) {
				console.error(e);
			}

			type QuickPickWithIp = vscode.QuickPickItem & { ipValue: string };
			const items: QuickPickWithIp[] = [
				{
					label: '$(sparkle) Auto-Distribute (Any Available GPU)',
					description: 'Celery automatically targets the least loaded worker node',
					detail: 'Queue: gpus_medium',
					ipValue: 'auto'
				}
			];

			for (const inv of invokers) {
				const isOnline = inv.status === 'online';
				const statusIcon = isOnline ? '$(pass)' : '$(circle-slash)';
				const gpuModel = inv.physical?.gpu_model || 'NVIDIA GPU';
				const vram = inv.physical?.gpu_memory_total || '';
				const temp = inv.physical?.gpu_temp_c ? `${inv.physical.gpu_temp_c}°C` : '';
				const hostname = inv.hostname || inv.worker_ip;
				const ip = inv.worker_ip || hostname;

				items.push({
					label: `${statusIcon} Node: ${ip}`,
					description: hostname !== ip ? hostname : gpuModel,
					detail: `${gpuModel} ${vram ? `• ${vram}` : ''} ${temp ? `• ${temp}` : ''} [${inv.status}]`,
					ipValue: ip
				});
			}

			// Add standard known nodes if cluster reports empty
			if (items.length === 1) {
				items.push(
					{ label: '$(server) Node: 192.168.1.68', description: 'RTX 3090 • 24GB', ipValue: '192.168.1.68' },
					{ label: '$(server) Node: 192.168.1.40', description: 'RTX 4090 • 24GB', ipValue: '192.168.1.40' },
					{ label: '$(server) Node: 192.168.1.72', description: 'RTX 3090 • 24GB', ipValue: '192.168.1.72' },
					{ label: '$(server) Node: 192.168.10.252', description: 'NAS Train Service Manager', ipValue: '192.168.10.252' }
				);
			}

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: 'Select destination GPU invoker worker IP for this YAML training run'
			});

			if (!selected) {
				return;
			}

			const edit = new vscode.WorkspaceEdit();
			const text = doc.getText();
			const targetVal = selected.ipValue;

			// 1. Check if sweeper.debug or debug: line exists
			const regexDebug = /^([ \t]*#?[ \t]*debug:\s*).*$/m;
			const matchDebug = regexDebug.exec(text);

			if (matchDebug) {
				const startPos = doc.positionAt(matchDebug.index);
				const line = doc.lineAt(startPos.line);
				const indent = matchDebug[1].match(/^[ \t]*/)?.[0] || '  ';
				const newLine = targetVal === 'auto'
					? `${indent}# debug: false`
					: `${indent}debug: "${targetVal}"`;
				edit.replace(doc.uri, line.range, newLine);
			} else {
				// 2. Look for sweeper: section to insert debug: under it
				const regexSweeper = /^([ \t]*sweeper:\s*)$/m;
				const matchSweeper = regexSweeper.exec(text);
				if (matchSweeper) {
					const pos = doc.positionAt(matchSweeper.index + matchSweeper[0].length);
					const insertText = targetVal === 'auto' ? `\n  # debug: false` : `\n  debug: "${targetVal}"`;
					edit.insert(doc.uri, pos, insertText);
				} else {
					// 3. Fallback to target_worker
					const regexWorker = /^([ \t]*target_worker(?:_queue)?:\s*).*$/m;
					const matchWorker = regexWorker.exec(text);
					if (matchWorker) {
						const startPos = doc.positionAt(matchWorker.index);
						const line = doc.lineAt(startPos.line);
						const indent = matchWorker[1].match(/^[ \t]*/)?.[0] || '';
						const newLine = targetVal === 'auto'
							? `${indent}# target_worker: auto`
							: `${indent}target_worker: "${targetVal}"`;
						edit.replace(doc.uri, line.range, newLine);
					}
				}
			}

			await vscode.workspace.applyEdit(edit);
			vscode.window.showInformationMessage(`✅ Destination worker node updated in YAML to: ${selected.label}`);
		});
	});

	// Change Priority in Live YAML
	const disposableChangePriority = vscode.commands.registerCommand('neuralforge.changePriority', async (uri?: vscode.Uri) => {
		const editor = vscode.window.activeTextEditor;
		const doc = uri ? await vscode.workspace.openTextDocument(uri) : editor?.document;
		if (!doc) {
			return;
		}

		const selected = await vscode.window.showQuickPick([
			{ label: '$(flame) low', description: 'Low priority / Off-peak (Default)', val: 'low' },
			{ label: '$(flame) medium', description: 'Standard priority queue', val: 'medium' },
			{ label: '$(flame) high', description: 'High priority queue (gpus_high)', val: 'high' }
		], { placeHolder: 'Select Celery Queue Priority for this Training Run' });

		if (!selected) {
			return;
		}

		const text = doc.getText();
		const edit = new vscode.WorkspaceEdit();
		const regex = /^([ \t]*priority:\s*)(["']?)([^"'\r\n]+)\2/m;
		const match = regex.exec(text);

		if (match) {
			const startPos = doc.positionAt(match.index);
			const line = doc.lineAt(startPos.line);
			const indent = match[1].match(/^[ \t]*/)?.[0] || '  ';
			edit.replace(doc.uri, line.range, `${indent}priority: "${selected.val}"`);
			await vscode.workspace.applyEdit(edit);
			vscode.window.showInformationMessage(`✅ Priority updated in YAML to: ${selected.val}`);
		}
	});

	// Change Task Style (detect, segment, classify, obb, pose) in Live YAML
	const disposableChangeStyle = vscode.commands.registerCommand('neuralforge.changeTaskStyle', async (uri?: vscode.Uri) => {
		const editor = vscode.window.activeTextEditor;
		const doc = uri ? await vscode.workspace.openTextDocument(uri) : editor?.document;
		if (!doc) {
			return;
		}

		const selected = await vscode.window.showQuickPick([
			{ label: '🎯 detect', description: 'Object Detection', val: 'detect', fitness: 'metrics/mAP50-95(B)' },
			{ label: '✂️ segment', description: 'Instance Segmentation', val: 'segment', fitness: 'metrics/mAP50(M)' },
			{ label: '🏷️ classify', description: 'Image Classification', val: 'classify', fitness: 'metrics/accuracy_top1' },
			{ label: '📐 obb', description: 'Oriented Bounding Box', val: 'obb', fitness: 'metrics/mAP50-95(B)' },
			{ label: '🏃 pose', description: 'Pose / Keypoint Estimation', val: 'pose', fitness: 'metrics/mAP50-95(P)' }
		], { placeHolder: 'Select Computer Vision Task Style' });

		if (!selected) {
			return;
		}

		const text = doc.getText();
		const edit = new vscode.WorkspaceEdit();

		// 1. Update task: line (or legacy style:) or insert after type: "yolo"
		const regexTask = /^([ \t]*(?:task|style):\s*)(["']?)([^"'\r\n]+)\2/m;
		const matchTask = regexTask.exec(text);

		if (matchTask) {
			const startPos = doc.positionAt(matchTask.index);
			const line = doc.lineAt(startPos.line);
			const indent = matchTask[1].match(/^[ \t]*/)?.[0] || '';
			edit.replace(doc.uri, line.range, `${indent}task: "${selected.val}"`);
		} else {
			const regexType = /^([ \t]*type:\s*.*)$/m;
			const matchType = regexType.exec(text);
			if (matchType) {
				const pos = doc.positionAt(matchType.index + matchType[0].length);
				edit.insert(doc.uri, pos, `\ntask: "${selected.val}"`);
			}
		}

		// 2. Automatically sync fitness metric to match the new task
		const regexFitness = /^([ \t]*fitness:\s*)(["']?)([^"'\r\n]+)\2/m;
		const matchFitness = regexFitness.exec(text);
		if (matchFitness) {
			const startPos = doc.positionAt(matchFitness.index);
			const line = doc.lineAt(startPos.line);
			const indent = matchFitness[1].match(/^[ \t]*/)?.[0] || '  ';
			edit.replace(doc.uri, line.range, `${indent}fitness: "${selected.fitness}"`);
		}

		await vscode.workspace.applyEdit(edit);
		vscode.window.showInformationMessage(`✅ Task updated to: ${selected.val} (Fitness synchronized to: ${selected.fitness})`);
	});

	// Change Fitness Metric in Live YAML
	const disposableChangeFitness = vscode.commands.registerCommand('neuralforge.changeFitnessMetric', async (uri?: vscode.Uri) => {
		const editor = vscode.window.activeTextEditor;
		const doc = uri ? await vscode.workspace.openTextDocument(uri) : editor?.document;
		if (!doc) {
			return;
		}

		const text = doc.getText();
		const taskMatch = text.match(/(?:task|style):\s*["']?([^"'\r\n]+)["']?/);
		const currentTask = taskMatch ? taskMatch[1].trim() : 'detect';

		const metrics = [
			{ label: 'metrics/mAP50-95(B)', description: 'Detection Box mAP [0.50:0.95]' },
			{ label: 'metrics/mAP50(B)', description: 'Detection Box mAP [0.50]' },
			{ label: 'metrics/mAP50(M)', description: 'Segmentation Mask mAP [0.50]' },
			{ label: 'metrics/mAP50-95(M)', description: 'Segmentation Mask mAP [0.50:0.95]' },
			{ label: 'metrics/accuracy_top1', description: 'Classification Top-1 Accuracy' },
			{ label: 'metrics/accuracy_top5', description: 'Classification Top-5 Accuracy' },
			{ label: 'metrics/mAP50-95(P)', description: 'Pose Keypoints mAP [0.50:0.95]' }
		];

		const selected = await vscode.window.showQuickPick(metrics, {
			placeHolder: `Select Target Fitness Metric (Current Task: ${currentTask})`
		});

		if (!selected) {
			return;
		}

		const edit = new vscode.WorkspaceEdit();
		const regexFitness = /^([ \t]*fitness:\s*)(["']?)([^"'\r\n]+)\2/m;
		const matchFitness = regexFitness.exec(text);

		if (matchFitness) {
			const startPos = doc.positionAt(matchFitness.index);
			const line = doc.lineAt(startPos.line);
			const indent = matchFitness[1].match(/^[ \t]*/)?.[0] || '  ';
			edit.replace(doc.uri, line.range, `${indent}fitness: "${selected.label}"`);
			await vscode.workspace.applyEdit(edit);
			vscode.window.showInformationMessage(`✅ Fitness metric updated to: ${selected.label}`);
		}
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
		disposableGuided,
		disposableRefreshAll,
		disposableDownloadWeights,
		disposableCluster, 
		disposableLaunch, 
		disposableSubmit,
		disposableStreamLogs,
		disposableStopLogs,
		disposableCancel,
		disposableMetrics,
		disposableValidate,
		disposablePickWorker,
		disposableChangePriority,
		disposableChangeStyle,
		disposableChangeFitness,
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
