import { Result } from '../../shared/contracts';
import { 
    type AnyOperation, 
    isCreateFileOperation, 
    isDeletePathOperation, 
    isUpdateFileOperation, 
    isMovePathOperation 
} from '../models/operations';
import type { ITransactionCompiler, CompilationResult, CompilerWarning } from './models';
import { VirtualWorkspace } from './virtualWorkspace';
import { OperationReducer } from './operationReducer';

export class TransactionCompiler implements ITransactionCompiler {
    
    public async compile(rawOperations: AnyOperation[]): Promise<Result<CompilationResult>> {
        try {
            const workspace = new VirtualWorkspace();
            const warnings: CompilerWarning[] = [];
            const reducer = new OperationReducer(workspace, warnings);

            for (const op of rawOperations) {
                if (isCreateFileOperation(op)) {
                    reducer.applyCreate(op);
                } else if (isDeletePathOperation(op)) {
                    reducer.applyDelete(op);
                } else if (isUpdateFileOperation(op)) {
                    await reducer.applyUpdate(op);
                } else if (isMovePathOperation(op)) {
                    reducer.applyMove(op);
                }
            }

            const flattenedOperations = this.emitAST(workspace, rawOperations);

            return Result.ok({
                operations: flattenedOperations,
                warnings
            });

        } catch (error) {
            return Result.fail(error instanceof Error ? error : new Error('Fatal Compilation Error'));
        }
    }

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
                output.push({
                    id: this.generateId(),
                    type: 'delete_path',
                    path: node.originalPath, 
                    status: 'pending'
                });
            } 
            else {
                if (node.stagedChanges.length > 0) {
                    output.push({
                        id: this.generateId(),
                        type: 'update_file',
                        path: node.originalPath,
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

        for (const rawOp of rawOperations) {
            if (rawOp.type === 'create_dir') {
                output.push(rawOp);
            }
        }

        return output;
    }

    private generateId(): string {
        return 'cmp-' + Math.random().toString(36).substring(2, 9);
    }
}
