import React from 'react';
import { DiffOperation } from '../../../shared/models';
import { useIPC } from '../../hooks/useIPC';
import { 
    IconCheck, 
    IconX, 
    IconArrowsDiff,
    IconPlus,
    IconMinus,
    IconAlertCircle,
    IconFile,
    IconFolder,
    IconFolderPlus,
    IconEdit,
    IconExternalLink
} from '@tabler/icons-react';

interface DiffReviewCardProps {
    readonly operation: DiffOperation;
}

interface BadgeConfig {
    readonly label: string;
    readonly bg: string;
    readonly color: string;
    readonly icon: React.ReactNode;
}

// Capsule-badge configurations next to the file name
const BADGE_CONFIG: Record<string, BadgeConfig> = {
    create_file: { 
        label: 'NEW', 
        bg: 'var(--vscode-testing-iconPassed, #2ea44f)', 
        color: '#ffffff',
        icon: <IconPlus size={8} strokeWidth={3} />
    },
    update_file: { 
        label: 'UPDATE', 
        bg: 'var(--vscode-textLink-foreground, #007acc)', 
        color: '#ffffff',
        icon: <IconEdit size={8} strokeWidth={3} />
    },
    delete_path: { 
        label: 'DELETE', 
        bg: 'var(--vscode-testing-iconFailed, #cf222e)', 
        color: '#ffffff',
        icon: <IconMinus size={8} strokeWidth={3} />
    },
    move_path: { 
        label: 'MOVE', 
        bg: 'var(--vscode-editorWarning-foreground, #d29922)', 
        color: '#ffffff',
        icon: <IconExternalLink size={8} strokeWidth={3} />
    },
    create_dir: { 
        label: 'DIR', 
        bg: 'var(--vscode-badge-background, #586069)', 
        color: 'var(--vscode-badge-foreground, #ffffff)',
        icon: <IconFolderPlus size={8} strokeWidth={3} />
    }
};

export const DiffReviewCard = ({ operation }: DiffReviewCardProps) => {
    const { sendEvent } = useIPC();

    const isDirectory = operation.type === 'create_dir' || operation.path.endsWith('/');
    const TypeIcon = isDirectory ? IconFolder : IconFile;

    const badge = BADGE_CONFIG[operation.type];
    const canInteract = operation.status === 'pending' || operation.status === 'reviewing' || operation.status === 'conflict';
    const isConflict = operation.status === 'conflict';
    const isManualModified = operation.status === 'manual_modified';
    const isApplied = operation.status === 'applied';
    const isRejected = operation.status === 'rejected';

    const pathParts = operation.path.split('/');
    const fileName = pathParts.pop() ?? operation.path;
    const parentPath = pathParts.join('/');

    const renderStatusIcon = () => {
        const size = 14;
        if (isApplied) return <IconCheck size={size} style={{ color: 'var(--vscode-testing-iconPassed)' }} title="Applied Successfully" />;
        if (isRejected) return <IconX size={size} style={{ color: 'var(--vscode-descriptionForeground)' }} title="Rejected" />;
        if (isManualModified) return <IconEdit size={size} style={{ color: 'var(--vscode-editorWarning-foreground)' }} title="Modified Manually" />;
        if (isConflict) return <IconAlertCircle size={size} style={{ color: 'var(--vscode-testing-iconFailed)' }} title="Conflict Detected" />;
        return null;
    };

    const handleCardClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        
        if (operation.type === 'update_file') {
            sendEvent({ type: 'OPEN_DIFF', operationId: operation.id });
        }
    };

    return (
        <div 
            onClick={handleCardClick}
            style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '6px 8px',
                backgroundColor: 'var(--vscode-editor-background)',
                border: `1px solid ${isConflict ? 'var(--vscode-testing-iconFailed)' : 'var(--vscode-panel-border)'}`,
                borderLeft: `3px solid ${badge ? badge.bg : 'var(--vscode-badge-background)'}`,
                borderRadius: '4px',
                marginBottom: '4px',
                cursor: operation.type === 'update_file' ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease',
                userSelect: 'none'
            }}
            onMouseEnter={(e) => {
                if (operation.type === 'update_file') {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--vscode-editor-background)';
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                width: '100%',
                overflow: 'hidden'
            }}>
                {/* Left Side: Type Icon + Path Metadata */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--vscode-descriptionForeground)' }}>
                        <TypeIcon size={15} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
                            <span style={{
                                fontFamily: 'var(--vscode-font-family)',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: 'var(--vscode-foreground)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }} title={operation.path}>
                                {fileName}
                            </span>
                            {badge && (
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                    backgroundColor: badge.bg,
                                    color: badge.color,
                                    textTransform: 'uppercase',
                                    lineHeight: '1',
                                    flexShrink: 0
                                }}>
                                    {badge.icon}
                                    {badge.label}
                                </span>
                            )}
                        </div>
                        {parentPath && (
                            <span style={{
                                fontSize: '10px',
                                color: 'var(--vscode-descriptionForeground)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }} title={parentPath}>
                                {parentPath}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right Side: Line Statistics & Controls (Encapsulated to protect narrow sidebars) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {/* Compact Git-style diff stats */}
                    {operation.stats && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', marginRight: '4px' }}>
                            {operation.stats.additions > 0 && (
                                <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)', display: 'flex', alignItems: 'center' }}>
                                    <IconPlus size={10} strokeWidth={3} />{operation.stats.additions}
                                </span>
                            )}
                            {operation.stats.deletions > 0 && (
                                <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)', display: 'flex', alignItems: 'center' }}>
                                    <IconMinus size={10} strokeWidth={3} />{operation.stats.deletions}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Display static state icons for historical cards */}
                    {!canInteract && renderStatusIcon()}

                    {/* Active interactive button group with specialized separate background */}
                    {canInteract && (
                        <div style={{
                            display: 'flex',
                            gap: '2px',
                            alignItems: 'center',
                            backgroundColor: 'var(--vscode-button-secondaryBackground)',
                            border: '1px solid var(--vscode-panel-border)',
                            borderRadius: '4px',
                            padding: '2px'
                        }} onClick={e => e.stopPropagation()}>
                            {operation.type === 'update_file' && operation.status === 'reviewing' && (
                                <button
                                    title="Open Diff"
                                    onClick={() => sendEvent({ type: 'OPEN_DIFF', operationId: operation.id })}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        color: 'var(--vscode-icon-foreground)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        borderRadius: '3px',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <IconArrowsDiff size={14} />
                                </button>
                            )}
                            <button
                                title="Reject Change"
                                onClick={() => sendEvent({ type: 'ACTION_REJECT', operationId: operation.id })}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--vscode-gitDecoration-deletedResourceForeground)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    borderRadius: '3px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <IconX size={14} />
                            </button>
                            <button
                                title="Accept Change"
                                onClick={() => sendEvent({ type: 'ACTION_ACCEPT', operationId: operation.id })}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--vscode-gitDecoration-addedResourceForeground)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    borderRadius: '3px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <IconCheck size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isConflict && operation.errorMessage && (
                <div style={{
                    marginTop: '4px',
                    fontSize: '10.5px',
                    color: 'var(--vscode-editorError-foreground)',
                    backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
                    border: '1px solid var(--vscode-inputValidation-errorBorder)',
                    padding: '3px 6px',
                    borderRadius: '3px',
                    fontFamily: 'var(--vscode-editor-font-family)'
                }}>
                    {operation.errorMessage}
                </div>
            )}
        </div>
    );
};
