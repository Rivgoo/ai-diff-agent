import type { ResolutionResult } from '../models';
import type { IFileSystemPort, IWorkspaceSearchPort } from '../ports';

export interface ResolutionLogger {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
}

export interface ResolutionOptions {
    respectGitIgnore?: boolean;
    maxGlobalSearchCandidates?: number;
    logger?: ResolutionLogger; 
}

export interface IPathResolutionStrategy {
    readonly name: string;
    resolve(
        rawPath: string,
        fs: IFileSystemPort,
        search: IWorkspaceSearchPort,
        searchBlock?: string,
        options?: ResolutionOptions
    ): Promise<ResolutionResult | null>;
}