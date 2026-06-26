import type { PayloadSummary } from '@/shared/contracts';
import styles from '../styles/terminal.module.css';

export const CommandHeader = ({ summary }: { summary?: PayloadSummary }) => {
    if (!summary) return null;

    const { codeImpact, totalCreatedFiles, totalUpdatedFiles, totalDeletedPaths, totalMovedPaths } = summary;
    const totalOps = totalCreatedFiles + totalUpdatedFiles + totalDeletedPaths + totalMovedPaths;

    return (
        <div className={styles.commandHeader}>
            <span className={styles.promptSymbol}>$</span>
            <span>apply-transaction --ops {totalOps}</span>
            <span className={styles.metrics}>
                {codeImpact.additions > 0 && <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>+{codeImpact.additions} </span>}
                {codeImpact.deletions > 0 && <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}>-{codeImpact.deletions}</span>}
            </span>
        </div>
    );
};
