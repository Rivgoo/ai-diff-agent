import * as vscode from 'vscode';
import { WebviewEvent, ExtensionEvent } from '../../shared/ipc';
import { ChatMessage, DiffOperation, OperationStatus } from '../../shared/models';
import { ChatSessionManager } from './sessionManager';
import { DSLParser } from '../../core/parser/dslParser';
import { DomainValidator } from '../../core/parser/validator';
import { SettingsManager } from '../settings/settingsManager';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';
import { AnyOperation } from '../../core/models/operations';
import { TransactionManager } from '../transactions/transactionManager';
import { CompensationStore } from '../transactions/compensationStore';
import { DecorationService } from '../transactions/decorationService';
import { PathSandbox } from '../../vscode/workspace/pathSandbox';
import { PathNormalizer } from '../../core/workspace/pathNormalizer';

export class MessageRouter {
    private sessionManager: ChatSessionManager;
    private parser: DSLParser;
    private validator: DomainValidator;
    private settingsManager: SettingsManager;
    
    public transactionManager: TransactionManager;
    private store: CompensationStore;

    private pendingOperations = new Map<string, AnyOperation>();

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly decorationService: DecorationService,
        private readonly postMessageCallback: (event: ExtensionEvent) => void
    ) {
        this.sessionManager = new ChatSessionManager(context.workspaceState);
        this.parser = new DSLParser();
        this.validator = new DomainValidator();
        this.settingsManager = new SettingsManager();
        this.store = new CompensationStore(context.workspaceState);

        this.transactionManager = new TransactionManager(this.store, this.decorationService, (opId: string, status: OperationStatus) => {
            this.sessionManager.updateOperationStatus(opId, status);
            this.postMessageCallback({ type: 'OPERATION_UPDATED', operationId: opId, status });
        });

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('aiDiffAgent')) {
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
                this.handlePayloadSubmission(event.payload);
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
            
            // Redirect navigation target if the file was moved and is applied
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

    public async handlePayloadSubmission(payload: string): Promise<void> {
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: 'Payload submitted', timestamp: Date.now() };
        this.sessionManager.addMessage(userMsg);
        this.syncState();

        this.postMessageCallback({ type: 'AGENT_TYPING', isTyping: true });
        this.postMessageCallback({ type: 'PIPELINE_STATE', stage: 'parsing', current: 0, total: 0 });

        try {
            const parseResult = this.parser.parse(payload);
            if (!parseResult.success) throw new Error(`Parsing failed: ${parseResult.error.message}`);
            
            this.postMessageCallback({ type: 'PIPELINE_STATE', stage: 'validating', current: 0, total: parseResult.value.length });
            const validationResult = this.validator.validate(parseResult.value);
            if (!validationResult.success) throw new Error(`Validation failed: ${validationResult.error.message}`);

            const operations = validationResult.value;
            const diffOps: DiffOperation[] = operations.map((op: AnyOperation) => {
                this.pendingOperations.set(op.id, op);
                
                const rawOp = op as any;
                return { 
                    id: op.id, 
                    type: op.type, 
                    path: op.path, 
                    status: 'pending', 
                    changes: op.type === 'update_file' ? rawOp.changes : [],
                    sourcePath: op.type === 'move_path' ? rawOp.path : undefined,
                    destinationPath: op.type === 'move_path' ? rawOp.destinationPath : undefined
                };
            });

            const agentMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                text: `Applying ${diffOps.length} operation(s) immediately to the workspace. Please review and Save/Revert.`,
                operations: diffOps,
                timestamp: Date.now()
            };
            this.sessionManager.addMessage(agentMsg);
            this.syncState();

            this.postMessageCallback({ type: 'PIPELINE_STATE', stage: 'applying', current: 0, total: operations.length });
            await this.transactionManager.applyBatch(operations);

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.sessionManager.addMessage({ id: Date.now().toString(), role: 'system', text: msg, timestamp: Date.now() });
        } finally {
            this.postMessageCallback({ type: 'AGENT_TYPING', isTyping: false });
            this.postMessageCallback({ type: 'PIPELINE_STATE', stage: 'idle', current: 0, total: 0 });
            this.syncState();
        }
    }
}
