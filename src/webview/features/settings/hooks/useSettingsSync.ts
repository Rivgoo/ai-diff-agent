import { useRef, useCallback } from 'react';
import { useIPC } from '@/webview/hooks/useIPC';
import { useAgentStore } from '@/webview/store/agentStore';

export const useSettingsSync = () => {
    const { sendEvent } = useIPC();
    const updateLocalSetting = useAgentStore((state) => state.updateLocalSetting);
    const timerRef = useRef<number | null>(null);

    const updateSetting = useCallback((category: 'behavior' | 'engine', key: string, value: any) => {
        // Optimistic update
        updateLocalSetting(category, key, value);

        // Debounce IPC call to avoid freezing the Extension Host
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
            sendEvent({ type: 'UPDATE_SETTING', category, key, value });
        }, 300);
    }, [updateLocalSetting, sendEvent]);

    return { updateSetting };
};
