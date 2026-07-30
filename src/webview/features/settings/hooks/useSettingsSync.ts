import { useRef, useCallback, useEffect } from 'react';
import { useIPC } from '@/webview/hooks/useIPC';
import { useAgentStore } from '@/webview/store/agentStore';

export const useSettingsSync = () => {
    const { sendEvent } = useIPC();
    const updateLocalSetting = useAgentStore((state) => state.updateLocalSetting);
    
    const timersRef = useRef<Map<string, number>>(new Map());

    const updateSetting = useCallback((category: 'ui' | 'workflow' | 'engine' | 'ast' | 'ai', key: string, value: any) => {
        updateLocalSetting(category, key, value);

        const timerKey = `${category}.${key}`;
        const existingTimer = timersRef.current.get(timerKey);

        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const newTimer = window.setTimeout(() => {
            sendEvent({ type: 'UPDATE_SETTING', category, key, value });
            timersRef.current.delete(timerKey);
        }, 300);

        timersRef.current.set(timerKey, newTimer);
    }, [updateLocalSetting, sendEvent]);

    useEffect(() => {
        return () => {
            timersRef.current.forEach((timer) => clearTimeout(timer));
            timersRef.current.clear();
        };
    }, []);

    return { updateSetting };
};