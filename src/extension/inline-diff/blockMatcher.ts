import * as vscode from 'vscode';

/**
 * Reliable exact-match search utility resilient to CRLF/LF discrepancies.
 */
export class BlockMatcher {
    public static findMatch(document: vscode.TextDocument, searchBlock: string): vscode.Range | null {
        const docText = document.getText();
        
        // Normalize line endings to avoid \r\n vs \n matching failures
        const normalizedDoc = docText.replace(/\r\n/g, '\n');
        const normalizedSearch = searchBlock.replace(/\r\n/g, '\n').trim();

        if (!normalizedSearch) return null;

        const index = normalizedDoc.indexOf(normalizedSearch);
        if (index === -1) {
            // Fallback: Try whitespace-agnostic matching for indentation drift
            return this.findFuzzyMatch(document, normalizedSearch);
        }

        const startPos = document.positionAt(index);
        const endPos = document.positionAt(index + normalizedSearch.length);
        
        return new vscode.Range(startPos, endPos);
    }

    private static findFuzzyMatch(document: vscode.TextDocument, searchBlock: string): vscode.Range | null {
        const lines = searchBlock.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return null;

        const docText = document.getText().replace(/\r\n/g, '\n');
        
        // Escape regex special chars and join with flexible whitespace matching
        const escapedLines = lines.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const fuzzyPattern = new RegExp(escapedLines.join('\\s*\\n\\s*'), 'g');
        
        const match = fuzzyPattern.exec(docText);
        if (match) {
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            return new vscode.Range(startPos, endPos);
        }

        return null;
    }
}
