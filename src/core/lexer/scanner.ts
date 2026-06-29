/**
 * Types of tokens emitted by the streaming tokenizer.
 */
export type TokenType = 
    | 'OPEN_TAG' 
    | 'CLOSE_TAG' 
    | 'SELF_CLOSING_TAG' 
    | 'TEXT_CONTENT';

export interface Token {
    readonly type: TokenType;
    readonly name: string;
    readonly attributes: Record<string, string>;
    readonly content: string;
}

/**
 * Deterministic linear Lexer.
 * Avoids regular expression backtracking entirely by parsing tag structures character by character.
 * Prevents ReDoS vulnerabilities and ignores non-schema tags (like code-level HTML/XML blocks).
 */
export class StreamScanner {
    private static readonly VALID_TAGS = new Set([
        'workspace_edit',
        'create_file',
        'update_file',
        'change',
        'search',
        'replace',
        'delete_path',
        'move_path',
        'create_dir'
    ]);

    /**
     * Tokenizes a raw string input into a flat sequence of matched tokens.
     * Uses asynchronous Event Loop Yielding to prevent Extension Host freezes on huge payloads.
     */
    public async tokenize(input: string): Promise<Token[]> {
        const tokens: Token[] = [];
        let index = 0;
        const length = input.length;

        while (index < length) {
            // YIELDING: Кожні 50,000 символів віддаємо керування головному потоку VS Code на 0мс.
            // Це дозволяє UI не "мерзнути", поки йде важкий парсинг.
            if (index % 50000 === 0 && index > 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            const char = input[index];

            if (char === '<') {
                const tagToken = this.tryParseTag(input, index);
                if (tagToken) {
                    tokens.push(tagToken.token);
                    index = tagToken.nextIndex;
                    continue;
                }
            }

            const textToken = this.consumeText(input, index);
            if (textToken.token.content.length > 0) {
                tokens.push(textToken.token);
            }
            index = textToken.nextIndex;
        }

        return tokens;
    }
    /**
     * Attempts to parse a schema-conforming tag block starting at the '<' character.
     */
    private tryParseTag(input: string, start: number): { token: Token; nextIndex: number } | null {
        let index = start;
        const length = input.length;

        if (index + 1 >= length) return null;
        
        const isClosing = input[index + 1] === '/';
        const offset = isClosing ? 2 : 1;
        
        // Extract candidate tag name
        let nameEnd = index + offset;
        while (nameEnd < length && /[a-zA-Z0-9_-]/.test(input[nameEnd])) {
            nameEnd++;
        }

        const tagName = input.substring(index + offset, nameEnd);
        if (!StreamScanner.VALID_TAGS.has(tagName.toLowerCase())) {
            return null; // Not a schema-matching tag, treat as plain text
        }

        // Locate tag closing boundaries
        let tagEnd = nameEnd;
        let isSelfClosing = false;
        while (tagEnd < length && input[tagEnd] !== '>') {
            if (input[tagEnd] === '/' && tagEnd + 1 < length && input[tagEnd + 1] === '>') {
                isSelfClosing = true;
                break;
            }
            tagEnd++;
        }

        if (tagEnd >= length) {
            return null; // Unterminated tag, fallback to plain text
        }

        const tagBody = input.substring(nameEnd, tagEnd).trim();
        const attributes = this.parseAttributes(tagBody);
        const nextIndex = tagEnd + (isSelfClosing ? 2 : 1);

        return {
            token: {
                type: isClosing 
                    ? 'CLOSE_TAG' 
                    : (isSelfClosing ? 'SELF_CLOSING_TAG' : 'OPEN_TAG'),
                name: tagName.toLowerCase(),
                attributes,
                content: ''
            },
            nextIndex
        };
    }

    /**
     * Consumes text content until hitting the next schema-valid tag boundary.
     */
    private consumeText(input: string, start: number): { token: Token; nextIndex: number } {
        let index = start;
        const length = input.length;
        const builder: string[] = [];

        while (index < length) {
            const char = input[index];
            if (char === '<') {
                const peek = this.tryParseTag(input, index);
                if (peek) {
                    break; // Stop immediately to preserve tag tokens
                }
            }
            builder.push(char);
            index++;
        }

        return {
            token: {
                type: 'TEXT_CONTENT',
                name: 'text',
                attributes: {},
                content: builder.join('')
            },
            nextIndex: index
        };
    }

    /**
     * Linear token-based parser for HTML-like attributes.
     * Prevents regular expression backtracking and properly handles single/double/unquoted attributes.
     */
    private parseAttributes(attrString: string): Record<string, string> {
        const attributes: Record<string, string> = {};
        let i = 0;
        const len = attrString.length;

        while (i < len) {
            // Skip whitespaces
            while (i < len && /\s/.test(attrString[i])) {
                i++;
            }
            if (i >= len) break;

            // Extract attribute name
            const nameStart = i;
            while (i < len && /[a-zA-Z0-9_-]/.test(attrString[i])) {
                i++;
            }
            const name = attrString.substring(nameStart, i);
            if (!name) {
                i++; // Skip invalid character to prevent infinite loops
                continue;
            }

            // Skip whitespaces surrounding '='
            while (i < len && /\s/.test(attrString[i])) {
                i++;
            }

            if (i < len && attrString[i] === '=') {
                i++; // Consume '='
                
                // Skip whitespaces after '='
                while (i < len && /\s/.test(attrString[i])) {
                    i++;
                }

                if (i < len && (attrString[i] === '"' || attrString[i] === "'")) {
                    const quote = attrString[i];
                    i++; // Consume opening quote
                    const valStart = i;
                    while (i < len && attrString[i] !== quote) {
                        i++;
                    }
                    const val = attrString.substring(valStart, i);
                    if (i < len) {
                        i++; // Consume closing quote
                    }
                    attributes[name] = val;
                } else {
                    // Extract unquoted attribute value
                    const valStart = i;
                    while (i < len && !/\s/.test(attrString[i]) && attrString[i] !== '>') {
                        i++;
                    }
                    const val = attrString.substring(valStart, i);
                    attributes[name] = val;
                }
            } else {
                // Handle implicit boolean attributes
                attributes[name] = 'true';
            }
        }

        return attributes;
    }
}
