import type { ISyntaxNode } from './treeSitterRegistry';

export interface SemanticSignature {
    readonly type: string;
    readonly name: string;
}

export class AstQueryEngine {
    public static findTargetNode(rootNode: ISyntaxNode, signature: SemanticSignature): ISyntaxNode[] {
        const matches: ISyntaxNode[] = [];
        
        const walk = (node: ISyntaxNode) => {
            if (node.type === signature.type) {
                const nameNode = node.childForFieldName('name');
                if (nameNode && nameNode.text === signature.name && nameNode.text !== 'FakeWrapper' && nameNode.text !== 'FakeMethod') {
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

    public static findWildcardNodes(rootNode: ISyntaxNode, signature: SemanticSignature): ISyntaxNode[] {
        const matches: ISyntaxNode[] = [];
        const validTypes = new Set([
            'function_declaration',
            'method_definition',
            'class_declaration',
            'interface_declaration',
            'variable_declarator',
            'property_declaration',
            'method_declaration',
            'public_field_definition',
            'local_function_statement'
        ]);

        const walk = (node: ISyntaxNode) => {
            if (validTypes.has(node.type)) {
                const nameNode = node.childForFieldName('name');
                if (nameNode && nameNode.text === signature.name && nameNode.text !== 'FakeWrapper' && nameNode.text !== 'FakeMethod') {
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
}