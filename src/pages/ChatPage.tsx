import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2, Terminal, Paperclip, Archive, Search, ChevronDown, Check, Shield, ShieldOff } from "lucide-react";
import { cn, maskIPs } from "../lib/utils";
import { useCodorRuntime, CodorMessage } from "../hooks/useCodorRuntime";
import { saveMessage, updateChatTitle } from "../db";
import { useI18n } from "../i18n";

interface ChatProps { chatId: string; }
interface Model {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

export default function ChatPage({ chatId }: ChatProps) {
  const { t } = useI18n();
  const { messages, setMessages, isRunning, pendingApproval, loadHistory, runAgentLoop, approveToolCall, rejectToolCall, stopExecution } = useCodorRuntime(chatId);
  const [input, setInput] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("deepseek/deepseek-v4-flash");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  // Default to manual approval: every command requires explicit user sign-off
  // before it runs. Users can opt into autopilot per session.
  const [autopilot, setAutopilot] = useState(false);
  // Mask IP addresses in displayed messages (on by default). Display-only.
  const [privacy, setPrivacy] = useState(true);
  const mask = (text: string) => (privacy ? maskIPs(text) : text);

  // Model search state
  const [modelSearch, setModelSearch] = useState("");
  const [modelOpen, setModelOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (chatId) loadHistory(chatId); }, [chatId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    fetch("https://openrouter.ai/api/v1/models")
      .then((r) => r.json())
      .then((d) => {
        const popular = ["deepseek/deepseek-v4-flash", "openai/gpt-4o", "anthropic/claude-3.5-sonnet"];
        // Filter only models that support tools/functions
        const toolModels = d.data.filter((m: any) => m.supported_parameters?.includes("tools"));
        const sorted = toolModels.map((m: any) => ({
          id: m.id,
          name: m.name,
          context_length: m.context_length,
          pricing: m.pricing
        })).sort((a: Model, b: Model) => {
          const indexA = popular.indexOf(a.id);
          const indexB = popular.indexOf(b.id);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return 0;
        });
        if (sorted.length > 0) setModels(sorted);
      })
      .catch(() => {
      });
  }, []);

