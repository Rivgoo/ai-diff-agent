import { Result } from '@/shared/contracts';
import type { ConflictDetails, ConflictReason } from '@/shared/models';
import type { ITransactionCommand, CommandMetadata } from '@/extension/transactions/core/ITransactionCommand';
import type { ITransactionContext } from '@/extension/transactions/core/ITransactionContext';
import type { AntiAction } from '@/extension/transactions/store/CompensationStore';
import type { AnyOperation } from '@/core/models/operations';

export abstract class BaseCommand<T extends AnyOperation> implements ITransactionCommand {
    public readonly operationId: string;
    public metadata: CommandMetadata = {};
    
    protected antiActions: AntiAction[] = [];
    protected targetPath!: string;
    protected normalizedPath!: string;

    constructor(public readonly operation: T) {
        this.operationId = operation.id;
    }

    public abstract validate(context: ITransactionContext): Promise<Result<void, ConflictDetails>>;
    public abstract prepareBackup(context: ITransactionContext): Promise<void>;
    public abstract apply(context: ITransactionContext): Promise<void>;
    
    public getCompensation(): AntiAction[] {
        return this.antiActions;
    }

    protected buildConflict(
        reason: ConflictReason, 
        candidatePaths?: string[], 
        blockIndex = 0, 
        totalBlocks = 0, 
        searchExcerpt = 'N/A',
        semanticDiagnostic?: string
    ): ConflictDetails {
        return {
            reason,
            blockIndex,
            totalBlocks,
            searchExcerpt,
            originalSearchBlock: '',
            candidatePaths,
            semanticDiagnostic 
        };
    }
}