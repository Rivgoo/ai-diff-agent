import * as vscode from 'vscode';
import type { AnyOperation } from '@/core/models/operations';
import { PathSandbox } from '../../vscode/workspace/pathSandbox';
import { PathNormalizer } from '@/core/workspace/pathNormalizer';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';

export class VirtualConflictProvider implements vscode.TextDocumentContentProvider {
    public static readonly scheme = 'ai-diff-conflict';

    constructor(
        private readonly getOperation: (opId: string) => AnyOperation | undefined
    ) {}

    public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        try {
            // Парсимо query параметри, щоб дістати ID операції
            const queryParams = new URLSearchParams(uri.query);
            const opId = queryParams.get('opId');
            
            if (!opId) {
                return '/* ERROR: Missing Operation ID in URI */';
            }

            const operation = this.getOperation(opId);
            if (!operation) {
                return `/* ERROR: Operation '${opId}' not found in current session memory */`;
            }

            // Отримуємо поточний стан файлу (ліва панель)
            let currentText = '';
            try {
                const cleanPath = PathNormalizer.normalize(operation.path);
                const targetUri = PathSandbox.validate(cleanPath);
                
                const openDoc = vscode.workspace.textDocuments.find(d => d.uri.toString() === targetUri.toString());
                if (openDoc) {
                    currentText = openDoc.getText();
                } else {
                    const fileData = await vscode.workspace.fs.readFile(targetUri);
                    currentText = new TextDecoder('utf-8').decode(fileData);
                }
            } catch {
                currentText = '/* File currently does not exist on disk */\n';
            }

            return this.generateVirtualContent(operation, currentText);

        } catch (error) {
            OutputLogger.log(`VirtualConflictProvider failed to generate content: ${error}`, 'ERROR');
            return `/* FATAL ERROR: Failed to generate virtual conflict diff. Check logs. */`;
        }
    }

    private generateVirtualContent(operation: AnyOperation, currentText: string): string {
        if (operation.type === 'create_file') {
            return operation.content; 
        }

        if (operation.type === 'update_file') {
            let output = currentText;
            output += '\n\n' + '='.repeat(60) + '\n';
            output += '/* ⚠️ AI DIFF AGENT: PROPOSED REPLACEMENT BLOCKS ⚠️ */\n';
            output += '/* The search pattern failed. You can copy the code below manually. */\n';
            output += '='.repeat(60) + '\n\n';

            for (let i = 0; i < operation.changes.length; i++) {
                const change = operation.changes[i];
                output += `/* --- BLOCK ${i + 1} --- */\n`;
                output += change.replace + '\n\n';
            }
            return output;
        }

        return currentText;
    }
}