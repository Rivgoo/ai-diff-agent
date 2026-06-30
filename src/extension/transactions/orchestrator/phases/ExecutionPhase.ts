import type { ITransactionCommand } from '../../core/ITransactionCommand';
import type { ITransactionContext } from '../../core/ITransactionContext';

export class ExecutionPhase {
    public async execute(commands: ITransactionCommand[], context: ITransactionContext): Promise<void> {
        // Step 1: Snapshot Isolation
        for (const cmd of commands) {
            await cmd.prepareBackup(context);
        }
        // Step 2: Memory Staging
        for (const cmd of commands) {
            await cmd.apply(context);
        }
    }
}