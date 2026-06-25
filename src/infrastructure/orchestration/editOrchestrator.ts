import * as vscode from 'vscode';
import { AnyOperation, UpdateFileOperation } from '../../core/models/operations';
import { SearchEngine } from '../../core/matcher/searchEngine';
import { PathResolver } from '../../vscode/workspace/pathResolver';
import { VsCodeDocument } from '../adapters/vsCodeDocument';

/**
 * Transactional orchestrator executing atomic edits on the workspace.
 */
export class EditOrchestrator {
    private readonly searchEngine = new SearchEngine();

    public async applyOperations(operations: AnyOperation[]): Promise<boolean> {
        const workspaceEdit = new vscode.WorkspaceEdit();
        let hasValidEdits = false;

        for (const op of operations) {
            const baseOp = op as any;

            if (baseOp.status === 'applied') {
                continue;
            }

            const success = await this.processOperation(op, workspaceEdit);
            if (!success) {
                baseOp.status = 'error';
                return false; // Transaction fails atomically on any operational conflict
            }
            hasValidEdits = true;
        }

        if (hasValidEdits) {
            const result = await vscode.workspace.applyEdit(workspaceEdit);
            if (result) {
                // Bulk update execution statuses upon atomic commit success
                operations.forEach(op => {
                    const baseOp = op as any;
                    if (baseOp.status !== 'error') {
                        baseOp.status = 'applied';
                    }
                });
            }
            return result;
        }

        return false;
    }

    private async processOperation(op: AnyOperation, edit: vscode.WorkspaceEdit): Promise<boolean> {
        const baseOp = op as any;
        const uri = PathResolver.resolve(baseOp.path);
        if (!uri) {
            baseOp.errorMessage = `Could not resolve absolute path for: ${baseOp.path}`;
            return false;
        }

        switch (baseOp.type) {
            case 'create_file':
                edit.createFile(uri, { ignoreIfExists: true });
                const clearFileRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(99999, 0));
                edit.replace(uri, clearFileRange, (op as any).content);
                return true;

            case 'delete_path':
                edit.deleteFile(uri, { ignoreIfNotExists: true, recursive: true });
                return true;

            case 'create_dir':
                edit.createFile(vscode.Uri.joinPath(uri, '.gitkeep'), { ignoreIfExists: true });
                return true;

            case 'move_path':
                const destUri = PathResolver.resolve((op as any).destinationPath);
                if (destUri) {
                    edit.renameFile(uri, destUri, { overwrite: true });
                    return true;
                }
                baseOp.errorMessage = `Could not resolve destination path: ${(op as any).destinationPath}`;
                return false;

            case 'update_file':
                return await this.prepareUpdateFileEdits(op as UpdateFileOperation, uri, edit);

            default:
                return false;
        }
    }

    private async prepareUpdateFileEdits(
        op: UpdateFileOperation, 
        uri: vscode.Uri, 
        edit: vscode.WorkspaceEdit
    ): Promise<boolean> {
        const baseOp = op as any;
        const document = await PathResolver.readDocumentSafe(uri);
        if (!document) {
            baseOp.errorMessage = `Target file not found: ${baseOp.path}`;
            return false;
        }

        const domainDoc = new VsCodeDocument(document);
        const resolvedEdits: { range: vscode.Range; replace: string }[] = [];

        // 1. JIT Matching Verification
        for (let i = 0; i < op.changes.length; i++) {
            const change = op.changes[i];
            const matchResult = this.searchEngine.findMatch(domainDoc, change.search);

            if (matchResult.status !== 'MATCHED' || !matchResult.range) {
                baseOp.errorMessage = `Change block ${i} failed match in ${baseOp.path}. Reason: ${matchResult.status}`;
                baseOp.status = 'conflict';
                return false;
            }

            const vsCodeRange = new vscode.Range(
                new vscode.Position(matchResult.range.start.line, matchResult.range.start.character),
                new vscode.Position(matchResult.range.end.line, matchResult.range.end.character)
            );

            resolvedEdits.push({ range: vsCodeRange, replace: change.replace });
        }

        // 2. Validate Overlapping Edits to prevent simultaneous blocks corruption
        if (this.detectOverlappingEdits(resolvedEdits)) {
            baseOp.errorMessage = `Overlapping modifications detected inside ${baseOp.path}`;
            baseOp.status = 'conflict';
            return false;
        }

        // 3. Sort bottom-up (Reverse sorting) to lock in-memory offsets stability
        resolvedEdits.sort((a, b) => b.range.start.compareTo(a.range.start));

        // 4. Populate workspace transaction edit
        for (const resolved of resolvedEdits) {
            edit.replace(uri, resolved.range, resolved.replace);
        }

        return true;
    }

    private detectOverlappingEdits(edits: { range: vscode.Range }[]): boolean {
        for (let i = 0; i < edits.length; i++) {
            for (let j = i + 1; j < edits.length; j++) {
                const r1 = edits[i].range;
                const r2 = edits[j].range;
                // Intersection verification
                if (r1.start.isBefore(r2.end) && r2.start.isBefore(r1.end)) {
                    return true;
                }
            }
        }
        return false;
    }
}
