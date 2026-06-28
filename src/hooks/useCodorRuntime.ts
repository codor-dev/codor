import { invoke } from "@tauri-apps/api/core";
import OpenAI from "openai";
import { useCallback, useRef, useState } from "react";
import { addBackupRecord, getApiKey, getMessages, getSetting, getSkills, getVaultCredentials, saveMessage } from "../db";
import { useI18n } from "../i18n";

export type CodorMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  reasoning?: string;
  toolCalls?: { id: string; name: string; arguments: string }[];
  toolCallId?: string;
  isLoading?: boolean;
};

// Hard cap on consecutive tool-call iterations to prevent a runaway agent loop
// from hanging the UI or burning through API credits.
const MAX_ITERATIONS = 25;

type PendingTool = {
  toolCall: { id: string; name: string; arguments: string };
  baseMessages: CodorMessage[];
  model: string;
};

export function useCodorRuntime(chatId: string | null) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<CodorMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  // When set, execution is paused waiting for the user to approve/reject a tool
  // call. Nothing runs until they act (manual mode).
  const [pendingApproval, setPendingApproval] = useState<PendingTool | null>(null);
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async (id: string) => {
    const history = await getMessages(id);
    if (history.length === 0) {
      const welcome: CodorMessage = {
        id: "welcome",
        role: "assistant",
        content: t("welcomeMessage"),
      };
      setMessages([welcome]);
      await saveMessage(id, welcome);
    } else {
      setMessages(history as CodorMessage[]);
    }
  }, [t]);

  const stopExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setPendingApproval(null);
    setIsRunning(false);
  }, []);

  // Actually dispatch a tool call to the Rust backend, append the result, and
  // continue the agent loop. The secret never crosses into JS — Rust reads it
  // from the keychain using the credential id.
  const executeToolCall = useCallback(
    async (pending: PendingTool, autopilot: boolean, iteration: number) => {
      const { toolCall, baseMessages, model } = pending;
      setIsRunning(true);

      let result = "";
      try {
        const args = JSON.parse(toolCall.arguments || "{}");
        if (toolCall.name === "create_backup") {
          try {
            const filepath = await invoke<string>("execute_backup", {
              originalPath: args.original_path,
              description: args.description,
            });
            await addBackupRecord(filepath, args.original_path, args.description);
            result = `✅ Backup created successfully at: ${filepath}`;
          } catch (e: any) {
            result = `❌ Backup failed: ${e}`;
          }
        } else {
          result = await invoke<string>("execute_ai_command", {
            command: args.command,
          });
        }
      } catch (e: any) {
        result = `Error: ${e}`;
      }

      const toolResultMsg: CodorMessage = {
        id: (Date.now() + 1).toString(),
        role: "tool",
        toolCallId: toolCall.id,
        content: result,
      };

      const nextHistory = [...baseMessages, toolResultMsg];
      setMessages(nextHistory);
      await saveMessage(chatIdRef.current!, toolResultMsg);

      await runAgentLoop(nextHistory, model, autopilot, iteration + 1);
    },
    []
  );

  const runAgentLoop = useCallback(
    async (
      currentMessages: CodorMessage[],
      selectedModel: string,
      autopilot: boolean,
      iteration: number = 0
    ) => {
      if (!chatIdRef.current) return;

      if (iteration >= MAX_ITERATIONS) {
        const capMsg: CodorMessage = {
          id: Date.now().toString(),
          role: "system",
          content: `⚠️ Reached the maximum of ${MAX_ITERATIONS} consecutive tool calls. Stopping to avoid a runaway loop. Send a new message to continue.`,
        };
        setMessages((p) => [...p, capMsg]);
        await saveMessage(chatIdRef.current!, capMsg);
        setIsRunning(false);
        return;
      }

      setIsRunning(true);

      const apiKey = await getApiKey();
      if (!apiKey) {
        const err: CodorMessage = {
          id: Date.now().toString(),
          role: "system",
          content: t("noApiKeyErr"),
        };
        setMessages((p) => [...p, err]);
        await saveMessage(chatIdRef.current!, err);
        setIsRunning(false);
        return;
      }

      const userCtx = (await getSetting("user_custom_context")) || "";
      const creds = await getVaultCredentials();
      const vaultCtx = creds
        .map((c) => `• [ID: ${c.id}] ${c.name}: ${c.llm_description}`)
        .join("\n");

      const allSkills = await getSkills();
      const activeSkills = allSkills.filter((s) => s.is_enabled === 1);
      const skillsCtx = activeSkills
        .map((s) => `=== SPECIALIZATION: ${s.name} ===\n${s.system_prompt}`)
        .join("\n\n");

      const systemPrompt = `You are Codor, an elite AI Infrastructure Agent running inside a secure desktop app.
${userCtx ? `\nUser custom instructions:\n${userCtx}\n` : ""}
Commands you run with execute_command are executed on the USER'S LOCAL MACHINE through the system shell. To act on a remote server you write an SSH command; to use a cloud provider you call its CLI (aws, gcloud, az, kubectl, docker, ...) directly.

Secure vault available — each entry is an arbitrary secret (an SSH password, an AWS key, a GCP service-account token, an API key, a connection string, anything). The description tells you what each secret is and how it is meant to be used. You NEVER see the secret value:
${vaultCtx || "No credentials configured yet."}

USING SECRETS: Insert the placeholder {{secret:ID}} wherever a secret's value belongs in a command. Codor substitutes the real value securely at execution time. Examples:
- SSH with a password: sshpass -p {{secret:ID}} ssh -o StrictHostKeyChecking=accept-new user@host 'df -h'
- SSH with a key (no secret needed): ssh user@host 'df -h'
- AWS: AWS_ACCESS_KEY_ID={{secret:ID1}} AWS_SECRET_ACCESS_KEY={{secret:ID2}} aws s3 ls
- GCP: read the description for whether to set GOOGLE_APPLICATION_CREDENTIALS, run gcloud auth, etc.
Never print a secret's value, and never try to echo or cat it back to the user.

${activeSkills.length > 0 ? `Active DevOps Specializations & Guidelines:\n${skillsCtx}\n` : ""}

CRITICAL SAFETY & BACKUP DIRECTIVES:
1. MANDATORY BACKUPS: Before modifying, overwriting, or deleting critical files/configs or performing database updates, YOU MUST create a backup copy first using the create_backup tool.
2. RESIST DANGEROUS COMMANDS: If a command is destructive or hazardous (e.g., recursive deletion \`rm -rf\`, disk formatting \`mkfs\`, dropping databases, shutting down production services), RESIST executing it immediately. Explain the risks clearly and require explicit user confirmation before proceeding.

Analyze command output before summarizing for the user.`;

      const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        dangerouslyAllowBrowser: true,
      });

      const apiMessages: any[] = [
        { role: "system", content: systemPrompt },
        ...currentMessages
          .filter((m) => m.id !== "welcome")
          .map((m) => {
            if (m.toolCalls?.length) {
              return {
                role: "assistant",
                content: m.content || null,
                tool_calls: m.toolCalls.map((tc) => ({
                  id: tc.id,
                  type: "function",
                  function: { name: tc.name, arguments: tc.arguments },
                })),
              };
            }
            if (m.role === "tool") {
              return {
                role: "tool",
                tool_call_id: m.toolCallId,
                content: m.content,
              };
            }
            return { role: m.role, content: m.content || "" };
          }),
      ];

      try {
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const stream = await openai.chat.completions.create({
          model: selectedModel || "deepseek/deepseek-chat",
          messages: apiMessages,
          tools: [
            {
              type: "function",
              function: {
                name: "execute_command",
                description: "Run a shell command on the user's local machine. To use a vault secret, insert the placeholder {{secret:ID}} wherever the secret value belongs — it is substituted securely at execution time and you never see the value. Remote servers are reached by writing an ssh/sshpass command; cloud CLIs (aws, gcloud, az) are run directly with their credentials injected via placeholders.",
                parameters: {
                  type: "object",
                  properties: {
                    command: { type: "string", description: "Exact shell command to run. Reference vault secrets as {{secret:ID}}." },
                  },
                  required: ["command"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "create_backup",
                description: "Create a local backup archive of a file or directory before modifying it.",
                parameters: {
                  type: "object",
                  properties: {
                    original_path: { type: "string", description: "Absolute path to the file or directory to back up" },
                    description: { type: "string", description: "Short explanation of why this backup is being created" }
                  },
                  required: ["original_path", "description"]
                }
              }
            }
          ],
          stream: true,
        }, { signal: abortController.signal });

        let contentText = "";
        let reasoningText = "";
        let toolCallId = "";
        let toolCallName = "";
        let toolCallArgs = "";

        const tempMsgId = "live-" + Date.now();

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta as any;
          if (!delta) continue;

          // Extract reasoning (DeepSeek reasoning token)
          if (delta.reasoning_content) {
            reasoningText += delta.reasoning_content;
          } else if (delta.reasoning) {
            reasoningText += delta.reasoning;
          }

          if (delta.content) {
            contentText += delta.content;
          }

          if (delta.tool_calls?.[0]) {
            const tc = delta.tool_calls[0];
            if (tc.id) toolCallId = tc.id;
            if (tc.function?.name) toolCallName += tc.function.name;
            if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
          }

          setMessages((p) => {
            const list = [...p];
            const idx = list.findIndex((m) => m.id === tempMsgId);
            const updatedMsg: CodorMessage = {
              id: tempMsgId,
              role: "assistant",
              content: contentText,
              reasoning: reasoningText,
              ...(toolCallId ? { toolCalls: [{ id: toolCallId, name: toolCallName, arguments: toolCallArgs }] } : {}),
            };
            if (idx !== -1) {
              list[idx] = updatedMsg;
            } else {
              list.push(updatedMsg);
            }
            return list;
          });
        }

        // Clean up controller
        abortControllerRef.current = null;

        // If it was a tool call, decide whether to run it.
        if (toolCallId) {
          const toolCall = { id: toolCallId, name: toolCallName, arguments: toolCallArgs };
          const finalToolCallMsg: CodorMessage = {
            id: Date.now().toString(),
            role: "assistant",
            content: contentText,
            reasoning: reasoningText,
            toolCalls: [toolCall],
          };

          // Save the assistant message with tool calls and pin its DB id.
          await saveMessage(chatIdRef.current!, finalToolCallMsg);
          setMessages((p) => p.map((m) => (m.id === tempMsgId ? finalToolCallMsg : m)));

          const baseMessages = [...currentMessages, finalToolCallMsg];
          const pending: PendingTool = { toolCall, baseMessages, model: selectedModel };

          if (autopilot) {
            // Autopilot: run immediately, no human gate.
            await executeToolCall(pending, autopilot, iteration);
          } else {
            // Manual: STOP and wait for the user to approve/reject. Nothing is
            // executed until approveToolCall is called.
            setPendingApproval(pending);
            setIsRunning(false);
          }
        } else {
          // Normal message response complete
          const finalMsg: CodorMessage = {
            id: Date.now().toString(),
            role: "assistant",
            content: contentText,
            reasoning: reasoningText,
          };
          setMessages((p) => p.map(m => m.id === tempMsgId ? finalMsg : m));
          await saveMessage(chatIdRef.current!, finalMsg);
          setIsRunning(false);
        }
      } catch (e: any) {
        if (e.name === "AbortError") {
          console.log("Stream aborted by user.");
          return;
        }
        const errMsg: CodorMessage = {
          id: Date.now().toString(),
          role: "system",
          content: `⚠️ **Error:** ${e.message}`,
        };
        setMessages((p) => [...p, errMsg]);
        await saveMessage(chatIdRef.current!, errMsg);
        setIsRunning(false);
      }
    },
    [t, executeToolCall]
  );

  // Called when the user clicks "Approve Execution" in manual mode.
  const approveToolCall = useCallback(async () => {
    if (!pendingApproval) return;
    const pending = pendingApproval;
    setPendingApproval(null);
    await executeToolCall(pending, false, 0);
  }, [pendingApproval, executeToolCall]);

  // Called when the user clicks "Reject". Feeds a rejection back to the model so
  // it can react, without ever running the command.
  const rejectToolCall = useCallback(async () => {
    if (!pendingApproval) return;
    const pending = pendingApproval;
    setPendingApproval(null);

    const rejectionMsg: CodorMessage = {
      id: (Date.now() + 1).toString(),
      role: "tool",
      toolCallId: pending.toolCall.id,
      content: "❌ Command execution rejected by the user. Do not retry it; ask how to proceed instead.",
    };
    const nextHistory = [...pending.baseMessages, rejectionMsg];
    setMessages(nextHistory);
    await saveMessage(chatIdRef.current!, rejectionMsg);
    await runAgentLoop(nextHistory, pending.model, false, 0);
  }, [pendingApproval, runAgentLoop]);

  return {
    messages,
    setMessages,
    isRunning,
    pendingApproval,
    loadHistory,
    runAgentLoop,
    approveToolCall,
    rejectToolCall,
    stopExecution,
  };
}
