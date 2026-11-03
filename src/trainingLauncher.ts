import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ClusterApiClient } from './clusterApiClient';
import { LogStreamer } from './logStreamer';
import { openMetricsExplorer } from './metricsExplorer';

export async function submitTrainingFromEditor(context: vscode.ExtensionContext, uri?: vscode.Uri) {
    let filePath = '';

    if (uri && fs.existsSync(uri.fsPath)) {
        filePath = uri.fsPath;
    } else {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.fileName.endsWith('.yaml')) {
            filePath = activeEditor.document.fileName;
        }
    }

    if (!filePath) {
        const picked = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectMany: false,
            filters: { 'YAML Configurations': ['yaml', 'yml'] },
            title: 'Select NeuralForge Training YAML to Submit'
        });
        if (picked && picked.length > 0) {
            filePath = picked[0].fsPath;
        } else {
            return;
        }
    }

    // Read YAML content
    let yamlContent = '';
    try {
        yamlContent = fs.readFileSync(filePath, 'utf-8');
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to read YAML file: ${err.message}`);
        return;
    }

    // Quick parse for worker target or priority
    let defaultWorker = '';
    const workerMatch = yamlContent.match(/(?:target_worker_queue|debug):\s*["']?([^"'\r\n]+)["']?/);
    if (workerMatch && workerMatch[1]) {
        defaultWorker = workerMatch[1].trim();
    }

    const modeChoice = await vscode.window.showQuickPick([
        {
            label: '🚀 Public Cluster Queue (Recommended)',
            description: 'Automatic load-balanced dispatch based on GPU VRAM and priority',
            mode: 'public'
        },
        {
            label: '🎯 Target Specific Worker Node',
            description: defaultWorker ? `Target ${defaultWorker}` : 'Direct execution on specified GPU invoker IP',
            mode: 'private'
        }
    ], { placeHolder: 'Select Cluster Dispatch Mode' });

    if (!modeChoice) {
        return;
    }

    let targetWorker = '';
    if (modeChoice.mode === 'private') {
        const input = await vscode.window.showInputBox({
            prompt: 'Enter target worker IP or hostname (e.g. 192.168.1.40)',
            value: defaultWorker || '192.168.1.40'
        });
        if (!input) {
            return;
        }
        targetWorker = input.trim();
    }

    const priorityChoice = await vscode.window.showQuickPick([
        { label: '⚡ High Priority (gpus_high)', priority: 'high' },
        { label: '⚖️ Medium Priority (gpus_medium)', priority: 'medium' },
        { label: '💤 Low Priority (gpus_low)', priority: 'low' }
    ], { placeHolder: 'Select Queue Priority' });

    const priority = priorityChoice?.priority || 'medium';

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Submitting ${path.basename(filePath)} to NeuralForge Cluster...`,
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 30, message: 'Packaging and uploading YAML payload...' });

        const client = ClusterApiClient.getInstance();
        const res = await client.submitTraining(filePath, yamlContent, {
            mode: modeChoice.mode,
            workerName: targetWorker,
            priority
        });

        if (res.success && res.study_id) {
            const studyId = res.study_id;

            // Automatically inject study_id into the YAML file if not present
            try {
                if (!yamlContent.includes('study_id:')) {
                    const updatedContent = `study_id: "${studyId}"\n` + yamlContent;
                    fs.writeFileSync(filePath, updatedContent, 'utf-8');
                }
            } catch {
                // Ignore file write error
            }

            vscode.window.showInformationMessage(
                `🚀 Training dispatched! Study ID: "${studyId}".`,
                '📜 Stream Live Logs',
                '📈 View Metrics Curves',
                '❌ Cancel Study'
            ).then(action => {
                if (action === '📜 Stream Live Logs') {
                    LogStreamer.getInstance().startStreaming(studyId);
                } else if (action === '📈 View Metrics Curves') {
                    openMetricsExplorer(context, studyId);
                } else if (action === '❌ Cancel Study') {
                    vscode.commands.executeCommand('neuralforge.cancelStudy', studyId);
                }
            });
        } else {
            vscode.window.showErrorMessage(`Failed to launch training: ${res.error || 'Unknown error'}`);
        }
    });
}
