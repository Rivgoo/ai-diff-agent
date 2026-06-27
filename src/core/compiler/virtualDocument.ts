import type { IDocument } from '../matcher/documentPort';
import type { Position, Range } from '../../shared/contracts';

/**
 * Adapter that wraps an in-memory string buffer into an IDocument contract.
 * Allows the existing Domain SearchEngine to run regex & fuzzy matches against 
 * files that only exist in memory (CREATED state) without writing to disk.
 */
export class VirtualDocument implements IDocument {
    constructor(
        public readonly path: string, 
        private readonly content: string
    ) {}

    public getText(): string { 
        return this.content; 
    }
    
    public getLineCount(): number { 
        return this.content.split(/\r?\n/).length; 
    }
    
    public positionAt(offset: number): Position {
        const before = this.content.substring(0, offset);
        const lines = before.split('\n');
        return { 
            line: lines.length - 1, 
            character: lines[lines.length - 1].length 
        };
    }

    /**
     * Slices the internal string buffer to apply a replacement at exact coordinate ranges.
     */
    public applyChange(range: Range, replaceWith: string): string {
        const lines = this.content.split('\n');
        
        // Extract content before the start coordinate
        const beforeLines = lines.slice(0, range.start.line);
        const startLineBefore = lines[range.start.line]?.substring(0, range.start.character) || '';
        const before = beforeLines.join('\n') + (beforeLines.length > 0 ? '\n' : '') + startLineBefore;

        // Extract content after the end coordinate
        const endLineAfter = lines[range.end.line]?.substring(range.end.character) || '';
        const afterLines = lines.slice(range.end.line + 1);
        const after = endLineAfter + (afterLines.length > 0 ? '\n' : '') + afterLines.join('\n');

        return before + replaceWith + after;
    }
}
