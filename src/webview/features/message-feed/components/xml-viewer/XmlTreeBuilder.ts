import { StreamScanner } from '@/core/lexer/scanner';
import type { XmlTree, XmlElementNode, XmlTextNode } from './models';

export class XmlTreeBuilder {
    private static scanner = new StreamScanner();

    // Тепер це async, щоб дочекатися фонового парсингу
    public static async buildAsync(rawInput: string): Promise<XmlTree> {
        const tokens = await this.scanner.tokenize(rawInput);
        const rootNodes: XmlTree = [];
        const stack: XmlElementNode[] = [];

        for (const token of tokens) {
            if (token.type === 'OPEN_TAG') {
                const node: XmlElementNode = {
                    id: this.generateId(),
                    type: 'ELEMENT',
                    tagName: token.name,
                    attributes: token.attributes,
                    isSelfClosing: false,
                    isUnclosedError: false,
                    children: []
                };

                if (stack.length > 0) {
                    stack[stack.length - 1].children.push(node);
                } else {
                    rootNodes.push(node);
                }
                stack.push(node);
            } 
            else if (token.type === 'CLOSE_TAG') {
                const index = this.findMatchingOpenTagIndex(stack, token.name);
                if (index !== -1) {
                    while (stack.length > index) {
                        stack.pop();
                    }
                }
            } 
            else if (token.type === 'SELF_CLOSING_TAG') {
                const node: XmlElementNode = {
                    id: this.generateId(),
                    type: 'ELEMENT',
                    tagName: token.name,
                    attributes: token.attributes,
                    isSelfClosing: true,
                    isUnclosedError: false,
                    children: []
                };

                if (stack.length > 0) {
                    stack[stack.length - 1].children.push(node);
                } else {
                    rootNodes.push(node);
                }
            } 
            else if (token.type === 'TEXT_CONTENT') {
                if (token.content.trim() === '' && stack.length === 0) {
                    continue;
                }

                const node: XmlTextNode = {
                    id: this.generateId(),
                    type: 'TEXT',
                    content: token.content
                };

                if (stack.length > 0) {
                    stack[stack.length - 1].children.push(node);
                } else {
                    rootNodes.push(node);
                }
            }
        }

        while (stack.length > 0) {
            const node = stack.pop();
            if (node) {
                (node as any).isUnclosedError = true;
            }
        }

        return rootNodes;
    }

    private static findMatchingOpenTagIndex(stack: XmlElementNode[], tagName: string): number {
        for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].tagName.toLowerCase() === tagName.toLowerCase()) {
                return i;
            }
        }
        return -1;
    }

    private static generateId(): string {
        if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.randomUUID) {
            return globalThis.crypto.randomUUID();
        }
        return 'xml-' + Math.random().toString(36).substring(2, 15);
    }
}