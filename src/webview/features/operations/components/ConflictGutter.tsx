import type { ConflictDetails } from '@/shared/models';
import { useIPC } from '@/webview/hooks/useIPC';
import { IconCopy } from '@tabler/icons-react';
import styles from '../styles/gutter.module.css';

interface ConflictGutterProps {
    readonly details: ConflictDetails;
    readonly operationId: string;
}

export const ConflictGutter = ({ details, operationId }: ConflictGutterProps) => {
    const { sendEvent } = useIPC();

    return (
        <div className={styles.gutter} role="alert">
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

            {details.reason !== 'ABORTED' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button 
                        style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: '1px solid var(--vscode-panel-border)', padding: '3px 8px', borderRadius: '3px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={(e) => { e.stopPropagation(); sendEvent({ type: 'SMART_RETRY_CONTEXT', operationId }); }}
                    >
                        <IconCopy size={12} />
                        Copy Error Context
                    </button>
                </div>
            )}
        </div>
    );
};