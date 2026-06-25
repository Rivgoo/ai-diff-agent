import { IDocument } from '../../src/core/matcher/documentPort';
import { SearchEngine } from '../../src/core/matcher/searchEngine';
import { Position } from '../../src/shared/contracts';

/**
 * Mock implementation of IDocument to facilitate fully decoupled testing.
 */
class MockDocument implements IDocument {
    constructor(
        public readonly path: string,
        private readonly text: string
    ) {}

    public getText(): string {
        return this.text;
    }

    public getLineCount(): number {
        return this.text.split(/\r?\n/).length;
    }

    public positionAt(offset: number): Position {
        const before = this.text.substring(0, offset);
        const lines = before.split('\n');
        const line = lines.length - 1;
        const character = lines[lines.length - 1].length;
        return { line, character };
    }
}

describe('SearchEngine Matching Tests', () => {
    const searchEngine = new SearchEngine();

    it('should successfully match exact text verbatim', () => {
        const originalText = `const a = 1;\nconst b = 2;\nexport function sum(x, y) {\n    return x + y;\n}`;
        const doc = new MockDocument('src/main.ts', originalText);
        const searchBlock = `export function sum(x, y) {\n    return x + y;\n}`;

        const result = searchEngine.findMatch(doc, searchBlock);

        if (result.status !== 'MATCHED') {
            throw new Error(`Expected MATCHED, got ${result.status}`);
        }
        if (result.confidence !== 'exact') {
            throw new Error(`Expected exact match, got ${result.confidence}`);
        }
        if (result.range.start.line !== 2 || result.range.end.line !== 4) {
            throw new Error(`Coordinates misaligned: ${JSON.stringify(result.range)}`);
        }
    });

    it('should fall back to whitespace-agnostic matching when indentation shifts', () => {
        const originalText = `class App {\n    render() {\n        console.log("Rendering...");\n    }\n}`;
        const doc = new MockDocument('src/app.ts', originalText);
        
        // Block has different indentation level (2 spaces instead of 4)
        const searchBlock = `  render() {\n    console.log("Rendering...");\n  }`;

        const result = searchEngine.findMatch(doc, searchBlock);

        if (result.status !== 'MATCHED') {
            throw new Error(`Expected MATCHED, got ${result.status}`);
        }
        if (result.confidence !== 'fallback') {
            throw new Error(`Expected fallback match, got ${result.confidence}`);
        }
    });

    it('should fail with AMBIGUOUS_MATCH when target block exists multiple times', () => {
        const originalText = `function log() {\n    return true;\n}\n\nfunction verify() {\n    return true;\n}`;
        const doc = new MockDocument('src/dup.ts', originalText);
        
        // Non-unique block matching both functions
        const searchBlock = `    return true;`;

        const result = searchEngine.findMatch(doc, searchBlock);

        if (result.status !== 'FAILED') {
            throw new Error(`Expected matching failure, got status: ${result.status}`);
        }
        if (result.reason !== 'AMBIGUOUS_MATCH') {
            throw new Error(`Expected AMBIGUOUS_MATCH, got ${result.reason}`);
        }
        if (result.matchesFound !== 2) {
            throw new Error(`Expected matchesFound to be 2, got ${result.matchesFound}`);
        }
    });

    it('should correctly handle multi-byte surrogate character boundaries (emojis 🚀)', () => {
        const originalText = `console.log("Welcome 🚀");\nconst marker = "safe";\nconsole.log("Exit 🚀");`;
        const doc = new MockDocument('src/emoji.ts', originalText);
        const searchBlock = `const marker = "safe";`;

        const result = searchEngine.findMatch(doc, searchBlock);

        if (result.status !== 'MATCHED') {
            throw new Error(`Emoji boundary test failed: ${result.status}`);
        }
        if (result.range.start.line !== 1 || result.range.start.character !== 0) {
            throw new Error(`Emoji alignment error: coordinates shifted to ${JSON.stringify(result.range)}`);
        }
    });

    it('should match correctly when file uses CRLF but search block uses LF', () => {
        const originalText = `const host = "localhost";\r\nconst port = 8080;\r\n`;
        const doc = new MockDocument('src/config.ts', originalText);
        const searchBlock = `const host = "localhost";\nconst port = 8080;`;

        const result = searchEngine.findMatch(doc, searchBlock);

        if (result.status !== 'MATCHED') {
            throw new Error(`CRLF mismatch test failed: ${result.status}`);
        }
    });
});
