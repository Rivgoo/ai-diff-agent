import { useState } from 'react';
import { IconChevronRight, IconCopy, IconCheck } from '@tabler/icons-react';
import { XmlViewer } from './xml-viewer/XmlViewer';
import styles from '../styles/message.module.css';

interface PayloadAccordionProps {
    readonly rawInput: string;
}

export const PayloadAccordion = ({ rawInput }: PayloadAccordionProps) => {
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
                <div style={{ marginTop: '4px' }} role="region">
                    <XmlViewer rawInput={rawInput} />
                </div>
            )}
        </div>
    );
};
