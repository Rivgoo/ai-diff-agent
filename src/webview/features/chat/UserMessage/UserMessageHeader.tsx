import { use } from 'react';
import { UserMessageContext } from './UserMessageContext';
import { IconChevronDown, IconChevronRight, IconTerminal } from '@tabler/icons-react';
import styles from './UserMessage.module.css';

export function UserMessageHeader() {
    const context = use(UserMessageContext);
    if (!context) {
        throw new Error('UserMessageHeader must be rendered within a UserMessageProvider');
    }

    const { state, actions } = context;
    const hasPayload = !!state.message.payloadSummary;

    const formattedTime = new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(new Date(state.message.timestamp));

    return (
        <div className={styles.header}>
            <div className={styles.titleGroup}>
                <IconTerminal size={14} className={styles.terminalIcon} aria-hidden="true" />
                <span className={styles.title}>Change Request</span>
                <span className={styles.timestamp}><time dateTime={new Date(state.message.timestamp).toISOString()}>{formattedTime}</time></span>
            </div>
            {hasPayload && (
                <button
                    type="button"
                    className={styles.collapseButton}
                    onClick={actions.toggleCollapse}
                    aria-expanded={!state.isCollapsed}
                    aria-label={state.isCollapsed ? 'Expand payload raw view' : 'Collapse payload raw view'}
                >
                    {state.isCollapsed ? (
                        <IconChevronRight size={14} aria-hidden="true" />
                    ) : (
                        <IconChevronDown size={14} aria-hidden="true" />
                    )}
                </button>
            )}
        </div>
    );
}
