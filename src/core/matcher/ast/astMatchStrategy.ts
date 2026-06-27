import type { IMatchStrategy, MatchContext } from '../types';
import type { MatchResult } from '@/shared/contracts';
import { AstParserRegistry } from './treeSitterRegistry';

/**
 * Tier 0: Absolute AST matching.
 * Compares semantic graph nodes, completely ignoring lexical whitespace or formatting.
 */
export class AstMatchStrategy implements IMatchStrategy {
    public readonly name = 'AST_MATCH';
    public readonly tier = 0;

    public async findMatch(context: MatchContext): Promise<MatchResult | null> {
        if (context.fileExtension !== '.json') return null;
        
        const parser = await AstParserRegistry.getParser('json');
        if (!parser) return null;

        let docTree;
        try {
            docTree = parser.parse(context.document.getText());
            if (docTree.rootNode.hasError()) {
                docTree.delete();
                return null; 
            }

            const targetText = context.searchBlock.replace(/\s+/g, '');
            let matchedNode: any = null;

            // Simple robust subgraph detection:
            // Finds an exact topological node boundary that contains identical text.
            const walk = (node: any) => {
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

            walk(docTree.rootNode);
            
            if (matchedNode) {
                const start = context.document.positionAt(matchedNode.startIndex);
                const end = context.document.positionAt(matchedNode.endIndex);
                docTree.delete();
                return {
                    status: 'MATCHED',
                    range: { start, end },
                    confidence: 'exact'
                };
            }

            docTree.delete();
            return null; 
        } catch (e) {
            if (docTree) docTree.delete();
            return null;
        }
    }
}
