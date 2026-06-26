import * as vscode from "vscode";
import { SYSTEM_CONSTANTS } from "@/shared/constants";
import type { BehaviorSettings, EngineSettings } from "@/shared/models";

export class ConfigurationService {
  public getBehaviorSettings(): BehaviorSettings {
    const config = vscode.workspace.getConfiguration(
      SYSTEM_CONSTANTS.CONFIG_SECTION,
    );

    // Handle backwards compatibility migration fallback
    const oldAutoScroll = config.inspect<boolean>("autoScroll");
    const defaultAutoScroll =
      oldAutoScroll?.globalValue ?? oldAutoScroll?.workspaceValue ?? true;

    const behavior = config.get<BehaviorSettings>("behavior");

    return {
      autoScroll: behavior?.autoScroll ?? defaultAutoScroll,
      compactMode: behavior?.compactMode ?? false,
    };
  }

  public getEngineSettings(): EngineSettings {
    const config = vscode.workspace.getConfiguration(
      SYSTEM_CONSTANTS.CONFIG_SECTION,
    );

    // Handle backwards compatibility migration fallback
    const oldStrict = config.inspect<boolean>("strictParsing");
    const defaultStrict =
      oldStrict?.globalValue ?? oldStrict?.workspaceValue ?? false;

    const engine = config.get<EngineSettings>("engine");

    return {
      strictParsing: engine?.strictParsing ?? defaultStrict,
      maxBackupRetentionDays: engine?.maxBackupRetentionDays ?? 7,
    };
  }

  public async updateSetting(
    category: "behavior" | "engine",
    key: string,
    value: any,
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(
      SYSTEM_CONSTANTS.CONFIG_SECTION,
    );
    const currentSection = config.get<Record<string, any>>(category) || {};
    currentSection[key] = value;

    await config.update(
      category,
      currentSection,
      vscode.ConfigurationTarget.Global,
    );
  }
}
