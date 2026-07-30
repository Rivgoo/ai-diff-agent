import { Result } from '../../shared/contracts';
import type { AnyOperation, ChangeBlock } from '../models/operations';
import { StreamScanner, type Token } from '../lexer/scanner';
import { PathSanitizer } from '../workspace/pathSanitizer';

export interface ParserOptions {
    recoveryMode: 'strict' | 'standard' | 'aggressive';
    polyglotParsing?: boolean; // ФІКС: Додано прапорець для поліглота
}

export class DSLParser {
    private readonly scanner = new StreamScanner();
    private options: ParserOptions = { recoveryMode: 'aggressive', polyglotParsing: true };

    public async parse(rawInput: string, options?: Partial<ParserOptions>): Promise<Result<AnyOperation[]>> {
        if (options) {
            this.options = { ...this.options, ...options };
        }
        
        try {
            const cleanedInput = this.preprocessPayload(rawInput);
            const tokens = await this.scanner.tokenize(cleanedInput);

            let index = 0;
            while (index < tokens.length) {
                const token = tokens[index];

                if (token.type === 'OPEN_TAG' && token.name === 'workspace_edit') {
                    const workspaceResult = this.parseWorkspaceEdit(tokens, index);
                    if (workspaceResult.success) {
                        return Result.ok(workspaceResult.value.operations);
                    } else {
                        return Result.fail(workspaceResult.error);
                    }
                }
                index++;
            }

            const looseResult = this.parseOperationsList(tokens, 0, tokens.length);
            
            // ФІКС: Якщо стандартний парсер XML не знайшов ЖОДНОЇ операції, 
            // і ввімкнено polyglotParsing, запускаємо резервний Markdown парсер!
            if (looseResult.operations.length === 0 && this.options.polyglotParsing) {
                const fallbackOps = this.parseMarkdownFallback(rawInput);
                if (fallbackOps.length > 0) {
                    return Result.ok(fallbackOps);
                }
            }

            return Result.ok(looseResult.operations);

        } catch (error) {
            return Result.fail(error instanceof Error ? error : new Error('Unknown structural parse error'));
        }
    }

