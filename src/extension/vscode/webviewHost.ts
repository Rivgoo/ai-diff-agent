import * as vscode from 'vscode';
import { ExtensionEvent, WebviewEvent } from '../../shared/ipc';
import { MessageRouter } from '../chat/messageRouter';

export class SidebarWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ai-diff-agent-sidebar-view';
    private view?: vscode.WebviewView;
    public readonly router: MessageRouter;

    constructor(private readonly context: vscode.ExtensionContext) {
        // Forward context for direct storage and resources folder read accesses
        this.router = new MessageRouter(context, (event: ExtensionEvent) => {
            this.view?.webview.postMessage(event);
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview')
            ]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((message: WebviewEvent) => {
            this.router.handleMessage(message);
        });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'webview.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'webview.css'));
        const nonce = this.getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <link href="${styleUri}" rel="stylesheet">
                <title>AI Agent Chat</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) { text += possible.charAt(Math.floor(Math.random() * possible.length)); }
        return text;
    }
}
