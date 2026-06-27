import styles from './styles/xml-viewer.module.css';

interface AttributesProps {
    readonly attributes: Record<string, string>;
}

export const XmlAttributes = ({ attributes }: AttributesProps) => {
    const entries = Object.entries(attributes);
    if (entries.length === 0) return null;

    return (
        <>
            {entries.map(([key, value]) => (
                <span key={key}>
                    {' '}
                    <span className={styles.attributeName}>{key}</span>
                    <span className={styles.tagBracket}>=</span>
                    <span className={styles.attributeValue}>"{value}"</span>
                </span>
            ))}
        </>
    );
};

export const XmlText = ({ content }: { readonly content: string }) => {
    return <span className={styles.textContent}>{content}</span>;
};

export function getTagNameClass(tagName: string): string {
    switch (tagName) {
        case 'workspace_edit':
            return styles.tagWorkspaceEdit;
        case 'create_file':
        case 'create_dir':
            return styles.tagCreate;
        case 'update_file':
        case 'change':
        case 'search':
        case 'replace':
            return styles.tagUpdate;
        case 'delete_path':
            return styles.tagDelete;
        case 'move_path':
            return styles.tagMove;
        default:
            return styles.tagDefault;
    }
}

export const XmlOpeningTag = ({ 
    tagName, 
    attributes, 
    isSelfClosing,
    isUnclosedError
}: { 
    readonly tagName: string;
    readonly attributes: Record<string, string>;
    readonly isSelfClosing: boolean;
    readonly isUnclosedError: boolean;
}) => {
    const wrapperClass = isUnclosedError ? styles.errorNode : '';
    const tagNameClass = getTagNameClass(tagName);
    
    return (
        <span className={wrapperClass}>
            <span className={styles.tagBracket}>{'<'}</span>
            <span className={tagNameClass}>{tagName}</span>
            <XmlAttributes attributes={attributes} />
            <span className={styles.tagBracket}>{isSelfClosing ? ' />' : '>'}</span>
        </span>
    );
};

export const XmlClosingTag = ({ tagName }: { readonly tagName: string }) => {
    const tagNameClass = getTagNameClass(tagName);
    return (
        <span>
            <span className={styles.tagBracket}>{'</'}</span>
            <span className={tagNameClass}>{tagName}</span>
            <span className={styles.tagBracket}>{'>'}</span>
        </span>
    );
};

export const XmlRowIndent = ({ depth }: { readonly depth: number }) => {
    const guides = [];
    for (let i = 0; i < depth; i++) {
        guides.push(<span key={i} className={styles.indentGuide} />);
    }
    return <div className={styles.indentGuidesWrapper}>{guides}</div>;
};
