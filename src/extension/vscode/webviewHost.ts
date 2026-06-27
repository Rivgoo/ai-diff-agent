import * as vscode from 'vscode';
import type { ExtensionEvent, WebviewEvent } from '@/shared/ipc';
import { MessageRouter } from '@/extension/chat/messageRouter';
import { DecorationService } from '@/extension/transactions/services/DecorationService';

export class SidebarWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ai-diff-agent-sidebar-view';
    private _view?: vscode.WebviewView;
    public readonly router: MessageRouter;

    constructor(
        private readonly context: vscode.ExtensionContext,
        decorationService: DecorationService
    ) {
        this.router = new MessageRouter(context, decorationService, (event) => {
            this.postMessage(event);
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((data: WebviewEvent) => {
            this.router.handleMessage(data);
        });
    }

    public postMessage(event: ExtensionEvent): void {
        if (this._view) {
            this._view.webview.postMessage(event);
        }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'webview.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'webview.css')
        );
        const nonce = this.getNonce();
        
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <link href="${styleUri}" rel="stylesheet">
                <title>AI Agent</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private getNonce(): string {
        let text = '';
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return text;
    }
}
