import * as vscode from 'vscode';
import type { WebviewEvent, ExtensionEvent } from '../../shared/ipc';
import type { OperationStatus, DiffOperation } from '../../shared/models';
import { ChatSessionManager } from './sessionManager';
import { SettingsManager } from '../settings/settingsManager';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';
import type { AnyOperation } from '../../core/models/operations';
import { TransactionManager } from '../transactions/transactionManager';
import { CompensationStore } from '../transactions/compensationStore';
import type { DecorationService } from '../transactions/decorationService';
import { PathSandbox } from '../../vscode/workspace/pathSandbox';
import { PathNormalizer } from '../../core/workspace/pathNormalizer';
import { ProcessPayloadUseCase } from '../use-cases/processPayloadUseCase';
import { SYSTEM_CONSTANTS } from '../../shared/constants';

/**
 * MessageRouter acts as the central command dispatcher for the extension.
 */
export class MessageRouter {
    private readonly sessionManager: ChatSessionManager;
    private readonly settingsManager: SettingsManager;
    public readonly transactionManager: TransactionManager;
    private readonly store: CompensationStore;
    private readonly pendingOperations = new Map<string, AnyOperation>();
    private readonly processPayloadUseCase: ProcessPayloadUseCase;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly decorationService: DecorationService,
        private readonly postMessageCallback: (event: ExtensionEvent) => void
    ) {
        this.sessionManager = new ChatSessionManager(context.workspaceState);
        this.settingsManager = new SettingsManager();
        this.store = new CompensationStore(context.workspaceState);

        // Instantiating TransactionManager with advanced, multi-field metadata status synchronizer (Phase 2)
        this.transactionManager = new TransactionManager(this.store, this.decorationService, (
            opId: string, 
            status: OperationStatus, 
            metadata?: Partial<DiffOperation>
        ) => {
            const session = this.sessionManager.getSession();
            let targetOp: DiffOperation | undefined;
            
            // Look up the operation in active historical session records
            for (const msg of session.messages) {
                if (msg.operations) {
                    targetOp = msg.operations.find(o => o.id === opId);
                    if (targetOp) break;
                }
            }

            if (targetOp) {
                const updated: DiffOperation = {
                    ...targetOp,
                    status,
                    ...metadata
                };
                this.sessionManager.updateOperation(updated);
                this.postMessageCallback({ 
                    type: 'OPERATION_UPDATED', 
                    operationId: opId, 
                    status,
                    resolvedResiliently: updated.resolvedResiliently,
                    originalPath: updated.originalPath,
                    path: updated.path,
                    conflict: updated.conflict
                });
            } else {
                // Fallback for flat status modifications
                this.sessionManager.updateOperationStatus(opId, status);
                this.postMessageCallback({ type: 'OPERATION_UPDATED', operationId: opId, status });
            }
        });

        this.processPayloadUseCase = new ProcessPayloadUseCase(
            this.sessionManager,
            this.transactionManager,
            this.pendingOperations,
            this.postMessageCallback,
            () => this.syncState()
        );

        // Listen for configuration adjustments in real time
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION)) {
                this.syncSettings();
            }
        });
    }

    /**
     * Entry-point message dispatcher.
     */
    public handleMessage(event: WebviewEvent): void {
        switch (event.type) {
            case 'REQUEST_STATE_SYNC':
                this.syncState();
                break;
            case 'REQUEST_SETTINGS_SYNC':
                this.syncSettings();
                break;
            case 'UPDATE_SETTINGS':
                this.settingsManager.updateSettings(event.settings);
                break;
            case 'SUBMIT_PAYLOAD':
                this.processPayloadUseCase.execute(event.payload);
                break;
            case 'CLEAR_SESSION':
                this.sessionManager.clearSession();
                this.pendingOperations.clear();
                this.syncState();
                break;
            case 'ACTION_SAVE_ALL':
                this.transactionManager.saveBatch();
                break;
            case 'ACTION_REVERT_ALL':
                this.transactionManager.revertBatch();
                break;
            case 'OPEN_FILE':
                this.handleOpenFile(event.operationId);
                break;
            case 'COPY_PROMPT':
                this.handleCopyPrompt();
                break;
            case 'DOWNLOAD_INSTRUCTIONS':
                this.handleDownloadInstructions();
                break;
        }
    }

    private syncState(): void {
        this.postMessageCallback({ type: 'STATE_HYDRATE', session: this.sessionManager.getSession() });
    }

    private syncSettings(): void {
        this.postMessageCallback({ type: 'SETTINGS_HYDRATE', settings: this.settingsManager.getSettings() });
    }

    /**
     * Resolves file URI location safely and reveals the file in active editor columns.
     */
    private async handleOpenFile(operationId: string): Promise<void> {
        const rawOp = this.pendingOperations.get(operationId);
        if (!rawOp) return;
        
        try {
            let targetPath = rawOp.path;
            
            if (rawOp.type === 'move_path') {
                const baseOp = rawOp as any;
                const sessionOp = this.sessionManager.getSession().messages
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
            await vscode.window.showTextDocument(doc, { preview: false });
        } catch (e) {
            OutputLogger.log(`Failed to open workspace target: ${e}`, 'ERROR');
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
            // Ignore cancel download dialog actions
        }
    }
}
