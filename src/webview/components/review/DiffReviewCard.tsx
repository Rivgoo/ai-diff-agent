import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { DiffOperation } from '../../../shared/models';
import { useIPC } from '../../hooks/useIPC';

interface DiffReviewCardProps {
    operation: DiffOperation;
}

const TYPE_LABELS: Record<string, string> = {
    create_file: 'NEW',
    update_file: 'UPDATE',
    delete_path: 'DELETE',
    move_path: 'MOVE',
    create_dir: 'DIR'
};

const TYPE_COLORS: Record<string, string> = {
    create_file: 'var(--vscode-testing-iconPassed)',
    update_file: 'var(--vscode-textLink-foreground)',
    delete_path: 'var(--vscode-testing-iconFailed)',
    move_path: 'var(--vscode-editorWarning-foreground)',
    create_dir: 'var(--vscode-badge-background)'
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    reviewing: 'In Review',
    applied: 'Applied',
    rejected: 'Rejected',
    conflict: 'Conflict',
    error: 'Error',
    manual_modified: 'Edited Manually'
};

export const DiffReviewCard = ({ operation }: DiffReviewCardProps) => {
    const { sendEvent } = useIPC();

    const typeColor = TYPE_COLORS[operation.type] ?? 'var(--vscode-badge-background)';
    const typeLabel = TYPE_LABELS[operation.type] ?? operation.type.toUpperCase();
    const statusLabel = STATUS_LABELS[operation.status] ?? operation.status;

    const changeCount = operation.changes?.length ?? 0;
    const isUpdateFile = operation.type === 'update_file';
    const canInteract = operation.status === 'pending' || operation.status === 'reviewing';
    const isConflict = operation.status === 'conflict';
    const isManualModified = operation.status === 'manual_modified';

    return (
        <div style={{
            marginTop: '6px',
            padding: '8px 10px',
            backgroundColor: 'var(--vscode-editor-background)',
            border: `1px solid ${isConflict ? 'var(--vscode-testing-iconFailed)' : 'var(--vscode-panel-border)'}`,
            borderLeft: `3px solid ${typeColor}`,
            borderRadius: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
        }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                            backgroundColor: typeColor,
                            color: '#fff',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            flexShrink: 0
                        }}>
                            {typeLabel}
                        </span>
                        {/* Fix §6.4 — show full path, not just filename */}
                        <span style={{
                            fontFamily: 'var(--vscode-editor-font-family)',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: 'var(--vscode-foreground)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }} title={operation.path}>
                            {operation.path}
                        </span>
                    </div>
                    {/* Fix §6.4 — show change count */}
                    {isUpdateFile && changeCount > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', paddingLeft: '2px' }}>
                            {changeCount} change block{changeCount !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <span style={{
                    fontSize: '10px',
                    color: isConflict ? 'var(--vscode-testing-iconFailed)' : 'var(--vscode-descriptionForeground)',
                    flexShrink: 0,
                    paddingTop: '2px'
                }}>
                    {statusLabel}
                </span>
            </div>

            {/* Manual modified notice */}
            {isManualModified && (
                <div style={{ fontSize: '11px', color: 'var(--vscode-editorWarning-foreground)', fontStyle: 'italic' }}>
                    You modified this code manually. The AI change was discarded for safety.
                </div>
            )}

            {/* Conflict notice */}
            {isConflict && operation.errorMessage && (
                <div style={{
                    fontSize: '11px',
                    color: 'var(--vscode-editorError-foreground)',
                    backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
                    padding: '4px 6px',
                    borderRadius: '3px',
                    fontFamily: 'var(--vscode-editor-font-family)'
                }}>
                    {operation.errorMessage}
                </div>
            )}

            {/* Action row */}
            {canInteract && (
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {/* Fix §6.4 — "Open Diff" for update_file ops in reviewing state */}
                    {isUpdateFile && operation.status === 'reviewing' && (
                        <VSCodeButton
                            appearance="icon"
                            title="Open side-by-side diff"
                            style={{ fontSize: '11px' }}
                            onClick={() => sendEvent({ type: 'OPEN_DIFF', operationId: operation.id })}
                        >
                            ⇄ Diff
                        </VSCodeButton>
                    )}
                    <VSCodeButton
                        appearance="secondary"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => sendEvent({ type: 'ACTION_REJECT', operationId: operation.id })}
                    >
                        Reject
                    </VSCodeButton>
                    <VSCodeButton
                        appearance="primary"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => sendEvent({ type: 'ACTION_ACCEPT', operationId: operation.id })}
                    >
                        {operation.type === 'update_file' ? 'Accept' : 'Accept & Apply'}
                    </VSCodeButton>
                </div>
            )}
        </div>
    );
};
