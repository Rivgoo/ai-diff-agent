import { useState, useMemo, useEffect, startTransition, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { IconChevronRight } from '@tabler/icons-react';
import { XmlTreeBuilder } from './XmlTreeBuilder';
import { XmlOpeningTag, XmlClosingTag, XmlText, XmlRowIndent } from './XmlElements';
import type { XmlTree, XmlElementNode, XmlTextNode, RenderableRow } from './models';
import styles from './styles/xml-viewer.module.css';

interface XmlViewerProps {
    readonly rawInput: string;
}

function getInitialCollapsedIds(tree: XmlTree, initialSet = new Set<string>()): Set<string> {
    for (const node of tree) {
        if (node.type === 'ELEMENT') {
            if (node.tagName === 'search' || node.tagName === 'replace') {
                const textChild = node.children.find(c => c.type === 'TEXT') as XmlTextNode | undefined;
                if (textChild && textChild.content && textChild.content.split('\n').length > 10) {
                    initialSet.add(node.id);
                }
            }
            getInitialCollapsedIds(node.children, initialSet);
        }
    }
    return initialSet;
}

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
                rows.push({ id: `${node.id}-self`, depth, node, type: 'SELF_CLOSING_TAG' });
            } else {
                rows.push({ id: `${node.id}-open`, depth, node, type: 'OPENING_TAG' });

                if (!isCollapsed) {
                    flattenTree(node.children, collapsedIds, depth + 1, rows);
                    if (!node.isUnclosedError) {
                        rows.push({ id: `${node.id}-close`, depth, node, type: 'CLOSING_TAG' });
                    }
                }
            }
        } else {
            const lines = node.content.split(/\r?\n/);
            lines.forEach((lineText, idx) => {
                rows.push({ id: `${node.id}-line-${idx}`, depth, node, type: 'TEXT_LINE', text: lineText });
            });
        }
    }
    return rows;
}

export const XmlViewer = ({ rawInput }: XmlViewerProps) => {
    const [tree, setTree] = useState<XmlTree | null>(null);
    const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
    
    // ФІКС: Контейнер для віртуалізації
    const parentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;
        XmlTreeBuilder.buildAsync(rawInput).then(result => {
            if (isMounted) {
                setTree(result);
                setCollapsedNodeIds(getInitialCollapsedIds(result));
            }
        });
        return () => { isMounted = false; };
    }, [rawInput]);

    const rows = useMemo(() => {
        if (!tree) return [];
        return flattenTree(tree, collapsedNodeIds);
    }, [tree, collapsedNodeIds]);

    const toggleCollapse = (nodeId: string) => {
        startTransition(() => {
            setCollapsedNodeIds(prev => {
                const next = new Set(prev);
                if (next.has(nodeId)) next.delete(nodeId);
                else next.add(nodeId);
                return next;
            });
        });
    };

    // Ініціалізація віртуалізатора
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 20, // Очікувана висота рядка
        overscan: 10 // Кількість рядків за межами екрану для плавного скролу
    });

    if (!tree) {
        return (
            <div className={styles.container} style={{ padding: '8px 12px', color: 'var(--vscode-descriptionForeground)' }}>
                Parsing XML payload...
            </div>
        );
    }

    return (
        <div 
            ref={parentRef} 
            className={styles.container} 
            style={{ maxHeight: '400px', overflowY: 'auto' }} // Обмеження висоти для скролу
        >
            <div 
                style={{ 
                    height: `${virtualizer.getTotalSize()}px`, 
                    width: '100%', 
                    position: 'relative' 
                }}
            >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const row = rows[virtualItem.index];
                    const elementNode = row.node as XmlElementNode;
                    const isCollapsed = collapsedNodeIds.has(row.node.id);
                    const canExpand = row.type === 'OPENING_TAG' && elementNode.children.length > 0;

                    return (
                        <div 
                            key={row.id} 
                            className={styles.line}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualItem.size}px`,
                                transform: `translateY(${virtualItem.start}px)`
                            }}
                        >
                            <div className={styles.gutter}>{virtualItem.index + 1}</div>
                            
                            <div className={styles.content}>
                                <XmlRowIndent depth={row.depth} />
                                
                                {canExpand ? (
                                    <button 
                                        type="button"
                                        className={styles.chevronBtn}
                                        onClick={() => toggleCollapse(row.node.id)}
                                        aria-expanded={!isCollapsed}
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
        </div>
    );
};