  // Calculate active context token usage & limit
  const currentModelObj = models.find((m) => m.id === selectedModel);
  const maxLimit = currentModelObj?.context_length || 128000;
  const contextTokens = messages.reduce((acc, m) => acc + Math.round((m.content.length + (m.reasoning?.length || 0)) / 4), 0);
  const isLimitReached = contextTokens >= maxLimit;

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isLimitReached) return;
    if (!input.trim() && attachedFiles.length === 0) return;

    let content = input;
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map((f) => f.name).join(", ");
      content += `\n[Attached files: ${fileNames}]`;
    }

    const userMsg: CodorMessage = { id: Date.now().toString(), role: "user", content };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setAttachedFiles([]);
    await saveMessage(chatId, userMsg);
    if (messages.length <= 1) await updateChatTitle(chatId, content.slice(0, 30) + "...");

    runAgentLoop(updated, selectedModel, autopilot);
  }

  async function handleCompact() {
    if (!window.confirm(t("compactConfirm"))) return;
    const summary: CodorMessage = {
      id: Date.now().toString(),
      role: "system",
      content: "📦 History compacted to save context window.",
    };
    const updated = [summary, ...messages.slice(-4)];
    setMessages(updated);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setAttachedFiles(Array.from(e.target.files));
  }

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden" onClick={() => modelOpen && setModelOpen(false)}>
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
        </div>
        <div className="flex items-center gap-4">
          {/* Circular progress bar */}
          <div className="flex items-center gap-2 border border-border/40 bg-secondary/30 px-2 py-1 rounded-md" title={`Context usage: ${contextTokens.toLocaleString()} / ${maxLimit.toLocaleString()} tokens`}>
            <svg className="w-4 h-4 -rotate-90">
              <circle cx="8" cy="8" r="6" className="stroke-muted/40 fill-none" strokeWidth="2" />
              <circle
                cx="8"
                cy="8"
                r="6"
                className={cn(
                  "fill-none transition-all duration-300",
                  contextTokens >= maxLimit ? "stroke-destructive" : (contextTokens / maxLimit) > 0.8 ? "stroke-amber-500" : "stroke-primary"
                )}
                strokeWidth="2"
                strokeDasharray={2 * Math.PI * 6}
                strokeDashoffset={2 * Math.PI * 6 - (Math.min((contextTokens / maxLimit) * 100, 100) / 100) * (2 * Math.PI * 6)}
              />
            </svg>
            <span className="text-[10px] font-mono text-muted-foreground font-semibold">
              {Math.min(Math.round((contextTokens / maxLimit) * 100), 100)}% ({Math.round(contextTokens).toLocaleString()} / {Math.round(maxLimit / 1000)}k)
            </span>
          </div>

          <button
            onClick={() => setPrivacy((p) => !p)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors cursor-pointer",
              privacy ? "text-primary hover:bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            title={privacy ? t("privacyOn") : t("privacyOff")}
          >
            {privacy ? <Shield size={13} /> : <ShieldOff size={13} />}
            {privacy ? t("privacyOn") : t("privacyOff")}
          </button>

          {messages.length > 6 && (
            <button onClick={handleCompact} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent transition-colors cursor-pointer" title={t("compactHistory")}>
              <Archive size={13} /> {t("compactHistory")}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 space-y-6">
        {messages.map((msg) => {
          const isToolCall = msg.toolCalls && msg.toolCalls.length > 0;
          const isToolResult = msg.role === "tool" || (msg.role === "system" && msg.content.includes("Tool Output:"));

          if (isToolCall) {
            const cmdText = (() => {
              try {
                return JSON.parse(msg.toolCalls![0].arguments).command;
              } catch {
                return msg.toolCalls![0].arguments;
              }
            })();

            return (
              <div key={msg.id} className="max-w-2xl me-auto w-full select-none animate-in fade-in duration-200">
                {/* Optional Assistant bubble text if there is any text content */}
                {(msg.content || msg.reasoning) && (
                  <div className="flex gap-3 mb-3 me-auto">
                    <div className="shrink-0 w-7 h-7 rounded-full border border-border bg-card flex items-center justify-center mt-0.5 overflow-hidden">
                      <img src="/logo.svg" className="w-5 h-5 object-contain" alt="Codor Avatar" />
                    </div>
                    <div className="bg-card border border-border rounded-md px-4 py-3 text-sm leading-relaxed max-w-[80%]">
                      {msg.reasoning && (
                        <div className="mb-3 text-[11px] text-muted-foreground/75 font-serif italic border-l-2 border-primary/25 pl-3 py-0.5 max-w-[90%] leading-relaxed select-none">
                          <span className="text-[9px] uppercase font-bold font-sans tracking-wide text-primary/70 not-italic block mb-0.5">Thinking Process</span>
                          {mask(msg.reasoning || "")}
                        </div>
                      )}
                      {msg.content && <MessageContent content={mask(msg.content)} />}
                    </div>
                  </div>
                )}
                {/* Standalone Tool Call Box */}
                <div className="border border-border bg-card rounded-md overflow-hidden shadow-sm">
                  {/* Status header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="flex items-center gap-1.5 text-primary">
                      <Terminal size={11} className="shrink-0" />
                      <span>{t("toolCall") || "Command Execution"}</span>
                    </div>
                    <span className="font-mono text-zinc-500">{msg.toolCalls![0].name}</span>
                  </div>
                  {/* Code block */}
                  <div className="p-3.5 bg-[#1a1b26] text-zinc-100 font-mono text-[11px] whitespace-pre-wrap overflow-x-auto leading-relaxed">
                    <span className="text-zinc-500/80 select-none mr-2">$</span>
                    {mask(cmdText)}
                  </div>

                  {pendingApproval?.toolCall.id === msg.toolCalls![0].id && !isRunning && (
                    <div className="px-3 py-2 border-t border-border bg-muted/20 flex items-center gap-2">
                      <button onClick={() => approveToolCall()} className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-[11px] font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-sm">
                        {t("approveCall")}
                      </button>
                      <button onClick={() => rejectToolCall()} className="bg-muted hover:bg-accent hover:text-foreground text-muted-foreground px-3 py-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer border border-border">
                        {t("rejectCall")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (isToolResult) {
            const rawOutput = msg.content.replace("**Tool Output:**\n```\n", "").replace("\n```", "").replace("Tool Output:\n", "");
            return (
              <div key={msg.id} className="max-w-2xl me-auto w-full select-none animate-in fade-in duration-200">
                <ToolResultAccordion title="Terminal Output" output={mask(rawOutput)} />
              </div>
            );
          }

          // Default Chat Bubbles (User / standard System messages)
          return (
            <div key={msg.id} className={cn("flex gap-3 max-w-3xl", msg.role === "user" ? "ms-auto flex-row-reverse" : "me-auto")}>
              <div className={cn("shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 overflow-hidden",
                msg.role === "user" ? "bg-primary text-primary-foreground text-xs font-bold" : "bg-card border border-border"
              )}>
                {msg.role === "user" ? "U" : <img src="/logo.svg" className="w-5 h-5 object-contain" alt="Codor Avatar" />}
              </div>
              <div className={cn("rounded-md px-4 py-3 text-sm leading-relaxed max-w-[80%]",
                msg.role === "user" ? "bg-primary text-primary-foreground" :
                  msg.role === "system" ? "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono text-xs" :
                    "bg-card border border-border"
              )}>
                {msg.reasoning && (
                  <div className="mb-3 text-[11px] text-muted-foreground/75 font-serif italic border-l-2 border-primary/25 pl-3 py-0.5 max-w-[90%] leading-relaxed select-none">
                    <span className="text-[9px] uppercase font-bold font-sans tracking-wide text-primary/70 not-italic block mb-0.5">Thinking Process</span>
                    {mask(msg.reasoning || "")}
                  </div>
                )}
                {msg.content && <MessageContent content={mask(msg.content)} />}
              </div>
            </div>
          );
        })}
        {isRunning && (
          <div className="flex gap-3 max-w-3xl me-auto">
            <div className="shrink-0 w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center mt-0.5 overflow-hidden">
              <img src="/logo.svg" className="w-5 h-5 object-contain" alt="Codor Avatar" />
            </div>
            <div className="bg-card border border-border rounded-md px-4 py-3 flex items-center gap-2 text-muted-foreground text-sm"><Loader2 size={14} className="animate-spin text-primary" />{t("thinking")}</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pb-6 pt-2">
        <div className="max-w-4xl mx-auto">
          {/* Attached files */}
          {attachedFiles.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {attachedFiles.map((f, i) => (
                <span key={i} className="text-xs bg-secondary px-2 py-1 rounded-md flex items-center gap-1">
                  <Paperclip size={10} /> {f.name}
                  <button onClick={() => setAttachedFiles(attachedFiles.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive ms-1">&times;</button>
                </span>
              ))}
            </div>
          )}
          {isLimitReached && (
            <div className="mb-2 bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-medium px-3 py-2 rounded-md flex items-center justify-between animate-in fade-in duration-200">
              <span>{t("contextFullWarning")}</span>
              <button onClick={handleCompact} className="underline hover:text-destructive/80 font-bold ml-auto cursor-pointer">
                {t("compactHistory")}
              </button>
            </div>
          )}

          <div className="flex items-end gap-3.5 bg-card border border-border rounded-md px-4 py-3 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            {/* File attach */}
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isRunning || isLimitReached} className="shrink-0 w-9.5 h-9.5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:hover:bg-transparent" title={t("attachFile")}>
              <Paperclip size={16} />
            </button>

            <textarea className="flex-1 bg-transparent resize-none text-sm focus:outline-none min-h-[48px] max-h-40 leading-relaxed py-2.5" placeholder={isLimitReached ? t("contextFullWarning") : t("sendPlaceholder")} value={input} rows={1}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              onKeyDown={handleKeyDown} disabled={isRunning || isLimitReached}
            />

            {isRunning ? (
              <button onClick={stopExecution} className="shrink-0 w-9.5 h-9.5 rounded-md bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90 transition-all cursor-pointer border border-destructive/20" title="Stop Agent">
                <div className="w-2.5 h-2.5 bg-current rounded-sm" />
              </button>
            ) : (
              <button onClick={() => handleSend()} disabled={!input.trim() || isLimitReached} className="shrink-0 w-9.5 h-9.5 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer">
                <Send size={15} />
              </button>
            )}
          </div>

          {/* Autopilot & Help hint bottom bar */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground/50 mt-2 select-none px-1">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground/75 tracking-wider uppercase">{t("autopilot")}</span>
                <button
                  onClick={() => setAutopilot(!autopilot)}
                  className={cn(
                    "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-border/40 transition-colors duration-200 ease-in-out focus:outline-none",
                    autopilot ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none absolute top-[1px] h-3 w-3 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out",
                      autopilot ? "left-[13px]" : "left-[1px]"
                    )}
                  />
                </button>
              </div>

              {/* Separator line */}
              <div className="w-[1px] h-3 bg-border/40" />

              {/* Modern Searchable Combobox */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setModelOpen(!modelOpen)}
                  className="flex items-center gap-1.5 text-[11px] font-medium hover:text-foreground text-muted-foreground select-none cursor-pointer transition-colors"
                >
                  <span className="truncate max-w-[120px] text-start">{selectedModel.split("/").pop()}</span>
                  <ChevronDown size={11} className="shrink-0 text-muted-foreground/60" />
                </button>

                {modelOpen && (
                  <div className="absolute bottom-full mb-1.5 start-0 bg-card border border-border rounded-md shadow-lg py-1.5 z-50 w-[240px] flex flex-col animate-in fade-in slide-in-from-bottom-1 duration-150">
                    {/* Search input */}
                    <div className="px-2.5 pb-2 pt-0.5 border-b border-border flex items-center gap-1.5">
                      <Search size={12} className="text-muted-foreground/60 shrink-0" />
                      <input
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Search models..."
                        className="w-full bg-transparent border-0 text-[11px] focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground/50"
                        autoFocus
                      />
                    </div>
                    {/* Options list */}
                    <div className="max-h-48 overflow-y-auto py-1 divide-y divide-border/20">
                      {models
                        .filter((m) => m.id.toLowerCase().includes(modelSearch.toLowerCase()))
                        .map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelectedModel(m.id);
                              setModelOpen(false);
                              setModelSearch("");
                            }}
                            className={cn(
                              "w-full flex flex-col items-start px-3 py-2 text-start hover:bg-accent transition-colors cursor-pointer text-muted-foreground hover:text-foreground",
                              selectedModel === m.id && "bg-primary/5 text-primary hover:text-primary"
                            )}
                          >
                            <div className="flex items-center justify-between w-full mb-0.5">
                              <span className="font-semibold text-[11px] truncate flex-1 text-foreground">
                                {m.id.split("/").pop()}
                              </span>
                              {selectedModel === m.id && <Check size={12} className="shrink-0 text-primary" />}
                            </div>

                            {/* Details & Pricing row */}
                            <div className="flex items-center justify-between w-full text-[9px] text-muted-foreground/60 select-none">
                              <span>Ctx: {m.context_length ? `${Math.round(m.context_length / 1000)}k` : "N/A"}</span>
                              {m.pricing && (
                                <span>
                                  In: ${(parseFloat(m.pricing.prompt) * 1_000_000).toFixed(2)} | Out: ${(parseFloat(m.pricing.completion) * 1_000_000).toFixed(2)} /1M
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      {models.filter((m) => m.id.toLowerCase().includes(modelSearch.toLowerCase())).length === 0 && (
                        <div className="text-[10px] text-muted-foreground/50 text-center py-4">No models found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <span>{t("sendHint")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Beautiful Collapsible Accordion for Terminal Output
function ToolResultAccordion({ title, output }: { title: string; output: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-border bg-card rounded-md overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/60 transition-colors select-none"
      >
        <div className="flex items-center gap-1.5 text-zinc-500">
          <Terminal size={11} className="shrink-0" />
          <span>{title}</span>
        </div>
        <ChevronDown size={11} className={cn("shrink-0 text-muted-foreground/60 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="p-3.5 bg-[#14151a] text-[#10b981] font-mono text-[11px] whitespace-pre-wrap overflow-x-auto leading-relaxed border-t border-border/30 animate-in slide-in-from-bottom-0.5 duration-150">
          {output}
        </div>
      )}
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  if (!content) return null;
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith("```")) {
      if (!inCode) { inCode = true; codeLines = []; }
      else {
        elements.push(<pre key={i} className="bg-black/40 rounded-md p-3 overflow-x-auto my-2"><code className="text-green-300 text-xs font-mono">{codeLines.join("\n")}</code></pre>);
        inCode = false;
      }
    } else if (inCode) { codeLines.push(line); }
    else if (line.startsWith("# ")) { elements.push(<h3 key={i} className="font-bold text-base mt-2">{line.slice(2)}</h3>); }
    else if (line.startsWith("• ") || line.startsWith("- ")) { elements.push(<li key={i} className="ms-4 list-disc">{line.slice(2)}</li>); }
    else if (line === "") { elements.push(<div key={i} className="h-2" />); }
    else {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      elements.push(<p key={i}>{parts.map((p, j) => p.startsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p)}</p>);
    }
  });
  return <div className="space-y-1">{elements}</div>;
}
