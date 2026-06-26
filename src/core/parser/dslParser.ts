import { Result } from '../../shared/contracts';
import type { AnyOperation, ChangeBlock } from '../models/operations';
import { StreamScanner, type Token } from '../lexer/scanner';
import { PathSanitizer } from '../workspace/pathSanitizer';

/**
 * Main AST DSL Parser.
 * Orchestrates the flat token stream into structured executable Domain operations.
 * Implements loose-recovery mechanics to strip redundant markdown wraps.
 */
export class DSLParser {
    private readonly scanner = new StreamScanner();

    /**
     * Parses raw input instructions and generates executable file operations.
     */
    public parse(rawInput: string): Result<AnyOperation[]> {
        try {
            const cleanedInput = this.stripMarkdownFences(rawInput);
            const tokens = this.scanner.tokenize(cleanedInput);

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

            // Fallback: Parse operation blocks loosely if workspace_edit root is missing
            const looseResult = this.parseOperationsList(tokens, 0, tokens.length);
            return Result.ok(looseResult.operations);

        } catch (error) {
            return Result.fail(error instanceof Error ? error : new Error('Unknown structural parse error'));
        }
    }

    /**
     * Processes a bounded workspace edit block.
     */
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

    /**
     * Extracts a continuous flat list of operations loosely.
     */
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

    /**
     * Evaluates a single operation block (create, update, delete, move, create_dir).
     * Integrates Ingestion Path Sanitization to eliminate control characters and whitespace immediately.
     */
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
                    content: this.stripMarkdownFences(contentResult.content),
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
                    operation: {
                        id,
                        type: 'move_path',
                        path: src,
                        destinationPath: dest,
                        status: 'pending'
                    },
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

    /**
     * Parses nested change blocks inside an update_file operation.
     */
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

    /**
     * Parses search/replace tag sequences inside an active change block.
     */
    private parseSingleChange(tokens: Token[], startIdx: number): { change: ChangeBlock | null; nextIndex: number } {
        let index = startIdx + 1;
        let search: string | null = null;
        let replace: string | null = null;

        while (index < tokens.length) {
            const token = tokens[index];

            if (token.type === 'CLOSE_TAG' && token.name === 'change') {
                if (search !== null && replace !== null) {
                    return {
                        change: { search, replace },
                        nextIndex: index + 1
                    };
                }
                return { change: null, nextIndex: index + 1 };
            }

            if (token.type === 'OPEN_TAG' && token.name === 'search') {
                const res = this.consumeContentUntilClose(tokens, index, 'search');
                search = res.content;
                index = res.nextIndex;
            } else if (token.type === 'OPEN_TAG' && token.name === 'replace') {
                const res = this.consumeContentUntilClose(tokens, index, 'replace');
                replace = res.content;
                index = res.nextIndex;
            } else {
                index++;
            }
        }

        return { change: null, nextIndex: index };
    }

    /**
     * Aggregates textual block segments, reconstructing literal embedded code blocks.
     */
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
                // Reconstruct literal code structures that look like non-schema XML tags
                builder.push(this.reconstructTagLiteral(token));
            }
            index++;
        }

        return { content: builder.join(''), nextIndex: index };
    }

    /**
     * Safely reconstructs raw structural formatting of non-schema HTML tag tokens.
     */
    private reconstructTagLiteral(token: Token): string {
        const attributes = Object.entries(token.attributes)
            .map(([k, v]) => ` ${k}="${v}"`)
            .join('');

        if (token.type === 'OPEN_TAG') {
            return `<${token.name}${attributes}>`;
        }
        if (token.type === 'CLOSE_TAG') {
            return `</${token.name}>`;
        }
        return `<${token.name}${attributes} />`;
    }

    /**
     * Recursively and safely strips markdown block wrappers surrounding raw text nodes.
     */
    private stripMarkdownFences(content: string): string {
        let cleaned = content.trim();
        cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\r?\n/g, '');
        cleaned = cleaned.replace(/\r?\n```$/g, '');
        return cleaned.trim();
    }

    /**
     * Generates a lightweight unique execution identifier.
     */
    private generateId(): string {
        return Math.random().toString(36).substring(2, 9);
    }
}
