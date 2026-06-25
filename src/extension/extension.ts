import * as vscode from 'vscode';
import { SidebarWebviewProvider } from './vscode/webviewHost';
import { VirtualFsProvider } from '../infrastructure/providers/virtualFsProvider';
import { OutputLogger } from '../infrastructure/logging/outputLogger';

/**
 * VS Code Extension Activation Hook.
 */
export function activate(context: vscode.ExtensionContext): void {
    // Fix §3.9 — Initialize output channel immediately on activation
    OutputLogger.initialize();
    OutputLogger.log('AI Diff Agent activating...', 'INFO');

    // Fix §3.3 — Register VirtualFsProvider for ai-diff-agent:// URI scheme
    const virtualFsProvider = new VirtualFsProvider();
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(VirtualFsProvider.scheme, virtualFsProvider)
    );

    const sidebarProvider = new SidebarWebviewProvider(context, virtualFsProvider);

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

    // Accept / Reject per-operation commands (CodeLens)
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-diff-agent.action.accept', (opId: string) => {
            sidebarProvider.router.acceptOperation(opId);
        }),
        vscode.commands.registerCommand('ai-diff-agent.action.reject', (opId: string) => {
            sidebarProvider.router.rejectOperation(opId);
        })
    );

    // Fix §3.2 — Accept All / Reject All batch commands
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-diff-agent.action.acceptAll', () => {
            sidebarProvider.router.handleMessage({ type: 'ACTION_ACCEPT_ALL' });
        }),
        vscode.commands.registerCommand('ai-diff-agent.action.rejectAll', () => {
            sidebarProvider.router.handleMessage({ type: 'ACTION_REJECT_ALL' });
        })
    );

    // Focus chat command
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-diff-agent.start', () => {
            vscode.commands.executeCommand(`${SidebarWebviewProvider.viewType}.focus`);
        })
    );

    // Show output channel command
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-diff-agent.showLog', () => {
            OutputLogger.show();
        })
    );

    OutputLogger.log('AI Diff Agent activated successfully', 'INFO');
}

export function deactivate(): void {
    OutputLogger.log('AI Diff Agent deactivated', 'INFO');
    OutputLogger.dispose();
}
