import * as vscode from 'vscode';
import type { WebviewEvent, ExtensionEvent } from '@/shared/ipc';
import type { DiffOperation } from '@/shared/models';
import { ChatSessionManager } from './sessionManager';
import { SettingsManager } from '@/extension/settings/settingsManager';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';
import type { AnyOperation } from '@/core/models/operations';
import { ProcessPayloadUseCase } from '@/extension/use-cases/processPayloadUseCase';
import { SnapshotService } from '@/extension/transactions/services/SnapshotService';
import { PathSandbox } from '@/vscode/workspace/pathSandbox';
import { PathNormalizer } from '@/core/workspace/pathNormalizer';

// New Architecture Imports
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
    private readonly snapshotService = new SnapshotService();

    public readonly transactionPipeline: TransactionPipeline;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly decorationService: DecorationService,
        private readonly postMessageCallback: (event: ExtensionEvent) => void
    ) {
        this.sessionManager = new ChatSessionManager(context.workspaceState);
        this.settingsManager = new SettingsManager(context, () => this.syncSettings());
        this.store = new CompensationStore(context.workspaceState);

        // Instantiate Dependencies for Pipeline Context
        const logger = new LoggerAdapter();
        const searchEngine = new SearchEngine();
        const pathResolver = new ResilientPathResolver(new VsCodeFileSystemAdapter(), new VsCodeWorkspaceSearchAdapter());
        const editorService = new EditorService();
        const directoryCleanupService = new DirectoryCleanupService();

        this.transactionPipeline = new TransactionPipeline(
            this.store,
            this.decorationService,
            searchEngine,
            pathResolver,
            this.snapshotService,
            editorService,
            directoryCleanupService,
            logger,
            (update: OperationStatusUpdate) => {
                const session = this.sessionManager.getActiveSession();
                let targetOp: DiffOperation | undefined;
                
                for (const msg of session.messages) {
                    if (msg.operations) {
                        targetOp = msg.operations.find(o => o.id === update.operationId);
                        if (targetOp) break;
                    }
                }

                if (targetOp) {
                    const { status, resolvedResiliently, originalPath, path, conflict } = update;
                    const updated: DiffOperation = { 
                        ...targetOp, 
                        status,
                        resolvedResiliently: resolvedResiliently ?? targetOp.resolvedResiliently,
                        originalPath: originalPath ?? targetOp.originalPath,
                        path: path ?? targetOp.path,
                        conflict: conflict ?? targetOp.conflict
                    };
                    this.sessionManager.updateOperation(updated);
                    this.postMessageCallback({ 
                        type: 'OPERATION_UPDATED', 
                        operationId: update.operationId, 
                        status,
                        resolvedResiliently: updated.resolvedResiliently,
                        originalPath: updated.originalPath,
                        path: updated.path,
                        conflict: updated.conflict
                    });
                } else {
                    this.sessionManager.updateOperationStatus(update.operationId, update.status);
                    this.postMessageCallback({ type: 'OPERATION_UPDATED', operationId: update.operationId, status: update.status });
                }
            }
        );

        this.processPayloadUseCase = new ProcessPayloadUseCase(
            this.sessionManager,
            this.transactionPipeline,
            this.pendingOperations,
            this.postMessageCallback,
            () => this.syncState()
        );
    }

    public handleMessage(event: WebviewEvent): void {
        switch (event.type) {
            case 'REQUEST_STATE_SYNC': this.syncState(); break;
            case 'REQUEST_SETTINGS_SYNC': this.syncSettings(); break;
            case 'UPDATE_SETTING': this.settingsManager.updateSetting(event.category, event.key, event.value); break;
            case 'SUBMIT_PAYLOAD': this.processPayloadUseCase.execute(event.payload); break;
            case 'CANCEL_PROCESSING': break;
            case 'NEW_SESSION':
                this.sessionManager.createSession();
                this.syncState();
                break;
            case 'SWITCH_SESSION':
                this.sessionManager.switchSession(event.sessionId);
                this.syncState();
                break;
            case 'DELETE_SESSION':
                this.sessionManager.deleteSession(event.sessionId);
                this.syncState();
                break;
            case 'CLEAR_SESSION': 
                this.sessionManager.clearSession();
                this.pendingOperations.clear();
                this.syncState();
                break;
            case 'ACTION_SAVE_ALL': this.transactionPipeline.saveBatch(); break;
            case 'ACTION_REVERT_ALL': this.transactionPipeline.revertBatch(); break;
            case 'ACTION_ACCEPT_OPERATION': this.transactionPipeline.saveOperation(event.operationId); break;
            case 'ACTION_REVERT_OPERATION': this.transactionPipeline.revertOperation(event.operationId); break;
            case 'OPEN_FILE': this.handleOpenFile(event.operationId); break;
            case 'OPEN_DIFF': this.handleOpenDiff(event.operationId); break;
            case 'COPY_PROMPT': this.handleCopyPrompt(); break;
            case 'DOWNLOAD_INSTRUCTIONS': this.handleDownloadInstructions(); break;
            case 'SHOW_OUTPUT_LOG': vscode.commands.executeCommand('ai-diff-agent.showLog'); break;
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
            
            const rootName = workspaceFolders[0].name;
            const normalized = PathNormalizer.normalize(targetPath, rootName);
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
            
            const rootName = workspaceFolders[0].name;
            const normalized = PathNormalizer.normalize(targetPath, rootName);
            const targetUri = PathSandbox.validate(normalized);
            
            const backupUri = this.snapshotService.getBackupUri(workspaceFolders[0].uri, operationId, normalized);

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

    private async handleCopyPrompt(): Promise<void> {
        try {
            const instructionsPath = vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'prompt-instructions.md');
            const fileBytes = await vscode.workspace.fs.readFile(instructionsPath);
            await vscode.env.clipboard.writeText(new TextDecoder().decode(fileBytes));
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
}
