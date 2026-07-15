import type { Range } from '@/shared/contracts';

export interface AppliedBlock {
    range: Range;
    originalSearch: string;
}

export interface IUnitOfWork {
    createFile(path: string, content: string, options?: { ignoreIfExists: boolean }): void;
    replace(path: string, range: Range, content: string): void;
    deleteFile(path: string, options?: { recursive: boolean; ignoreIfNotExists: boolean }): void;
    renameFile(oldPath: string, newPath: string, options?: { overwrite: boolean }): void;
    
    commit(): Promise<boolean>;
    
    addAppliedBlock(operationId: string, path: string, block: AppliedBlock): void; 
    getAppliedBlocks(operationId: string): { path: string; blocks: AppliedBlock[] } | undefined; 
    getModifiedPaths(): string[];
}