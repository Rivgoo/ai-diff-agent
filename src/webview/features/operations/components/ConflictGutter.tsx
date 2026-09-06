import type { ConflictDetails } from '@/shared/models';
import { useIPC } from '@/webview/hooks/useIPC';
import { IconAlertCircle, IconExternalLink, IconCopy } from '@tabler/icons-react';
import styles from '../styles/gutter.module.css';
import { useAgentStore } from '@/webview/store/agentStore';

interface ConflictGutterProps {
    readonly details: ConflictDetails;
    readonly operationId: string;
}

export const ConflictGutter = ({ details, operationId }: ConflictGutterProps) => {
    const { sendEvent } = useIPC();
    const toggleDiagnosticsWindow = useAgentStore((state) => state.toggleDiagnosticsWindow);

    // Коротка причина для UI (щоб не засмічувати екран)
    let shortReason = 'Resolution Conflict';
    if (details.reason === 'NOT_FOUND') shortReason = 'Pattern Not Found';
    if (details.reason === 'AMBIGUOUS_MATCH') shortReason = 'Ambiguous Match';
    if (details.reason === 'SYNTAX_CORRUPTION_PREVENTED') shortReason = 'Syntax Error Prevented';
    if (details.reason === 'LSP_ERROR') shortReason = 'LSP Compilation Failed';
    if (details.reason === 'UNSAVED_CHANGES') shortReason = 'Unsaved File Exists';

     return (
        <div className={styles.gutter} role="alert">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <IconAlertCircle size={14} color="var(--vscode-editorError-foreground)" style={{ flexShrink: 0 }} />
                    <span className={styles.reasonTitle} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {shortReason} <span style={{ opacity: 0.7, fontWeight: 'normal' }}>(Block {details.blockIndex}/{details.totalBlocks})</span>
                    </span>
                </div>

                {details.reason !== 'ABORTED' && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button 
                            className={styles.retryBtn}
                            onClick={(e) => { e.stopPropagation(); sendEvent({ type: 'SMART_RETRY_CONTEXT', operationId }); }}
                            title="Copy error context for AI"
                        >
                            <IconCopy size={12} />
                        </button>
                        
                        {details.diagnostic && (
                            <button 
                                className={styles.retryBtn}
                                onClick={(e) => { e.stopPropagation(); toggleDiagnosticsWindow(true); }}
                                title="View detailed diagnostic"
                            >
                                <IconExternalLink size={12} /> Diagnostics
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};