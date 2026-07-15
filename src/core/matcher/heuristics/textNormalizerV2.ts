import type { NormalizationMap } from './normalizationMap';
export class TextNormalizerV2 {

    public static normalizeWithMap(originalText: string): NormalizationMap {
        return this.processNormalization(originalText, new Set([' ', '\t', '\n', '\r']));
    }

    public static normalizeSearchBlock(searchBlock: string): string {
        return searchBlock.replace(/[\s\r\n]+/g, '').replace(/["`]/g, "'");
    }

    public static aggressiveNormalizeWithMap(originalText: string): NormalizationMap {
        const drops = new Set([' ', '\t', '\n', '\r', '"', "'", '`']);
        return this.processNormalization(originalText, drops);
    }

    public static aggressiveNormalizeSearchBlock(searchBlock: string): string {
        return searchBlock.replace(/[\s\r\n"'`]/g, '');
    }

    private static processNormalization(originalText: string, drops: Set<string>): NormalizationMap {
        let textToProcess = originalText;
        let offset = 0;
        
        if (textToProcess.charCodeAt(0) === 0xFEFF) {
            textToProcess = textToProcess.substring(1);
            offset = 1;
        }

        const len = textToProcess.length;
        const indices = new Uint32Array(len);
        const chars: string[] = [];
        let normIdx = 0;

        for (let i = 0; i < len; i++) {
            let char = textToProcess[i];
            
            if (drops.has(char)) continue;
            
            // Normalize quote variances
            if (char === '"' || char === '`') {
                char = "'";
            }

            chars.push(char);
            indices[normIdx] = i + offset; 
            normIdx++;
        }

        return {
            normalizedText: chars.join(''),
            originalIndices: indices.slice(0, normIdx)
        };
    }

    public static expandToWhitespaceBoundaries(docText: string, realStart: number, realEnd: number): { s: number, e: number } {
        let s = realStart;
        let e = realEnd;
        
        while (e < docText.length && (docText[e] === ' ' || docText[e] === '\t')) e++;
        
        let tempS = s;
        while (tempS > 0 && (docText[tempS - 1] === ' ' || docText[tempS - 1] === '\t')) tempS--;

        if (tempS > 0 && docText[tempS - 1] !== '\n') s = tempS;
        
        return { s, e };
    }
}