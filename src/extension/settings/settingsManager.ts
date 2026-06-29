import * as vscode from 'vscode';
import type { AgentSettings } from '@/shared/models';
import { SYSTEM_CONSTANTS } from '@/shared/constants';
import { ConfigurationService } from './configurationService';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';

export class SettingsManager {
    private readonly configService: ConfigurationService;

    constructor(
        context: vscode.ExtensionContext,
        private readonly onSettingsChanged: () => void
    ) {
        this.configService = new ConfigurationService();

        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION)) {
                    this.onSettingsChanged();
                }
            })
        );
    }

    public getSettings(): AgentSettings {
        return {
            behavior: this.configService.getBehaviorSettings(),
            engine: this.configService.getEngineSettings()
        };
    }

    public async updateSetting(category: 'behavior' | 'engine', key: string, value: any): Promise<void> {
        try {
            await this.configService.updateSetting(category, key, value);
        } catch (error) {
            OutputLogger.log(`Failed to update setting ${category}.${key}: ${error}`, 'ERROR');
        }
    }
}