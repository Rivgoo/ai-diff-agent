import { Result } from '@/shared/contracts';
import type { ConflictDetails } from '@/shared/models';
import type { ITransactionContext } from '@/extension/transactions/core/ITransactionContext';
import type { AntiAction } from '@/extension/transactions/store/CompensationStore';
import type { AnyOperation } from '@/core/models/operations';

export interface CommandMetadata {
    resolvedResiliently?: boolean;
    originalPath?: string;
    path?: string;
}

export interface ITransactionCommand {
    readonly operationId: string;
    readonly metadata: CommandMetadata;
    readonly operation: AnyOperation;
    
    validate(context: ITransactionContext): Promise<Result<void, ConflictDetails>>;
    prepareBackup(context: ITransactionContext): Promise<void>;
    apply(context: ITransactionContext): Promise<void>;
    getCompensation(): AntiAction[];
}
