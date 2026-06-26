import { useState } from 'react';
import type { PayloadSummary } from '@/shared/contracts';
import styles from '../styles/terminal.module.css';

/**
 * Lightweight XML syntax highlighter.
 * Makes it easier to read AI payloads and spot <search> / <replace> tag errors.
 */
const HighlightedXML = ({ content }: { content: string }) => {
    // Розбиваємо текст по тегах XML
    const parts = content.split(/(<\/?[a-zA-Z0-9_="-]+\s*\/?>)/g);
    
    return (
        <code>
            {parts.map((part, i) => {
                if (part.startsWith('<') && part.endsWith('>')) {
                    const isCrucialTag = part.includes('search') || part.includes('replace');
                    const tagClass = isCrucialTag ? styles.xmlTagHighlight : styles.xmlTag;
                    return <span key={i} className={tagClass}>{part}</span>;
                }
                return <span key={i}>{part}</span>;
            })}
        </code>
    );
};

export const StdOutAccordion = ({ summary }: { summary: PayloadSummary }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(summary.rawInput);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div>
            <button 
                type="button" 
                className={styles.accordionBtn}
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                {isOpen ? '[-]' : '[+]'} View raw stdout payload
                {isOpen && (
                    <span className={styles.copyInline} onClick={handleCopy}>
                        {copied ? '(copied)' : '(copy)'}
                    </span>
                )}
            </button>

            {isOpen && (
                <pre className={styles.payloadPre}>
                    <HighlightedXML content={summary.rawInput} />
                </pre>
            )}
        </div>
    );
};