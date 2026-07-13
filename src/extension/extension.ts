import * as vscode from 'vscode';
import { SidebarWebviewProvider } from '@/extension/vscode/webviewHost';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';
import { DecorationService } from '@/extension/transactions/services/DecorationService';
import { SnapshotService } from '@/extension/transactions/services/SnapshotService';
import { BlockCodeLensProvider } from '@/extension/vscode/BlockCodeLensProvider'; 
import { SettingsManager } from '@/extension/settings/settingsManager'; 
import { AstParserRegistry } from '@/core/matcher/ast/treeSitterRegistry';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    OutputLogger.initialize();
    OutputLogger.log('AI Diff Agent activating...', 'INFO');

    try {
        const wasmGrammarsPath = vscode.Uri.joinPath(context.extensionUri, 'out', 'extension', 'grammars').fsPath;
        await AstParserRegistry.initialize(wasmGrammarsPath);
        OutputLogger.log(`[AST] Tree-Sitter engine initialized successfully at ${wasmGrammarsPath}`, 'INFO');
    } catch (error) {
        OutputLogger.log(`[AST] Failed to initialize Tree-Sitter engine: ${error}`, 'ERROR');
    }

    const tempSettingsManager = new SettingsManager(context, () => {});

    const config = vscode.workspace.getConfiguration('aiDiffAgent');
    const retentionDays = config.get<number>('workflow.backupRetentionDays') || 7;
    const snapshotService = new SnapshotService(context.globalStorageUri);
    
    const rawData = context.workspaceState.get<any[]>('ai-diff-agent.transactions', []);
    const activeTxIds = new Set<string>(rawData.map(r => r.transactionId).filter(Boolean));
    
    snapshotService.cleanStaleBackups(retentionDays, activeTxIds);

    const decorationService = new DecorationService();

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) decorationService.updateDecorationsForEditor(editor);
        }),
        vscode.workspace.onDidCloseTextDocument(doc => {
            decorationService.clearDecorationsForDocument(doc.uri);
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            decorationService.shiftDecorations(event.document.uri, event.contentChanges);
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

    const codeLensProvider = new BlockCodeLensProvider(decorationService, tempSettingsManager);
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-diff-agent.action.acceptAll', () => {
            sidebarProvider.router.transactionPipeline.saveBatch();
        }),
        vscode.commands.registerCommand('ai-diff-agent.action.rejectAll', () => {
            sidebarProvider.router.transactionPipeline.revertBatch();
        }),
        vscode.commands.registerCommand('ai-diff-agent.start', () => {
            vscode.commands.executeCommand(`${SidebarWebviewProvider.viewType}.focus`);
        }),
        vscode.commands.registerCommand('ai-diff-agent.showLog', () => {
            OutputLogger.show();
        }),
        
        vscode.commands.registerCommand('ai-diff-agent.action.acceptBlock', async (opId: string, uri: vscode.Uri, blockId: string) => {
            await sidebarProvider.router.handleAcceptBlock(opId, uri, blockId);
        }),
        
        vscode.commands.registerCommand('ai-diff-agent.action.rejectBlock', async (opId: string, uri: vscode.Uri, blockId: string) => {
            await sidebarProvider.router.handleRejectBlock(opId, uri, blockId);
        })
    );

    OutputLogger.log('AI Diff Agent activated successfully', 'INFO');
}

export function deactivate(): void {
    OutputLogger.log('AI Diff Agent deactivated', 'INFO');
    AstParserRegistry.dispose();
    OutputLogger.dispose();
}