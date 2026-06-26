import * as vscode from 'vscode';
import { SidebarWebviewProvider } from '@/extension/vscode/webviewHost';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';
import { DecorationService } from '@/extension/transactions/decorationService';

export function activate(context: vscode.ExtensionContext): void {
    OutputLogger.initialize();
    OutputLogger.log('AI Diff Agent activating...', 'INFO');

    const decorationService = new DecorationService();

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                decorationService.updateDecorationsForEditor(editor);
            }
        }),
        // Звільнення пам'яті: очищення кешу декорацій при закритті документа
        vscode.workspace.onDidCloseTextDocument(doc => {
            decorationService.clearDecorationsForDocument(doc.uri);
        })
    );

    const sidebarProvider = new SidebarWebviewProvider(context, decorationService);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SidebarWebviewProvider.viewType,
            sidebarProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-diff-agent.action.acceptAll', () => {
            sidebarProvider.router.handleMessage({ type: 'ACTION_SAVE_ALL' });
        }),
        vscode.commands.registerCommand('ai-diff-agent.action.rejectAll', () => {
            sidebarProvider.router.handleMessage({ type: 'ACTION_REVERT_ALL' });
        }),
        vscode.commands.registerCommand('ai-diff-agent.start', () => {
            vscode.commands.executeCommand(`${SidebarWebviewProvider.viewType}.focus`);
        }),
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