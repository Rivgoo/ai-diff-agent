import * as vscode from 'vscode';
import type { WebviewEvent, ExtensionEvent } from '@/shared/ipc';
import { ChatSessionManager } from './sessionManager';
import { SettingsManager } from '@/extension/settings/settingsManager';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';
import type { AnyOperation } from '@/core/models/operations';
import { ProcessPayloadUseCase } from '@/extension/use-cases/processPayloadUseCase';
import { SnapshotService } from '@/extension/transactions/services/SnapshotService';
import { PathSandbox } from '@/vscode/workspace/pathSandbox';
import { PathNormalizer } from '@/core/workspace/pathNormalizer';

import { VirtualDocument } from '@/core/compiler/virtualDocument';

import { TransactionPipeline } from '@/extension/transactions/orchestrator/TransactionPipeline';
import { SearchEngine } from '@/core/matcher/searchEngine';
import { ResilientPathResolver } from '@/core/resolver/resilientPathResolver';
import { VsCodeFileSystemAdapter } from '@/infrastructure/adapters/fsTargetAdapter';
import { VsCodeWorkspaceSearchAdapter } from '@/infrastructure/adapters/workspaceSearchAdapter';
import { EditorService } from '@/extension/transactions/services/EditorService';
import { DirectoryCleanupService } from '@/extension/transactions/services/DirectoryCleanupService';
import { LoggerAdapter } from '@/extension/transactions/context/LoggerAdapter';
import { CompensationStore } from '@/extension/transactions/store/CompensationStore';
import type { DecorationService } from '@/extension/transactions/services/DecorationService';
import type { OperationStatusUpdate } from '@/extension/transactions/core/TransactionEvents';

export class MessageRouter {
    private readonly sessionManager: ChatSessionManager;
    private readonly settingsManager: SettingsManager;
    private readonly store: CompensationStore;
    private readonly pendingOperations = new Map<string, AnyOperation>();
    private readonly processPayloadUseCase: ProcessPayloadUseCase;
    private readonly snapshotService: SnapshotService;
    private isProcessingLens = false;

    private statusUpdateQueue: any[] = [];
    private updateTimer: ReturnType<typeof setTimeout> | null = null;

