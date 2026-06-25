import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { DiffOperation } from '../../../shared/models';
import { useIPC } from '../../hooks/useIPC';
import { IconCheck, IconX } from '@tabler/icons-react';

interface BatchSummaryBarProps {
    operations: DiffOperation[];
}

export const BatchSummaryBar = ({ operations }: BatchSummaryBarProps) => {
    const { sendEvent } = useIPC();

    const pending = operations.filter(o => o.status === 'pending' || o.status === 'reviewing').length;
    const fileCount = new Set(operations.map(o => o.path)).size;
    const changeCount = operations.reduce((acc, o) => acc + (o.changes?.length ?? 0), 0);

    if (pending === 0) return null;

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 0',
            marginBottom: '4px',
            borderBottom: '1px solid var(--vscode-panel-border)',
            flexWrap: 'wrap',
            gap: '6px'
        }}>
            <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
                {fileCount} file{fileCount !== 1 ? 's' : ''}{changeCount > 0 ? ` · ${changeCount} change${changeCount !== 1 ? 's' : ''}` : ''}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
                <VSCodeButton
                    appearance="secondary"
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    onClick={() => sendEvent({ type: 'ACTION_REJECT_ALL' })}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IconX size={14} /> Reject All
                    </div>
                </VSCodeButton>
                <VSCodeButton
                    appearance="primary"
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    onClick={() => sendEvent({ type: 'ACTION_ACCEPT_ALL' })}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IconCheck size={14} /> Accept All
                    </div>
                </VSCodeButton>
            </div>
        </div>
    );
};
