import * as vscode from 'vscode';
import { AgentSettings } from '../../shared/models';

/**
 * Manages reading and writing configuration from VS Code's native settings.json.
 */
export class SettingsManager {
    private readonly configSection = 'aiDiffAgent';

    public getSettings(): AgentSettings {
        const config = vscode.workspace.getConfiguration(this.configSection);
        return {
            autoScroll: config.get<boolean>('autoScroll', true),
            strictParsing: config.get<boolean>('strictParsing', false)
        };
    }

    public async updateSettings(settings: AgentSettings): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.configSection);
        await config.update('autoScroll', settings.autoScroll, vscode.ConfigurationTarget.Global);
        await config.update('strictParsing', settings.strictParsing, vscode.ConfigurationTarget.Global);
    }
}
