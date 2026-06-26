import type { AnyOperation } from '@/core/models/operations';
import type { PayloadSummary } from '@/shared/contracts';

export class PayloadMetricsExtractor {
    /**
     * Extracts structural stats and counts from a list of validated parser operations.
     * Operates with O(N) linear complexity.
     */
    public static extract(operations: AnyOperation[], rawInput: string): PayloadSummary {
        let totalCreatedFiles = 0;
        let totalUpdatedFiles = 0;
        let totalDeletedPaths = 0;
        let totalMovedPaths = 0;
        let totalCreatedDirs = 0;
        
        let additions = 0;
        let deletions = 0;

        for (const op of operations) {
            switch (op.type) {
                case 'create_file': {
                    totalCreatedFiles++;
                    additions += this.countLines(op.content);
                    break;
                }
                case 'update_file': {
                    totalUpdatedFiles++;
                    for (const change of op.changes) {
                        deletions += this.countLines(change.search);
                        additions += this.countLines(change.replace);
                    }
                    break;
                }
                case 'delete_path': {
                    totalDeletedPaths++;
                    deletions += 1;
                    break;
                }
                case 'move_path': {
                    totalMovedPaths++;
                    break;
                }
                case 'create_dir': {
                    totalCreatedDirs++;
                    break;
                }
            }
        }

        return {
            rawInput: rawInput.trim(),
            totalCreatedFiles,
            totalUpdatedFiles,
            totalDeletedPaths,
            totalMovedPaths,
            totalCreatedDirs,
            codeImpact: {
                additions,
                deletions
            }
        };
    }

    /**
     * Counts lines inside a text stream, normalizing carriage return sequences.
     * Returns 0 for empty, undefined or null buffers.
     */
    public static countLines(text: string | undefined | null): number {
        if (text === undefined || text === null) {
            return 0;
        }
        const normalized = text.replace(/\r\n/g, '\n');
        if (normalized === '') {
            return 0;
        }
        return normalized.split('\n').length;
    }
}
