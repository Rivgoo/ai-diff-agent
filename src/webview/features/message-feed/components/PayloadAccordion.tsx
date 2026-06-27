import { useState } from 'react';
import { IconChevronRight, IconCopy, IconCheck } from '@tabler/icons-react';
import styles from '../styles/message.module.css';

const HighlightedXML = ({ content }: { content: string }) => {
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

export const PayloadAccordion = ({ rawInput }: { rawInput: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(rawInput);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            }
        } catch (error) {
            console.error('Clipboard write failed', error);
        }
    };

    return (
        <div>
            <div className={styles.accordionHeader}>
                <button 
                    type="button" 
                    className={styles.accordionToggle}
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                >
                    <IconChevronRight 
                        size={14} 
                        className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} 
                        aria-hidden="true" 
                    />
                    XML Payload Data
                </button>

                <button 
                    type="button" 
                    className={`${styles.copyBtn} ${isCopied ? styles.copySuccess : ''}`}
                    onClick={handleCopy}
                    aria-label="Copy payload to clipboard"
                >
                    {isCopied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
            </div>

            {isOpen && (
                <pre className={styles.payloadContent} role="region">
                    <HighlightedXML content={rawInput} />
                </pre>
            )}
        </div>
    );
};
