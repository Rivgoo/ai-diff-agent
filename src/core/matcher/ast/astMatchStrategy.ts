import type { IMatchStrategy, MatchContext } from '../types';
import type { MatchResult } from '@/shared/contracts';
import { AstParserRegistry, type IParserTree, type ISyntaxNode, type ITreeSitterParser } from './treeSitterRegistry';
import { AstQueryEngine, type SemanticSignature } from './astQueryEngine';

const LANGUAGE_DISPATCH_MAP: Record<string, string> = {
    '.json': 'json',
    '.ts': 'typescript',
    '.tsx': 'tsx', 
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.cs': 'c_sharp',
    '.py': 'python',
    '.html': 'html',
    '.css': 'css',
    '.sh': 'bash',
    '.bash': 'bash',
    '.cpp': 'cpp',
    '.hpp': 'cpp',
    '.cc': 'cpp',
    '.c': 'c',
    '.h': 'c'
};

const BANNED_SIGNATURE_TYPES = new Set([
    'identifier', 'qualified_name', 'type_identifier', 'primitive_type',
    'string_literal', 'number_literal', 'boolean_literal',
    'using_directive', 'import_statement', 'expression_statement', 
    'namespace_declaration', 'file_scoped_namespace_declaration',
    'member_access_expression', 'call_expression', 'assignment_expression',
    'binary_expression', 'property_identifier', 'argument_list', 'variable_declaration',
    'type_parameter'
]);

export class AstMatchStrategy implements IMatchStrategy {
    public readonly name = 'SEMANTIC_AST_MATCH';
    public readonly tier = 0;

    public async findMatch(context: MatchContext): Promise<MatchResult> {
        if (!context.astSettings.enableAstMatching) {
            return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
        }

        const langKey = LANGUAGE_DISPATCH_MAP[context.fileExtension.toLowerCase()];
        if (!langKey || !context.astSettings.enabledLanguages.includes(langKey)) {
            return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
        }
        
        const parser = await AstParserRegistry.getParser(langKey, context.logger, context.astSettings.parserTimeoutMs);
        if (!parser) return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };

        context.logger?.info(`[AST] Initiating semantic analysis for ${context.document.path}`);

        let documentTree: IParserTree | undefined;

        try {
            documentTree = parser.parse(context.document.getText());
            
            const signature = this.extractSignatureFromFragment(parser, context.searchBlock, context.fileExtension);
            
            if (!signature) {
                context.logger?.info(`[AST] Could not extract reliable signature (likely an internal block). Falling back to Exact Match.`);
                this.cleanup(documentTree);
                return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
            }

            context.logger?.info(`[AST] Extracted semantic target: [${signature.type}] named '${signature.name}'`);

            let candidates = AstQueryEngine.findTargetNode(documentTree.rootNode, signature);
            let confidenceScore: 'High' | 'Medium' | 'Low' | 'Warning' = 'High';
            
            if (candidates.length === 0 && context.astSettings.queryTolerance === 'allow_signature_drift') {
                context.logger?.warn(`[AST] Strict match failed. Attempting Signature Drift wildcard search for '${signature.name}'...`);
                candidates = AstQueryEngine.findWildcardNodes(documentTree.rootNode, signature);
                if (candidates.length > 0) {
                    confidenceScore = 'Medium'; 
                }
            }

            if (candidates.length === 0) {
                context.logger?.warn(`[AST] Target '${signature.name}' not found.`);
                this.cleanup(documentTree);
                return {
                    status: 'FAILED',
                    reason: 'NOT_FOUND',
                    matchesFound: 0,
                    diagnostic: {
                        path: context.document.path,
                        severity: 'warning',
                        title: 'Semantic Target Missing',
                        detailedMessage: `Entity '${signature.type}' named '${signature.name}' does not exist in this file. Context might have changed.`,
                        code: 'AST_ENTITY_MISSING'
                    }
                };
            }

            if (candidates.length > 1) {
                context.logger?.warn(`[AST] Ambiguous match. Found ${candidates.length} entities named '${signature.name}'.`);
                this.cleanup(documentTree);
                return { status: 'FAILED', reason: 'AMBIGUOUS_MATCH', matchesFound: candidates.length };
            }

            const matchedNode = candidates[0];
            
            const nodeTextLength = matchedNode.endIndex - matchedNode.startIndex;
            const searchLength = context.searchBlock.length;
            
            if (nodeTextLength < searchLength * 0.25) { 
                context.logger?.warn(`[AST] Danger: Matched node is significantly smaller than the search block. Rejecting AST match.`);
                this.cleanup(documentTree);
                return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
            }

            if (matchedNode.type === 'program' || matchedNode.type === 'translation_unit') {
                context.logger?.warn(`[AST] Danger: Signature matched the entire file root node. Rejecting.`);
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
            }
            
            this.cleanup(documentTree);

            context.logger?.info(`[AST] Successful semantic match. Coordinates bounded securely.`);

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

    private extractSignatureFromFragment(parser: ITreeSitterParser, code: string, extension: string): SemanticSignature | null {
        let tree: IParserTree | undefined;
        
        try {
            tree = parser.parse(code);
            let sig = this.extractSignature(tree.rootNode);
            if (sig) return sig;
        } finally {
            tree?.delete();
        }

        if (['.cs', '.ts', '.tsx', '.js', '.jsx'].includes(extension)) {
            try {
                const classWrapped = `class FakeWrapper {\n${code}\n}`;
                tree = parser.parse(classWrapped);
                let sig = this.extractSignature(tree.rootNode);
                if (sig) return sig;
            } finally {
                tree?.delete();
            }

            try {
                const methodWrapped = `class FakeWrapper { void FakeMethod() {\n${code}\n} }`;
                tree = parser.parse(methodWrapped);
                let sig = this.extractSignature(tree.rootNode);
                if (sig) return sig;
            } finally {
                tree?.delete();
            }
        } else if (extension === '.json') {
            try {
                const jsonWrapped = `{ "fakeKey": ${code} }`;
                tree = parser.parse(jsonWrapped);
                let sig = this.extractSignature(tree.rootNode);
                if (sig) return sig;
            } finally {
                tree?.delete();
            }
        }

        return null;
    }

    private extractSignature(rootNode: ISyntaxNode): SemanticSignature | null {
        const walk = (node: ISyntaxNode): SemanticSignature | null => {
            if (node.isNamed && !BANNED_SIGNATURE_TYPES.has(node.type)) {
                const nameNode = node.childForFieldName('name');
                if (nameNode && nameNode.text && nameNode.text !== 'FakeWrapper' && nameNode.text !== 'FakeMethod') {
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

    private cleanup(...trees: (IParserTree | undefined | null)[]): void {
        for (const tree of trees) {
            if (tree) tree.delete();
        }
    }
}