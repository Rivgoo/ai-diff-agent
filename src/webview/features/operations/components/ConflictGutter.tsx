import type { ConflictDetails } from '@/shared/models';
import styles from '../styles/gutter.module.css';

interface ConflictGutterProps {
    readonly details: ConflictDetails;
}

export const ConflictGutter = ({ details }: ConflictGutterProps) => {
    return (
        <div className={styles.gutter} role="alert" aria-live="polite">
            <div className={styles.reasonTitle}>
                Error: {details.reason} (Block {details.blockIndex}/{details.totalBlocks})
            </div>
            
            <div className={styles.resolutionText}>
                {details.reason === 'NOT_FOUND' && 'Target pattern not found. Context may have changed.'}
                {details.reason === 'AMBIGUOUS_MATCH' && `Pattern matched ${details.matchesFound || 2} times. Provide more context lines.`}
                {details.reason === 'FILE_NOT_FOUND' && 'Target file does not exist on disk.'}
                {details.reason === 'SYNTAX_CORRUPTION_PREVENTED' && 'AI payload contains syntax errors.'}
            </div>

            {details.semanticDiagnostic && (
                <div className={styles.reasonTitle} style={{ marginTop: '4px', color: 'var(--vscode-testing-iconFailed)' }}>
                    Diagnostics: {details.semanticDiagnostic}
                </div>
            )}

            {details.searchExcerpt && details.searchExcerpt !== 'N/A' && (
                <pre className={styles.codeBlock}><code>{details.searchExcerpt}</code></pre>
            )}

            {details.candidatePaths && details.candidatePaths.length > 0 && (
                <div className={styles.candidatesList}>
                    <div className={styles.reasonTitle} style={{ color: 'var(--vscode-editorWarning-foreground)' }}>
                        Ambiguous path candidates found:
                    </div>
                    {details.candidatePaths.map(cp => (
                        <div key={cp} className={styles.candidateItem}>{cp}</div>
                    ))}
                </div>
            )}
        </div>
    );
};
