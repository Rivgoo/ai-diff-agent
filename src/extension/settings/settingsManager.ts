import * as vscode from 'vscode';
import type { AgentSettings } from '@/shared/models';
import { SYSTEM_CONSTANTS } from '@/shared/constants';

export class SettingsManager {
    public getSettings(): AgentSettings {
        const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
        return {
            autoScroll: config.get<boolean>('autoScroll', true),
            strictParsing: config.get<boolean>('strictParsing', false)
        };
    }

    public async updateSettings(settings: AgentSettings): Promise<void> {
        const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
        await config.update('autoScroll', settings.autoScroll, vscode.ConfigurationTarget.Global);
        await config.update('strictParsing', settings.strictParsing, vscode.ConfigurationTarget.Global);
    }
}
