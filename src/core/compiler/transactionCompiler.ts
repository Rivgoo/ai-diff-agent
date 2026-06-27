import { Result } from '../../shared/contracts';
import { 
    AnyOperation, 
    isCreateFileOperation, 
    isDeletePathOperation, 
    isUpdateFileOperation, 
    isMovePathOperation 
} from '../models/operations';
import { ITransactionCompiler, CompilationResult, CompilerWarning } from './models';
import { VirtualWorkspace } from './virtualWorkspace';
import { OperationReducer } from './operationReducer';

/**
 * AST Optimizer Facade.
 * Processes chronological LLM payloads into flat, conflict-free disk instructions.
 */
export class TransactionCompiler implements ITransactionCompiler {
    
    public compile(rawOperations: AnyOperation[]): Result<CompilationResult> {
        try {
            const workspace = new VirtualWorkspace();
            const warnings: CompilerWarning[] = [];
            const reducer = new OperationReducer(workspace, warnings);

            // Phase A: Reduce chronologically into the Virtual Workspace Memory State
            for (const op of rawOperations) {
                if (isCreateFileOperation(op)) {
                    reducer.applyCreate(op);
                } else if (isDeletePathOperation(op)) {
                    reducer.applyDelete(op);
                } else if (isUpdateFileOperation(op)) {
                    reducer.applyUpdate(op);
                } else if (isMovePathOperation(op)) {
                    reducer.applyMove(op);
                }
            }

            // Phase B: Emit flattened AST tailored for the underlying Transaction Manager
            const flattenedOperations = this.emitAST(workspace, rawOperations);

            return Result.ok({
                operations: flattenedOperations,
                warnings
            });

        } catch (error) {
            return Result.fail(error instanceof Error ? error : new Error('Fatal Compilation Error'));
        }
    }

    /**
     * Translates Virtual File Nodes back into actionable Domain Operations.
     */
    private emitAST(workspace: VirtualWorkspace, rawOperations: AnyOperation[]): AnyOperation[] {
        const output: AnyOperation[] = [];
        
        for (const node of workspace.getAllNodes()) {
            if (node.state === 'CREATED') {
                output.push({
                    id: this.generateId(),
                    type: 'create_file',
                    path: node.currentPath,
                    content: node.contentBuffer || '',
                    status: 'pending'
                });
            } 
            else if (node.state === 'DELETED') {
                // Regardless of moves prior to deletion, just delete the original physical file
                output.push({
                    id: this.generateId(),
                    type: 'delete_path',
                    path: node.originalPath, 
                    status: 'pending'
                });
            } 
            else {
                // Handles UNTOUCHED, MODIFIED, and implicit MOVED nodes.
                // CRITICAL LOGIC: If a file is both updated and moved, we MUST emit the `update_file` 
                // targeting the ORIGINAL path before emitting the `move_path`. This prevents the 
                // physical TransactionManager from failing Pre-Flight file-exists validation checks.
                
                if (node.stagedChanges.length > 0) {
                    output.push({
                        id: this.generateId(),
                        type: 'update_file',
                        path: node.originalPath, // Always update the original source file on disk
                        changes: node.stagedChanges,
                        status: 'pending'
                    });
                }
                
                if (node.originalPath !== node.currentPath) {
                    output.push({
                        id: this.generateId(),
                        type: 'move_path',
                        path: node.originalPath,
                        destinationPath: node.currentPath,
                        status: 'pending'
                    });
                }
            }
        }

        // Pass-through scaffold operations unaffected by file reduction rules
        for (const rawOp of rawOperations) {
            if (rawOp.type === 'create_dir') {
                output.push(rawOp);
            }
        }

        return output;
    }

    /**
     * Generates an internal identifier for compiled operations.
     */
    private generateId(): string {
        return 'cmp-' + Math.random().toString(36).substring(2, 9);
    }
}
