import React from 'react';
import { ComposerButton } from './ComposerButton';
import { ActionHints } from './ActionHints';
import { IconSend, IconX, IconAdjustmentsHorizontal, IconTrash, IconDownload } from '@tabler/icons-react';

interface ComposerActionBarProps {
    isFocused: boolean;
    isProcessing: boolean;
    hasValue: boolean;
    onSubmit: () => void;
    onCancel: () => void;
    onToggleSettings: () => void;
    onClearSession: () => void;
    onDownloadInstructions: () => void;
}

export const ComposerActionBar = ({
    isFocused,
    isProcessing,
    hasValue,
    onSubmit,
    onCancel,
    onToggleSettings,
    onClearSession,
    onDownloadInstructions
}: ComposerActionBarProps) => {
    
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 8px',
            borderTop: '1px solid transparent',
            position: 'relative',
            top: '-5px'
        }}>
            {/* Left side tools - Settings, Clear Chat, and Download Instructions grouped together */}
            <div style={{ display: 'flex', gap: '4px' }}>
                <ComposerButton title="Composer Settings" onClick={onToggleSettings}>
                    <IconAdjustmentsHorizontal size={16} />
                </ComposerButton>
                <ComposerButton title="Clear Chat History" onClick={onClearSession}>
                    <IconTrash size={16} />
                </ComposerButton>
                <ComposerButton title="Get AI Instructions" onClick={onDownloadInstructions}>
                    <IconDownload size={16} />
                </ComposerButton>
            </div>

            {/* Right side actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ActionHints isFocused={isFocused} isProcessing={isProcessing} />
                
                {isProcessing ? (
                    <ComposerButton appearance="danger" onClick={onCancel} title="Cancel Processing (Esc)">
                        <IconX size={16} /> Cancel
                    </ComposerButton>
                ) : (
                    <ComposerButton 
                        appearance="primary" 
                        onClick={onSubmit} 
                        disabled={!hasValue}
                        title="Apply AI Payload (Enter)"
                    >
                        <IconSend size={16} /> Apply
                    </ComposerButton>
                )}
            </div>
        </div>
    );
};
