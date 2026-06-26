import { DSLParser } from '../../core/parser/dslParser';
import { DomainValidator } from '../../core/parser/validator';
import type { ChatMessage, DiffOperation } from '../../shared/models';
import type { ChatSessionManager } from '../chat/sessionManager';
import type { TransactionManager } from '../transactions/transactionManager';
import type { AnyOperation } from '../../core/models/operations';
import type { ExtensionEvent } from '../../shared/ipc';

/**
 * Orchestrates the full, asynchronous processing pipeline of LLM payloads.
 * Decouples message ingestion from direct workspace modifications, advancing the progress
 * pipeline state sequentially and managing error limits gracefully.
 */
export class ProcessPayloadUseCase {
    private readonly parser = new DSLParser();
    private readonly validator = new DomainValidator();

    constructor(
        private readonly sessionManager: ChatSessionManager,
        private readonly transactionManager: TransactionManager,
        private readonly pendingOperations: Map<string, AnyOperation>,
        private readonly postMessage: (event: ExtensionEvent) => void,
        private readonly syncState: () => void
    ) {}

    /**
     * Executes the parsing, validation, snapshotting, and transaction staging sequence.
     */
    public async execute(payload: string): Promise<void> {
        // Track the user submit payload action
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
            // Step 1: Lexical & AST parsing
            const parseResult = this.parser.parse(payload);
            if (!parseResult.success) {
                throw new Error(`DSL Parsing failed: ${parseResult.error.message}`);
            }
            
            this.postMessage({ type: 'PIPELINE_STATE', stage: 'validating', current: 0, total: parseResult.value.length });
            
            // Step 2: Domain validations and collision checks
            const validationResult = this.validator.validate(parseResult.value);
            if (!validationResult.success) {
                throw new Error(`DSL Validation failed: ${validationResult.error.message}`);
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

            // Post initial pending state to the user chat panel
            const agentMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                text: `Staging ${diffOps.length} operation(s) immediately into editor memory. Please review and Accept/Reject.`,
                operations: diffOps,
                timestamp: Date.now()
            };
            this.sessionManager.addMessage(agentMsg);
            this.syncState();

            this.postMessage({ type: 'PIPELINE_STATE', stage: 'applying', current: 0, total: operations.length });
            
            // Step 3: Run the Transaction batch
            await this.transactionManager.applyBatch(operations);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown compilation or parsing failure';
            
            // Log the parsing/validation breakdown into the user sidebar output
            this.sessionManager.addMessage({ 
                id: Date.now().toString(), 
                role: 'system', 
                text: errorMsg, 
                timestamp: Date.now() 
            });
        } finally {
            this.postMessage({ type: 'AGENT_TYPING', isTyping: false });
            this.postMessage({ type: 'PIPELINE_STATE', stage: 'idle', current: 0, total: 0 });
            this.syncState();
        }
    }
}
