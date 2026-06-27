import { useState, useMemo } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { XmlTreeBuilder } from './XmlTreeBuilder';
import { XmlOpeningTag, XmlClosingTag, XmlText, XmlRowIndent } from './XmlElements';
import type { XmlTree, XmlElementNode, XmlTextNode, RenderableRow } from './models';
import styles from './styles/xml-viewer.module.css';

interface XmlViewerProps {
    readonly rawInput: string;
}

/**
 * Pre-calculates initially collapsed IDs based on line count heuristics
 */
function getInitialCollapsedIds(tree: XmlTree, initialSet = new Set<string>()): Set<string> {
    for (const node of tree) {
        if (node.type === 'ELEMENT') {
            if (node.tagName === 'search' || node.tagName === 'replace') {
                const textChild = node.children.find(c => c.type === 'TEXT') as XmlTextNode;
                if (textChild && textChild.content.split('\n').length > 10) {
                    initialSet.add(node.id);
                }
            }
            getInitialCollapsedIds(node.children, initialSet);
        }
    }
    return initialSet;
}

/**
 * Flattens the hierarchical XML tree dynamically into a single list of renderable lines.
 * This ensures perfect zero-gap spacing and straightforward line numbering.
 */
function flattenTree(
    tree: XmlTree,
    collapsedIds: Set<string>,
    depth = 0,
    rows: RenderableRow[] = []
): RenderableRow[] {
    for (const node of tree) {
        if (node.type === 'ELEMENT') {
            const isCollapsed = collapsedIds.has(node.id);

            if (node.isSelfClosing) {
                rows.push({
                    id: `${node.id}-self`,
                    depth,
                    node,
                    type: 'SELF_CLOSING_TAG'
                });
            } else {
                rows.push({
                    id: `${node.id}-open`,
                    depth,
                    node,
                    type: 'OPENING_TAG'
                });

                if (!isCollapsed) {
                    flattenTree(node.children, collapsedIds, depth + 1, rows);

                    if (!node.isUnclosedError) {
                        rows.push({
                            id: `${node.id}-close`,
                            depth,
                            node,
                            type: 'CLOSING_TAG'
                        });
                    }
                }
            }
        } else {
            // Split multi-line blocks into explicit separate line rows
            const lines = node.content.split(/\r?\n/);
            lines.forEach((lineText, idx) => {
                rows.push({
                    id: `${node.id}-line-${idx}`,
                    depth,
                    node,
                    type: 'TEXT_LINE',
                    text: lineText
                });
            });
        }
    }
    return rows;
}

export const XmlViewer = ({ rawInput }: XmlViewerProps) => {
    // 1. Build the immutable AST
    const tree = useMemo(() => XmlTreeBuilder.build(rawInput), [rawInput]);

    // 2. Pre-calculate collapsed sections
    const initialCollapsed = useMemo(() => getInitialCollapsedIds(tree), [tree]);
    const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(initialCollapsed);

    // 3. Flatten the expanded elements into visible rows
    const rows = useMemo(() => {
        return flattenTree(tree, collapsedNodeIds);
    }, [tree, collapsedNodeIds]);

    const toggleCollapse = (nodeId: string) => {
        setCollapsedNodeIds(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    return (
        <div className={styles.container}>
            {rows.map((row, index) => {
                const elementNode = row.node as XmlElementNode;
                const isCollapsed = collapsedNodeIds.has(row.node.id);
                const canExpand = row.type === 'OPENING_TAG' && elementNode.children.length > 0;

                return (
                    <div key={row.id} className={styles.line}>
                        {/* Line number Gutter */}
                        <div className={styles.gutter}>{index + 1}</div>
                        
                        <div className={styles.content}>
                            <XmlRowIndent depth={row.depth} />
                            
                            {/* Expand/Collapse Chevron control */}
                            {canExpand ? (
                                <button 
                                    type="button"
                                    className={styles.chevronBtn}
                                    onClick={() => toggleCollapse(row.node.id)}
                                    aria-expanded={!isCollapsed}
                                    aria-label={`Toggle ${elementNode.tagName} block`}
                                >
                                    <IconChevronRight 
                                        size={12} 
                                        className={`${styles.chevronIcon} ${!isCollapsed ? styles.chevronExpanded : ''}`} 
                                        aria-hidden="true"
                                    />
                                </button>
                            ) : (
                                <div className={styles.spacer} aria-hidden="true" />
                            )}

                            {/* Render explicit line content */}
                            {row.type === 'OPENING_TAG' && (
                                <>
                                    <XmlOpeningTag 
                                        tagName={elementNode.tagName} 
                                        attributes={elementNode.attributes} 
                                        isSelfClosing={false} 
                                        isUnclosedError={elementNode.isUnclosedError}
                                    />
                                    {isCollapsed && (
                                        <>
                                            <span 
                                                className={styles.collapsedStub} 
                                                onClick={() => toggleCollapse(row.node.id)}
                                                role="button"
                                                tabIndex={0}
                                            >
                                                ... {elementNode.children.length} node(s)
                                            </span>
                                            <XmlClosingTag tagName={elementNode.tagName} />
                                        </>
                                    )}
                                </>
                            )}

                            {row.type === 'CLOSING_TAG' && (
                                <XmlClosingTag tagName={elementNode.tagName} />
                            )}

                            {row.type === 'SELF_CLOSING_TAG' && (
                                <XmlOpeningTag 
                                    tagName={elementNode.tagName} 
                                    attributes={elementNode.attributes} 
                                    isSelfClosing={true} 
                                    isUnclosedError={elementNode.isUnclosedError}
                                />
                            )}

                            {row.type === 'TEXT_LINE' && (
                                <XmlText content={row.text ?? ''} />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
