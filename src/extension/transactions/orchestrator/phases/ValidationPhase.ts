import type { ITransactionCommand } from '../../core/ITransactionCommand';
import type { ITransactionContext } from '../../core/ITransactionContext';
import type { ConflictDetails } from '@/shared/models';

export interface ValidationSummary {
    validCommands: ITransactionCommand[];
    conflicts: Map<string, ConflictDetails>;
}

export class ValidationPhase {
    public async execute(
        commands: ITransactionCommand[], 
        context: ITransactionContext
    ): Promise<ValidationSummary> {
        const validCommands: ITransactionCommand[] = [];
        const conflicts = new Map<string, ConflictDetails>();

        for (const cmd of commands) {
            const res = await cmd.validate(context);
            if (!res.success) {
                conflicts.set(cmd.operationId, res.error);
            } else {
                validCommands.push(cmd);
            }
        }
        
        return { validCommands, conflicts };
    }
}