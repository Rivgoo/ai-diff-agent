import * as vscode from 'vscode';

export interface IUnitOfWork {
    createFile(uri: vscode.Uri, content: string, options?: { ignoreIfExists: boolean }): void;
    replace(uri: vscode.Uri, range: vscode.Range, content: string): void;
    deleteFile(uri: vscode.Uri, options?: { recursive: boolean; ignoreIfNotExists: boolean }): void;
    renameFile(oldUri: vscode.Uri, newUri: vscode.Uri, options?: { overwrite: boolean }): void;
    
    commit(): Promise<boolean>;
    
    addAppliedRange(operationId: string, uri: vscode.Uri, range: vscode.Range): void;
    getAppliedRanges(operationId: string): { uri: vscode.Uri; ranges: vscode.Range[] } | undefined;
    getModifiedUris(): vscode.Uri[];
}
