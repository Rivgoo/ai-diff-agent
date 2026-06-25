import { useEffect, useRef } from 'react';
import { WebviewEvent, ExtensionEvent } from '../../shared/ipc';
import { useChatStore } from '../store/chatStore';

class VSCodeAPIWrapper {
    private static instance: any;
    static acquire() {
        if (!VSCodeAPIWrapper.instance) {
            // @ts-ignore
            VSCodeAPIWrapper.instance = acquireVsCodeApi();
        }
        return VSCodeAPIWrapper.instance;
    }
}

export const useIPC = () => {
    const vscode = useRef(VSCodeAPIWrapper.acquire());
    const hydrateSession = useChatStore((state) => state.hydrateSession);
    const hydrateSettings = useChatStore((state) => state.hydrateSettings);
    const setAgentTyping = useChatStore((state) => state.setAgentTyping);

    useEffect(() => {
        const handleMessage = (event: MessageEvent<ExtensionEvent>) => {
            const message = event.data;
            switch (message.type) {
                case 'STATE_HYDRATE':
                    hydrateSession(message.session);
                    break;
                case 'SETTINGS_HYDRATE':
                    hydrateSettings(message.settings);
                    break;
                case 'AGENT_TYPING':
                    setAgentTyping(message.isTyping);
                    break;
                case 'ERROR_OCCURRED':
                    console.error("Agent Error:", message.message);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        
        // Request initial states on mount
        sendEvent({ type: 'REQUEST_STATE_SYNC' });
        sendEvent({ type: 'REQUEST_SETTINGS_SYNC' });

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const sendEvent = (event: WebviewEvent) => {
        vscode.current.postMessage(event);
    };

    return { sendEvent };
};
