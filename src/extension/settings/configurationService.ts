import * as vscode from "vscode";
import { SYSTEM_CONSTANTS } from "@/shared/constants";
import type { BehaviorSettings, EngineSettings } from "@/shared/models";

export class ConfigurationService {
  public getBehaviorSettings(): BehaviorSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const behavior = config.get<BehaviorSettings>("behavior") || {} as BehaviorSettings;
    
    return {
      autoScroll: behavior.autoScroll ?? true,
      compactMode: behavior.compactMode ?? false,
      storeChatInWorkspace: behavior.storeChatInWorkspace ?? false,
    };
  }

  public getEngineSettings(): EngineSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const engine = config.get<EngineSettings>("engine") || {} as EngineSettings;
    
    return {
      strictParsing: engine.strictParsing ?? false,
      maxBackupRetentionDays: engine.maxBackupRetentionDays ?? 7,
    };
  }

  public async updateSetting(category: "behavior" | "engine", key: string, value: any): Promise<void> {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    
    const currentSection = { ...(config.get<Record<string, any>>(category) || {}) };
    currentSection[key] = value;

    const inspection = config.inspect(category);
    let target = vscode.ConfigurationTarget.Global;
    
    if (inspection?.workspaceValue !== undefined) {
        target = vscode.ConfigurationTarget.Workspace;
    }

    await config.update(category, currentSection, target);
  }
}