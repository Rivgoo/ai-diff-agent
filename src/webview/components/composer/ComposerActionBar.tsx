import React from 'react';
import { ComposerButton } from './ComposerButton';
import { ActionHints } from './ActionHints';
import { ApplyIcon } from '../icons/ApplyIcon';
import { CancelIcon } from '../icons/CancelIcon';
import { AttachIcon } from '../icons/AttachIcon';
import { SettingsModeIcon } from '../icons/SettingsModeIcon';

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
            borderTop: '1px solid transparent', // Can be styled if needed
        }}>
            {/* Left side tools */}
            <div style={{ display: 'flex', gap: '4px' }}>
                <ComposerButton title="Attach context (Coming soon)" disabled>
                    <AttachIcon />
                </ComposerButton>
                <ComposerButton title="Composer Settings" onClick={onToggleSettings}>
                    <SettingsModeIcon />
                </ComposerButton>
            </div>

            {/* Right side actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ActionHints isFocused={isFocused} isProcessing={isProcessing} />
                
                {isProcessing ? (
                    <ComposerButton appearance="danger" onClick={onCancel} title="Cancel Processing (Esc)">
                        <CancelIcon /> Cancel
                    </ComposerButton>
                ) : (
                    <ComposerButton 
                        appearance="primary" 
                        onClick={onSubmit} 
                        disabled={!hasValue}
                        title="Apply AI Payload (Enter)"
                    >
                        <ApplyIcon /> Apply
                    </ComposerButton>
                )}
            </div>
        </div>
    );
};
