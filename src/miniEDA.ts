import * as vscode from 'vscode';

export function openMiniEDA(context: vscode.ExtensionContext, uri: vscode.Uri) {
    const panel = vscode.window.createWebviewPanel(
        'miniEDA',
        `Mini-EDA Preview: ${uri.path.split('/').pop()}`,
        vscode.ViewColumn.Two,
        {}
    );

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini-EDA Visualizer</title>
    <style>
        body { 
            font-family: 'Inter', sans-serif; 
            padding: 20px; 
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            text-align: center;
        }
        .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .img-container {
            border: 2px dashed var(--vscode-focusBorder);
            padding: 10px;
            border-radius: 8px;
            background: var(--vscode-editorWidget-background);
        }
        img { max-width: 100%; height: auto; border-radius: 4px; }
    </style>
</head>
<body>
    <h2>🖼️ Dataset Mini-EDA</h2>
    <p>Previewing configuration for <strong>${uri.path}</strong></p>
    <p><i>(Mockup) In a real scenario, we would parse the YAML, locate local images, and draw bounding boxes here.</i></p>
    <div class="gallery">
        <div class="img-container"><p>Image 1</p></div>
        <div class="img-container"><p>Image 2</p></div>
        <div class="img-container"><p>Image 3</p></div>
    </div>
</body>
</html>`;
}
