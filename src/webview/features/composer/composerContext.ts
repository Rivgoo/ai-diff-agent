import { createContext } from 'react';
import type { RefObject } from 'react';

export interface ComposerState {
    value: string;
    isProcessing: boolean;
    hasValue: boolean;
    isClearDisabled: boolean;
}

export interface ComposerActions {
    updateValue: (val: string) => void;
    submit: () => void;
    cancel: () => void;
    clear: () => void;
    clearSession: () => void;
    toggleSettings: () => void;
}

export interface ComposerMeta {
    inputRef: RefObject<HTMLTextAreaElement | null>;
}

export interface ComposerContextContract {
    state: ComposerState;
    actions: ComposerActions;
    meta: ComposerMeta;
}

export const ComposerContext = createContext<ComposerContextContract | null>(null);
