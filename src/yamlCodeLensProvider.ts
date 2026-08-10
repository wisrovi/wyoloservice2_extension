import * as vscode from 'vscode';

export class YamlCodeLensProvider implements vscode.CodeLensProvider {
    // Fire event to update lenses if needed
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        const regex = new RegExp(`^model:\\s*["']?.*["']?`, 'gm');
        const text = document.getText();
        let matches;

        while ((matches = regex.exec(text)) !== null) {
            const line = document.lineAt(document.positionAt(matches.index).line);
            const indexOf = line.text.indexOf(matches[0]);
            const position = new vscode.Position(line.lineNumber, indexOf);
            const range = document.getWordRangeAtPosition(position, new RegExp(`^model:\\s*["']?.*["']?`));
            
            if (range) {
                // Lens 1: Launch Training
                const launchCmd: vscode.Command = {
                    title: "$(play) Launch NeuralForge Training",
                    tooltip: "Send this configuration to the Celery Manager",
                    command: "neuralforge.launchTraining",
                    arguments: [document.uri]
                };
                codeLenses.push(new vscode.CodeLens(range, launchCmd));

                // Lens 2: Preview Config / EDA
                const previewCmd: vscode.Command = {
                    title: "$(graph) Mini-EDA Preview",
                    tooltip: "Preview Dataset & Bounding Boxes",
                    command: "neuralforge.local.previewEDA",
                    arguments: [document.uri]
                };
                codeLenses.push(new vscode.CodeLens(range, previewCmd));
            }
        }
        return codeLenses;
    }
}
