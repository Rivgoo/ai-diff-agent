import { DSLParser } from '../../core/parser/dslParser';
import { DomainValidator } from '../../core/parser/validator';
import { PayloadMetricsExtractor } from '../../core/parser/metricsExtractor';
import type { ChatMessage, DiffOperation } from '../../shared/models';
import type { ChatSessionManager } from '../chat/sessionManager';
import type { TransactionManager } from '../transactions/transactionManager';
import type { AnyOperation } from '../../core/models/operations';
import type { ExtensionEvent } from '../../shared/ipc';

/**
 * Orchestrates the full, asynchronous processing pipeline of LLM payloads.
 * Decouples message ingestion from direct workspace modifications, advancing the progress
 * pipeline state sequentially, calculating change impact, and managing error states gracefully.
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
     * Executes the parsing, validation, snapshotting, metrics calculation, and transaction staging sequence.
     */
    public async execute(payload: string): Promise<void> {
        this.postMessage({ type: 'AGENT_TYPING', isTyping: true });
        this.postMessage({ type: 'PIPELINE_STATE', stage: 'parsing', current: 0, total: 0 });

        try {
            // Step 1: Lexical & AST parsing
            const parseResult = this.parser.parse(payload);
            if (!parseResult.success) {
                // Record user submit action with error metadata if parsing fails
                const userFailMsg: ChatMessage = {
                    id: Date.now().toString(),
                    role: 'user',
                    text: 'Submitted payload with structural syntax errors.',
                    timestamp: Date.now(),
                    errorDetails: parseResult.error.message
                };
                this.sessionManager.addMessage(userFailMsg);
                this.syncState();
                throw new Error(`DSL Parsing failed: ${parseResult.error.message}`);
            }

            // Step 2: Compute change telemetry and structural metrics
            const parsedOperations = parseResult.value;
            const summary = PayloadMetricsExtractor.extract(parsedOperations, payload);

            // Add enriched user message containing complete payload summary metrics
            const userMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'user',
                text: `Applied change request targeting ${parsedOperations.length} operational segments.`,
                timestamp: Date.now(),
                payloadSummary: summary
            };
            this.sessionManager.addMessage(userMsg);
            this.syncState();

            this.postMessage({ type: 'PIPELINE_STATE', stage: 'validating', current: 0, total: parsedOperations.length });

            // Step 3: Domain validation and structural conflict validations
            const validationResult = this.validator.validate(parsedOperations);
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

            // Post initial pending staging block to the conversation timeline
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

            // Step 4: Run the transaction batch
            await this.transactionManager.applyBatch(operations);

            // Step 5: Verify Transaction Batch results for atomic fallback warnings
            const hasConflicts = operations.some(op => op.status === 'conflict');
            if (hasConflicts) {
                this.sessionManager.addMessage({
                    id: Date.now().toString(),
                    role: 'system',
                    text: 'Could not apply changes. The transaction was automatically rolled back to prevent incomplete code modifications. Please resolve the search pattern conflicts listed below.',
                    timestamp: Date.now()
                });
            }

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
