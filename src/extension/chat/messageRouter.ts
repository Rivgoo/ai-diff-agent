import * as vscode from 'vscode';
import type { WebviewEvent, ExtensionEvent } from '@/shared/ipc';
import type { OperationStatus } from '@/shared/models';
import { ChatSessionManager } from '@/extension/chat/sessionManager';
import { SettingsManager } from '@/extension/settings/settingsManager';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';
import type { AnyOperation } from '@/core/models/operations';
import { TransactionManager } from '@/extension/transactions/transactionManager';
import { CompensationStore } from '@/extension/transactions/compensationStore';
import type { DecorationService } from '@/extension/transactions/decorationService';
import { PathSandbox } from '@/vscode/workspace/pathSandbox';
import { PathNormalizer } from '@/core/workspace/pathNormalizer';
import { ProcessPayloadUseCase } from '@/extension/use-cases/processPayloadUseCase';
import { SYSTEM_CONSTANTS } from '@/shared/constants';

export class MessageRouter {
    private sessionManager: ChatSessionManager;
    private settingsManager: SettingsManager;
    public transactionManager: TransactionManager;
    private store: CompensationStore;
    private pendingOperations = new Map<string, AnyOperation>();
    private processPayloadUseCase: ProcessPayloadUseCase;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly decorationService: DecorationService,
        private readonly postMessageCallback: (event: ExtensionEvent) => void
    ) {
        this.sessionManager = new ChatSessionManager(context.workspaceState);
        this.settingsManager = new SettingsManager();
        this.store = new CompensationStore(context.workspaceState);

        this.transactionManager = new TransactionManager(this.store, this.decorationService, (opId: string, status: OperationStatus) => {
            this.sessionManager.updateOperationStatus(opId, status);
            this.postMessageCallback({ type: 'OPERATION_UPDATED', operationId: opId, status });
        });

        this.processPayloadUseCase = new ProcessPayloadUseCase(
            this.sessionManager,
            this.transactionManager,
            this.pendingOperations,
            this.postMessageCallback,
            () => this.syncState()
        );

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION)) {
                this.syncSettings();
            }
        });
    }

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
            OutputLogger.log(`Failed to open file: ${e}`, 'ERROR');
        }
    }

    private async handleCopyPrompt(): Promise<void> {
        try {
            const instructionsPath = vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'prompt-instructions.md');
            const fileBytes = await vscode.workspace.fs.readFile(instructionsPath);
            await vscode.env.clipboard.writeText(new TextDecoder().decode(fileBytes));
            this.postMessageCallback({ type: 'PROMPT_COPIED' });
        } catch (e) {
            OutputLogger.log(`Copy prompt failed: ${e}`, 'ERROR');
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
        } catch (e) {}
    }
}
