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

    // O(1) перевірка без створення об'єктів RegExp в пам'яті
    private static isAlphaNumeric(char: string): boolean {
        if (!char) return false;
        const code = char.charCodeAt(0);
        return (code > 47 && code < 58) || // 0-9
               (code > 64 && code < 91) || // A-Z
               (code > 96 && code < 123) || // a-z
               code === 45 || // -
               code === 95;   // _
    }

    public async tokenize(input: string): Promise<Token[]> {
        const tokens: Token[] = [];
        let index = 0;
        const length = input.length;

        while (index < length) {
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

    private tryParseTag(input: string, start: number): { token: Token; nextIndex: number } | null {
        let index = start;
        const length = input.length;

        if (index + 1 >= length) return null;
        
        const isClosing = input[index + 1] === '/';
        const offset = isClosing ? 2 : 1;
        
        let nameEnd = index + offset;
        while (nameEnd < length && StreamScanner.isAlphaNumeric(input[nameEnd])) {
            nameEnd++;
        }

        const tagName = input.substring(index + offset, nameEnd);
        if (!StreamScanner.VALID_TAGS.has(tagName.toLowerCase())) {
            return null; 
        }

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
            return null; 
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
        let nextBracket = input.indexOf('<', start);

        if (nextBracket === -1) {
            return {
                token: {
                    type: 'TEXT_CONTENT',
                    name: 'text',
                    attributes: {},
                    content: input.substring(start)
                },
                nextIndex: input.length
            };
        }

        while (nextBracket !== -1) {
            const peek = this.tryParseTag(input, nextBracket);
            if (peek) {
                return {
                    token: {
                        type: 'TEXT_CONTENT',
                        name: 'text',
                        attributes: {},
                        content: input.substring(start, nextBracket)
                    },
                    nextIndex: nextBracket
                };
            }
            nextBracket = input.indexOf('<', nextBracket + 1);
        }

        return {
            token: {
                type: 'TEXT_CONTENT',
                name: 'text',
                attributes: {},
                content: input.substring(start)
            },
            nextIndex: input.length
        };
    }

    private parseAttributes(attrString: string): Record<string, string> {
        const attributes: Record<string, string> = {};
        let i = 0;
        const len = attrString.length;

        while (i < len) {
            while (i < len && /\s/.test(attrString[i])) i++;
            if (i >= len) break;

            const nameStart = i;
            while (i < len && StreamScanner.isAlphaNumeric(attrString[i])) i++;
            const name = attrString.substring(nameStart, i);
            if (!name) { i++; continue; }

            while (i < len && /\s/.test(attrString[i])) i++;

            if (i < len && attrString[i] === '=') {
                i++; 
                while (i < len && /\s/.test(attrString[i])) i++;

                if (i < len && (attrString[i] === '"' || attrString[i] === "'")) {
                    const quote = attrString[i];
                    i++; 
                    const valStart = i;
                    while (i < len && attrString[i] !== quote) i++;
                    
                    attributes[name] = attrString.substring(valStart, i);
                    
                    if (i < len && attrString[i] === quote) i++; 
                } else {
                    const valStart = i;
                    while (i < len && !/\s/.test(attrString[i]) && attrString[i] !== '>') i++;
                    attributes[name] = attrString.substring(valStart, i);
                }
            } else {
                attributes[name] = 'true';
            }
        }

        return attributes;
    }
}