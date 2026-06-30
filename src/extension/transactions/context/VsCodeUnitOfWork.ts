import * as vscode from 'vscode';
import type { IUnitOfWork } from '../core/IUnitOfWork';
import type { Range } from '@/shared/contracts';

export class VsCodeUnitOfWork implements IUnitOfWork {
    private readonly edit = new vscode.WorkspaceEdit();
    private readonly appliedRanges = new Map<string, { path: string; ranges: Range[] }>();
    private readonly modifiedPaths = new Set<string>();
    private readonly modifiedPathsList: string[] = [];

    constructor(private readonly workspaceRootUri: vscode.Uri) {}

    public getAbsoluteUri(relativePath: string): vscode.Uri {
        const cleanPath = relativePath.replace(/^[\/\\]+/, '');
        return vscode.Uri.joinPath(this.workspaceRootUri, cleanPath);
    }

    public createFile(path: string, content: string, options?: { ignoreIfExists: boolean }): void {
        const uri = this.getAbsoluteUri(path);
        this.edit.createFile(uri, options);
        this.edit.insert(uri, new vscode.Position(0, 0), content);
        this.trackPath(path);
    }

    public replace(path: string, range: Range, content: string): void {
        const uri = this.getAbsoluteUri(path);
        const vsRange = new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character);
        this.edit.replace(uri, vsRange, content);
        this.trackPath(path);
    }

    public deleteFile(path: string, options?: { recursive: boolean; ignoreIfNotExists: boolean }): void {
        this.edit.deleteFile(this.getAbsoluteUri(path), options);
    }

    public renameFile(oldPath: string, newPath: string, options?: { overwrite: boolean }): void {
        this.edit.renameFile(this.getAbsoluteUri(oldPath), this.getAbsoluteUri(newPath), options);
        this.trackPath(newPath);
    }

    public async commit(): Promise<boolean> {
        return vscode.workspace.applyEdit(this.edit);
    }

    public addAppliedRange(operationId: string, path: string, range: Range): void {
        const existing = this.appliedRanges.get(operationId) || { path, ranges: [] };
        existing.ranges.push(range);
        this.appliedRanges.set(operationId, existing);
    }

    public getAppliedRanges(operationId: string): { path: string; ranges: Range[] } | undefined {
        return this.appliedRanges.get(operationId);
    }

    public getModifiedPaths(): string[] {
        return this.modifiedPathsList;
    }

    private trackPath(path: string): void {
        if (!this.modifiedPaths.has(path)) {
            this.modifiedPaths.add(path);
            this.modifiedPathsList.push(path);
        }
    }
}