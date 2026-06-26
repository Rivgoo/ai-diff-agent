import { use } from 'react';
import { UserMessageContext } from './UserMessageContext';
import { IconPlus, IconEdit, IconExternalLink, IconTrash } from '@tabler/icons-react';
import styles from './UserMessage.module.css';

export function UserMessageStatsBar() {
    const context = use(UserMessageContext);
    if (!context) {
        throw new Error('UserMessageStatsBar must be rendered within a UserMessageProvider');
    }

    const { state } = context;
    const summary = state.message.payloadSummary;

    if (!summary) {
        return <div className={styles.plainText}>{state.message.text}</div>;
    }

    const { codeImpact } = summary;
    const iconSize = 12;

    return (
        <div className={styles.statsBar}>
            <div className={styles.metricsRow}>
                <div className={styles.pillsList}>
                    {summary.totalCreatedFiles > 0 && (
                        <span className={`${styles.pill} ${styles.addPill}`}>
                            <IconPlus size={iconSize} aria-hidden="true" />
                            {summary.totalCreatedFiles} new
                        </span>
                    )}
                    {summary.totalUpdatedFiles > 0 && (
                        <span className={`${styles.pill} ${styles.updatePill}`}>
                            <IconEdit size={iconSize} aria-hidden="true" />
                            {summary.totalUpdatedFiles} mod
                        </span>
                    )}
                    {summary.totalDeletedPaths > 0 && (
                        <span className={`${styles.pill} ${styles.deletePill}`}>
                            <IconTrash size={iconSize} aria-hidden="true" />
                            {summary.totalDeletedPaths} del
                        </span>
                    )}
                    {summary.totalMovedPaths > 0 && (
                        <span className={`${styles.pill} ${styles.movePill}`}>
                            <IconExternalLink size={iconSize} aria-hidden="true" />
                            {summary.totalMovedPaths} mov
                        </span>
                    )}
                </div>

                {(codeImpact.additions > 0 || codeImpact.deletions > 0) && (
                    <div className={styles.linesSummary}>
                        {codeImpact.additions > 0 && (
                            <span className={styles.additionsText}>+{codeImpact.additions}</span>
                        )}
                        {codeImpact.deletions > 0 && (
                            <span className={styles.deletionsText}>-{codeImpact.deletions}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
