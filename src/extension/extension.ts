import * as vscode from 'vscode';
import { SidebarWebviewProvider } from './vscode/webviewHost';

/**
 * VS Code Extension Activation Hook.
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('AI Diff Agent (Phase 4) is starting execution...');

    const sidebarProvider = new SidebarWebviewProvider(context);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SidebarWebviewProvider.viewType, 
            sidebarProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { scheme: 'file' }, 
            sidebarProvider.router.getLensProvider()
        )
    );

    // Register Document Change Listener for Conflict Detection
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            sidebarProvider.router.orchestrator.handleDocumentChange(event);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-diff-agent.action.accept', (opId: string) => {
            sidebarProvider.router.acceptOperation(opId);
        }),
        vscode.commands.registerCommand('ai-diff-agent.action.reject', (opId: string) => {
            sidebarProvider.router.rejectOperation(opId);
        }),
        vscode.commands.registerCommand('ai-diff-agent.start', () => {
            vscode.commands.executeCommand(`${SidebarWebviewProvider.viewType}.focus`);
        })
    );
}

export function deactivate(): void {
    console.log('AI Diff Agent deactivated.');
}
