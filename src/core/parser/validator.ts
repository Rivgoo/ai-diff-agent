import { Result } from '../../shared/contracts';
import type { AnyOperation } from '../models/operations';

/**
 * Domain AST Validator.
 * Handles extensive verification checks of parsed AST instructions to guarantee 
 * execution safety, preventing operations collision and validating required payload structures.
 */
export class DomainValidator {
    
    /**
     * Evaluates a flat collection of operations. 
     * Verifies structures and prevents path traversal collisions within the same execution batch.
     */
    public validate(operations: AnyOperation[]): Result<AnyOperation[]> {
        if (operations.length === 0) {
            return Result.fail(new Error('Payload contains no executable operations.'));
        }

        const pathActivityMap = new Map<string, string[]>();

        for (const op of operations) {
            const baseOp = op as any; 
            
            // Validate absolute presence of file workspace target paths
            if (!baseOp.path || baseOp.path.trim() === '') {
                return Result.fail(new Error(`Operation of type '${baseOp.type}' contains an invalid or empty path.`));
            }

            const normalizedPath = baseOp.path.replace(/\\/g, '/').trim();

            // Track same-batch operations collision
            if (!pathActivityMap.has(normalizedPath)) {
                pathActivityMap.set(normalizedPath, []);
            }
            pathActivityMap.get(normalizedPath)!.push(op.type);

            // Verify specific constraints per operation type
            if (baseOp.type === 'create_file') {
                if (baseOp.content === undefined) {
                    return Result.fail(new Error(`Create file operation on '${baseOp.path}' contains undefined content.`));
                }
            }

            if (baseOp.type === 'update_file') {
                if (!baseOp.changes || baseOp.changes.length === 0) {
                    return Result.fail(new Error(`Update file operation on '${baseOp.path}' is missing structural change blocks.`));
                }

                for (let i = 0; i < baseOp.changes.length; i++) {
                    const block = baseOp.changes[i];
                    if (block.search === undefined || block.search.trim() === '') {
                        return Result.fail(new Error(`Update file on '${baseOp.path}' has an empty search block at index ${i}.`));
                    }
                    if (block.replace === undefined) {
                        return Result.fail(new Error(`Update file on '${baseOp.path}' has an undefined replace block at index ${i}.`));
                    }
                }
            }

            if (baseOp.type === 'move_path') {
                if (!baseOp.destinationPath || baseOp.destinationPath.trim() === '') {
                    return Result.fail(new Error(`Move path operation on '${baseOp.path}' is missing its destination Path.`));
                }
            }
        }

        // Evaluate batch integrity and collisions
        for (const [filePath, activities] of pathActivityMap.entries()) {
            if (activities.includes('delete_path') && activities.includes('create_file')) {
                return Result.fail(new Error(
                    `Collision detected: File path '${filePath}' cannot be created and deleted in the same execution batch.`
                ));
            }
            if (activities.filter(type => type === 'create_file').length > 1) {
                return Result.fail(new Error(
                    `Collision detected: Duplicate file creation request for path '${filePath}' in the same execution batch.`
                ));
            }
        }

        return Result.ok(operations);
    }
}
