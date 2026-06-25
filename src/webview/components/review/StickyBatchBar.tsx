import React from 'react';
import { useAgentStore } from '../../store/agentStore';
import { useIPC } from '../../hooks/useIPC';
import { IconDeviceFloppy, IconArrowBackUp, IconFiles, IconPlus, IconMinus, IconEdit, IconExternalLink, IconFolderPlus, IconX } from '@tabler/icons-react';

export const StickyBatchBar = () => {
    const { sendEvent } = useIPC();
    const messages = useAgentStore((state) => state.messages);
    
    const dirtyOps = messages.flatMap(msg => msg.operations || [])
        .filter(op => op.status === 'applied_dirty' || op.status === 'conflict');

    if (dirtyOps.length === 0) return null;

    let addedFiles = 0, addedFolders = 0, deletedFiles = 0, deletedFolders = 0, updatedFiles = 0, movedPaths = 0;
    let totalAdditions = 0, totalDeletions = 0;

    dirtyOps.forEach(op => {
        if (op.type === 'create_file') addedFiles++;
        else if (op.type === 'create_dir') addedFolders++;
        else if (op.type === 'delete_path') { if (op.path.endsWith('/')) deletedFolders++; else deletedFiles++; }
        else if (op.type === 'update_file') updatedFiles++;
        else if (op.type === 'move_path') movedPaths++;

        if (op.stats) {
            totalAdditions += op.stats.additions;
            totalDeletions += op.stats.deletions;
        }
    });

    const statItems: React.ReactNode[] = [];
    const iconSize = 11;

    if (addedFiles > 0) statItems.push(<span key="add-f" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--vscode-testing-iconPassed)' }}><IconPlus size={iconSize} />{addedFiles} file{addedFiles > 1 ? 's' : ''}</span>);
    if (addedFolders > 0) statItems.push(<span key="add-d" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--vscode-badge-background)' }}><IconFolderPlus size={iconSize} />{addedFolders} dir{addedFolders > 1 ? 's' : ''}</span>);
    if (updatedFiles > 0) statItems.push(<span key="up-f" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--vscode-textLink-foreground)' }}><IconEdit size={iconSize} />{updatedFiles} update{updatedFiles > 1 ? 's' : ''}</span>);
    if (deletedFiles > 0) statItems.push(<span key="del-f" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--vscode-testing-iconFailed)' }}><IconMinus size={iconSize} />{deletedFiles} deleted file{deletedFiles > 1 ? 's' : ''}</span>);
    if (deletedFolders > 0) statItems.push(<span key="del-d" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--vscode-testing-iconFailed)' }}><IconX size={iconSize} />{deletedFolders} deleted dir{deletedFolders > 1 ? 's' : ''}</span>);
    if (movedPaths > 0) statItems.push(<span key="mov-p" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--vscode-editorWarning-foreground)' }}><IconExternalLink size={iconSize} />{movedPaths} moved</span>);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px',
            backgroundColor: 'var(--vscode-sideBar-background)', borderTop: '1px solid var(--vscode-panel-border)', borderBottom: '1px solid var(--vscode-panel-border)',
            fontSize: '11px', color: 'var(--vscode-foreground)', userSelect: 'none', flexShrink: 0
        }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', lineHeight: '1.4' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', color: 'var(--vscode-foreground)' }}>
                    <IconFiles size={13} /><span>Pending Review:</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    {statItems.reduce((prev, curr) => prev === null ? [curr] : [...prev, <span key={`sep-${curr.key}`} style={{ color: 'var(--vscode-descriptionForeground)' }}>·</span>, curr], null as React.ReactNode[] | null)}
                </div>
                {(totalAdditions > 0 || totalDeletions > 0) && (
                    <span style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)' }}>
                        ({totalAdditions > 0 && <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>+{totalAdditions}</span>}
                        {totalAdditions > 0 && totalDeletions > 0 && ' '}
                        {totalDeletions > 0 && <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}>-{totalDeletions}</span>})
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
                <button
                    onClick={() => sendEvent({ type: 'ACTION_REVERT_ALL' })}
                    title="Undo all modifications"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px', border: 'none',
                        background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)',
                        borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontWeight: 600
                    }}
                >
                    <IconArrowBackUp size={13} /> Revert All
                </button>
                <button
                    onClick={() => sendEvent({ type: 'ACTION_SAVE_ALL' })}
                    title="Save all open dirty files"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px', border: 'none',
                        background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)',
                        borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontWeight: 600
                    }}
                >
                    <IconDeviceFloppy size={13} /> Save All
                </button>
            </div>
        </div>
    );
};
