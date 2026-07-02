import type { IUnitOfWork } from '@/extension/transactions/core/IUnitOfWork';
import type { ILogger } from '@/extension/transactions/core/ILogger';
import type { SearchEngine } from '@/core/matcher/searchEngine';
import type { ResilientPathResolver } from '@/core/resolver/resilientPathResolver';
import type { SettingsManager } from '@/extension/settings/settingsManager';
import type { IDocument } from '@/core/matcher/documentPort';

export interface ITransactionContext {
    readonly rootName: string;
    readonly uow: IUnitOfWork;
    readonly searchEngine: SearchEngine;
    readonly pathResolver: ResilientPathResolver;
    readonly logger: ILogger;
    readonly settingsManager: SettingsManager;

    getResolvedPath(rawPath: string): string | undefined;
    setResolvedPath(rawPath: string, actualPath: string): void;
    getDocument(relativePath: string): Promise<IDocument>;
    ensureDirectoryExists(targetRelativeDirPath: string): Promise<string[]>;
    fileExists(relativePath: string): Promise<boolean>;
    
    // ДОДАНО: Чистий доменний метод для створення бекапу
    createBackup(operationId: string, relativePath: string): Promise<void>;
}