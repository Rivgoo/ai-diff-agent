import React from 'react';
import { useAgentStore } from '../../store/agentStore';
import { useIPC } from '../../hooks/useIPC';
import { IconCheck, IconX, IconFiles, IconPlus, IconMinus, IconEdit, IconExternalLink, IconFolderPlus } from '@tabler/icons-react';

export const StickyBatchBar = () => {
    const { sendEvent } = useIPC();
    
    const messages = useAgentStore((state) => state.messages);
    const pendingOps = messages.flatMap(msg => msg.operations || [])
        .filter(op => op.status === 'pending' || op.status === 'reviewing' || op.status === 'conflict');

    if (pendingOps.length === 0) return null;

    let addedFiles = 0;
    let addedFolders = 0;
    let deletedFiles = 0;
    let deletedFolders = 0;
    let updatedFiles = 0;
    let movedPaths = 0;

    let totalAdditions = 0;
    let totalDeletions = 0;

    pendingOps.forEach(op => {
        if (op.type === 'create_file') {
            addedFiles++;
        } else if (op.type === 'create_dir') {
            addedFolders++;
        } else if (op.type === 'delete_path') {
            if (op.path.endsWith('/')) {
                deletedFolders++;
            } else {
                deletedFiles++;
            }
        } else if (op.type === 'update_file') {
            updatedFiles++;
        } else if (op.type === 'move_path') {
            movedPaths++;
        }

        if (op.stats) {
            totalAdditions += op.stats.additions;
            totalDeletions += op.stats.deletions;
        }
    });

    const statItems: React.ReactNode[] = [];
    const iconSize = 11;

    // Build statistics displaying only categories that exceed zero
    if (addedFiles > 0) {
        statItems.push(
            <span key="add-f" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--vscode-testing-iconPassed)' }}>
                <IconPlus size={iconSize} />{addedFiles} file{addedFiles > 1 ? 's' : ''}
            </span>
        );
    }
    if (addedFolders > 0) {
        statItems.push(
            <span key="add-d" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--vscode-badge-background)' }}>
                <IconFolderPlus size={iconSize} />{addedFolders} dir{addedFolders > 1 ? 's' : ''}
            </span>
        );
    }
    if (updatedFiles > 0) {
        statItems.push(
            <span key="up-f" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--vscode-textLink-foreground)' }}>
                <IconEdit size={iconSize} />{updatedFiles} update{updatedFiles > 1 ? 's' : ''}
            </span>
        );
    }
    if (deletedFiles > 0) {
        statItems.push(
            <span key="del-f" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--vscode-testing-iconFailed)' }}>
                <IconMinus size={iconSize} />{deletedFiles} deleted file{deletedFiles > 1 ? 's' : ''}
            </span>
        );
    }
    if (deletedFolders > 0) {
        statItems.push(
            <span key="del-d" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--vscode-testing-iconFailed)' }}>
                <IconX size={iconSize} />{deletedFolders} deleted dir{deletedFolders > 1 ? 's' : ''}
            </span>
        );
    }
    if (movedPaths > 0) {
        statItems.push(
            <span key="mov-p" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--vscode-editorWarning-foreground)' }}>
                <IconExternalLink size={iconSize} />{movedPaths} moved
            </span>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '8px 10px',
            backgroundColor: 'var(--vscode-sideBar-background)',
            borderTop: '1px solid var(--vscode-panel-border)',
            borderBottom: '1px solid var(--vscode-panel-border)',
            fontSize: '11px',
            color: 'var(--vscode-foreground)',
            userSelect: 'none',
            flexShrink: 0
        }}>
            {/* Top row: Detailed breakdowns */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', lineHeight: '1.4' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', color: 'var(--vscode-foreground)' }}>
                    <IconFiles size={13} />
                    <span>Pending Changes:</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    {statItems.reduce((prev, curr) => prev === null ? [curr] : [...prev, <span key={`sep-${curr.key}`} style={{ color: 'var(--vscode-descriptionForeground)' }}>·</span>, curr], null as React.ReactNode[] | null)}
                </div>
                {(totalAdditions > 0 || totalDeletions > 0) && (
                    <span style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)' }}>
                        (
                        {totalAdditions > 0 && <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>+{totalAdditions}</span>}
                        {totalAdditions > 0 && totalDeletions > 0 && ' '}
                        {totalDeletions > 0 && <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}>-{totalDeletions}</span>}
                        )
                    </span>
                )}
            </div>

            {/* Bottom row: Expanded Action Buttons */}
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
                <button
                    onClick={() => sendEvent({ type: 'ACTION_REJECT_ALL' })}
                    title="Reject All Pending Edits"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        border: 'none',
                        background: 'var(--vscode-button-secondaryBackground)',
                        color: 'var(--vscode-button-secondaryForeground)',
                        borderRadius: '3px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        height: '24px'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    <IconX size={13} /> Reject All
                </button>
                <button
                    onClick={() => sendEvent({ type: 'ACTION_ACCEPT_ALL' })}
                    title="Accept All Pending Edits"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        border: 'none',
                        background: 'var(--vscode-button-background)',
                        color: 'var(--vscode-button-foreground)',
                        borderRadius: '3px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        height: '24px'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    <IconCheck size={13} /> Accept All
                </button>
            </div>
        </div>
    );
};
