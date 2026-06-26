/// <reference types="node" />
/// <reference types="mocha" />

import * as assert from 'assert';
import * as vscode from 'vscode';
import { DirectoryCleanupService } from '../../src/extension/transactions/directoryCleanupService';
import { TransactionManager } from '../../src/extension/transactions/transactionManager';
import { CompensationStore } from '../../src/extension/transactions/compensationStore';
import { DecorationService } from '../../src/extension/transactions/decorationService';
import { resetMockState, mockFilesystem } from '../mocks/vscode.mock';
import type { AnyOperation } from '../../src/core/models/operations';

describe('Transaction-Scoped Directory Cleanup Verification', () => {
    const rootUri = vscode.Uri.parse('file:///workspace');

    beforeEach(() => {
        resetMockState();
    });

    describe('DirectoryCleanupService Unit Tests', () => {
        const cleanupService = new DirectoryCleanupService();

        it('should successfully delete absolutely empty directories', async () => {
            mockFilesystem.set('file:///workspace/src/components/button/', 'DIRECTORY_MARKER');

            const deleted = await cleanupService.cleanupEmptyDirectories(
                ['src/components/button'],
                rootUri
            );

            assert.strictEqual(deleted.length, 1);
            assert.strictEqual(deleted[0].toString(), 'file:///workspace/src/components/button');
            assert.strictEqual(mockFilesystem.has('file:///workspace/src/components/button/'), false);
        });

        it('should bypass cleanup if directory contains active file resources', async () => {
            mockFilesystem.set('file:///workspace/src/components/button/', 'DIRECTORY_MARKER');
            mockFilesystem.set('file:///workspace/src/components/button/Button.tsx', 'export const Button = () => {};');

            const deleted = await cleanupService.cleanupEmptyDirectories(
                ['src/components/button'],
                rootUri
            );

            assert.strictEqual(deleted.length, 0);
            assert.strictEqual(mockFilesystem.has('file:///workspace/src/components/button/Button.tsx'), true);
        });

        it('should clean up directories containing only OS metadata files', async () => {
            mockFilesystem.set('file:///workspace/src/components/button/', 'DIRECTORY_MARKER');
            mockFilesystem.set('file:///workspace/src/components/button/.DS_Store', 'binary metadata');

            const deleted = await cleanupService.cleanupEmptyDirectories(
                ['src/components/button'],
                rootUri
            );

            assert.strictEqual(deleted.length, 1);
            assert.strictEqual(mockFilesystem.has('file:///workspace/src/components/button/.DS_Store'), false);
            assert.strictEqual(mockFilesystem.has('file:///workspace/src/components/button/'), false);
        });

        it('should enforce Root Guard and system directory exclusions', async () => {
            mockFilesystem.set('file:///workspace/.vscode/', 'DIRECTORY_MARKER');

            // Trying to clean the root workspace folder or the .vscode folder
            const deleted = await cleanupService.cleanupEmptyDirectories(
                ['', '.vscode'],
                rootUri
            );

            assert.strictEqual(deleted.length, 0);
            assert.strictEqual(mockFilesystem.has('file:///workspace/.vscode/'), true);
        });
    });

    describe('TransactionManager Integration Scenarios', () => {
        let store: CompensationStore;
        let decorationService: DecorationService;
        let manager: TransactionManager;

        const mockMemento: any = {
            get: () => [],
            update: () => Promise.resolve()
        };

        beforeEach(() => {
            store = new CompensationStore(mockMemento);
            decorationService = new DecorationService();
            manager = new TransactionManager(store, decorationService, () => {});
        });

        it('should automatically track, delete, and rollback empties during batch application', async () => {
            const fileUri = 'file:///workspace/src/features/button/Button.tsx';
            mockFilesystem.set(fileUri, 'export const Button = () => {};');

            const operations: AnyOperation[] = [
                {
                    id: 'tx-cleanup-e2e',
                    type: 'delete_path',
                    path: 'src/features/button/Button.tsx',
                    status: 'pending'
                }
            ];

            // 1. Execute deletion
            await manager.applyBatch(operations);

            // Button.tsx is deleted, making src/features/button, src/features and src empty
            assert.strictEqual(mockFilesystem.has(fileUri), false);
            assert.strictEqual(mockFilesystem.has('file:///workspace/src/features/button/'), false);

            // Verify compensation store registers restore_dir anti-actions
            const txRecord = store.getTransaction('tx-cleanup-e2e');
            assert.ok(txRecord);
            const restoreDirs = txRecord.antiActions.filter(act => act.type === 'restore_dir');
            // Changed expected length from 2 to 3 to correctly account for "src", "src/features" and "src/features/button"
            assert.strictEqual(restoreDirs.length, 3); 

            // 2. Perform Rollback
            await manager.revertBatch();

            // Verify folders are re-created and the file is restored
            assert.strictEqual(mockFilesystem.has('file:///workspace/src/features/button/'), true);
            assert.strictEqual(mockFilesystem.get(fileUri), 'export const Button = () => {};');
        });
    });
});
