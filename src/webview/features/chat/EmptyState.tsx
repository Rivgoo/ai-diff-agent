import { useAgentStore } from "@/webview/store/agentStore";
import { useIPC } from "@/webview/hooks/useIPC";
import { Button } from "@/webview/shared/ui/Button/Button";
import {
  IconCopy,
  IconDownload,
  IconTerminal,
  IconSettings,
} from "@tabler/icons-react";
import styles from "./EmptyState.module.css";

export const EmptyState = () => {
  const { sendEvent } = useIPC();
  const copied = useAgentStore((state) => state.isPromptCopied);
  const toggleSettings = useAgentStore((state) => state.toggleSettings);

  return (
    <div className={styles.container}>
      {/* Semantic Header */}
      <h1 className={styles.title}>AI DIFF AGENT</h1>
      <p className={styles.description}>
        A transactional diff engine designed to stage, review, and apply code
        modifications with human-in-the-loop control.
      </p>

      {/* Action Grid Panel */}
      <div
        className={styles.actionsGrid}
        role="group"
        aria-label="Quick actions menu"
      >
        <Button
          variant="secondary"
          onClick={() => sendEvent({ type: "COPY_PROMPT" })}
          aria-label="Copy prompt rules to clipboard"
        >
          <IconCopy size={14} aria-hidden="true" />
          <span>{copied ? "Copied" : "Copy Rules"}</span>
        </Button>

        <Button
          variant="secondary"
          onClick={() => sendEvent({ type: "DOWNLOAD_INSTRUCTIONS" })}
          aria-label="Download prompt instructions document"
        >
          <IconDownload size={14} aria-hidden="true" />
          <span>Instructions</span>
        </Button>

        <Button
          variant="secondary"
          onClick={() => sendEvent({ type: "SHOW_OUTPUT_LOG" })}
          aria-label="Open extension output log panel"
        >
          <IconTerminal size={14} aria-hidden="true" />
          <span>Open Logs</span>
        </Button>

        <Button
          variant="secondary"
          onClick={toggleSettings}
          aria-label="Open agent configuration settings"
        >
          <IconSettings size={14} aria-hidden="true" />
          <span>Settings</span>
        </Button>
      </div>
    </div>
  );
};
