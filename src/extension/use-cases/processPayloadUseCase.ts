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
import { PayloadAutoFixer } from '../../core/parser/payloadAutoFixer';
import { SettingsManager } from '../settings/settingsManager';
import { VsCodeWorkspaceSearchAdapter } from '../../infrastructure/adapters/workspaceSearchAdapter';

class HandledUIError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HandledUIError';
    }
}

export class ProcessPayloadUseCase {
    private readonly parser = new DSLParser();
    private readonly validator = new DomainValidator();
    private readonly compiler = new TransactionCompiler();
    private readonly workspaceSearchAdapter = new VsCodeWorkspaceSearchAdapter();

    constructor(
        private readonly sessionManager: ChatSessionManager,
        private readonly transactionPipeline: TransactionPipeline,
        private readonly pendingOperations: Map<string, AnyOperation>,
        private readonly settingsManager: SettingsManager,
        private readonly postMessage: (event: ExtensionEvent) => void,
        private readonly syncState: () => void
    ) {}

    public async execute(payload: string, abortSignal?: AbortSignal): Promise<void> {
        this.postMessage({ type: 'AGENT_TYPING', isTyping: true });
        this.postMessage({ type: 'PIPELINE_STATE', stage: 'parsing', current: 0, total: 0 });

        await new Promise(resolve => setTimeout(resolve, 0));

        try {
            const engineSettings = this.settingsManager.getSettings().engine;
            const astSettings = this.settingsManager.getSettings().ast;
            
            const parseResult = await this.parser.parse(payload, {
                recoveryMode: engineSettings.payloadRecoveryMode,
                polyglotParsing: engineSettings.polyglotParsing,
                searchPort: this.workspaceSearchAdapter 
            });

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
                throw new HandledUIError(`DSL Parsing failed: ${parseResult.error.message}`);
            }

            const parsedOperations = parseResult.value;

            this.postMessage({ type: 'PIPELINE_STATE', stage: 'resolving', current: 0, total: parsedOperations.length });
            
            const compilationResult = await this.compiler.compile(parsedOperations, { 
                engineSettings,
                astSettings
            });
            
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
            
            if (astSettings.autoFixSyntax) {
                for (const op of operations) {
                    if (op.type === 'create_file' && op.content) {
                        (op as any).content = PayloadAutoFixer.fix(op.content, op.path);
                    } else if (op.type === 'update_file' && op.changes) {
                        for (const change of op.changes) {
                            (change as any).replace = PayloadAutoFixer.fix(change.replace, op.path);
                        }
                    }
                }
            }

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

            if (abortSignal?.aborted) throw new HandledUIError('ABORTED_BY_USER');

            await this.transactionPipeline.applyBatch(operations, abortSignal);

            const currentSession = this.sessionManager.getActiveSession();
            const lastMessage = currentSession.messages[currentSession.messages.length - 1];
            
            const totalOps = lastMessage.operations?.length || 0;
            const conflictOps = lastMessage.operations?.filter(op => op.status === 'conflict' || op.status === 'error').length || 0;
            const appliedOps = totalOps - conflictOps;
            
            if (conflictOps > 0) {
                const isAtomic = this.settingsManager.getSettings().workflow.executionMode === 'atomic';
                
                let systemText = '';
                if (isAtomic) {
                    systemText = 'Could not apply changes. The entire transaction was rolled back (Atomic mode) to prevent incomplete modifications. Please resolve the search conflicts below.';
                } else if (appliedOps === 0) {
                    systemText = 'Could not apply any changes. All files encountered conflicts. Please review the errors below.';
                } else {
                    systemText = `Partial success (${appliedOps}/${totalOps} files staged). However, some files encountered matching conflicts and were isolated. Please resolve them below.`;
                }

                this.sessionManager.addMessage({
                    id: Date.now().toString(),
                    role: 'system',
                    text: systemText,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            if (error instanceof HandledUIError) {
                OutputLogger.log(`Payload processing stopped: ${error.message}`, 'WARN');
            } else {
                const errorMsg = error instanceof Error ? error.message : 'Unknown compilation or parsing failure';
                this.sessionManager.addMessage({
                    id: Date.now().toString(),
                    role: 'system',
                    text: errorMsg,
                    timestamp: Date.now()
                });
                OutputLogger.log(`Payload processing failed: ${errorMsg}`, 'ERROR');
            }
        } finally {
            this.postMessage({ type: 'AGENT_TYPING', isTyping: false });
            this.postMessage({ type: 'PIPELINE_STATE', stage: 'idle', current: 0, total: 0 });
            this.syncState();
        }
    }
}