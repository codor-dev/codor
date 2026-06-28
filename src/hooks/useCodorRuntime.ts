import { invoke } from "@tauri-apps/api/core";
import OpenAI from "openai";
import { useCallback, useRef, useState } from "react";
import { addBackupRecord, getMessages, getSetting, getSkills, getVaultCredentials, saveMessage } from "../db";
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

export function useCodorRuntime(chatId: string | null) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<CodorMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
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
    setIsRunning(false);
  }, []);

  const runAgentLoop = useCallback(
    async (currentMessages: CodorMessage[], selectedModel: string) => {
      if (!chatIdRef.current) return;
      setIsRunning(true);

      const apiKey = await getSetting("openrouter_key");
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
Secure vault credentials available (you NEVER see the actual secrets — use IDs in tool calls):
${vaultCtx || "No credentials configured yet."}

${activeSkills.length > 0 ? `Active DevOps Specializations & Guidelines:\n${skillsCtx}\n` : ""}

CRITICAL SAFETY & BACKUP DIRECTIVES:
1. MANDATORY BACKUPS: Before modifying, overwriting, or deleting critical files/configs or performing database updates, YOU MUST create a backup copy first using the create_backup tool.
2. RESIST DANGEROUS COMMANDS: If a command is destructive or hazardous (e.g., recursive deletion \`rm -rf\`, disk formatting \`mkfs\`, dropping databases, shutting down production services), RESIST executing it immediately. Explain the risks clearly and require explicit user confirmation before proceeding.

When the user requests server operations, call execute_command with the matching credential ID and a precise bash command. Analyze output before summarizing.`;

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
                description: "Execute a bash command on a configured remote server or local environment.",
                parameters: {
                  type: "object",
                  properties: {
                    credential_id: { type: "string", description: "ID of the vault credential to use" },
                    command: { type: "string", description: "Exact bash command to run" },
                  },
                  required: ["credential_id", "command"],
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

        // If it was a tool call, run it
        if (toolCallId) {
          const finalToolCallMsg: CodorMessage = {
            id: Date.now().toString(),
            role: "assistant",
            content: contentText,
            reasoning: reasoningText,
            toolCalls: [{ id: toolCallId, name: toolCallName, arguments: toolCallArgs }],
          };

          // Save the assistant message with tool calls
          await saveMessage(chatIdRef.current!, finalToolCallMsg);

          // Update message list to use static database ID
          setMessages((p) => p.map(m => m.id === tempMsgId ? finalToolCallMsg : m));

          let result = "";
          try {
            const args = JSON.parse(toolCallArgs);
            if (toolCallName === "create_backup") {
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
              const allCreds = await getVaultCredentials();
              const matched = allCreds.find((c) => c.id === args.credential_id);
              const secretValue = matched ? matched.secret_value : "";

              result = await invoke<string>("execute_ai_command", {
                command: args.command,
                serverId: args.credential_id,
                secretValue,
              });
            }
          } catch (e: any) {
            result = `Error: ${e}`;
          }

          const toolResultMsg: CodorMessage = {
            id: (Date.now() + 1).toString(),
            role: "tool",
            toolCallId,
            content: result,
          };

          const nextHistory = [...currentMessages, finalToolCallMsg, toolResultMsg];
          setMessages(nextHistory);
          await saveMessage(chatIdRef.current!, toolResultMsg);

          // Continue loop
          await runAgentLoop(nextHistory, selectedModel);
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
    []
  );

  return { messages, setMessages, isRunning, loadHistory, runAgentLoop, stopExecution };
}
