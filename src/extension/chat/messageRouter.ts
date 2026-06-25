import * as vscode from 'vscode';
import { WebviewEvent, ExtensionEvent } from '../../shared/ipc';
import { ChatMessage, DiffOperation, OperationStatus } from '../../shared/models';
import { ChatSessionManager } from './sessionManager';
import { DSLParser } from '../../core/parser/dslParser';
import { DomainValidator } from '../../core/parser/validator';
import { DiffOrchestrator } from '../inline-diff/diffOrchestrator';
import { SettingsManager } from '../settings/settingsManager';
import { AnyOperation } from '../../core/models/operations';

export class MessageRouter {
    private sessionManager: ChatSessionManager;
    private parser: DSLParser;
    private validator: DomainValidator;
    public orchestrator: DiffOrchestrator;
    private settingsManager: SettingsManager;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly postMessageCallback: (event: ExtensionEvent) => void
    ) {
        this.sessionManager = new ChatSessionManager(context.workspaceState);
        this.parser = new DSLParser();
        this.validator = new DomainValidator();
        this.settingsManager = new SettingsManager();
        
        this.orchestrator = new DiffOrchestrator((opId: string, status: OperationStatus) => {
            this.sessionManager.updateOperationStatus(opId, status);
            this.syncState();
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

    public acceptOperation(opId: string) {
        this.orchestrator.acceptOperation(opId);
    }

    public rejectOperation(opId: string) {
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
                this.syncState();
                break;
            case 'ACTION_ACCEPT':
                this.acceptOperation(event.operationId);
                break;
            case 'ACTION_REJECT':
                this.rejectOperation(event.operationId);
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

    private async handlePayloadSubmission(payload: string): Promise<void> {
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: 'Submitted XML Payload',
            timestamp: Date.now()
        };
        this.sessionManager.addMessage(userMsg);
        this.syncState();

        this.postMessageCallback({ type: 'AGENT_TYPING', isTyping: true });
        await new Promise(resolve => setTimeout(resolve, 300));

        try {
            const parseResult = this.parser.parse(payload);
            if (!parseResult.success) throw new Error(`Syntax Error: ${parseResult.error.message}`);

            const validationResult = this.validator.validate(parseResult.value);
            if (!validationResult.success) throw new Error(`Validation Error: ${validationResult.error.message}`);

            const diffOps: DiffOperation[] = validationResult.value.map((op: AnyOperation) => ({
                id: op.id,
                type: op.type,
                path: op.path,
                status: 'pending',
                changes: op.type === 'update_file' ? (op as any).changes : []
            }));

            const agentMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                text: `I have prepared ${diffOps.length} file operations. Review them directly in your code.`,
                operations: diffOps,
                timestamp: Date.now()
            };
            this.sessionManager.addMessage(agentMsg);
            this.syncState();

            await this.orchestrator.stageOperations(diffOps);

        } catch (error) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'system',
                text: 'Failed to process the payload.',
                errorDetails: error instanceof Error ? error.message : 'Unknown structural error.',
                timestamp: Date.now()
            };
            this.sessionManager.addMessage(errorMsg);
        } finally {
            this.postMessageCallback({ type: 'AGENT_TYPING', isTyping: false });
            this.syncState();
        }
    }
}
