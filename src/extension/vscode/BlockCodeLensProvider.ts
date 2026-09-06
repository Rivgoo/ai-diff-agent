import * as vscode from 'vscode';
import type { DecorationService } from '../transactions/services/DecorationService';
import type { SettingsManager } from '../settings/settingsManager';

export class BlockCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
    private debounceTimer: NodeJS.Timeout | null = null;

    constructor(
        private readonly decorationService: DecorationService,
        private readonly settingsManager: SettingsManager
    ) {
        this.decorationService.onDidChangeDecorations(() => {
            this.triggerUpdate();
        });
        
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('aiDiffAgent.ui.enableCodeLens')) {
                this.triggerUpdate();
            }
        });
    }

    // ФІКС: Debounce усуває затримку (Input Lag) при швидкому друці
    private triggerUpdate(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this._onDidChangeCodeLenses.fire();
        }, 150); // 150мс достатньо, щоб не спамити VS Code
    }

    public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | null {
        const isEnabled = this.settingsManager.getSettings().ui.enableCodeLens;
        if (!isEnabled) {
            return null;
        }

        const decorations = this.decorationService.getDecorationsForDocument(document.uri);
        if (!decorations || decorations.length === 0) {
            return null;
        }

        const lenses: vscode.CodeLens[] = [];

        for (const dec of decorations) {
            const targetRange = new vscode.Range(dec.range.start.line, 0, dec.range.start.line, 0);

            const acceptLens = new vscode.CodeLens(targetRange, {
                title: "$(check) Accept Block",
                command: "ai-diff-agent.action.acceptBlock",
                arguments: [dec.opId, document.uri, dec.id], 
                tooltip: "Keep these changes and remove the highlight"
            });

            const rejectLens = new vscode.CodeLens(targetRange, {
                title: "$(close) Reject Block",
                command: "ai-diff-agent.action.rejectBlock",
                arguments: [dec.opId, document.uri, dec.id], 
                tooltip: "Revert this specific block to its original state"
            });

            lenses.push(acceptLens, rejectLens);
        }

        return lenses;
    }
}