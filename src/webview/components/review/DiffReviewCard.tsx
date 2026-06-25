import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { DiffOperation } from '../../../shared/models';
import { useIPC } from '../../hooks/useIPC';

interface DiffReviewCardProps {
    operation: DiffOperation;
}

export const DiffReviewCard = (props: DiffReviewCardProps) => {
    const { operation } = props;
    const { sendEvent } = useIPC();

    const getBadgeStyle = () => {
        let backgroundColor = 'var(--vscode-badge-background)';
        let color = 'var(--vscode-badge-foreground)';
        
        switch (operation.status) {
            case 'applied':
                backgroundColor = 'var(--vscode-testing-iconPassed)';
                color = '#ffffff';
                break;
            case 'rejected':
                backgroundColor = 'var(--vscode-button-secondaryBackground)';
                color = 'var(--vscode-foreground)';
                break;
            case 'conflict':
                backgroundColor = 'var(--vscode-testing-iconFailed)';
                color = '#ffffff';
                break;
            case 'manual_modified':
                backgroundColor = 'var(--vscode-testing-iconQueued)';
                color = '#ffffff';
                break;
            case 'reviewing':
                backgroundColor = 'var(--vscode-textLink-foreground)';
                color = '#ffffff';
                break;
        }

        return {
            backgroundColor,
            color,
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: 'bold' as const,
            textTransform: 'uppercase' as const
        };
    };

    const handleAccept = () => {
        sendEvent({ type: 'ACTION_ACCEPT', operationId: operation.id });
    };

    const handleReject = () => {
        sendEvent({ type: 'ACTION_REJECT', operationId: operation.id });
    };

    const fileName = operation.path.split('/').pop() || operation.path;
    let displayStatus = operation.status.toUpperCase().replace('_', ' ');

    return (
        <div style={{
            marginTop: '8px',
            padding: '8px',
            backgroundColor: 'var(--vscode-editor-background)',
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={getBadgeStyle()}>
                        {operation.type === 'create_file' ? 'NEW' : operation.type.replace('_path', '').replace('_file', '').toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={operation.path}>
                        {fileName}
                    </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
                    {displayStatus}
                </div>
            </div>
            
            {operation.status === 'manual_modified' && (
                <div style={{ fontSize: '12px', color: 'var(--vscode-editorWarning-foreground)', fontStyle: 'italic' }}>
                    Code was modified manually. Auto-apply disabled.
                </div>
            )}

            {operation.status === 'pending' && (
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <VSCodeButton appearance="secondary" onClick={handleReject} style={{ padding: '2px 8px' }}>
                        Reject
                    </VSCodeButton>
                    <VSCodeButton appearance="primary" onClick={handleAccept} style={{ padding: '2px 8px' }}>
                        Accept & Apply
                    </VSCodeButton>
                </div>
            )}
        </div>
    );
};
