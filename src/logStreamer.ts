import * as vscode from 'vscode';
import { ClusterApiClient } from './clusterApiClient';

export class LogStreamer {
    private static instance: LogStreamer;
    private outputChannel: vscode.OutputChannel;
    private activeInterval: NodeJS.Timeout | null = null;
    private activeStudyId: string | null = null;
    private seenLines: Set<string> = new Set<string>();

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('NeuralForge Training Logs');
    }

    public static getInstance(): LogStreamer {
        if (!LogStreamer.instance) {
            LogStreamer.instance = new LogStreamer();
        }
        return LogStreamer.instance;
    }

    /**
     * Starts live streaming logs for a given study ID.
     */
    public async startStreaming(studyId?: string) {
        if (!studyId) {
            const input = await vscode.window.showInputBox({
                prompt: 'Enter the Study ID to tail live logs (e.g. Test_AREPO_ProtSup_v3)',
                placeHolder: 'Study ID...'
            });
            if (!input) {
                return;
            }
            studyId = input.trim();
        }

        this.stopStreaming();

        this.activeStudyId = studyId;
        this.seenLines.clear();
        this.outputChannel.clear();
        this.outputChannel.show(true);

        this.outputChannel.appendLine(`======================================================================`);
        this.outputChannel.appendLine(`🚀 [NeuralForge Live Log Streamer] Initiated for Study: ${studyId}`);
        this.outputChannel.appendLine(`⏱️ Timestamp: ${new Date().toISOString()}`);
        this.outputChannel.appendLine(`======================================================================\n`);

        vscode.window.showInformationMessage(`Streaming live cluster logs for "${studyId}"...`, 'Stop Streaming').then(action => {
            if (action === 'Stop Streaming') {
                this.stopStreaming();
            }
        });

        // Immediate first poll
        await this.pollLogs();

        // Continuous polling every 2.5 seconds
        this.activeInterval = setInterval(() => {
            this.pollLogs();
        }, 2500);
    }

    /**
     * Stops the active polling interval.
     */
    public stopStreaming() {
        if (this.activeInterval) {
            clearInterval(this.activeInterval);
            this.activeInterval = null;
        }
        if (this.activeStudyId) {
            this.outputChannel.appendLine(`\n🛑 [NeuralForge] Log streaming stopped for ${this.activeStudyId}.`);
            this.activeStudyId = null;
        }
    }

    private async pollLogs() {
        if (!this.activeStudyId) {
            return;
        }

        try {
            const client = ClusterApiClient.getInstance();
            const logs = await client.fetchTaskLogs(this.activeStudyId, 300);

            let newLinesCount = 0;
            for (const line of logs) {
                if (!this.seenLines.has(line)) {
                    this.seenLines.add(line);
                    this.outputChannel.appendLine(line);
                    newLinesCount++;
                }
            }

            // Check if study completed or failed
            for (const line of logs) {
                if (line.includes('TRAINING_COMPLETED_SUCCESSFULLY') || line.includes('STUDY_COMPLETED') || line.includes('Training completed.')) {
                    this.outputChannel.appendLine(`\n✨ [NeuralForge] Study ${this.activeStudyId} has finished successfully!`);
                    this.stopStreaming();
                    break;
                }
                if (line.includes('FATAL_ERROR') || line.includes('TRAINING_FAILED')) {
                    this.outputChannel.appendLine(`\n❌ [NeuralForge] Study ${this.activeStudyId} encountered a fatal error.`);
                    this.stopStreaming();
                    break;
                }
            }
        } catch (err: any) {
            this.outputChannel.appendLine(`[Streamer Warning] Connection error: ${err.message}`);
        }
    }
}
