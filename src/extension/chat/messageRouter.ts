import * as vscode from 'vscode';
import { WebviewEvent, ExtensionEvent } from '../../shared/ipc';
import { ChatMessage, DiffOperation, OperationStatus } from '../../shared/models';
import { ChatSessionManager } from './sessionManager';
import { DSLParser } from '../../core/parser/dslParser';
import { DomainValidator } from '../../core/parser/validator';
import { DiffOrchestrator } from '../inline-diff/diffOrchestrator';
import { SettingsManager } from '../settings/settingsManager';
import { EditOrchestrator } from '../../infrastructure/orchestration/editOrchestrator';
import { VirtualFsProvider } from '../../infrastructure/providers/virtualFsProvider';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';
import { AnyOperation, UpdateFileOperation } from '../../core/models/operations';
import { PathSandbox } from '../../vscode/workspace/pathSandbox';

export class MessageRouter {
    private sessionManager: ChatSessionManager;
    private parser: DSLParser;
    private validator: DomainValidator;
    public orchestrator: DiffOrchestrator;
    private settingsManager: SettingsManager;
    private editOrchestrator: EditOrchestrator;

    private pendingOperations = new Map<string, AnyOperation>();

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly postMessageCallback: (event: ExtensionEvent) => void,
        private readonly virtualFsProvider: VirtualFsProvider
    ) {
        this.sessionManager = new ChatSessionManager(context.workspaceState);
        this.parser = new DSLParser();
        this.validator = new DomainValidator();
        this.settingsManager = new SettingsManager();
        this.editOrchestrator = new EditOrchestrator();

        this.orchestrator = new DiffOrchestrator((opId: string, status: OperationStatus) => {
            this.sessionManager.updateOperationStatus(opId, status);
            this.postMessageCallback({ type: 'OPERATION_UPDATED', operationId: opId, status });
        });

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('aiDiffAgent')) {
                this.syncSettings();
            }
        });
    }

    public getLensProvider() {
        return this.orchestrator.lensProvider;
    }

    public async acceptOperation(opId: string): Promise<void> {
        const rawOp = this.pendingOperations.get(opId);

        if (rawOp && rawOp.type !== 'update_file') {
            OutputLogger.log(`Committing deferred operation ${opId} (${rawOp.type})`, 'INFO');
            const success = await this.editOrchestrator.applyOperations([rawOp]);
            if (success) {
                this.pendingOperations.delete(opId);
                this.sessionManager.updateOperationStatus(opId, 'applied');
                this.postMessageCallback({ type: 'OPERATION_UPDATED', operationId: opId, status: 'applied' });
            } else {
                this.sessionManager.updateOperationStatus(opId, 'error');
                this.postMessageCallback({ type: 'OPERATION_UPDATED', operationId: opId, status: 'error' });
            }
        } else {
            this.orchestrator.acceptOperation(opId);
        }
    }

    public rejectOperation(opId: string): void {
        this.pendingOperations.delete(opId);
        this.orchestrator.rejectOperation(opId);
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
            case 'ACTION_ACCEPT':
                this.acceptOperation(event.operationId);
                break;
            case 'ACTION_REJECT':
                this.rejectOperation(event.operationId);
                break;
            case 'ACTION_ACCEPT_ALL':
                this.acceptAllPending();
                break;
            case 'ACTION_REJECT_ALL':
                this.rejectAllPending();
                break;
            case 'OPEN_DIFF':
                this.handleOpenDiff(event.operationId);
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
        this.postMessageCallback({
            type: 'STATE_HYDRATE',
            session: this.sessionManager.getSession()
        });
    }

    private syncSettings(): void {
        this.postMessageCallback({
            type: 'SETTINGS_HYDRATE',
            settings: this.settingsManager.getSettings()
        });
    }

    private async acceptAllPending(): Promise<void> {
        const session = this.sessionManager.getSession();
        const pendingOps: string[] = [];
        for (const msg of session.messages) {
            if (msg.operations) {
                for (const op of msg.operations) {
                    if (op.status === 'pending' || op.status === 'reviewing') {
                        pendingOps.push(op.id);
                    }
                }
            }
        }
        for (const opId of pendingOps) {
            await this.acceptOperation(opId);
        }
    }

    private rejectAllPending(): void {
        const session = this.sessionManager.getSession();
        for (const msg of session.messages) {
            if (msg.operations) {
                for (const op of msg.operations) {
                    if (op.status === 'pending' || op.status === 'reviewing') {
                        this.rejectOperation(op.id);
                    }
                }
            }
        }
    }

    private async handleOpenDiff(operationId: string): Promise<void> {
        const session = this.sessionManager.getSession();
        let targetOp: DiffOperation | undefined;
        for (const msg of session.messages) {
            targetOp = msg.operations?.find(o => o.id === operationId);
            if (targetOp) break;
        }

        if (!targetOp || targetOp.type !== 'update_file') return;

        try {
            const fileUri = PathSandbox.validate(targetOp.path);
            const previewUri = vscode.Uri.parse(`${VirtualFsProvider.scheme}://preview?opId=${operationId}`);
            const fileName = targetOp.path.split('/').pop() ?? targetOp.path;

            await vscode.commands.executeCommand(
                'vscode.diff',
                fileUri,
                previewUri,
                `${fileName} — AI Proposed Changes`
            );
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            OutputLogger.log(`Failed to open diff for op ${operationId}: ${msg}`, 'ERROR');
            vscode.window.showErrorMessage(`Could not open diff: ${msg}`);
        }
    }

    private async handleCopyPrompt(): Promise<void> {
        try {
            const instructionsPath = vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'prompt-instructions.md');
            const fileBytes = await vscode.workspace.fs.readFile(instructionsPath);
            const content = new TextDecoder().decode(fileBytes);
            
            await vscode.env.clipboard.writeText(content);
            this.postMessageCallback({ type: 'PROMPT_COPIED' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown read error';
            OutputLogger.log(`Failed to copy prompt instructions to clipboard: ${msg}`, 'ERROR');
            vscode.window.showErrorMessage(`Failed to copy instructions: ${msg}`);
        }
    }

    private async handleDownloadInstructions(): Promise<void> {
        try {
            const instructionsPath = vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'prompt-instructions.md');
            const fileBytes = await vscode.workspace.fs.readFile(instructionsPath);

            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('AI_To_XML_Instructions.md'),
                filters: { 'Markdown Files': ['md'] },
                title: 'Save AI Prompt Instructions'
            });

            if (saveUri) {
                await vscode.workspace.fs.writeFile(saveUri, fileBytes);
                vscode.window.showInformationMessage('AI Instructions saved successfully!');
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown write error';
            vscode.window.showErrorMessage(`Failed to save instructions: ${msg}`);
        }
    }

    public async handlePayloadSubmission(payload: string): Promise<void> {
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: 'Payload submitted',
            timestamp: Date.now()
        };
        this.sessionManager.addMessage(userMsg);
        this.syncState();

        OutputLogger.log('Payload submission received', 'INFO');
        this.postMessageCallback({ type: 'AGENT_TYPING', isTyping: true });
        this.postMessageCallback({ type: 'PIPELINE_STATE', stage: 'parsing', current: 0, total: 0 });

        try {
            const parseResult = this.parser.parse(payload);
            if (!parseResult.success) {
                throw new Error(`Parsing failed: ${parseResult.error.message}`);
            }
            OutputLogger.log(`Parsed ${parseResult.value.length} operations`, 'INFO');

            this.postMessageCallback({ type: 'PIPELINE_STATE', stage: 'validating', current: 0, total: parseResult.value.length });
            const validationResult = this.validator.validate(parseResult.value);
            if (!validationResult.success) {
                throw new Error(`Validation failed: ${validationResult.error.message}`);
            }

            this.postMessageCallback({ type: 'PIPELINE_STATE', stage: 'resolving', current: 0, total: validationResult.value.length });
            for (const op of validationResult.value) {
                PathSandbox.validate(op.path);
                if (op.type === 'move_path') {
                    PathSandbox.validate((op as any).destinationPath);
                }
            }
            OutputLogger.log('All paths validated within workspace boundary', 'INFO');

            const diffOps: DiffOperation[] = validationResult.value.map((op: AnyOperation) => {
                let additions = 0;
                let deletions = 0;

                if (op.type === 'create_file') {
                    additions = op.content ? op.content.split(/\r?\n/).length : 0;
                } else if (op.type === 'update_file') {
                    for (const change of op.changes) {
                        deletions += change.search ? change.search.split(/\r?\n/).length : 0;
                        additions += change.replace ? change.replace.split(/\r?\n/).length : 0;
                    }
                }

                const hasStats = op.type === 'create_file' || op.type === 'update_file';

                return {
                    id: op.id,
                    type: op.type,
                    path: op.path,
                    status: 'pending' as const,
                    changes: op.type === 'update_file' ? (op as any).changes : [],
                    stats: hasStats ? { additions, deletions } : undefined
                };
            });

            for (const op of validationResult.value) {
                this.pendingOperations.set(op.id, op);
            }

            for (const op of validationResult.value) {
                if (op.type === 'update_file') {
                    this.virtualFsProvider.registerOperation(op as UpdateFileOperation);
                }
            }

            const agentMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                text: `Prepared ${diffOps.length} operation${diffOps.length === 1 ? '' : 's'}. Review the changes below.`,
                operations: diffOps,
                timestamp: Date.now()
            };
            this.sessionManager.addMessage(agentMsg);
            this.syncState();

            this.postMessageCallback({ type: 'PIPELINE_STATE', stage: 'staging', current: 0, total: diffOps.length });
            await this.orchestrator.stageOperations(diffOps);
            this.postMessageCallback({ type: 'PIPELINE_STATE', stage: 'reviewing', current: diffOps.length, total: diffOps.length });

            OutputLogger.log(`Staging complete for ${diffOps.length} operations`, 'INFO');

        } catch (error) {
            const errorDetail = error instanceof Error ? error.message : 'Unknown structural error.';
            OutputLogger.log(`Payload processing failed: ${errorDetail}`, 'ERROR');

            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'system',
                text: errorDetail,
                timestamp: Date.now()
            };
            this.sessionManager.addMessage(errorMsg);
            this.postMessageCallback({ type: 'PIPELINE_STATE', stage: 'idle', current: 0, total: 0 });
        } finally {
            this.postMessageCallback({ type: 'AGENT_TYPING', isTyping: false });
            this.syncState();
        }
    }
}
