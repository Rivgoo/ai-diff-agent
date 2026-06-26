import { Result } from '../../shared/contracts';
import type { AnyOperation } from '../models/operations';
import { 
    isCreateFileOperation, 
    isUpdateFileOperation, 
    isMovePathOperation 
} from '../models/operations';

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
            // Validate absolute presence of file workspace target paths
            if (!op.path || op.path.trim() === '') {
                return Result.fail(new Error(`Operation of type '${op.type}' contains an invalid or empty path.`));
            }

            const normalizedPath = op.path.replace(/\\/g, '/').trim();

            // Track same-batch operations collision
            if (!pathActivityMap.has(normalizedPath)) {
                pathActivityMap.set(normalizedPath, []);
            }
            pathActivityMap.get(normalizedPath)!.push(op.type);

            // Verify specific constraints per operation type
            if (isCreateFileOperation(op)) {
                if (op.content === undefined) {
                    return Result.fail(new Error(`Create file operation on '${op.path}' contains undefined content.`));
                }
            }

            if (isUpdateFileOperation(op)) {
                if (!op.changes || op.changes.length === 0) {
                    return Result.fail(new Error(`Update file operation on '${op.path}' is missing structural change blocks.`));
                }

                for (let i = 0; i < op.changes.length; i++) {
                    const block = op.changes[i];
                    if (block.search === undefined || block.search.trim() === '') {
                        return Result.fail(new Error(`Update file on '${op.path}' has an empty search block at index ${i}.`));
                    }
                    if (block.replace === undefined) {
                        return Result.fail(new Error(`Update file on '${op.path}' has an undefined replace block at index ${i}.`));
                    }
                }
            }

            if (isMovePathOperation(op)) {
                if (!op.destinationPath || op.destinationPath.trim() === '') {
                    return Result.fail(new Error(`Move path operation on '${op.path}' is missing its destination Path.`));
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