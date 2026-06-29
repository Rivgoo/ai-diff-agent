import { useEffect, useRef } from 'react';
import type { WebviewEvent, ExtensionEvent } from '../../shared/ipc';
import { useAgentStore } from '../../webview/store/agentStore';

class VSCodeAPIWrapper {
    private static instance: any;
    static acquire() {
        if (!VSCodeAPIWrapper.instance) {
            try {
                // @ts-ignore
                VSCodeAPIWrapper.instance = acquireVsCodeApi();
            } catch {
                VSCodeAPIWrapper.instance = { postMessage: () => {} };
            }
        }
        return VSCodeAPIWrapper.instance;
    }
}

export const useIPC = () => {
    const vscode = useRef(VSCodeAPIWrapper.acquire());
    const hydrateSession = useAgentStore((state) => state.hydrateSession);
    const hydrateSettings = useAgentStore((state) => state.hydrateSettings);
    const setAgentTyping = useAgentStore((state) => state.setAgentTyping);
    const updateOperationStatus = useAgentStore((state) => state.updateOperationStatus);
    const updateOperationBatch = useAgentStore((state) => state.updateOperationBatch);
    const setPipelineProgress = useAgentStore((state) => state.setPipelineProgress);
    const setPromptCopied = useAgentStore((state) => state.setPromptCopied);

    useEffect(() => {
        const handleMessage = (event: MessageEvent<ExtensionEvent>) => {
            const message = event.data;
            switch (message.type) {
                case 'STATE_HYDRATE': 
                    hydrateSession(message.sessions, message.activeSessionId); 
                    break;
                case 'SETTINGS_HYDRATE': hydrateSettings(message.settings); break;
                case 'AGENT_TYPING': setAgentTyping(message.isTyping); break;
                case 'OPERATION_UPDATED': 
                    updateOperationStatus(
                        message.operationId, 
                        message.status,
                        message.resolvedResiliently,
                        message.originalPath,
                        message.path,
                        message.conflict,
                        message.isDirectory
                    ); 
                    break;
                case 'PIPELINE_STATE': setPipelineProgress({ stage: message.stage, current: message.current, total: message.total }); break;
                case 'PROMPT_COPIED': 
                    setPromptCopied(true);
                    setTimeout(() => setPromptCopied(false), 2000);
                    break;
                case 'ERROR_OCCURRED': console.error(message.message); break;
                case 'OPERATION_BATCH_UPDATED':
                    updateOperationBatch(message.updates);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        sendEvent({ type: 'REQUEST_STATE_SYNC' });
        sendEvent({ type: 'REQUEST_SETTINGS_SYNC' });

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const sendEvent = (event: WebviewEvent) => vscode.current.postMessage(event);

    return { sendEvent };
};
