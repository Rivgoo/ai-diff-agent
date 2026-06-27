import type { AnyOperation, ChangeBlock } from '../models/operations';
import { Result } from '../../shared/contracts';

/**
 * Represents the lifecycle state of a file within the boundaries of a single transaction.
 */
export type FileNodeState = 
    | 'UNTOUCHED'   // File exists on disk, no modifications attempted yet
    | 'CREATED'     // File was created from scratch in this transaction
    | 'MODIFIED'    // Existing file received update blocks
    | 'DELETED'     // File is marked for complete deletion
    | 'MOVED';      // File was moved (current node acts as a redirect)

/**
 * In-memory representation of a file undergoing modifications.
 * Accumulates chronological actions into a final deterministic state.
 */
export interface VirtualFileNode {
    readonly originalPath: string;
    currentPath: string;
    state: FileNodeState;
    contentBuffer?: string;       // Holds raw text for CREATED states
    stagedChanges: ChangeBlock[]; // Accumulates search/replace blocks for MODIFIED states
    targetPath?: string;          // Points to the new path if state is MOVED
}

/**
 * Warning record for dropped or logically invalid LLM operations that were safely absorbed.
 */
export interface CompilerWarning {
    readonly operationId: string;
    readonly reason: string;
    readonly path: string;
}

/**
 * Result payload containing the flattened AST and observability metadata.
 */
export interface CompilationResult {
    readonly operations: AnyOperation[];
    readonly warnings: CompilerWarning[];
}

/**
 * Standard contract for the Transaction Compiler Orchestrator.
 */
export interface ITransactionCompiler {
    /**
     * Transforms a raw array of chronological LLM operations into a deterministic,
     * conflict-free flat array of operations ready for disk application.
     */
    compile(rawOperations: AnyOperation[]): Result<CompilationResult>;
}
