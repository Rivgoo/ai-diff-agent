import * as vscode from "vscode";
import { SYSTEM_CONSTANTS } from "@/shared/constants";
import type { UiSettings, WorkflowSettings, EngineSettings, AstSettings } from "@/shared/models";

export class ConfigurationService {
  public getUiSettings(): UiSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const ui = config.get<Partial<UiSettings>>("ui") || {};
    
    return {
      autoScroll: ui.autoScroll ?? true,
      compactMode: ui.compactMode ?? false,
      showConfidenceBadges: ui.showConfidenceBadges ?? true,
      enableCodeLens: ui.enableCodeLens ?? true, 
    };
  }

  public getWorkflowSettings(): WorkflowSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const workflow = config.get<Partial<WorkflowSettings>>("workflow") || {};

    return {
      chatHistoryMode: workflow.chatHistoryMode ?? 'workspace',
      autoSaveAfterAccept: workflow.autoSaveAfterAccept ?? true,
      formatBehavior: workflow.formatBehavior ?? 'onSaveOnly',
      cleanupEmptyDirectories: workflow.cleanupEmptyDirectories ?? true,
      backupRetentionDays: workflow.backupRetentionDays ?? 7,
    };
  }

  public getEngineSettings(): EngineSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const engine = config.get<Partial<EngineSettings>>("engine") || {};
    
    return {
      payloadRecoveryMode: engine.payloadRecoveryMode ?? 'aggressive',
      fallbackMatchLevel: engine.fallbackMatchLevel ?? 'aggressive',
      maxFileSizeMb: engine.maxFileSizeMb ?? 5,
      
      strictParsing: engine.strictParsing ?? false,
      allowCdataUnwrap: engine.allowCdataUnwrap ?? true,
      allowFuzzyMatching: engine.allowFuzzyMatching ?? true,
      allowSlidingWindow: engine.allowSlidingWindow ?? true,
      blockOnSyntaxErrors: engine.blockOnSyntaxErrors ?? false,
      respectGitIgnore: engine.respectGitIgnore ?? true,
      enableAstMatching: engine.enableAstMatching ?? true,
      strictSyntaxValidation: engine.strictSyntaxValidation ?? false,
      autoFixSyntax: engine.autoFixSyntax ?? true,
    };
  }

  public getAstSettings(): AstSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const ast = config.get<Partial<AstSettings>>("ast") || {};

    return {
      enabledLanguages: ast.enabledLanguages ?? ['javascript', 'typescript', 'python', 'c_sharp', 'json', 'html', 'css', 'bash', 'c'],
      sanityStrictness: ast.sanityStrictness ?? 'warn',
      validateEmbeddedScripts: ast.validateEmbeddedScripts ?? true,
      queryTolerance: ast.queryTolerance ?? 'allow_signature_drift',
    };
  }

  public async updateSetting(category: "ui" | "workflow" | "engine" | "ast", key: string, value: any): Promise<void> {
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