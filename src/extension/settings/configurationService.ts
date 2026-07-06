import * as vscode from "vscode";
import { SYSTEM_CONSTANTS } from "@/shared/constants";
import type { UiSettings, WorkflowSettings, EngineSettings } from "@/shared/models";

export class ConfigurationService {
  public getUiSettings(): UiSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const ui = config.get<Partial<UiSettings>>("ui") || {};
    const legacyBehavior = config.get<Record<string, any>>("behavior") || {};
    
    return {
      autoScroll: ui.autoScroll ?? legacyBehavior.autoScroll ?? true,
      compactMode: ui.compactMode ?? legacyBehavior.compactMode ?? false,
      showConfidenceBadges: ui.showConfidenceBadges ?? legacyBehavior.showConfidenceBadges ?? true,
      enableCodeLens: ui.enableCodeLens ?? legacyBehavior.enableCodeLens ?? true, 
    };
  }

  public getWorkflowSettings(): WorkflowSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const workflow = config.get<Partial<WorkflowSettings>>("workflow") || {};
    const legacyBehavior = config.get<Record<string, any>>("behavior") || {};
    const legacyEngine = config.get<Record<string, any>>("engine") || {};

    let chatHistoryMode: 'workspace' | 'global' | 'disabled' = workflow.chatHistoryMode ?? 'workspace';
    if (legacyBehavior.storeChatInWorkspace !== undefined && workflow.chatHistoryMode === undefined) {
        chatHistoryMode = legacyBehavior.storeChatInWorkspace ? 'workspace' : 'global';
    }

    return {
      chatHistoryMode,
      autoSaveAfterAccept: workflow.autoSaveAfterAccept ?? true,
      formatBehavior: workflow.formatBehavior ?? 'onSaveOnly',
      cleanupEmptyDirectories: workflow.cleanupEmptyDirectories ?? true,
      backupRetentionDays: workflow.backupRetentionDays ?? legacyEngine.maxBackupRetentionDays ?? 7,
    };
  }

  public getEngineSettings(): EngineSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const engine = config.get<Partial<EngineSettings>>("engine") || {};
    
    return {
      payloadRecoveryMode: engine.payloadRecoveryMode ?? 'aggressive',
      fallbackMatchLevel: engine.fallbackMatchLevel ?? 'aggressive',
      enableAstMatching: engine.enableAstMatching ?? true,
      strictSyntaxValidation: engine.strictSyntaxValidation ?? engine.blockOnSyntaxErrors ?? false,
      autoFixSyntax: engine.autoFixSyntax ?? true,
      maxFileSizeMb: engine.maxFileSizeMb ?? 5,
      
      // Legacy fallbacks for Phase 1 (will be refactored in Phase 5)
      strictParsing: engine.strictParsing ?? false,
      allowCdataUnwrap: engine.allowCdataUnwrap ?? true,
      allowFuzzyMatching: engine.allowFuzzyMatching ?? true,
      allowSlidingWindow: engine.allowSlidingWindow ?? true,
      blockOnSyntaxErrors: engine.blockOnSyntaxErrors ?? false,
      respectGitIgnore: engine.respectGitIgnore ?? true,
    };
  }

  public async updateSetting(category: "ui" | "workflow" | "engine", key: string, value: any): Promise<void> {
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