    private parseMarkdownFallback(rawInput: string): AnyOperation[] {
        const operations: AnyOperation[] = [];
        let currentIndex = 0;

        while (true) {
            const blockStart = rawInput.indexOf('```', currentIndex);
            if (blockStart === -1) break;

            const blockEnd = rawInput.indexOf('```', blockStart + 3);
            if (blockEnd === -1) break; 

            const firstNewline = rawInput.indexOf('\n', blockStart);
            if (firstNewline === -1 || firstNewline > blockEnd) {
                currentIndex = blockEnd + 3;
                continue;
            }

            const contentStart = firstNewline + 1;
            let content = rawInput.substring(contentStart, blockEnd);

            if (content.endsWith('\n')) content = content.slice(0, -1);
            if (content.endsWith('\r')) content = content.slice(0, -1);

            const textBefore = rawInput.substring(currentIndex, blockStart);
            const linesBefore = textBefore.split(/\r?\n/);
            let rawPath = '';

            for (let i = linesBefore.length - 1; i >= 0; i--) {
                const line = linesBefore[i].trim();
                if (line.length > 0) {
                    const match = line.match(/([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/);
                    if (match) {
                        rawPath = match[1];
                    }
                    break;
                }
            }

            const path = rawPath ? PathSanitizer.sanitize(rawPath) : undefined;
            if (path && content) {
                operations.push({
                    id: this.generateId(),
                    type: 'create_file',
                    path,
                    content,
                    status: 'pending'
                });
            }

            currentIndex = blockEnd + 3;
        }

        return operations;
    }

    private parseWorkspaceEdit(tokens: Token[], startIdx: number): Result<{ operations: AnyOperation[]; nextIndex: number }> {
        let index = startIdx + 1;
        const operations: AnyOperation[] = [];

        while (index < tokens.length) {
            const token = tokens[index];

            if (token.type === 'CLOSE_TAG' && token.name === 'workspace_edit') {
                return Result.ok({ operations, nextIndex: index + 1 });
            }

            const parsedOp = this.tryParseOperation(tokens, index);
            if (parsedOp) {
                operations.push(parsedOp.operation);
                index = parsedOp.nextIndex;
            } else {
                index++;
            }
        }

        return Result.ok({ operations, nextIndex: index }); 
    }

    private parseOperationsList(tokens: Token[], start: number, end: number): { operations: AnyOperation[] } {
        const operations: AnyOperation[] = [];
        let index = start;

        while (index < end) {
            const parsedOp = this.tryParseOperation(tokens, index);
            if (parsedOp) {
                operations.push(parsedOp.operation);
                index = parsedOp.nextIndex;
            } else {
                index++;
            }
        }

        return { operations };
    }

    private tryParseOperation(tokens: Token[], startIdx: number): { operation: AnyOperation; nextIndex: number } | null {
        const token = tokens[startIdx];

        if (token.type !== 'OPEN_TAG' && token.type !== 'SELF_CLOSING_TAG') {
            return null;
        }

        const rawPath = token.attributes.path;
        const path = rawPath ? PathSanitizer.sanitize(rawPath) : undefined;
        const id = this.generateId();

        if (token.name === 'create_file' && path) {
            const contentResult = this.consumeContentUntilClose(tokens, startIdx, 'create_file');
            return {
                operation: {
                    id,
                    type: 'create_file',
                    path,
                    content: this.postprocessBlock(contentResult.content),
                    status: 'pending'
                },
                nextIndex: contentResult.nextIndex
            };
        }

        if (token.name === 'update_file' && path) {
            const changesResult = this.parseChangeBlocks(tokens, startIdx);
            return {
                operation: {
                    id,
                    type: 'update_file',
                    path,
                    changes: changesResult.changes,
                    status: 'pending'
                },
                nextIndex: changesResult.nextIndex
            };
        }

        if (token.name === 'delete_path' && path) {
            return {
                operation: { id, type: 'delete_path', path, status: 'pending' },
                nextIndex: startIdx + 1
            };
        }

        if (token.name === 'move_path') {
            const rawSrc = token.attributes.src;
            const rawDest = token.attributes.dest;
            const src = rawSrc ? PathSanitizer.sanitize(rawSrc) : undefined;
            const dest = rawDest ? PathSanitizer.sanitize(rawDest) : undefined;
            if (src && dest) {
                return {
                    operation: { id, type: 'move_path', path: src, destinationPath: dest, status: 'pending' },
                    nextIndex: startIdx + 1
                };
            }
        }

        if (token.name === 'create_dir' && path) {
            return {
                operation: { id, type: 'create_dir', path, status: 'pending' },
                nextIndex: startIdx + 1
            };
        }

        return null;
    }

    private parseChangeBlocks(tokens: Token[], startIdx: number): { changes: ChangeBlock[]; nextIndex: number } {
        let index = startIdx + 1;
        const changes: ChangeBlock[] = [];

        while (index < tokens.length) {
            const token = tokens[index];

            if (token.type === 'CLOSE_TAG' && token.name === 'update_file') {
                return { changes, nextIndex: index + 1 };
            }

            if (token.type === 'OPEN_TAG' && token.name === 'change') {
                const blockResult = this.parseSingleChange(tokens, index);
                if (blockResult.change) {
                    changes.push(blockResult.change);
                }
                index = blockResult.nextIndex;
            } else {
                index++;
            }
        }

        return { changes, nextIndex: index };
    }

    private parseSingleChange(tokens: Token[], startIdx: number): { change: ChangeBlock | null; nextIndex: number } {
        let index = startIdx + 1;
        let search: string | null = null;
        let replace: string | null = null;

        while (index < tokens.length) {
            const token = tokens[index];

            if (token.type === 'CLOSE_TAG' && token.name === 'change') {
                if (search !== null && replace !== null) {
                    return { change: { search, replace }, nextIndex: index + 1 };
                }
                return { change: null, nextIndex: index + 1 };
            }

            if (token.type === 'OPEN_TAG' && token.name === 'search') {
                const res = this.consumeContentUntilClose(tokens, index, 'search');
                search = this.postprocessBlock(res.content);
                index = res.nextIndex;
            } else if (token.type === 'OPEN_TAG' && token.name === 'replace') {
                const res = this.consumeContentUntilClose(tokens, index, 'replace');
                replace = this.postprocessBlock(res.content);
                index = res.nextIndex;
            } else {
                index++;
            }
        }

        return { change: null, nextIndex: index };
    }

    private consumeContentUntilClose(tokens: Token[], startIdx: number, tagName: string): { content: string; nextIndex: number } {
        let index = startIdx + 1;
        const builder: string[] = [];

        while (index < tokens.length) {
            const token = tokens[index];

            if (token.type === 'CLOSE_TAG' && token.name === tagName) {
                return { content: builder.join(''), nextIndex: index + 1 };
            }

            if (token.type === 'TEXT_CONTENT') {
                builder.push(token.content);
            } else {
                builder.push(this.reconstructTagLiteral(token));
            }
            index++;
        }

        return { content: builder.join(''), nextIndex: index };
    }

    private reconstructTagLiteral(token: Token): string {
        const attributes = Object.entries(token.attributes)
            .map(([k, v]) => ` ${k}="${v}"`)
            .join('');

        if (token.type === 'OPEN_TAG') return `<${token.name}${attributes}>`;
        if (token.type === 'CLOSE_TAG') return `</${token.name}>`;
        return `<${token.name}${attributes} />`;
    }

    private preprocessPayload(content: string): string {
        let cleaned = content;
        
        cleaned = cleaned.replace(/^\s*```[a-zA-Z0-9_-]*\r?\n/g, '');
        cleaned = cleaned.replace(/\r?\n\s*```\s*$/g, '');

        if (this.options.recoveryMode === 'aggressive') {
            if (cleaned.startsWith('<![CDATA[') && cleaned.endsWith(']]>')) {
                cleaned = cleaned.substring(9, cleaned.length - 3);
            }
        }

        return cleaned;
    }

    private postprocessBlock(content: string): string {
        let cleaned = content;

        if (cleaned.startsWith('\n')) cleaned = cleaned.substring(1);
        else if (cleaned.startsWith('\r\n')) cleaned = cleaned.substring(2);
        
        if (cleaned.endsWith('\n')) cleaned = cleaned.substring(0, cleaned.length - 1);
        if (cleaned.endsWith('\r')) cleaned = cleaned.substring(0, cleaned.length - 1);

        if (this.options.recoveryMode === 'aggressive') {
            if (cleaned.startsWith('<![CDATA[') && cleaned.endsWith(']]>')) {
                cleaned = cleaned.substring(9, cleaned.length - 3);
            }
            
            const codeTagMatch = /^<code[^>]*>\r?\n?/i.exec(cleaned);
            if (codeTagMatch && cleaned.endsWith('</code>')) {
                cleaned = cleaned.substring(codeTagMatch[0].length, cleaned.length - 7);
            }
        }

        return cleaned;
    }

    private generateId(): string {
        if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.randomUUID) {
            return globalThis.crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}