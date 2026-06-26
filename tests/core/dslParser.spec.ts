/// <reference types="node" />
/// <reference types="mocha" />

import * as assert from 'assert';
import { DSLParser } from '../../src/core/parser/dslParser';
import { DomainValidator } from '../../src/core/parser/validator';
import type { AnyOperation } from '../../src/core/models/operations';

describe('DSLParser & DomainValidator Unit Tests', () => {
    const parser = new DSLParser();
    const validator = new DomainValidator();

    describe('DSLParser Parser Scenarios', () => {
        it('should parse create_file operations accurately', () => {
            const input = `
<workspace_edit>
    <create_file path="src/main.ts">
console.log("Hello World");
    </create_file>
</workspace_edit>
            `;
            const result = parser.parse(input);
            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.strictEqual(result.value.length, 1);
                assert.strictEqual(result.value[0].type, 'create_file');
                assert.strictEqual(result.value[0].path, 'src/main.ts');
                assert.strictEqual((result.value[0] as any).content, 'console.log("Hello World");');
            }
        });

        it('should loosely recover from markdown fence wrappers', () => {
            const input = `
<workspace_edit>
    <create_file path="src/test.js">
\`\`\`javascript
const test = true;
\`\`\`
    </create_file>
</workspace_edit>
            `;
            const result = parser.parse(input);
            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.strictEqual((result.value[0] as any).content, 'const test = true;');
            }
        });

        it('should parse update_file with multiple change blocks correctly', () => {
            const input = `
<workspace_edit>
    <update_file path="src/index.ts">
        <change>
            <search>old text 1</search>
            <replace>new text 1</replace>
        </change>
        <change>
            <search>old text 2</search>
            <replace>new text 2</replace>
        </change>
    </update_file>
</workspace_edit>
            `;
            const result = parser.parse(input);
            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.strictEqual(result.value.length, 1);
                const op = result.value[0] as any;
                assert.strictEqual(op.type, 'update_file');
                assert.strictEqual(op.changes.length, 2);
                assert.strictEqual(op.changes[0].search, 'old text 1');
                assert.strictEqual(op.changes[0].replace, 'new text 1');
                assert.strictEqual(op.changes[1].search, 'old text 2');
                assert.strictEqual(op.changes[1].replace, 'new text 2');
            }
        });

        it('should preserve literal non-schema XML blocks inside code fields', () => {
            const input = `
<workspace_edit>
    <create_file path="src/App.tsx">
        <div className="layout">
            <span role="img">🚀</span>
            <p>Welcome!</p>
        </div>
    </create_file>
</workspace_edit>
            `;
            const result = parser.parse(input);
            assert.strictEqual(result.success, true);
            if (result.success) {
                const op = result.value[0] as any;
                assert.ok(op.content.includes('<div className="layout">'));
                assert.ok(op.content.includes('<span role="img">🚀</span>'));
                assert.ok(op.content.includes('</p>'));
            }
        });

        it('should parse move_path and delete_path operations', () => {
            const input = `
<workspace_edit>
    <move_path src="src/old.ts" dest="src/new.ts" />
    <delete_path path="src/junk.ts" />
</workspace_edit>
            `;
            const result = parser.parse(input);
            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.strictEqual(result.value.length, 2);
                assert.strictEqual(result.value[0].type, 'move_path');
                assert.strictEqual((result.value[0] as any).path, 'src/old.ts');
                assert.strictEqual((result.value[0] as any).destinationPath, 'src/new.ts');
                assert.strictEqual(result.value[1].type, 'delete_path');
                assert.strictEqual(result.value[1].path, 'src/junk.ts');
            }
        });
    });

    describe('DomainValidator Scenarios', () => {
        it('should reject empty operations lists', () => {
            const validateResult = validator.validate([]);
            assert.strictEqual(validateResult.success, false);
        });

        it('should reject operations containing empty target paths', () => {
            const operations: AnyOperation[] = [
                { id: '1', type: 'delete_path', path: '', status: 'pending' }
            ];
            const validateResult = validator.validate(operations);
            assert.strictEqual(validateResult.success, false);
            assert.ok(validateResult.error.message.includes('invalid or empty path'));
        });

        it('should reject update_file operations that are missing change blocks', () => {
            const operations: AnyOperation[] = [
                { id: '1', type: 'update_file', path: 'src/main.ts', changes: [], status: 'pending' }
            ];
            const validateResult = validator.validate(operations);
            assert.strictEqual(validateResult.success, false);
        });

        it('should detect and block same-batch file collision (create + delete)', () => {
            const operations: AnyOperation[] = [
                { id: '1', type: 'create_file', path: 'src/main.ts', content: 'hello', status: 'pending' },
                { id: '2', type: 'delete_path', path: 'src/main.ts', status: 'pending' }
            ];
            const validateResult = validator.validate(operations);
            assert.strictEqual(validateResult.success, false);
            assert.ok(validateResult.error.message.includes('Collision detected'));
        });
    });
});
