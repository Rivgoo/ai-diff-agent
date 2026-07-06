import * as vscode from 'vscode';
import type { DecorationService } from '../transactions/services/DecorationService';
import type { SettingsManager } from '../settings/settingsManager';

export class BlockCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    constructor(
        private readonly decorationService: DecorationService,
        private readonly settingsManager: SettingsManager
    ) {
        // Коли змінюються підсвітки, ми кажемо VS Code оновити лінзи
        this.decorationService.onDidChangeDecorations(() => {
            this._onDidChangeCodeLenses.fire();
        });
        
        // Коли змінюються налаштування (користувач увімкнув/вимкнув фічу)
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('aiDiffAgent.ui.enableCodeLens')) {
                this._onDidChangeCodeLenses.fire();
            }
        });
    }

    public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | null {
        const isEnabled = this.settingsManager.getSettings().ui.enableCodeLens;
        if (!isEnabled) {
            return null; // Якщо вимкнено в налаштуваннях - нічого не малюємо
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
                arguments: [dec.opId, document.uri, dec.range],
                tooltip: "Keep these changes and remove the highlight"
            });

            const rejectLens = new vscode.CodeLens(targetRange, {
                title: "$(close) Reject Block",
                command: "ai-diff-agent.action.rejectBlock",
                arguments: [dec.opId, document.uri, dec.range, dec.originalSearch], 
                tooltip: "Revert this specific block to its original state"
            });

            lenses.push(acceptLens, rejectLens);
        }

        return lenses;
    }
}