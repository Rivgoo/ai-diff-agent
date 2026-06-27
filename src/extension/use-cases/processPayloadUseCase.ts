import { DSLParser } from '../../core/parser/dslParser';
import { DomainValidator } from '../../core/parser/validator';
import { PayloadMetricsExtractor } from '../../core/parser/metricsExtractor';
import { TransactionCompiler } from '../../core/compiler';
import type { ChatMessage, DiffOperation } from '../../shared/models';
import type { ChatSessionManager } from '../chat/sessionManager';
import type { TransactionPipeline } from '../transactions/orchestrator/TransactionPipeline';
import type { AnyOperation } from '../../core/models/operations';
import type { ExtensionEvent } from '../../shared/ipc';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';

export class ProcessPayloadUseCase {
    private readonly parser = new DSLParser();
    private readonly validator = new DomainValidator();
    private readonly compiler = new TransactionCompiler();

    constructor(
        private readonly sessionManager: ChatSessionManager,
        private readonly transactionPipeline: TransactionPipeline,
        private readonly pendingOperations: Map<string, AnyOperation>,
        private readonly postMessage: (event: ExtensionEvent) => void,
        private readonly syncState: () => void
    ) {}

    public async execute(payload: string): Promise<void> {
        this.postMessage({ type: 'AGENT_TYPING', isTyping: true });
        this.postMessage({ type: 'PIPELINE_STATE', stage: 'parsing', current: 0, total: 0 });

        await new Promise(resolve => setTimeout(resolve, 0));

        try {
            const parseResult = this.parser.parse(payload);
            if (!parseResult.success) {
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

            const parsedOperations = parseResult.value;

            this.postMessage({ type: 'PIPELINE_STATE', stage: 'resolving', current: 0, total: parsedOperations.length });
            const compilationResult = this.compiler.compile(parsedOperations);
            if (!compilationResult.success) {
                throw new Error(`Transaction Compilation failed: ${compilationResult.error.message}`);
            }

            const { operations: compiledOperations, warnings } = compilationResult.value;

            if (warnings.length > 0) {
                OutputLogger.log(`Transaction Compiler successfully resolved ${warnings.length} conflict(s):`, 'WARN');
                for (const warning of warnings) {
                    OutputLogger.log(` - [COMPILER RESOLUTION] ${warning.reason} (Path: ${warning.path}, Op ID: ${warning.operationId})`, 'WARN');
                }
            }

            const summary = PayloadMetricsExtractor.extract(compiledOperations, payload);

            const userMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'user',
                text: `Applied change request targeting ${compiledOperations.length} operational segments.`,
                timestamp: Date.now(),
                payloadSummary: summary
            };
            this.sessionManager.addMessage(userMsg);
            this.syncState();

            this.postMessage({ type: 'PIPELINE_STATE', stage: 'validating', current: 0, total: compiledOperations.length });

            const validationResult = this.validator.validate(compiledOperations);
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

            // Delegate to the new Pipeline Orchestrator Architecture
            await this.transactionPipeline.applyBatch(operations);

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
