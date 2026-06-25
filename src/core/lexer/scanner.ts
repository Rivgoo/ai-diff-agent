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
 * Avoids dangerous regular expressions, parsing tag structures character by character.
 * Perfectly ignores code structures containing '<' or '>' if they are not in the valid schema.
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

    public tokenize(input: string): Token[] {
        const tokens: Token[] = [];
        let index = 0;
        const length = input.length;

        while (index < length) {
            const char = input[index];

            if (char === '<') {
                // Peek ahead to see if it's a tag boundary we care about
                const tagToken = this.tryParseTag(input, index);
                if (tagToken) {
                    tokens.push(tagToken.token);
                    index = tagToken.nextIndex;
                    continue;
                }
            }

            // Otherwise, consume as text content until the next valid tag
            const textToken = this.consumeText(input, index);
            if (textToken.token.content.length > 0) {
                tokens.push(textToken.token);
            }
            index = textToken.nextIndex;
        }

        return tokens;
    }

    private tryParseTag(input: string, start: number): { token: Token; nextIndex: number } | null {
        let index = start;
        const length = input.length;

        if (index + 1 >= length) return null;
        
        const isClosing = input[index + 1] === '/';
        const offset = isClosing ? 2 : 1;
        
        // Extract tag name candidate
        let nameEnd = index + offset;
        while (nameEnd < length && /[a-zA-Z0-9_-]/.test(input[nameEnd])) {
            nameEnd++;
        }

        const tagName = input.substring(index + offset, nameEnd);
        if (!StreamScanner.VALID_TAGS.has(tagName.toLowerCase())) {
            return null; // Not a schema-matching tag, treat as plain text
        }

        // Find the boundary of the tag closing bracket
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
            return null; // Unterminated bracket, fallback
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

    private consumeText(input: string, start: number): { token: Token; nextIndex: number } {
        let index = start;
        const length = input.length;
        const builder: string[] = [];

        while (index < length) {
            const char = input[index];
            if (char === '<') {
                // If we hit '<', verify if it initiates a valid known tag
                const peek = this.tryParseTag(input, index);
                if (peek) {
                    break; // Stop text consumption immediately
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

    private parseAttributes(attrString: string): Record<string, string> {
        const attributes: Record<string, string> = {};
        const regex = /([a-zA-Z0-9_-]+)\s*=\s*(["'])(.*?)\2/g;
        let match;

        while ((match = regex.exec(attrString)) !== null) {
            attributes[match[1]] = match[3];
        }

        return attributes;
    }
}
