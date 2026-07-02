import type { Range } from '@/shared/contracts';

export interface IUnitOfWork {
    createFile(path: string, content: string, options?: { ignoreIfExists: boolean }): void;
    replace(path: string, range: Range, content: string): void;
    deleteFile(path: string, options?: { recursive: boolean; ignoreIfNotExists: boolean }): void;
    renameFile(oldPath: string, newPath: string, options?: { overwrite: boolean }): void;
    
    commit(): Promise<boolean>;
    
    addAppliedRange(operationId: string, path: string, range: Range): void;
    getAppliedRanges(operationId: string): { path: string; ranges: Range[] } | undefined;
    getModifiedPaths(): string[];
}