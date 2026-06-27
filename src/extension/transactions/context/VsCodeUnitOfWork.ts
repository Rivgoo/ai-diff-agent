import * as vscode from 'vscode';
import type { IUnitOfWork } from '../core/IUnitOfWork';

export class VsCodeUnitOfWork implements IUnitOfWork {
    private readonly edit = new vscode.WorkspaceEdit();
    private readonly appliedRanges = new Map<string, { uri: vscode.Uri; ranges: vscode.Range[] }>();
    private readonly modifiedUris = new Set<string>();
    private readonly modifiedUrisList: vscode.Uri[] = [];

    public createFile(uri: vscode.Uri, content: string, options?: { ignoreIfExists: boolean }): void {
        this.edit.createFile(uri, options);
        this.edit.insert(uri, new vscode.Position(0, 0), content);
        this.trackUri(uri);
    }

    public replace(uri: vscode.Uri, range: vscode.Range, content: string): void {
        this.edit.replace(uri, range, content);
        this.trackUri(uri);
    }

    public deleteFile(uri: vscode.Uri, options?: { recursive: boolean; ignoreIfNotExists: boolean }): void {
        this.edit.deleteFile(uri, options);
    }

    public renameFile(oldUri: vscode.Uri, newUri: vscode.Uri, options?: { overwrite: boolean }): void {
        this.edit.renameFile(oldUri, newUri, options);
        this.trackUri(newUri);
    }

    public async commit(): Promise<boolean> {
        return vscode.workspace.applyEdit(this.edit);
    }

    public addAppliedRange(operationId: string, uri: vscode.Uri, range: vscode.Range): void {
        const existing = this.appliedRanges.get(operationId) || { uri, ranges: [] };
        existing.ranges.push(range);
        this.appliedRanges.set(operationId, existing);
    }

    public getAppliedRanges(operationId: string): { uri: vscode.Uri; ranges: vscode.Range[] } | undefined {
        return this.appliedRanges.get(operationId);
    }

    public getModifiedUris(): vscode.Uri[] {
        return this.modifiedUrisList;
    }

    private trackUri(uri: vscode.Uri): void {
        const key = uri.toString();
        if (!this.modifiedUris.has(key)) {
            this.modifiedUris.add(key);
            this.modifiedUrisList.push(uri);
        }
    }
}
