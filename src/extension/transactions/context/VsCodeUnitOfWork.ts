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
        // ФІКС: Жорсткий захист від від'ємних координат
        const startLine = Math.max(0, range.start.line);
        const startChar = Math.max(0, range.start.character);
        const endLine = Math.max(0, range.end.line);
        const endChar = Math.max(0, range.end.character);
        
        const vsRange = new vscode.Range(startLine, startChar, endLine, endChar);
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
        if (this.modifiedPathsList.length === 0) {
            return true;
        }
        
        return vscode.workspace.applyEdit(this.edit);
    }

    private readonly appliedBlocks = new Map<string, { path: string; blocks: { range: Range; originalSearch: string }[] }>();

    public addAppliedBlock(operationId: string, path: string, block: { range: Range; originalSearch: string }): void {
        const existing = this.appliedBlocks.get(operationId) || { path, blocks: [] };
        existing.blocks.push(block);
        this.appliedBlocks.set(operationId, existing);
    }

    public getAppliedBlocks(operationId: string): { path: string; blocks: { range: Range; originalSearch: string }[] } | undefined {
        return this.appliedBlocks.get(operationId);
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