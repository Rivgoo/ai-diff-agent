import React from 'react';
import { ComposerButton } from './ComposerButton';
import { ActionHints } from './ActionHints';
import { IconSend, IconX, IconPaperclip, IconAdjustmentsHorizontal } from '@tabler/icons-react';

interface ComposerActionBarProps {
    isFocused: boolean;
    isProcessing: boolean;
    hasValue: boolean;
    onSubmit: () => void;
    onCancel: () => void;
    onToggleSettings: () => void;
}

export const ComposerActionBar = ({
    isFocused,
    isProcessing,
    hasValue,
    onSubmit,
    onCancel,
    onToggleSettings
}: ComposerActionBarProps) => {
    
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 8px',
            borderTop: '1px solid transparent',
            position: 'relative',
            top: '-5px' // Lifted 5px upwards as requested
        }}>
            {/* Left side tools */}
            <div style={{ display: 'flex', gap: '4px' }}>
                <ComposerButton title="Attach context (Coming soon)" disabled>
                    <IconPaperclip size={16} />
                </ComposerButton>
                <ComposerButton title="Composer Settings" onClick={onToggleSettings}>
                    <IconAdjustmentsHorizontal size={16} />
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
