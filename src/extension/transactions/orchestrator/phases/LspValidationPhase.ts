import * as vscode from 'vscode';
import type { ITransactionCommand } from '../../core/ITransactionCommand';
import type { ITransactionContext } from '../../core/ITransactionContext';

export interface LspFailure {
    cmd: ITransactionCommand;
    diagnostic: string;
}

export class LspValidationPhase {
    public async execute(
        commands: ITransactionCommand[],
        context: ITransactionContext
    ): Promise<LspFailure[]> {
        const failures: LspFailure[] = [];
        const astSettings = context.settingsManager.getSettings().ast;

        for (const cmd of commands) {
            const targetPath = cmd.metadata.path || cmd.operation.path;
            const uri = context.getAbsoluteUri(targetPath);
            if (!uri) continue;
            
            if (astSettings.autoStitchImports) {
                try {
                    const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
                        'vscode.executeCodeActionProvider',
                        uri,
                        new vscode.Range(0, 0, 0, 0),
                        vscode.CodeActionKind.Source.append('addMissingImports')
                    );
                    
                    if (actions && actions.length > 0) {
                        const action = actions[0];
                        if (action.edit) {
                            await vscode.workspace.applyEdit(action.edit);
                            context.logger.info(`Auto-stitched missing imports for ${targetPath}`);
                        } else if (action.command) {
                            await vscode.commands.executeCommand(action.command.command, ...(action.command.arguments || []));
                            context.logger.info(`Auto-stitched missing imports for ${targetPath}`);
                        }
                    }
                } catch (e) {
                    context.logger.warn(`Auto-stitch failed for ${targetPath}: ${e}`);
                }
            }

            if (astSettings.lspValidation) {
                const diagnostics = vscode.languages.getDiagnostics(uri);
                const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);

                if (errors.length > 0) {
                    const msg = errors.slice(0, 2).map(e => e.message).join(' | ');
                    failures.push({ cmd, diagnostic: msg });
                }
            }
        }
        
        return failures;
    }
}