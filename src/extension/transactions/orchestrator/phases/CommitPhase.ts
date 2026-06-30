import * as vscode from 'vscode';
import type { AnyOperation } from '@/core/models/operations';
import type { ITransactionCommand } from '../../core/ITransactionCommand';
import type { ITransactionContext } from '../../core/ITransactionContext';
import type { CompensationStore } from '../../store/CompensationStore';
import type { DecorationService } from '../../services/DecorationService';
import type { DirectoryCleanupService } from '../../services/DirectoryCleanupService';
import type { EditorService } from '../../services/EditorService';
import type { OperationStatusUpdate } from '../../core/TransactionEvents';
import { PathNormalizer } from '@/core/workspace/pathNormalizer';

export class CommitPhase {
    constructor(
        private readonly store: CompensationStore,
        private readonly decorationService: DecorationService,
        private readonly directoryCleanupService: DirectoryCleanupService,
        private readonly editorService: EditorService,
        private readonly onStatusUpdate: (event: OperationStatusUpdate) => void
    ) {}

    public async execute(
        commands: ITransactionCommand[],
        pendingOps: AnyOperation[],
        context: ITransactionContext,
        rootName: string,
        rootUri: vscode.Uri
    ): Promise<void> {
        const committed = await context.uow.commit();
        if (!committed) {
            throw new Error("Workspace edit commit failed at VS Code FS level.");
        }

        const allCandidateDirs = this.extractAllDirectoryCandidates(pendingOps, rootName);
        const cleanedDirs = await this.directoryCleanupService.cleanupEmptyDirectories(allCandidateDirs, rootUri);

        for (const cmd of commands) {
            const antiActions = cmd.getCompensation();
            const cmdCandidates = this.extractDirectoryCandidates(cmd.operation, rootName);

            for (const dirUri of cleanedDirs) {
                const relativeDir = PathNormalizer.normalize(dirUri.fsPath);
                if (cmdCandidates.includes(relativeDir)) {
                    antiActions.push({ type: 'restore_dir', path: relativeDir });
                }
            }

            if (antiActions.length > 0) {
                this.store.addTransaction({ operationId: cmd.operationId, antiActions });
                this.onStatusUpdate({
                    operationId: cmd.operationId,
                    status: 'applied_dirty',
                    ...cmd.metadata
                });

                const appliedData = context.uow.getAppliedRanges(cmd.operationId);
                if (appliedData) {
                    const vsUri = (context.uow as any).getAbsoluteUri(appliedData.path);
                    const vsRanges = appliedData.ranges.map(r => new vscode.Range(r.start.line, r.start.character, r.end.line, r.end.character));
                    this.decorationService.addDecorations(vsUri, cmd.operationId, vsRanges);
                }
            } else {
                this.onStatusUpdate({
                    operationId: cmd.operationId,
                    status: 'saved',
                    ...cmd.metadata
                });
            }
        }

        if (context.settingsManager.getSettings().engine.autoFormatOnApply) {
            const formatUris = context.uow.getModifiedPaths().map(p => (context.uow as any).getAbsoluteUri(p));
            await this.editorService.formatFilesSilently(formatUris);
        }
    }

    private extractAllDirectoryCandidates(operations: AnyOperation[], rootName: string): string[] {
        return operations.flatMap(op => this.extractDirectoryCandidates(op, rootName));
    }

    private extractDirectoryCandidates(op: AnyOperation, _rootName: string): string[] {
        const candidates: string[] = [];
        if (op.type === 'delete_path' || op.type === 'move_path') {
            const normalizedPath = PathNormalizer.normalize((op as any).path);
            let currentDir = normalizedPath.split('/').slice(0, -1).join('/');
            while (currentDir) {
                candidates.push(currentDir);
                currentDir = currentDir.split('/').slice(0, -1).join('/');
            }
        }
        return candidates;
    }
}