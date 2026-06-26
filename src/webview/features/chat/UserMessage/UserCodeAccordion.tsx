import { use, useState } from 'react';
import { UserMessageContext } from './UserMessageContext';
import { IconCopy, IconCheck, IconRotate } from '@tabler/icons-react';
import styles from './UserMessage.module.css';

export function UserCodeAccordion() {
    const context = use(UserMessageContext);
    if (!context) {
        throw new Error('UserCodeAccordion must be rendered within a UserMessageProvider');
    }

    const { state, actions } = context;
    const [copied, setCopied] = useState(false);

    if (state.isCollapsed || !state.message.payloadSummary) {
        return null;
    }

    const handleCopy = () => {
        actions.copyPayload();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={styles.accordionContainer}>
            <div className={styles.accordionHeader}>
                <span className={styles.accordionTitle}>Raw Input Payload</span>
                <div className={styles.actionsGroup}>
                    <button
                        type="button"
                        className={styles.actionButton}
                        onClick={handleCopy}
                        aria-label="Copy raw XML payload to clipboard"
                    >
                        {copied ? (
                            <IconCheck size={12} className={styles.successIcon} aria-hidden="true" />
                        ) : (
                            <IconCopy size={12} aria-hidden="true" />
                        )}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                        type="button"
                        className={styles.actionButton}
                        onClick={actions.retryPayload}
                        aria-label="Reload payload into composer input"
                    >
                        <IconRotate size={12} aria-hidden="true" />
                        <span>Retry</span>
                    </button>
                </div>
            </div>
            <div className={styles.codeViewport}>
                <pre className={styles.pre}>
                    <code>{state.message.payloadSummary.rawInput}</code>
                </pre>
            </div>
        </div>
    );
}
