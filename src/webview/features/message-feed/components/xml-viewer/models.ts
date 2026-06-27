export type XmlNodeType = 'ELEMENT' | 'TEXT';

export interface XmlBaseNode {
    readonly id: string;
    readonly type: XmlNodeType;
}

export interface XmlTextNode extends XmlBaseNode {
    readonly type: 'TEXT';
    readonly content: string;
}

export interface XmlElementNode extends XmlBaseNode {
    readonly type: 'ELEMENT';
    readonly tagName: string;
    readonly attributes: Record<string, string>;
    readonly isSelfClosing: boolean;
    readonly isUnclosedError: boolean;
    readonly children: (XmlElementNode | XmlTextNode)[];
}

export type XmlTree = (XmlElementNode | XmlTextNode)[];

export type RowType = 'OPENING_TAG' | 'CLOSING_TAG' | 'SELF_CLOSING_TAG' | 'TEXT_LINE';

export interface RenderableRow {
    readonly id: string;
    readonly depth: number;
    readonly node: XmlElementNode | XmlTextNode;
    readonly type: RowType;
    readonly text?: string;
}
