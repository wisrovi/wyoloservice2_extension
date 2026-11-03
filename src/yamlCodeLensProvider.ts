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
            (text.includes('model:') && text.includes('dataset:'));

        if (!isNeuralForgeYaml) {
            return codeLenses;
        }

        // Extract study_id if present
        let studyId: string | undefined;
        const studyIdMatch = text.match(/study_id:\s*["']?([^"'\r\n]+)["']?/);
        if (studyIdMatch && studyIdMatch[1]) {
            studyId = studyIdMatch[1].trim();
        }

        // Extract study_name if present
        let studyName: string | undefined;
        const studyNameMatch = text.match(/study_name:\s*["']?([^"'\r\n]+)["']?/);
        if (studyNameMatch && studyNameMatch[1]) {
            studyName = studyNameMatch[1].trim();
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
            // Lens 2: View Live Loss Curves
            codeLenses.push(new vscode.CodeLens(range, {
                title: `$(graph) View Status & Curves [${studyId}]`,
                tooltip: `Open real-time SVG loss curves and metrics for ${studyId}`,
                command: "neuralforge.viewMetricsCurves",
                arguments: [studyId]
            }));

            // Lens 3: Tail Real-Time Logs
            codeLenses.push(new vscode.CodeLens(range, {
                title: `$(output) Tail Logs`,
                tooltip: `Stream real-time worker container stdout for ${studyId}`,
                command: "neuralforge.streamLogs",
                arguments: [studyId]
            }));

            // Lens 4: Abort / Cancel Run
            codeLenses.push(new vscode.CodeLens(range, {
                title: `$(stop-circle) Cancel Study`,
                tooltip: `Abort active training task for ${studyId}`,
                command: "neuralforge.cancelStudy",
                arguments: [studyId]
            }));
        }

        // Lens 5: Mini-EDA Preview
        codeLenses.push(new vscode.CodeLens(range, {
            title: "$(eye) Mini-EDA Preview",
            tooltip: "Preview dataset distribution and sample bounding boxes",
            command: "neuralforge.local.previewEDA",
            arguments: [document.uri]
        }));

        // Lens 6: Validate Dataset Splits
        codeLenses.push(new vscode.CodeLens(range, {
            title: "$(check) Validate Dataset Splits",
            tooltip: "Pre-flight verify Samba CIFS or local dataset path and labels",
            command: "neuralforge.validateDataset",
            arguments: [document.uri]
        }));

        return codeLenses;
    }
}
