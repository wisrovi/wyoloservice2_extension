import * as vscode from 'vscode';

export class YamlCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        vscode.workspace.onDidChangeConfiguration(() => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();

        // Check if this YAML is a NeuralForge / train_service training descriptor
        const isNeuralForgeYaml = 
            text.includes('study_name:') || 
            text.includes('study_id:') || 
            (text.includes('model:') && (text.includes('train:') || text.includes('data:') || text.includes('type:')));

        if (!isNeuralForgeYaml) {
            return codeLenses;
        }

        // Extract study_id if present
        let studyId: string | undefined;
        const studyIdMatch = text.match(/study_id:\s*["']?([^"'\r\n]+)["']?/);
        if (studyIdMatch && studyIdMatch[1]) {
            studyId = studyIdMatch[1].trim();
        }

        // Find insertion line: top header line (study_name, study_id, or model)
        const headerRegex = new RegExp(`^(study_name|study_id|model):\\s*.*$`, 'm');
        const match = headerRegex.exec(text);
        const targetLine = match ? document.positionAt(match.index).line : 0;
        const range = new vscode.Range(targetLine, 0, targetLine, 0);

        // Lens 1: Launch Training on Cluster
        codeLenses.push(new vscode.CodeLens(range, {
            title: "$(play) Launch Training on Cluster",
            tooltip: "Submit this YAML configuration to the NeuralForge Celery Manager",
            command: "neuralforge.submitTraining",
            arguments: [document.uri]
        }));

        // If study_id exists, show live tracking and monitoring actions
        if (studyId) {
            codeLenses.push(new vscode.CodeLens(range, {
                title: `$(graph) View Status & Curves [${studyId}]`,
                tooltip: `Open real-time SVG loss curves and metrics for ${studyId}`,
                command: "neuralforge.viewMetricsCurves",
                arguments: [studyId]
            }));

            codeLenses.push(new vscode.CodeLens(range, {
                title: `$(output) Tail Logs`,
                tooltip: `Stream real-time worker container stdout for ${studyId}`,
                command: "neuralforge.streamLogs",
                arguments: [studyId]
            }));

            codeLenses.push(new vscode.CodeLens(range, {
                title: `$(stop-circle) Cancel Study`,
                tooltip: `Abort active training task for ${studyId}`,
                command: "neuralforge.cancelStudy",
                arguments: [studyId]
            }));
        }

        // Lens: Target Node Selector (Always available in top header)
        codeLenses.push(new vscode.CodeLens(range, {
            title: "$(server) Select Target Node / GPU",
            tooltip: "Pick destination GPU invoker worker IP from live cluster",
            command: "neuralforge.pickTargetWorkerNode",
            arguments: [document.uri, targetLine]
        }));

        // Lens: Validate Dataset Splits (auto-reads data: path from YAML)
        codeLenses.push(new vscode.CodeLens(range, {
            title: "$(check) Validate Dataset Splits",
            tooltip: "Pre-flight verify Samba CIFS or local dataset path and labels directly from train.data",
            command: "neuralforge.validateDataset",
            arguments: [document.uri]
        }));

        // Specific Lens for 'task:' lines (supporting both task and legacy style)
        const taskRegex = /^([ \t]*(?:task|style):\s*)(["']?)([^"'\r\n]+)\2/gm;
        let taskMatch;
        while ((taskMatch = taskRegex.exec(text)) !== null) {
            const lineNum = document.positionAt(taskMatch.index).line;
            const lineRange = new vscode.Range(lineNum, 0, lineNum, 0);
            const val = taskMatch[3].trim();
            codeLenses.push(new vscode.CodeLens(lineRange, {
                title: `$(symbol-misc) Task: ${val} (Click to Switch)`,
                tooltip: "Switch CV Task (detect, segment, classify, obb, pose) - auto-syncs fitness metric",
                command: "neuralforge.changeTaskStyle",
                arguments: [document.uri]
            }));
        }

        // Specific Lens for 'priority:' lines
        const priorityRegex = /^([ \t]*priority:\s*)(["']?)([^"'\r\n]+)\2/gm;
        let priorityMatch;
        while ((priorityMatch = priorityRegex.exec(text)) !== null) {
            const lineNum = document.positionAt(priorityMatch.index).line;
            const lineRange = new vscode.Range(lineNum, 0, lineNum, 0);
            const val = priorityMatch[3].trim();
            codeLenses.push(new vscode.CodeLens(lineRange, {
                title: `$(flame) Priority: ${val} (Click to Switch)`,
                tooltip: "Toggle Celery priority queue (low | medium | high)",
                command: "neuralforge.changePriority",
                arguments: [document.uri]
            }));
        }

        // Specific Lens for 'fitness:' lines
        const fitnessRegex = /^([ \t]*fitness:\s*)(["']?)([^"'\r\n]+)\2/gm;
        let fitnessMatch;
        while ((fitnessMatch = fitnessRegex.exec(text)) !== null) {
            const lineNum = document.positionAt(fitnessMatch.index).line;
            const lineRange = new vscode.Range(lineNum, 0, lineNum, 0);
            const val = fitnessMatch[3].trim();
            codeLenses.push(new vscode.CodeLens(lineRange, {
                title: `$(graph) Fitness Metric: ${val} (Click to Switch)`,
                tooltip: "Change target fitness optimization metric",
                command: "neuralforge.changeFitnessMetric",
                arguments: [document.uri]
            }));
        }

        // Specific Lens for 'debug' or 'target_worker' lines
        const workerRegex = /^([ \t]*#?[ \t]*(?:target_worker|target_worker_queue|debug):\s*)(["']?)([^"'\r\n]+)\2/gm;
        let workerMatch;
        while ((workerMatch = workerRegex.exec(text)) !== null) {
            const lineNum = document.positionAt(workerMatch.index).line;
            const lineRange = new vscode.Range(lineNum, 0, lineNum, 0);
            const rawKey = workerMatch[1].trim().replace('#', '').replace(':', '').trim();
            const val = workerMatch[3].trim();

            if (rawKey === 'debug') {
                const isIp = /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(val);
                const title = isIp 
                    ? `$(server) Target Invoker IP: ${val} (Click to Switch Node)`
                    : `$(server) Set Target Invoker Node (Debug Mode)`;
                codeLenses.push(new vscode.CodeLens(lineRange, {
                    title,
                    tooltip: "Choose an online GPU invoker node from live cluster for debug execution",
                    command: "neuralforge.pickTargetWorkerNode",
                    arguments: [document.uri, lineNum]
                }));
            } else if (rawKey.includes('target_worker')) {
                codeLenses.push(new vscode.CodeLens(lineRange, {
                    title: `$(server) Target Worker: ${val} (Click to Switch Node)`,
                    tooltip: "Choose another online GPU worker node from cluster",
                    command: "neuralforge.pickTargetWorkerNode",
                    arguments: [document.uri, lineNum]
                }));
            }
        }

        return codeLenses;
    }
}
