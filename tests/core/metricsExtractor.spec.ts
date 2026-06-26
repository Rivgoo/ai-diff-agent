import * as assert from 'assert';
import { PayloadMetricsExtractor } from '@/core/parser/metricsExtractor';
import type { AnyOperation } from '@/core/models/operations';

describe('PayloadMetricsExtractor Unit Tests', () => {
    it('should return zeroed counts for empty operations lists', () => {
        const rawInput = '<workspace_edit></workspace_edit>';
        const summary = PayloadMetricsExtractor.extract([], rawInput);

        assert.strictEqual(summary.rawInput, rawInput);
        assert.strictEqual(summary.totalCreatedFiles, 0);
        assert.strictEqual(summary.totalUpdatedFiles, 0);
        assert.strictEqual(summary.totalDeletedPaths, 0);
        assert.strictEqual(summary.totalMovedPaths, 0);
        assert.strictEqual(summary.totalCreatedDirs, 0);
        assert.strictEqual(summary.codeImpact.additions, 0);
        assert.strictEqual(summary.codeImpact.deletions, 0);
    });

    it('should calculate additions correctly for create_file operations', () => {
        const ops: AnyOperation[] = [
            {
                id: 'op-1',
                type: 'create_file',
                path: 'src/index.ts',
                content: 'const a = 1;\nconst b = 2;\nconst c = 3;',
                status: 'pending'
            }
        ];

        const summary = PayloadMetricsExtractor.extract(ops, 'dummy-input');
        assert.strictEqual(summary.totalCreatedFiles, 1);
        assert.strictEqual(summary.codeImpact.additions, 3);
        assert.strictEqual(summary.codeImpact.deletions, 0);
    });

    it('should normalize CRLF line endings when calculating additions', () => {
        const ops: AnyOperation[] = [
            {
                id: 'op-1',
                type: 'create_file',
                path: 'src/index.ts',
                content: 'const a = 1;\r\nconst b = 2;\r\nconst c = 3;',
                status: 'pending'
            }
        ];

        const summary = PayloadMetricsExtractor.extract(ops, 'dummy-input');
        assert.strictEqual(summary.codeImpact.additions, 3);
    });

    it('should calculate additions and deletions for update_file change blocks', () => {
        const ops: AnyOperation[] = [
            {
                id: 'op-2',
                type: 'update_file',
                path: 'src/index.ts',
                changes: [
                    {
                        search: 'const a = 1;\nconst b = 2;',
                        replace: 'const a = 10;\nconst b = 20;\nconst c = 30;'
                    }
                ],
                status: 'pending'
            }
        ];

        const summary = PayloadMetricsExtractor.extract(ops, 'dummy-input');
        assert.strictEqual(summary.totalUpdatedFiles, 1);
        assert.strictEqual(summary.codeImpact.deletions, 2);
        assert.strictEqual(summary.codeImpact.additions, 3);
    });

    it('should accumulate metrics across multiple operations in a batch', () => {
        const ops: AnyOperation[] = [
            {
                id: 'op-1',
                type: 'create_file',
                path: 'src/new-file.ts',
                content: 'console.log("hello");',
                status: 'pending'
            },
            {
                id: 'op-2',
                type: 'update_file',
                path: 'src/index.ts',
                changes: [
                    {
                        search: 'old_line_1\nold_line_2',
                        replace: 'new_line_1'
                    }
                ],
                status: 'pending'
            },
            {
                id: 'op-3',
                type: 'delete_path',
                path: 'src/legacy.ts',
                status: 'pending'
            },
            {
                id: 'op-4',
                type: 'move_path',
                path: 'src/old.ts',
                destinationPath: 'src/new.ts',
                status: 'pending'
            },
            {
                id: 'op-5',
                type: 'create_dir',
                path: 'src/assets',
                status: 'pending'
            }
        ];

        const summary = PayloadMetricsExtractor.extract(ops, 'batch-input');
        assert.strictEqual(summary.totalCreatedFiles, 1);
        assert.strictEqual(summary.totalUpdatedFiles, 1);
        assert.strictEqual(summary.totalDeletedPaths, 1);
        assert.strictEqual(summary.totalMovedPaths, 1);
        assert.strictEqual(summary.totalCreatedDirs, 1);

        assert.strictEqual(summary.codeImpact.additions, 2);
        assert.strictEqual(summary.codeImpact.deletions, 3);
    });

    it('should handle empty or whitespace-only code blocks gracefully', () => {
        const ops: AnyOperation[] = [
            {
                id: 'op-1',
                type: 'create_file',
                path: 'src/empty.ts',
                content: '   \n  \n',
                status: 'pending'
            }
        ];

        const summary = PayloadMetricsExtractor.extract(ops, 'whitespace');
        assert.strictEqual(summary.codeImpact.additions, 3);

        const emptyOps: AnyOperation[] = [
            {
                id: 'op-2',
                type: 'create_file',
                path: 'src/empty2.ts',
                content: '',
                status: 'pending'
            }
        ];
        const emptySummary = PayloadMetricsExtractor.extract(emptyOps, 'empty');
        assert.strictEqual(emptySummary.codeImpact.additions, 0);
    });
});
