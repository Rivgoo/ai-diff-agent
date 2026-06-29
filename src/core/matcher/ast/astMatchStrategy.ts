import type { IMatchStrategy, MatchContext } from '../types';
import type { MatchResult } from '@/shared/contracts';
import { AstParserRegistry, type IParserTree, type ISyntaxNode, type ITreeSitterParser } from './treeSitterRegistry';

const LANGUAGE_DISPATCH_MAP: Record<string, string> = {
    '.json': 'json',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.cs': 'c_sharp',
    '.py': 'python',
    '.html': 'html',
    '.css': 'css',
    '.sh': 'bash',
    '.bash': 'bash'
};

interface SemanticSignature {
    readonly type: string;
    readonly name: string;
}

export class AstMatchStrategy implements IMatchStrategy {
    public readonly name = 'SEMANTIC_AST_MATCH';
    public readonly tier = 0;

    public async findMatch(context: MatchContext): Promise<MatchResult | null> {
        if (!context.enableAstMatching) return null;

        const langKey = LANGUAGE_DISPATCH_MAP[context.fileExtension.toLowerCase()];
        if (!langKey) return null; 
        
        const parser = await AstParserRegistry.getParser(langKey);
        if (!parser) return null;

        let documentTree: IParserTree | undefined;
        let searchTree: IParserTree | undefined | null;

        try {
            documentTree = parser.parse(context.document.getText());
            if (documentTree.rootNode.hasError()) {
                this.cleanup(documentTree);
                return null;
            }

            // Розумне парсування фрагмента (з обходом проблеми браку контексту)
            searchTree = this.parseFragment(parser, context.searchBlock, context.fileExtension);
            
            // Якщо навіть після обгортань код містить ERROR - це дійсно битий код ШІ
            if (!searchTree || searchTree.rootNode.hasError()) {
                this.cleanup(documentTree, searchTree);
                return null;
            }

            const signature = this.extractSignature(searchTree.rootNode);
            if (signature) {
                const candidates = this.findNodesBySignature(documentTree.rootNode, signature);
                
                if (candidates.length === 1) {
                    const matchedNode = candidates[0];
                    const start = context.document.positionAt(matchedNode.startIndex);
                    const end = context.document.positionAt(matchedNode.endIndex);
                    this.cleanup(documentTree, searchTree);
                    return {
                        status: 'MATCHED',
                        range: { start, end },
                        confidence: 'exact',
                        strategy: this.name
                    };
                }
            }

            const matchedNode = this.fallbackCompare(documentTree.rootNode, context.searchBlock);
            if (matchedNode) {
                const start = context.document.positionAt(matchedNode.startIndex);
                const end = context.document.positionAt(matchedNode.endIndex);
                this.cleanup(documentTree, searchTree);
                return {
                    status: 'MATCHED',
                    range: { start, end },
                    confidence: 'exact',
                    strategy: this.name
                };
            }

            this.cleanup(documentTree, searchTree);
            return null; 
        } catch (e) {
            this.cleanup(documentTree, searchTree);
            return null;
        }
    }

    /**
     * Спроба розпарсити фрагмент коду. Якщо прямий парсинг видає помилку, 
     * ми обгортаємо фрагмент у фіктивну оболонку (клас/модуль) залежно від мови.
     */
    private parseFragment(parser: ITreeSitterParser, code: string, extension: string): IParserTree | null {
        let tree = parser.parse(code);
        
        // Якщо помилок немає - фрагмент ідеальний
        if (!tree.rootNode.hasError()) {
            return tree;
        }

        // Якщо помилки є, пробуємо обгорнути фрагмент
        tree.delete();
        let wrappedCode = '';
        
        if (extension === '.cs') {
            wrappedCode = `class FakeClass {\n${code}\n}`;
        } else if (extension === '.ts' || extension === '.tsx' || extension === '.js' || extension === '.jsx') {
            wrappedCode = `class FakeClass {\n${code}\n}`;
        } else if (extension === '.json') {
            wrappedCode = `{ "fakeKey": ${code} }`;
        } else {
            return null; // Інші мови поки не обгортаємо
        }

        const wrappedTree = parser.parse(wrappedCode);
        return wrappedTree;
    }

    private extractSignature(rootNode: ISyntaxNode): SemanticSignature | null {
        const walk = (node: ISyntaxNode): SemanticSignature | null => {
            if (node.isNamed) {
                const nameNode = node.childForFieldName('name');
                if (nameNode && nameNode.text) {
                    return { type: node.type, name: nameNode.text };
                }
            }
            for (const child of node.children) {
                const res = walk(child);
                if (res) return res;
            }
            return null;
        };
        return walk(rootNode);
    }

    private findNodesBySignature(rootNode: ISyntaxNode, signature: SemanticSignature): ISyntaxNode[] {
        const matches: ISyntaxNode[] = [];
        const walk = (node: ISyntaxNode) => {
            if (node.type === signature.type) {
                const nameNode = node.childForFieldName('name');
                if (nameNode && nameNode.text === signature.name) {
                    matches.push(node);
                }
            }
            for (const child of node.children) {
                walk(child);
            }
        };
        walk(rootNode);
        return matches;
    }

    private fallbackCompare(rootNode: ISyntaxNode, searchBlock: string): ISyntaxNode | null {
        const targetText = searchBlock.replace(/\s+/g, '');
        let matchedNode: ISyntaxNode | null = null;

        const walk = (node: ISyntaxNode) => {
            if (matchedNode) return;
            const nodeText = node.text.replace(/\s+/g, '');
            if (nodeText === targetText) {
                matchedNode = node;
                return;
            }
            for (const child of node.children) {
                walk(child);
            }
        };

        walk(rootNode);
        return matchedNode;
    }

    private cleanup(...trees: (IParserTree | undefined | null)[]): void {
        for (const tree of trees) {
            if (tree) tree.delete();
        }
    }
}