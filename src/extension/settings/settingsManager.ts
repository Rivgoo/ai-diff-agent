import * as vscode from 'vscode';
import type { AgentSettings } from '@/shared/models';
import { SYSTEM_CONSTANTS } from '@/shared/constants';
import { ConfigurationService } from './configurationService';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';

export class SettingsManager {
    private readonly configService: ConfigurationService;

    constructor(
        context: vscode.ExtensionContext,
        workspaceRoot: vscode.Uri | undefined,
        private readonly onSettingsChanged: () => void
    ) {
        this.configService = new ConfigurationService(workspaceRoot);

        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (!this.configService.isFallbackMode && e.affectsConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION)) {
                    this.onSettingsChanged();
                }
            })
        );
    }

    public async init(): Promise<void> {
        await this.configService.init();
        this.onSettingsChanged(); // Синхронізуємо UI після завантаження кешу
    }

    public getSettings(): AgentSettings {
        return {
            behavior: this.configService.getBehaviorSettings(),
            engine: this.configService.getEngineSettings(),
            isFallbackMode: this.configService.isFallbackMode
        };
    }

    public async updateSetting(category: 'behavior' | 'engine', key: string, value: any): Promise<void> {
        try {
            await this.configService.updateSetting(category, key, value);
            this.onSettingsChanged(); // Форсуємо оновлення UI, щоб показати банер, якщо стався збій
        } catch (error) {
            OutputLogger.log(`Failed to update setting ${category}.${key}: ${error}`, 'ERROR');
        }
    }
}