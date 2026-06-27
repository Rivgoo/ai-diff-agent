import type { AnyOperation, ChangeBlock } from '../models/operations';
import { Result } from '../../shared/contracts';

export type FileNodeState = 'UNTOUCHED' | 'CREATED' | 'MODIFIED' | 'DELETED' | 'MOVED';

export interface VirtualFileNode {
    readonly originalPath: string;
    currentPath: string;
    state: FileNodeState;
    contentBuffer?: string;
    stagedChanges: ChangeBlock[];
    targetPath?: string;
}

export interface CompilerWarning {
    readonly operationId: string;
    readonly reason: string;
    readonly path: string;
}

export interface CompilationResult {
    readonly operations: AnyOperation[];
    readonly warnings: CompilerWarning[];
}

export interface ITransactionCompiler {
    compile(rawOperations: AnyOperation[]): Promise<Result<CompilationResult>>;
}
