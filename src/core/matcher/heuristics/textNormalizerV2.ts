import type { NormalizationMap } from './normalizationMap';

/**
 * Advanced text reduction engine.
 * Strips formatting anomalies, quotes inconsistencies, and whitespace shifts
 * while perfectly preserving index relationships for safe AST/Range mapping.
 */
export class TextNormalizerV2 {
    /**
     * Strips all whitespace and normalizes quotes while tracking original indices.
     */
    public static normalizeWithMap(originalText: string): NormalizationMap {
        let textToProcess = originalText;
        let offset = 0;
        
        // Safely strip UTF-8 BOM if present without losing index accuracy
        if (textToProcess.charCodeAt(0) === 0xFEFF) {
            textToProcess = textToProcess.substring(1);
            offset = 1;
        }

        const len = textToProcess.length;
        const indices = new Uint32Array(len);
        const normalizedChars: string[] = [];
        let normIdx = 0;

        for (let i = 0; i < len; i++) {
            const char = textToProcess[i];
            
            // Bypass all whitespace variants
            if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
                continue;
            }
            
            // Normalize quote variances that LLMs hallucinate often
            let finalChar = char;
            if (char === '"' || char === '`') {
                finalChar = "'";
            }

            normalizedChars.push(finalChar);
            indices[normIdx] = i + offset; 
            normIdx++;
        }

        return {
            normalizedText: normalizedChars.join(''),
            originalIndices: indices.slice(0, normIdx)
        };
    }

    /**
     * Strips the search block down to its core semantic skeleton.
     */
    public static normalizeSearchBlock(searchBlock: string): string {
        return searchBlock
            .replace(/[\s\r\n]+/g, '')
            .replace(/["`]/g, "'");
    }

    /**
     * Safely expands the targeted exact character bounds outward to capture 
     * leading/trailing whitespace boundaries on the same line.
     * Mimics regex `[ \t]*` behavior, preventing duplicate indentation blocks 
     * without accidentally swallowing neighboring code.
     */
    public static expandToWhitespaceBoundaries(docText: string, realStart: number, realEnd: number): { s: number, e: number } {
        let s = realStart;
        let e = realEnd;
        
        while (e < docText.length && (docText[e] === ' ' || docText[e] === '\t')) {
            e++;
        }
        
        let tempS = s;
        while (tempS > 0 && (docText[tempS - 1] === ' ' || docText[tempS - 1] === '\t')) {
            tempS--;
        }

        if (tempS > 0 && docText[tempS - 1] !== '\n') {
            s = tempS;
        }
        
        return { s, e };
    }

    public static aggressiveNormalizeWithMap(originalText: string): NormalizationMap {
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

        // Потужний набір символів для ігнорування
        const drops = new Set([' ', '\t', '\n', '\r', '"', "'", '`', '$', ';', ',']);

        for (let i = 0; i < len; i++) {
            const char = textToProcess[i];
            if (drops.has(char)) continue;
            
            chars.push(char);
            indices[normIdx] = i + offset; 
            normIdx++;
        }

        return {
            normalizedText: chars.join(''),
            originalIndices: indices.slice(0, normIdx)
        };
    }

    /**
     * Aggressively strips the search block down to an extreme semantic skeleton.
     */
    public static aggressiveNormalizeSearchBlock(searchBlock: string): string {
        return searchBlock.replace(/[\s\r\n"'`$;,]/g, '');
    }
}
