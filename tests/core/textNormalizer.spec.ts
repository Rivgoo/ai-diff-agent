/// <reference types="node" />
/// <reference types="mocha" />

import * as assert from 'assert';
import { TextNormalizer } from '../../src/core/matcher/textNormalizer';

describe('TextNormalizer Unit Tests', () => {
    it('should strip UTF-8 BOM from string start', () => {
        const withBOM = '\uFEFFconst x = 1;';
        const stripped = TextNormalizer.stripBOM(withBOM);
        assert.strictEqual(stripped, 'const x = 1;');
        assert.strictEqual(stripped.charCodeAt(0), 99); // ASCII value for 'c'
    });

    it('should leave strings without BOM completely untouched', () => {
        const raw = 'const x = 1;';
        const processed = TextNormalizer.stripBOM(raw);
        assert.strictEqual(processed, 'const x = 1;');
    });

    it('should normalize Windows CRLF to Unix LF line breaks', () => {
        const windowsText = 'line1\r\nline2\r\nline3';
        const normalized = TextNormalizer.normalizeLineEndings(windowsText);
        assert.strictEqual(normalized, 'line1\nline2\nline3');
    });

    it('should execute line normalization on large text buffers rapidly', () => {
        const baseLine = 'const variableName = "extremely_long_string_literal_to_populate_memory";\r\n';
        const largeText = baseLine.repeat(10000); // Generate 10,000 lines
        
        const start = Date.now();
        const normalized = TextNormalizer.normalizeLineEndings(largeText);
        const duration = Date.now() - start;

        // Ensure performance stays well under acceptable budgets (< 50ms)
        assert.ok(duration < 50);
        assert.strictEqual(normalized.includes('\r\n'), false);
    });
});
