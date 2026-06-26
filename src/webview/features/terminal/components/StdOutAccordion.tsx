import { useState } from 'react';
import type { PayloadSummary } from '@/shared/contracts';
import styles from '../styles/terminal.module.css';

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
                    <code>{summary.rawInput}</code>
                </pre>
            )}
        </div>
    );
};
