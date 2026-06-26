/// <reference types="node" />
/// <reference types="mocha" />

import * as assert from 'assert';
import * as vscode from 'vscode';
import { SnapshotService } from '../../src/extension/transactions/snapshotService';
import { resetMockState, mockFilesystem, mockLiveDocuments } from '../mocks/vscode.mock';

describe('SnapshotService Integration Tests (Virtual Sandboxed FS)', () => {
    const rootUri = vscode.Uri.parse('file:///workspace');

    beforeEach(() => {
        resetMockState();
    });

    it('should create an isolated backup using cold file state from virtual disk', async () => {
        const fileUri = vscode.Uri.parse('file:///workspace/src/test.ts');
        mockFilesystem.set(fileUri.toString(), 'console.log("cold content");');

        const service = new SnapshotService();
        await service.createSnapshot(rootUri, 'op-1', 'src/test.ts', fileUri);

        const expectedBase64 = Buffer.from('src/test.ts').toString('base64').replace(/=+$/, '');
        const backupUriStr = `file:///workspace/.vscode/.ai-backups/op-1/${expectedBase64}`;

        assert.strictEqual(mockFilesystem.has(backupUriStr), true);
        assert.strictEqual(mockFilesystem.get(backupUriStr), 'console.log("cold content");');
    });

    it('should prioritize live dirty memory buffer text over cold virtual disk storage', async () => {
        const fileUri = vscode.Uri.parse('file:///workspace/src/test.ts');
        
        mockFilesystem.set(fileUri.toString(), 'console.log("old state");');

        mockLiveDocuments.push({
            uri: fileUri,
            isDirty: true,
            getText: () => 'console.log("active modification!");'
        });

        const service = new SnapshotService();
        await service.createSnapshot(rootUri, 'op-2', 'src/test.ts', fileUri);

        const expectedBase64 = Buffer.from('src/test.ts').toString('base64').replace(/=+$/, '');
        const backupUriStr = `file:///workspace/.vscode/.ai-backups/op-2/${expectedBase64}`;

        assert.strictEqual(mockFilesystem.get(backupUriStr), 'console.log("active modification!");');
    });

    it('should restore original state from snapshot successfully', async () => {
        const fileUri = vscode.Uri.parse('file:///workspace/src/test.ts');
        
        const service = new SnapshotService();
        
        const expectedBase64 = Buffer.from('src/test.ts').toString('base64').replace(/=+$/, '');
        const backupUriStr = `file:///workspace/.vscode/.ai-backups/op-3/${expectedBase64}`;
        mockFilesystem.set(backupUriStr, 'original backup content');

        await service.restoreSnapshot(rootUri, 'op-3', 'src/test.ts', fileUri);

        assert.strictEqual(mockFilesystem.get(fileUri.toString()), 'original backup content');
    });

    it('should purge snapshots selectively for individual operations', async () => {
        const service = new SnapshotService();

        const backup1 = 'file:///workspace/.vscode/.ai-backups/op-a/file1';
        const backup2 = 'file:///workspace/.vscode/.ai-backups/op-b/file2';

        mockFilesystem.set(backup1, 'content a');
        mockFilesystem.set(backup2, 'content b');

        await service.purgeSnapshotForOp(rootUri, 'op-a');

        assert.strictEqual(mockFilesystem.has(backup1), false);
        assert.strictEqual(mockFilesystem.has(backup2), true);
    });
});
