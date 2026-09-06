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
import { VirtualConflictProvider } from '@/extension/vscode/VirtualConflictProvider';
import { ClipboardObserverService } from '@/extension/services/ClipboardObserverService';

export class MessageRouter {
    private readonly sessionManager: ChatSessionManager;
    private readonly settingsManager: SettingsManager;
    private readonly store: CompensationStore;
    private readonly pendingOperations = new Map<string, AnyOperation>();
    private readonly processPayloadUseCase: ProcessPayloadUseCase;
    private readonly snapshotService: SnapshotService;
    
    private isProcessingLens = false;
    private isWalkthroughActive = false; 
    private activeAbortController: AbortController | null = null;

    private statusUpdateQueue: any[] = [];
    private updateTimer: NodeJS.Timeout | null = null;

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

        const pathResolver = new ResilientPathResolver(
            new VsCodeFileSystemAdapter(() => this.settingsManager.getSettings().engine), 
            new VsCodeWorkspaceSearchAdapter()
        );
        
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
            },
            () => {
                this.isWalkthroughActive = false;
                this.postMessageCallback({ type: 'WALKTHROUGH_COMPLETED' });
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

        const clipboardObserver = new ClipboardObserverService(
            this.settingsManager,
            (payload) => this.handleClipboardPayload(payload)
        );
        this.context.subscriptions.push(clipboardObserver);

        this.decorationService.onDidManualModifyBlock(({ uri, opId, blockId }) => {
            OutputLogger.log(`[Manual Override] User manually edited or reverted block ${blockId} in ${uri.fsPath}. Handing over control.`);
            this.checkPartialState(opId, uri);
        });
    }

    private handleClipboardPayload(payload: string): void {
        vscode.commands.executeCommand('ai-diff-agent.start');
        
        if (this.activeAbortController) {
            this.activeAbortController.abort();
        }
        
        this.activeAbortController = new AbortController();
        this.processPayloadUseCase.execute(payload, this.activeAbortController.signal);
    }

    public getPendingOperation(opId: string): AnyOperation | undefined {
        return this.pendingOperations.get(opId);
    }

    private flushStatusUpdates(): void {
        this.updateTimer = null;
        if (this.statusUpdateQueue.length === 0) return;
        const batch = [...this.statusUpdateQueue];
        this.statusUpdateQueue = [];
        this.postMessageCallback({ type: 'OPERATION_BATCH_UPDATED', updates: batch });
        
        this.syncHistory();
    }

    public handleMessage(event: WebviewEvent): void {
        switch (event.type) {
            case 'REQUEST_STATE_SYNC': this.syncState(); break;
            case 'REQUEST_SETTINGS_SYNC': this.syncSettings(); break;
            case 'REQUEST_HISTORY_SYNC': this.syncHistory(); break; 
            case 'ROLLBACK_SAGA': 
                (async () => {
                    for (const id of event.transactionIds) {
                        await this.transactionPipeline.revertOperation(id);
                    }
                    this.syncHistory();
                })();
                break; 
            case 'UPDATE_SETTING': 
                this.settingsManager.updateSetting(event.category, event.key, event.value);
                if (event.key === 'chatHistoryMode') this.sessionManager.reload();
                break;
            case 'SUBMIT_PAYLOAD': 
                this.activeAbortController = new AbortController();
                this.processPayloadUseCase.execute(event.payload, this.activeAbortController.signal); 
                break;
            case 'CANCEL_PROCESSING': 
                if (this.activeAbortController) {
                    this.activeAbortController.abort();
                    this.activeAbortController = null;
                }
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
                this.transactionPipeline.emergencyUnlock(); 
                this.syncState();
                this.syncHistory();
                break;
            case 'CLEAR_SESSION': 
                this.revertActiveSessionOperations(this.sessionManager.getActiveSessionId());
                this.sessionManager.clearSession();
                this.pendingOperations.clear();
                this.transactionPipeline.emergencyUnlock();
                this.syncState();
                this.syncHistory();
                break;
            case 'ACTION_SAVE_ALL': 
                if (event.hasConflicts) {
                    vscode.window.showWarningMessage(
                        "You have unresolved conflicts in this batch. Do you want to save the successful files and ignore the conflicts?",
                        "Save Successful", "Cancel"
                    ).then(choice => {
                        if (choice === "Save Successful") this.transactionPipeline.saveBatch();
                    });
                } else {
                    this.transactionPipeline.saveBatch();
                }
                break;
            case 'ACTION_REVERT_ALL': this.transactionPipeline.revertBatch(); break;
            case 'ACTION_ACCEPT_OPERATION': this.transactionPipeline.saveOperation(event.operationId, event.isWalkthrough); break;
            case 'ACTION_REVERT_OPERATION': this.transactionPipeline.revertOperation(event.operationId, event.isWalkthrough); break;
            case 'OPEN_FILE': this.handleOpenFile(event.operationId); break;
            case 'OPEN_DIFF': this.handleOpenDiff(event.operationId); break;
            case 'OPEN_HISTORY_DIFF': this.handleOpenHistoryDiff(event.operationId, event.filePath); break;
            case 'OPEN_FILE_AT_RANGE': this.handleOpenFileAtRange(event.path, event.range); break;
            // ФІКС: Оновлено сигнатуру виклику
            case 'COPY_PROMPT': 
                this.handleCopyPrompt(
                    event.mode as any, 
                    (event as any).formatId, 
                    (event as any).customPath
                ); 
                break; 
            case 'DOWNLOAD_INSTRUCTIONS': this.handleDownloadInstructions(); break;
            case 'SHOW_OUTPUT_LOG': vscode.commands.executeCommand('ai-diff-agent.showLog'); break;
            case 'OPEN_EXTERNAL_LINK': vscode.env.openExternal(vscode.Uri.parse(event.url)); break;
            case 'SMART_RETRY_CONTEXT': this.handleSmartRetry(event.operationId); break; 
            case 'SET_WALKTHROUGH_STATE': this.isWalkthroughActive = event.isActive; break;
            case 'ACTION_JUMP_TO_NEXT_BLOCK': this.transactionPipeline.jumpToNextDirtyBlock(); break;
            case 'OPEN_PROBLEMS_PANEL': vscode.commands.executeCommand('workbench.actions.view.problems'); break;
        }
    }

    private syncHistory(): void {
        const history = this.store.getAllSagas();
        const currentBranch = this.store.getCurrentBranch();
        this.postMessageCallback({ type: 'HISTORY_HYDRATE', history, currentBranch });
    }

    private async handleOpenHistoryDiff(operationId: string, filePath: string): Promise<void> {
        try {
            const normalized = PathNormalizer.normalize(filePath);
            const targetUri = PathSandbox.validate(normalized);
            const backupUri = this.snapshotService.getBackupUri(operationId, normalized);

            try {
                await vscode.workspace.fs.stat(backupUri);
                await vscode.commands.executeCommand('vscode.diff', backupUri, targetUri, `${normalized} (History ↔ Current)`);
            } catch {
                const doc = await vscode.workspace.openTextDocument(targetUri);
                await vscode.window.showTextDocument(doc, { preview: false });
                OutputLogger.log(`No backup found for ${normalized}. Opened file directly.`, 'INFO');
            }
        } catch (e) {
            OutputLogger.log(`Failed to open history diff: ${e}`, 'ERROR');
        }
    }

    private async handleOpenFileAtRange(filePath: string, range?: any): Promise<void> {
        try {
            const normalized = PathNormalizer.normalize(filePath);
            const uri = PathSandbox.validate(normalized);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, { preview: false });

            if (range) {
                const vsRange = new vscode.Range(range.start.line, Math.max(0, range.start.character), range.end.line, Math.max(0, range.end.character));
                editor.revealRange(vsRange, vscode.TextEditorRevealType.InCenter);
                editor.selection = new vscode.Selection(vsRange.start, vsRange.start);
            }
        } catch (e) {
            OutputLogger.log(`Failed to open file at range: ${e}`, 'ERROR');
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
            const sessionOp = this.sessionManager.getActiveSession().messages
                .flatMap(m => m.operations || [])
                .find(o => o.id === operationId);

            if (rawOp.type === 'move_path' && sessionOp && (sessionOp.status === 'applied_dirty' || sessionOp.status === 'saved')) {
                targetPath = (rawOp as any).destinationPath;
            }

            const normalized = PathNormalizer.normalize(targetPath);
            const targetUri = PathSandbox.validate(normalized);

            if (sessionOp && (sessionOp.status === 'conflict' || sessionOp.status === 'error')) {
                const virtualUri = vscode.Uri.parse(`${VirtualConflictProvider.scheme}://preview/${normalized}?opId=${operationId}`);
                await vscode.commands.executeCommand('vscode.diff', targetUri, virtualUri, `${normalized} (Current ↔ AI Proposal)`);
                return;
            }

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

    // ФІКС: Повністю переписаний правильний метод обробки кастомних промптів
    private async handleCopyPrompt(mode: 'system' | 'custom', formatId: 'stable' | 'experimental', customPath?: string): Promise<void> {
        try {
            const fileName = formatId === 'stable' ? 'prompt-stable.md' : 'prompt-experimental.md';
            const instructionsPath = vscode.Uri.joinPath(this.context.extensionUri, 'resources', fileName);
            
            let systemPrompt = '';
            try {
                const fileBytes = await vscode.workspace.fs.readFile(instructionsPath);
                systemPrompt = new TextDecoder().decode(fileBytes);
            } catch {
                const fallbackPath = vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'prompt-instructions.md');
                const fallbackBytes = await vscode.workspace.fs.readFile(fallbackPath);
                systemPrompt = new TextDecoder().decode(fallbackBytes);
            }

            let finalPrompt = systemPrompt;

            if (mode === 'custom' && customPath) {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    try {
                        const customUri = vscode.Uri.joinPath(workspaceFolders[0].uri, customPath.trim());
                        const customBytes = await vscode.workspace.fs.readFile(customUri);
                        const customText = new TextDecoder().decode(customBytes);
                        
                        finalPrompt = `--- CUSTOM ARCHITECTURE & CODING RULES ---\n${customText}\n\n--- CRITICAL SYSTEM INSTRUCTIONS (DO NOT IGNORE) ---\n${systemPrompt}`;
                    } catch {
                        OutputLogger.log(`Could not read custom prompt path: ${customPath}`, 'WARN');
                        vscode.window.showWarningMessage(`Could not find custom rules file: ${customPath}. Copied default system instructions instead.`);
                    }
                }
            }

            await vscode.env.clipboard.writeText(finalPrompt);
            this.postMessageCallback({ type: 'PROMPT_COPIED' });
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

    public async handleAcceptBlock(opId: string, uri: vscode.Uri, blockId: string): Promise<void> {
        if (this.isProcessingLens) return; 
        this.isProcessingLens = true;
        try {
            this.decorationService.removeDecorationBlock(uri, blockId);
            this.checkPartialState(opId, uri);

            if (this.isWalkthroughActive) {
                await this.transactionPipeline.jumpToNextDirtyBlock();
            }
        } finally {
            this.isProcessingLens = false;
        }
    }

    public async handleRejectBlock(opId: string, uri: vscode.Uri, blockId: string): Promise<void> {
        if (this.isProcessingLens) return;
        this.isProcessingLens = true;
        try {
            const decs = this.decorationService.getDecorationsForDocument(uri);
            const freshDec = decs.find(d => d.id === blockId);
            if (!freshDec) return; 

            const sessionOp = this.sessionManager.getActiveSession().messages
                .flatMap(m => m.operations || [])
                .find(o => o.id === opId);

            if (!sessionOp) return;

            const edit = new vscode.WorkspaceEdit();

            if (sessionOp.type === 'create_file') {
                edit.replace(uri, freshDec.range, ''); 
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
                    freshDec.originalSearch, 
                    undefined, 
                    strictEngineSettings, 
                    astSettings
                );

                if (match.status !== 'MATCHED') {
                     OutputLogger.log(`Failed to locate original text in backup for rollback.`, 'WARN');
                     return;
                }
                
                const originalText = this.extractFullLines(backupContent, match.range.start.line, match.range.end.line);
                edit.replace(uri, freshDec.range, originalText); 
            }

            await vscode.workspace.applyEdit(edit);
            
            this.decorationService.removeDecorationBlock(uri, blockId);
            this.checkPartialState(opId, uri);

            if (this.isWalkthroughActive) {
                await this.transactionPipeline.jumpToNextDirtyBlock();
            }
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