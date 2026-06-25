import React from 'react';
import { useAgentStore } from '../../store/agentStore';
import { useIPC } from '../../hooks/useIPC';
import { IconCheck, IconX, IconFiles } from '@tabler/icons-react';

export const StickyBatchBar = () => {
    const { sendEvent } = useIPC();
    
    const messages = useAgentStore((state) => state.messages);
    const pendingOps = messages.flatMap(msg => msg.operations || [])
        .filter(op => op.status === 'pending' || op.status === 'reviewing');

    if (pendingOps.length === 0) return null;

    const fileCount = new Set(pendingOps.map(o => o.path)).size;
    
    let totalAdditions = 0;
    let totalDeletions = 0;
    pendingOps.forEach(op => {
        if (op.stats) {
            totalAdditions += op.stats.additions;
            totalDeletions += op.stats.deletions;
        }
    });

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 8px',
            backgroundColor: 'var(--vscode-sideBar-background)',
            borderTop: '1px solid var(--vscode-panel-border)',
            borderBottom: '1px solid var(--vscode-panel-border)',
            fontSize: '11px',
            color: 'var(--vscode-foreground)',
            userSelect: 'none',
            flexShrink: 0
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--vscode-descriptionForeground)' }}>
                <IconFiles size={13} />
                <span>
                    {fileCount} pending file{fileCount !== 1 ? 's' : ''}
                </span>
                {(totalAdditions > 0 || totalDeletions > 0) && (
                    <span style={{ fontSize: '10px' }}>
                        (
                        {totalAdditions > 0 && <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>+{totalAdditions}</span>}
                        {totalAdditions > 0 && totalDeletions > 0 && ' '}
                        {totalDeletions > 0 && <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}>-{totalDeletions}</span>}
                        )
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
                <button
                    onClick={() => sendEvent({ type: 'ACTION_REJECT_ALL' })}
                    title="Reject All Pending Edits"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: 'none',
                        background: 'var(--vscode-button-secondaryBackground)',
                        color: 'var(--vscode-button-secondaryForeground)',
                        borderRadius: '3px',
                        padding: '2px 6px',
                        fontSize: '10.5px',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    <IconX size={12} /> Reject All
                </button>
                <button
                    onClick={() => sendEvent({ type: 'ACTION_ACCEPT_ALL' })}
                    title="Accept All Pending Edits"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: 'none',
                        background: 'var(--vscode-button-background)',
                        color: 'var(--vscode-button-foreground)',
                        borderRadius: '3px',
                        padding: '2px 6px',
                        fontSize: '10.5px',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    <IconCheck size={12} /> Accept All
                </button>
            </div>
        </div>
    );
};
