import { DSLParser } from '@/core/parser/dslParser';
import { DomainValidator } from '@/core/parser/validator';
import type { ChatMessage, DiffOperation } from '@/shared/models';
import type { ChatSessionManager } from '@/extension/chat/sessionManager';
import type { TransactionManager } from '@/extension/transactions/transactionManager';
import type { AnyOperation } from '@/core/models/operations';
import type { ExtensionEvent } from '@/shared/ipc';

/**
 * UseCase encapsulating the parsing and execution flow of AI generated payloads.
 * Implements Command Pattern logic decoupled from the generic event router.
 */
export class ProcessPayloadUseCase {
    private parser: DSLParser;
    private validator: DomainValidator;

    constructor(
        private readonly sessionManager: ChatSessionManager,
        private readonly transactionManager: TransactionManager,
        private readonly pendingOperations: Map<string, AnyOperation>,
        private readonly postMessage: (event: ExtensionEvent) => void,
        private readonly syncState: () => void
    ) {
        this.parser = new DSLParser();
        this.validator = new DomainValidator();
    }

    public async execute(payload: string): Promise<void> {
        const userMsg: ChatMessage = { 
            id: Date.now().toString(), 
            role: 'user', 
            text: 'Payload submitted', 
            timestamp: Date.now() 
        };
        
        this.sessionManager.addMessage(userMsg);
        this.syncState();

        this.postMessage({ type: 'AGENT_TYPING', isTyping: true });
        this.postMessage({ type: 'PIPELINE_STATE', stage: 'parsing', current: 0, total: 0 });

        try {
            const parseResult = this.parser.parse(payload);
            if (!parseResult.success) {
                throw new Error(`Parsing failed: ${parseResult.error.message}`);
            }
            
            this.postMessage({ type: 'PIPELINE_STATE', stage: 'validating', current: 0, total: parseResult.value.length });
            const validationResult = this.validator.validate(parseResult.value);
            if (!validationResult.success) {
                throw new Error(`Validation failed: ${validationResult.error.message}`);
            }

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

            this.postMessage({ type: 'PIPELINE_STATE', stage: 'applying', current: 0, total: operations.length });
            await this.transactionManager.applyBatch(operations);

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.sessionManager.addMessage({ 
                id: Date.now().toString(), 
                role: 'system', 
                text: msg, 
                timestamp: Date.now() 
            });
        } finally {
            this.postMessage({ type: 'AGENT_TYPING', isTyping: false });
            this.postMessage({ type: 'PIPELINE_STATE', stage: 'idle', current: 0, total: 0 });
            this.syncState();
        }
    }
}
