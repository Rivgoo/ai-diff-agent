import type { IDocument } from '../matcher/documentPort';
import type { Position, Range } from '../../shared/contracts';
export class VirtualDocument implements IDocument {
    constructor(
        public readonly path: string, 
        private readonly content: string
    ) {}

    public getText(): string { 
        return this.content; 
    }
    
    public getLineCount(): number { 
        let count = 1;
        for (let i = 0; i < this.content.length; i++) {
            if (this.content[i] === '\n') count++;
        }
        return count;
    }
    
    public positionAt(offset: number): Position {
        let line = 0;
        let lastNewLine = -1;
        for (let i = 0; i < offset; i++) {
            if (this.content[i] === '\n') {
                line++;
                lastNewLine = i;
            }
        }
        return { 
            line, 
            character: offset - lastNewLine - 1 
        };
    }

    private getOffsetAt(position: Position): number {
        let currentLine = 0;
        let offset = 0;
        const len = this.content.length;
        
        while (currentLine < position.line && offset < len) {
            if (this.content[offset] === '\n') currentLine++;
            offset++;
        }
        return Math.min(offset + position.character, len);
    }

    public applyChange(range: Range, replaceWith: string): string {
        const startOffset = this.getOffsetAt(range.start);
        const endOffset = this.getOffsetAt(range.end);

        const before = this.content.substring(0, startOffset);
        const after = this.content.substring(endOffset);

        return before + replaceWith + after;
    }
}