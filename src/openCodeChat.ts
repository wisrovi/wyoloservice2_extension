import * as vscode from 'vscode';

export function openChatAssistant(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'openCodeChat',
        'OpenCode Assistant',
        vscode.ViewColumn.Two,
        { enableScripts: true }
    );

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenCode Chat</title>
    <style>
        body { 
            font-family: 'Inter', sans-serif; 
            padding: 0; 
            margin: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .chat-container {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
        }
        .message {
            margin-bottom: 15px;
            padding: 10px 15px;
            border-radius: 8px;
            max-width: 80%;
        }
        .user { background: var(--vscode-button-background); color: var(--vscode-button-foreground); align-self: flex-end; margin-left: auto; }
        .assistant { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border); }
        .input-area {
            padding: 15px;
            border-top: 1px solid var(--vscode-widget-border);
            display: flex;
            gap: 10px;
        }
        input {
            flex: 1;
            padding: 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
        }
        button {
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="chat-container" id="chat">
        <div class="message assistant">
            🤖 <strong>OpenCode:</strong> Hola, soy tu asistente de post-entrenamiento. Puedo analizar los reportes de MLflow y explicarte por qué falló un trial o cómo mejorar tus hiperparámetros. ¿Qué necesitas?
        </div>
    </div>
    <div class="input-area">
        <input type="text" id="userInput" placeholder="Ask about your YOLO study...">
        <button onclick="send()">Send</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const chat = document.getElementById('chat');
        const input = document.getElementById('userInput');

        function send() {
            const text = input.value;
            if (!text) return;
            
            // Add user message
            chat.innerHTML += '<div class="message user">' + text + '</div>';
            input.value = '';
            
            // Send to extension
            vscode.postMessage({ command: 'askLLM', text: text });
            
            // Auto-scroll
            chat.scrollTop = chat.scrollHeight;
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'reply') {
                chat.innerHTML += '<div class="message assistant">🤖 <strong>OpenCode:</strong> ' + message.text + '</div>';
                chat.scrollTop = chat.scrollHeight;
            }
        });
    </script>
</body>
</html>`;

    panel.webview.onDidReceiveMessage(
        message => {
            if (message.command === 'askLLM') {
                // Mock delay
                setTimeout(() => {
                    panel.webview.postMessage({ 
                        command: 'reply', 
                        text: `Analyzing your question: "${message.text}". According to the MLflow logs, the mAP collapsed because the learning rate was too high (LR Max = 0.01) causing divergence in the box loss.`
                    });
                }, 1000);
            }
        },
        undefined,
        context.subscriptions
    );
}
