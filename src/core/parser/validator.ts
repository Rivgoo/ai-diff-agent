import { Result } from '../../shared/contracts';
import { AnyOperation } from '../models/operations';

/**
 * Strict validator designed to parse schema bounds.
 */
export class DomainValidator {
    
    public validate(operations: AnyOperation[]): Result<AnyOperation[]> {
        if (operations.length === 0) {
            return Result.fail(new Error('Payload has no executable file system operations.'));
        }

        for (const op of operations) {
            const baseOp = op as any; // Cast safely for common base parameters
            
            if (!baseOp.path || baseOp.path.trim() === '') {
                return Result.fail(new Error(`Operation of type '${baseOp.type}' has an empty or invalid path.`));
            }

            if (baseOp.type === 'create_file') {
                if (baseOp.content === undefined) {
                    return Result.fail(new Error(`Create file operation on '${baseOp.path}' contains undefined contents.`));
                }
            }

            if (baseOp.type === 'update_file') {
                if (!baseOp.changes || baseOp.changes.length === 0) {
                    return Result.fail(new Error(`Update file operation on '${baseOp.path}' has no change blocks.`));
                }

                for (let i = 0; i < baseOp.changes.length; i++) {
                    const block = baseOp.changes[i];
                    if (block.search === undefined || block.search.trim() === '') {
                        return Result.fail(new Error(`Update file on '${baseOp.path}' has empty search block at index ${i}.`));
                    }
                    if (block.replace === undefined) {
                        return Result.fail(new Error(`Update file on '${baseOp.path}' has undefined replace block at index ${i}.`));
                    }
                }
            }

            if (baseOp.type === 'move_path') {
                if (!baseOp.destinationPath || baseOp.destinationPath.trim() === '') {
                    return Result.fail(new Error(`Move path operation on '${baseOp.path}' is missing its destination.`));
                }
            }
        }

        return Result.ok(operations);
    }
}
