import type { ITransactionCommand } from '../../core/ITransactionCommand';
import type { ITransactionContext } from '../../core/ITransactionContext';
import type { ConflictDetails } from '@/shared/models';
import { Result } from '@/shared/contracts';

export class ValidationPhase {
    public async execute(
        commands: ITransactionCommand[], 
        context: ITransactionContext
    ): Promise<Result<void, { failedId: string, conflict: ConflictDetails }>> {
        for (const cmd of commands) {
            const res = await cmd.validate(context);
            if (!res.success) {
                return Result.fail({ failedId: cmd.operationId, conflict: res.error });
            }
        }
        return Result.ok(undefined);
    }
}