import React from 'react';
import { DiffOperation } from '../../../shared/models';
import { useIPC } from '../../hooks/useIPC';
import { 
    IconCheck, 
    IconPlus, 
    IconMinus, 
    IconAlertCircle, 
    IconFile, 
    IconFolder, 
    IconFolderPlus, 
    IconEdit, 
    IconExternalLink, 
    IconArrowBackUp,
    IconArrowRight
} from '@tabler/icons-react';

interface BadgeConfig { label: string; bg: string; color: string; icon: React.ReactNode; }

const BADGE_CONFIG: Record<string, BadgeConfig> = {
    create_file: { label: 'NEW', bg: 'var(--vscode-testing-iconPassed)', color: '#ffffff', icon: <IconPlus size={8} strokeWidth={3} /> },
    update_file: { label: 'UPDATE', bg: 'var(--vscode-textLink-foreground)', color: '#ffffff', icon: <IconEdit size={8} strokeWidth={3} /> },
    delete_path: { label: 'DELETE', bg: 'var(--vscode-testing-iconFailed)', color: '#ffffff', icon: <IconMinus size={8} strokeWidth={3} /> },
    move_path: { label: 'MOVE', bg: 'var(--vscode-editorWarning-foreground)', color: '#ffffff', icon: <IconExternalLink size={8} strokeWidth={3} /> },
    create_dir: { label: 'DIR', bg: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)', icon: <IconFolderPlus size={8} strokeWidth={3} /> }
};

export const DiffReviewCard = ({ operation }: { readonly operation: DiffOperation }) => {
    const { sendEvent } = useIPC();

    const isDirectory = operation.type === 'create_dir' || operation.path.endsWith('/');
    const TypeIcon = isDirectory ? IconFolder : IconFile;

    const badge = BADGE_CONFIG[operation.type];
    const isConflict = operation.status === 'conflict';

    const pathParts = operation.path.split('/');
    const fileName = pathParts.pop() ?? operation.path;
    const parentPath = pathParts.join('/');

    const renderStatusIcon = () => {
        const size = 14;
        if (operation.status === 'applied_dirty') return <IconEdit size={size} style={{ color: 'var(--vscode-editorWarning-foreground)' }} title="Unsaved changes applied to editor" />;
        if (operation.status === 'saved') return <IconCheck size={size} style={{ color: 'var(--vscode-testing-iconPassed)' }} title="Saved to Disk" />;
        if (operation.status === 'reverted') return <IconArrowBackUp size={size} style={{ color: 'var(--vscode-descriptionForeground)' }} title="Reverted" />;
        if (isConflict) return <IconAlertCircle size={size} style={{ color: 'var(--vscode-testing-iconFailed)' }} title="Conflict Detected" />;
        return null;
    };

    return (
        <div 
            onClick={() => sendEvent({ type: 'OPEN_FILE', operationId: operation.id })}
            style={{
                display: 'flex', flexDirection: 'column', padding: '6px 8px',
                backgroundColor: 'var(--vscode-editor-background)',
                border: `1px solid ${isConflict ? 'var(--vscode-testing-iconFailed)' : 'var(--vscode-panel-border)'}`,
                borderLeft: `3px solid ${badge ? badge.bg : 'var(--vscode-badge-background)'}`,
                borderRadius: '4px', marginBottom: '4px', cursor: 'pointer', transition: 'background-color 0.15s ease', userSelect: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-editor-background)'}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--vscode-descriptionForeground)' }}><TypeIcon size={15} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vscode-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={operation.path}>
                                {fileName}
                            </span>
                            {badge && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '1px 4px', borderRadius: '3px', fontSize: '8px', fontWeight: 'bold', backgroundColor: badge.bg, color: badge.color, textTransform: 'uppercase', lineHeight: '1', flexShrink: 0 }}>
                                    {badge.icon}{badge.label}
                                </span>
                            )}
                        </div>

                        {/* PHASE 5: Render detailed routing metadata for moved files */}
                        {operation.type === 'move_path' && operation.sourcePath && operation.destinationPath ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', fontSize: '10px' }}>
                                <span style={{ textDecoration: 'line-through', color: 'var(--vscode-testing-iconFailed)' }}>
                                    {operation.sourcePath}
                                </span>
                                <span style={{ color: 'var(--vscode-testing-iconPassed)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <IconArrowRight size={10} /> {operation.destinationPath}
                                </span>
                            </div>
                        ) : (
                            parentPath && (
                                <span style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={parentPath}>
                                    {parentPath}
                                </span>
                            )
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {operation.stats && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', marginRight: '4px' }}>
                            {operation.stats.additions > 0 && <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)', display: 'flex', alignItems: 'center' }}><IconPlus size={10} strokeWidth={3} />{operation.stats.additions}</span>}
                            {operation.stats.deletions > 0 && <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)', display: 'flex', alignItems: 'center' }}><IconMinus size={10} strokeWidth={3} />{operation.stats.deletions}</span>}
                        </div>
                    )}
                    {renderStatusIcon()}
                </div>
            </div>

            {isConflict && operation.errorMessage && (
                <div style={{ marginTop: '4px', fontSize: '10.5px', color: 'var(--vscode-editorError-foreground)', backgroundColor: 'var(--vscode-inputValidation-errorBackground)', border: '1px solid var(--vscode-inputValidation-errorBorder)', padding: '3px 6px', borderRadius: '3px' }}>
                    {operation.errorMessage}
                </div>
            )}
        </div>
    );
};
