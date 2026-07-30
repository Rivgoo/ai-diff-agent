import * as vscode from 'vscode';
import type { CoreDiagnostic } from '@/core/models/diagnostics';

export class DiagnosticService {
    private readonly collection: vscode.DiagnosticCollection;

    constructor() {
        this.collection = vscode.languages.createDiagnosticCollection('AI Diff Agent');
    }


    public reportDiagnostics(diagnostics: CoreDiagnostic[]): void {
        const diagnosticMap = new Map<string, vscode.Diagnostic[]>();

        for (const diag of diagnostics) {
            const severity = this.mapSeverity(diag.severity);
            
            const range = diag.range 
                ? new vscode.Range(diag.range.start.line, diag.range.start.character, diag.range.end.line, diag.range.end.character)
                : new vscode.Range(0, 0, 0, 1);

            const vsDiagnostic = new vscode.Diagnostic(range, `[${diag.title}] ${diag.detailedMessage}`, severity);
            
            if (diag.code) {
                vsDiagnostic.code = diag.code;
            }
            vsDiagnostic.source = 'AI Diff Agent';

            const uriStr = vscode.Uri.file(diag.path).toString();
            if (!diagnosticMap.has(uriStr)) {
                diagnosticMap.set(uriStr, []);
            }
            diagnosticMap.get(uriStr)!.push(vsDiagnostic);
        }

        for (const [uriStr, diags] of diagnosticMap.entries()) {
            this.collection.set(vscode.Uri.parse(uriStr), diags);
        }
    }

    public clearDiagnostics(uri?: vscode.Uri): void {
        if (uri) {
            this.collection.delete(uri);
        } else {
            this.collection.clear();
        }
    }

    public dispose(): void {
        this.collection.dispose();
    }

    private mapSeverity(severity: 'critical' | 'warning' | 'info'): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'critical': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
        }
    }
}