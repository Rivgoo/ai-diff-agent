import type { IMatchStrategy, MatchContext, IMatcherLogger } from '../types';
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

const BANNED_SIGNATURE_TYPES = new Set([
    'identifier', 'qualified_name', 'type_identifier', 'primitive_type',
    'string_literal', 'number_literal', 'boolean_literal',
    'using_directive', 'import_statement', 'expression_statement', 'namespace_declaration', 'file_scoped_namespace_declaration'
]);

export class AstMatchStrategy implements IMatchStrategy {
    public readonly name = 'SEMANTIC_AST_MATCH';
    public readonly tier = 0;

    public async findMatch(context: MatchContext): Promise<MatchResult> {
        if (!context.enableAstMatching) return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };

        const langKey = LANGUAGE_DISPATCH_MAP[context.fileExtension.toLowerCase()];
        if (!langKey) return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
        
        const parser = await AstParserRegistry.getParser(langKey, context.logger);
        if (!parser) return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };

        context.logger?.info(`[AST] Initiating semantic analysis for ${context.document.path}`);

        let documentTree: IParserTree | undefined;

        try {
            documentTree = parser.parse(context.document.getText());
            
            const signature = this.extractSignatureFromFragment(parser, context.searchBlock, context.fileExtension, context.logger);
            
            if (!signature) {
                context.logger?.info(`[AST] Could not extract reliable signature from search block. Falling back to text heuristics.`);
                this.cleanup(documentTree);
                return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
            }

            context.logger?.info(`[AST] Extracted semantic target: [${signature.type}] named '${signature.name}'`);

            let candidates = this.findNodesBySignature(documentTree.rootNode, signature);
            let confidenceScore: 'High' | 'Medium' | 'Low' | 'Warning' = 'High';
            
            // ВПРОВАДЖЕННЯ FUZZY MATCHING (План Б)
            if (candidates.length === 0 && context.allowFuzzyMatching) {
                context.logger?.warn(`[AST] Target '${signature.name}' not found. Attempting Fuzzy Node Matching...`);
                const fuzzyNode = this.fuzzyFindNode(documentTree.rootNode, signature, context.logger);
                if (fuzzyNode) {
                    candidates = [fuzzyNode];
                    confidenceScore = 'Medium'; // Знижуємо довіру, бо це наближений пошук
                }
            }

            if (candidates.length === 0) {
                context.logger?.error(`[AST] Target '${signature.name}' not found in the original document.`);
                this.cleanup(documentTree);
                return {
                    status: 'FAILED',
                    reason: 'NOT_FOUND',
                    matchesFound: 0,
                    semanticDiagnostic: `Entity '${signature.type}' named '${signature.name}' does not exist in this file.`
                };
            }

            if (candidates.length > 1) {
                context.logger?.warn(`[AST] Ambiguous match. Found ${candidates.length} entities named '${signature.name}'.`);
                this.cleanup(documentTree);
                return { status: 'FAILED', reason: 'AMBIGUOUS_MATCH', matchesFound: candidates.length };
            }

            const matchedNode = candidates[0];
            
            if (matchedNode.type === 'program' || matchedNode.type === 'translation_unit') {
                context.logger?.warn(`[AST] Danger: Signature matched the entire file root node. Rejecting to prevent full file overwrite. Falling back to text heuristics.`);
                this.cleanup(documentTree);
                return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 1 };
            }

            const realStartOffset = this.calculatePreservedStart(matchedNode, context.document.getText());
            
            const start = context.document.positionAt(realStartOffset);
            const end = context.document.positionAt(matchedNode.endIndex);
            
            let cleanReplaceBlock = context.replaceBlock;
            let hoistedImports: string[] = [];

            if (context.replaceBlock) {
                const importData = this.extractImports(parser, context.replaceBlock);
                cleanReplaceBlock = importData.cleanCode;
                hoistedImports = importData.imports;
                
                if (hoistedImports.length > 0) {
                    context.logger?.info(`[AST] Auto-Import Resolver isolated ${hoistedImports.length} imports.`);
                }
            }
            
            this.cleanup(documentTree);

            context.logger?.info(`[AST] Successful match. Coordinates bounded securely.`);

            return {
                status: 'MATCHED',
                range: { start, end },
                confidence: 'exact',
                confidenceScore,
                strategy: this.name,
                hoistedImports,
                cleanReplaceBlock
            };

        } catch (e) {
            context.logger?.error(`[AST] Fatal execution error: ${e}`);
            this.cleanup(documentTree);
            return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
        }
    }

    private fuzzyFindNode(rootNode: ISyntaxNode, signature: SemanticSignature, logger?: IMatcherLogger): ISyntaxNode | null {
        let bestMatch: ISyntaxNode | null = null;
        let bestScore = 0;

        const walk = (node: ISyntaxNode) => {
            if (node.type === signature.type) {
                const nameNode = node.childForFieldName('name');
                if (nameNode && nameNode.text) {
                    const score = this.calculateSimilarity(nameNode.text, signature.name);
                    if (score > bestScore && score >= 0.85) { // Поріг впевненості 85%
                        bestScore = score;
                        bestMatch = node;
                    }
                }
            }
            for (const child of node.children) walk(child);
        };

        walk(rootNode);

        if (bestMatch) {
            const matchedName = (bestMatch as ISyntaxNode).childForFieldName('name')?.text;
            logger?.info(`[AST] Fuzzy matched node '${signature.name}' to existing '${matchedName}' (Confidence: ${(bestScore * 100).toFixed(1)}%)`);
        }

        return bestMatch;
    }

    private calculateSimilarity(s1: string, s2: string): number {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        const longerLength = longer.length;
        if (longerLength === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longerLength - distance) / parseFloat(longerLength.toString());
    }

    private levenshteinDistance(s1: string, s2: string): number {
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        }
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }

    private extractImports(parser: ITreeSitterParser, code: string): { cleanCode: string, imports: string[] } {
        const tree = parser.parse(code);
        const imports: string[] = [];
        const nodesToRemove: ISyntaxNode[] = [];

        const walk = (node: ISyntaxNode) => {
            if (node.type === 'import_statement' || node.type === 'using_directive') {
                imports.push(node.text);
                nodesToRemove.push(node);
            } else {
                for (const child of node.children) {
                    walk(child);
                }
            }
        };

        walk(tree.rootNode);
        tree.delete();

        if (nodesToRemove.length === 0) {
            return { cleanCode: code, imports: [] };
        }

        nodesToRemove.sort((a, b) => b.startIndex - a.startIndex);
        let cleanCode = code;
        for (const node of nodesToRemove) {
            cleanCode = cleanCode.substring(0, node.startIndex) + cleanCode.substring(node.endIndex);
        }

        return { cleanCode: cleanCode.trim(), imports };
    }

    private calculatePreservedStart(originalNode: ISyntaxNode, docText: string): number {
        let preserveEndIndex = originalNode.startIndex;

        for (const child of originalNode.children) {
            const isMetadata = child.type === 'decorator' || child.type === 'attribute_list' || child.type === 'comment';
            
            if (isMetadata) {
                preserveEndIndex = child.endIndex;
            } else {
                break;
            }
        }
        
        if (preserveEndIndex > originalNode.startIndex) {
            while (preserveEndIndex < docText.length && /\s/.test(docText[preserveEndIndex])) {
                preserveEndIndex++;
            }
            return preserveEndIndex;
        }

        return originalNode.startIndex;
    }

    private extractSignatureFromFragment(parser: ITreeSitterParser, code: string, extension: string, logger?: IMatcherLogger): SemanticSignature | null {
        let tree = parser.parse(code);
        let sig = this.extractSignature(tree.rootNode);
        tree.delete();
        
        if (sig) return sig;

        if (['.cs', '.ts', '.tsx', '.js', '.jsx'].includes(extension)) {
            // Спроба 1: Обгортка у клас (рятує розірвані методи)
            const classWrapped = `class FakeWrapper {\n${code}\n}`;
            tree = parser.parse(classWrapped);
            sig = this.extractSignature(tree.rootNode);
            tree.delete();
            if (sig) {
                logger?.info(`[AST] Signature extracted via Class wrapper.`);
                return sig;
            }

            // Спроба 2: Обгортка у метод (рятує розірвані statement-блоки)
            const methodWrapped = `class FakeWrapper { void FakeMethod() {\n${code}\n} }`;
            tree = parser.parse(methodWrapped);
            sig = this.extractSignature(tree.rootNode);
            tree.delete();
            if (sig) {
                logger?.info(`[AST] Signature extracted via Method wrapper.`);
                return sig;
            }
        } else if (extension === '.json') {
            const jsonWrapped = `{ "fakeKey": ${code} }`;
            tree = parser.parse(jsonWrapped);
            sig = this.extractSignature(tree.rootNode);
            tree.delete();
            if (sig) return sig;
        }

        return null;
    }

    private extractSignature(rootNode: ISyntaxNode): SemanticSignature | null {
        const walk = (node: ISyntaxNode): SemanticSignature | null => {
            if (node.isNamed && !BANNED_SIGNATURE_TYPES.has(node.type)) {
                const nameNode = node.childForFieldName('name');
                if (nameNode && nameNode.text) return { type: node.type, name: nameNode.text };
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
                if (nameNode && nameNode.text === signature.name) matches.push(node);
            }
            for (const child of node.children) walk(child);
        };
        walk(rootNode);
        return matches;
    }

    private cleanup(...trees: (IParserTree | undefined | null)[]): void {
        for (const tree of trees) {
            if (tree) tree.delete();
        }
    }
}