    public readonly transactionPipeline: TransactionPipeline;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly decorationService: DecorationService,
        private readonly postMessageCallback: (event: ExtensionEvent) => void
    ) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri : undefined;

        this.settingsManager = new SettingsManager(context, () => this.syncSettings());
        
        this.sessionManager = new ChatSessionManager(
            context.workspaceState,
            workspaceRoot,
            () => this.settingsManager.getSettings().workflow.chatHistoryMode === 'workspace',
            () => {
                setTimeout(() => this.syncState(), 0);
            }
        );
        
        this.store = new CompensationStore(context.workspaceState);

        const logger = new LoggerAdapter();
        const searchEngine = new SearchEngine();

        const pathResolver = new ResilientPathResolver(new VsCodeFileSystemAdapter(), new VsCodeWorkspaceSearchAdapter());
        const editorService = new EditorService();
        const directoryCleanupService = new DirectoryCleanupService();

        this.snapshotService = new SnapshotService(context.globalStorageUri);

        this.transactionPipeline = new TransactionPipeline(
            this.store,
            this.decorationService,
            searchEngine,
            pathResolver,
            this.snapshotService,
            editorService,
            directoryCleanupService,
            logger,
            this.settingsManager,
            (update: OperationStatusUpdate) => {
                this.sessionManager.updateOperationFromEvent(update);
                
                this.statusUpdateQueue.push(update);

                if (!this.updateTimer) {
                    this.updateTimer = setTimeout(() => {
                        this.flushStatusUpdates();
                    }, 50);
                }
            }
        );

        this.processPayloadUseCase = new ProcessPayloadUseCase(
            this.sessionManager,
            this.transactionPipeline,
            this.pendingOperations,
            this.settingsManager,
            this.postMessageCallback,
            () => this.syncState()
        );
    }

    private flushStatusUpdates(): void {
        this.updateTimer = null;
        if (this.statusUpdateQueue.length === 0) return;

        const batch = [...this.statusUpdateQueue];
        this.statusUpdateQueue = [];

        this.postMessageCallback({
            type: 'OPERATION_BATCH_UPDATED',
            updates: batch
        });
    }

    public handleMessage(event: WebviewEvent): void {
        switch (event.type) {
            case 'REQUEST_STATE_SYNC': this.syncState(); break;
            case 'REQUEST_SETTINGS_SYNC': this.syncSettings(); break;
            case 'UPDATE_SETTING': 
                this.settingsManager.updateSetting(event.category, event.key, event.value);
                if (event.key === 'chatHistoryMode') {
                    this.sessionManager.reload();
                }
                break;
            case 'SUBMIT_PAYLOAD': 
                this.processPayloadUseCase.execute(event.payload); 
                break;
            case 'CANCEL_PROCESSING': 
                // ВИПРАВЛЕННЯ: Екстрене зняття замків при скасуванні
                this.transactionPipeline.emergencyUnlock();
                break;
            case 'NEW_SESSION':
                this.sessionManager.createSession();
                this.syncState();
                break;
            case 'SWITCH_SESSION':
                this.sessionManager.switchSession(event.sessionId);
                this.syncState();
                break;
            case 'DELETE_SESSION':
                this.revertActiveSessionOperations(event.sessionId);
                this.sessionManager.deleteSession(event.sessionId);
                this.transactionPipeline.emergencyUnlock(); // Очищення можливих зависань
                this.syncState();
                break;
            case 'CLEAR_SESSION': 
                this.revertActiveSessionOperations(this.sessionManager.getActiveSessionId());
                this.sessionManager.clearSession();
                this.pendingOperations.clear();
                this.transactionPipeline.emergencyUnlock(); // Очищення можливих зависань
                this.syncState();
                break;
            case 'ACTION_SAVE_ALL': this.transactionPipeline.saveBatch(); break;
            case 'ACTION_REVERT_ALL': this.transactionPipeline.revertBatch(); break;
            case 'ACTION_ACCEPT_OPERATION': this.transactionPipeline.saveOperation(event.operationId); break;
            case 'ACTION_REVERT_OPERATION': this.transactionPipeline.revertOperation(event.operationId); break;
            case 'OPEN_FILE': this.handleOpenFile(event.operationId); break;
            case 'OPEN_DIFF': this.handleOpenDiff(event.operationId); break;
            case 'COPY_PROMPT': this.handleCopyPrompt(event.mode || 'stable'); break; 
            case 'DOWNLOAD_INSTRUCTIONS': this.handleDownloadInstructions(); break;
            case 'SHOW_OUTPUT_LOG': vscode.commands.executeCommand('ai-diff-agent.showLog'); break;
            case 'OPEN_EXTERNAL_LINK': 
                vscode.env.openExternal(vscode.Uri.parse(event.url));
                break;
            case 'SMART_RETRY_CONTEXT': this.handleSmartRetry(event.operationId); break; 
        }
    }

    private async handleSmartRetry(operationId: string): Promise<void> {
        const sessionOp = this.sessionManager.getActiveSession().messages
            .flatMap(m => m.operations || [])
            .find(o => o.id === operationId);

        if (!sessionOp || !sessionOp.conflict) return;

        try {
            const targetPath = sessionOp.path;
            const normalized = PathNormalizer.normalize(targetPath);
            const uri = PathSandbox.validate(normalized);
            
            const doc = await vscode.workspace.openTextDocument(uri);
            const currentContent = doc.getText();

            const conflict = sessionOp.conflict;
            let explanation = '';
            if (conflict.reason === 'AMBIGUOUS_MATCH') {
                explanation = `But this pattern exists multiple times in the file. I don't know which one to replace.`;
            } else if (conflict.reason === 'NOT_FOUND') {
                explanation = `But this pattern was not found. The context may have changed.`;
            } else if (conflict.reason === 'SYNTAX_CORRUPTION_PREVENTED') {
                explanation = `But applying this change would cause a critical syntax error (corruption).`;
            }

            const prompt = `I tried to apply your changes to \`${targetPath}\`, but it failed with: **${conflict.reason}**.

You tried to search for:
\`\`\`
${conflict.searchExcerpt}
\`\`\`

${explanation}

Here is the CURRENT state of the file:
\`\`\`${targetPath.split('.').pop() || 'text'}
${currentContent}
\`\`\`

Please rewrite the \`<update_file>\` block with more specific or correct context lines.`;

            await vscode.env.clipboard.writeText(prompt);
            this.postMessageCallback({ type: 'PROMPT_COPIED' }); 
        } catch (e) {
            OutputLogger.log(`Failed to generate smart retry context: ${e}`, 'ERROR');
        }
    }


    private revertActiveSessionOperations(sessionId: string): void {
        const session = this.sessionManager.getAllSessions()[sessionId];
        if (!session) return;

        const opsToRevert = session.messages
            .flatMap(m => m.operations || [])
            .filter(op => op.status === 'applied_dirty')
            .reverse(); 

        for (const op of opsToRevert) {
            this.transactionPipeline.revertOperation(op.id);
        }
    }

    private syncState(): void {
        this.postMessageCallback({ 
            type: 'STATE_HYDRATE', 
            sessions: this.sessionManager.getAllSessions(),
            activeSessionId: this.sessionManager.getActiveSessionId()
        });
    }

    private syncSettings(): void {
        const settings = this.settingsManager.getSettings();
        this.postMessageCallback({ type: 'SETTINGS_HYDRATE', settings });
    }

    private async handleOpenFile(operationId: string): Promise<void> {
        const rawOp = this.pendingOperations.get(operationId);
        if (!rawOp) return;
        
        try {
            let targetPath = rawOp.path;
            if (rawOp.type === 'move_path') {
                const baseOp = rawOp as any;
                const sessionOp = this.sessionManager.getActiveSession().messages
                    .flatMap(m => m.operations || [])
                    .find(o => o.id === operationId);

                if (sessionOp && (sessionOp.status === 'applied_dirty' || sessionOp.status === 'saved')) {
                    targetPath = baseOp.destinationPath;
                }
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;
            
            const normalized = PathNormalizer.normalize(targetPath);
            const uri = PathSandbox.validate(normalized);
            
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, { preview: false });

            const ranges = this.decorationService.getRangesForOp(operationId);
            if (ranges && ranges.length > 0) {
                editor.revealRange(ranges[0], vscode.TextEditorRevealType.InCenter);
                editor.selection = new vscode.Selection(ranges[0].start, ranges[0].start);
            }
        } catch (e) {
            OutputLogger.log(`Failed to open workspace target: ${e}`, 'ERROR');
        }
    }

    private async handleOpenDiff(operationId: string): Promise<void> {
        const rawOp = this.pendingOperations.get(operationId);
        if (!rawOp) return;

        try {
            let targetPath = rawOp.path;
            if (rawOp.type === 'move_path') {
                const sessionOp = this.sessionManager.getActiveSession().messages
                    .flatMap(m => m.operations || [])
                    .find(o => o.id === operationId);

                if (sessionOp && (sessionOp.status === 'applied_dirty' || sessionOp.status === 'saved')) {
                    targetPath = (rawOp as any).destinationPath;
                }
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;
            
            const normalized = PathNormalizer.normalize(targetPath);
            const targetUri = PathSandbox.validate(normalized);
            
            const backupUri = this.snapshotService.getBackupUri(operationId, normalized);

            try {
                await vscode.workspace.fs.stat(backupUri);
                await vscode.commands.executeCommand('vscode.diff', backupUri, targetUri, `${normalized} (Original ↔ Modified)`);
            } catch {
                if (rawOp.type === 'create_file') {
                    const doc = await vscode.workspace.openTextDocument(targetUri);
                    await vscode.window.showTextDocument(doc, { preview: false });
                } else {
                    OutputLogger.log(`Backup not found for diff: ${backupUri.fsPath}`, 'WARN');
                }
            }
        } catch (e) {
            OutputLogger.log(`Failed to open diff: ${e}`, 'ERROR');
        }
    }

    private async handleCopyPrompt(mode: 'stable' | 'experimental'): Promise<void> {
        try {
            const fileName = mode === 'stable' ? 'prompt-stable.md' : 'prompt-experimental.md';
            const instructionsPath = vscode.Uri.joinPath(this.context.extensionUri, 'resources', fileName);
            
            try {
                const fileBytes = await vscode.workspace.fs.readFile(instructionsPath);
                await vscode.env.clipboard.writeText(new TextDecoder().decode(fileBytes));
                this.postMessageCallback({ type: 'PROMPT_COPIED' });
            } catch {
                const fallbackPath = vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'prompt-instructions.md');
                const fallbackBytes = await vscode.workspace.fs.readFile(fallbackPath);
                await vscode.env.clipboard.writeText(new TextDecoder().decode(fallbackBytes));
                this.postMessageCallback({ type: 'PROMPT_COPIED' });
            }
        } catch (e) {
            OutputLogger.log(`Copy prompt operation failed: ${e}`, 'ERROR');
        }
    }

    private async handleDownloadInstructions(): Promise<void> {
        try {
            const src = vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'prompt-instructions.md');
            const data = await vscode.workspace.fs.readFile(src);
            const dst = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file('AI_Instructions.md') });
            if (dst) {
                await vscode.workspace.fs.writeFile(dst, data);
            }
        } catch (e) {
            // Ignore cancel
        }
    }

    public async handleAcceptBlock(opId: string, uri: vscode.Uri, range: vscode.Range): Promise<void> {
        if (this.isProcessingLens) return; 
        this.isProcessingLens = true;
        try {
            this.decorationService.removeDecorationBlock(uri, opId, range);
            this.checkPartialState(opId, uri);
        } finally {
            this.isProcessingLens = false;
        }
    }

    public async handleRejectBlock(opId: string, uri: vscode.Uri, range: vscode.Range, originalSearch: string): Promise<void> {
        if (this.isProcessingLens) return;
        this.isProcessingLens = true;
        try {
            const sessionOp = this.sessionManager.getActiveSession().messages
                .flatMap(m => m.operations || [])
                .find(o => o.id === opId);

            if (!sessionOp) return;

            const edit = new vscode.WorkspaceEdit();

            if (sessionOp.type === 'create_file') {
                edit.replace(uri, range, ''); 
            } 
            else if (sessionOp.type === 'update_file') {
                const backupUri = this.snapshotService.getBackupUri(opId, PathNormalizer.normalize(uri.fsPath));
                let backupContent = '';
                try {
                    const backupBytes = await vscode.workspace.fs.readFile(backupUri);
                    backupContent = new TextDecoder('utf-8').decode(backupBytes);
                } catch {
                    OutputLogger.log('Backup not found. Cannot perform partial rollback.', 'ERROR');
                    return;
                }

                const engineSettings = this.settingsManager.getSettings().engine;
                const backupDoc = new VirtualDocument(backupUri.fsPath, backupContent);
                const searchEngine = new SearchEngine();
                
                const astSettings = this.settingsManager.getSettings().ast;
                const strictEngineSettings = { ...engineSettings, fallbackMatchLevel: 'none' as const };

                const match = await searchEngine.findMatch(
                    backupDoc, 
                    originalSearch, 
                    undefined, 
                    strictEngineSettings, 
                    astSettings
                );

                if (match.status !== 'MATCHED') {
                     OutputLogger.log(`Failed to locate original text in backup for rollback.`, 'WARN');
                     return;
                }
                
                const originalText = this.extractFullLines(backupContent, match.range.start.line, match.range.end.line);
                edit.replace(uri, range, originalText);
            }

            await vscode.workspace.applyEdit(edit);
            
            this.decorationService.removeDecorationBlock(uri, opId, range);
            this.checkPartialState(opId, uri);

        } catch (e) {
            OutputLogger.log(`Partial rollback failed: ${e}`, 'ERROR');
        } finally {
            this.isProcessingLens = false;
        }
    }

    private checkPartialState(opId: string, uri: vscode.Uri): void {
        const remainingDecorations = this.decorationService.getDecorationsForDocument(uri).filter(d => d.opId === opId);
        
        if (remainingDecorations.length === 0) {
            OutputLogger.log(`All blocks resolved for operation ${opId}. Auto-saving operation state.`);
            this.transactionPipeline.saveOperation(opId);
        } else {
            this.postMessageCallback({
                type: 'OPERATION_UPDATED',
                operationId: opId,
                status: 'applied_dirty',
                isPartiallyResolved: true
            });
        }
    }

    private extractFullLines(text: string, startLine: number, endLine: number): string {
        const lines = text.split(/\r?\n/); 
        const targetLines = lines.slice(startLine, endLine + 1);
        return targetLines.join('\n');
    }
}