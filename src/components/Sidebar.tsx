import { useState, useEffect } from "react";
import { Plus, MessageSquare, Trash2, Settings, ShieldCheck, Sun, Moon, Globe, RefreshCw, BookOpen, Archive, ShieldAlert } from "lucide-react";
import { cn } from "../lib/utils";
import { getChats, createChat, deleteChat, ChatSession } from "../db";
import { useI18n, LOCALE_LABELS, Locale } from "../i18n";

export type View = "chat" | "config" | "vault" | "skills" | "backups" | "filters" | "about";

interface SidebarProps {
  view: View;
  onViewChange: (v: View) => void;
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export default function Sidebar({
  view,
  onViewChange,
  activeChatId,
  onSelectChat,
  isDark,
  onToggleTheme,
}: SidebarProps) {
  const { t, locale, setLocale } = useI18n();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [langOpen, setLangOpen] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => { loadChats(); }, [activeChatId]);

  async function loadChats() {
    try {
      const list = await getChats();
      setChats(list);
      if (!activeChatId && list.length > 0) onSelectChat(list[0].id);
      else if (list.length === 0) newChat();
    } catch { }
  }

  async function newChat() {
    onViewChange("chat");
    const s = await createChat(t("newChat"));
    setChats((p) => [s, ...p]);
    onSelectChat(s.id);
  }

  async function removeChat(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await deleteChat(id);
    const updated = chats.filter((c) => c.id !== id);
    setChats(updated);
    if (activeChatId === id) {
      if (updated.length > 0) onSelectChat(updated[0].id);
      else newChat();
    }
  }

  function handleCheckUpdate() {
    setCheckingUpdate(true);
    setTimeout(() => {
      setCheckingUpdate(false);
      window.open("https://codor.dev", "_blank");
    }, 800);
  }

  return (
    <div className="flex flex-col h-full w-64 shrink-0 bg-card border-e border-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <img src="/logo.svg" className="w-7 h-7 shrink-0" alt="Codor" />
        <span className="font-bold text-base">{t("appName")}</span>
      </div>

      {/* New Chat */}
      <div className="px-3 pt-3">
        <button
          onClick={newChat}
          className="w-full flex items-center gap-2 text-sm px-3 py-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium cursor-pointer"
        >
          <Plus size={15} /> {t("newChat")}
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {chats.length > 0 && (
          <p className="text-muted-foreground/60 text-[10px] font-semibold uppercase tracking-wider px-2 mb-2">{t("recent")}</p>
        )}
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => { onSelectChat(chat.id); onViewChange("chat"); }}
            className={cn(
              "group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors",
              view === "chat" && activeChatId === chat.id
                ? "bg-primary/15 text-foreground font-medium"
                : "text-muted-foreground hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare size={14} className="shrink-0" />
            <span className="text-sm truncate flex-1">{chat.title}</span>
            <button
              onClick={(e) => removeChat(e, chat.id)}
              className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-1 rounded cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Bottom Nav */}
      <div className="border-t border-border p-2 space-y-0.5">
        {[
          { id: "skills" as View, icon: BookOpen, label: t("shortSkills") },
          { id: "vault" as View, icon: ShieldCheck, label: t("shortVault") },
          { id: "backups" as View, icon: Archive, label: t("shortBackups") },
          { id: "filters" as View, icon: ShieldAlert, label: t("shortFilters") },
          { id: "config" as View, icon: Settings, label: t("shortApi") },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
              view === id
                ? "bg-primary/15 text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon size={15} />
            <span className="truncate">{label}</span>
          </button>
        ))}

        {/* Theme Toggle & Language */}
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-1 cursor-pointer"
          >
            {isDark ? <Sun size={13} /> : <Moon size={13} />}
            {isDark ? t("lightMode") : t("darkMode")}
          </button>

          {/* Language */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <Globe size={13} />
              {LOCALE_LABELS[locale].slice(0, 2)}
            </button>
            {langOpen && (
              <div className="absolute bottom-full mb-1 end-0 bg-card border border-border rounded-md py-1 z-50 min-w-[120px] shadow-sm">
                {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLocale(l); setLangOpen(false); }}
                    className={cn(
                      "w-full text-start px-3 py-1.5 text-xs hover:bg-accent transition-colors cursor-pointer",
                      locale === l && "text-primary font-medium"
                    )}
                  >
                    {LOCALE_LABELS[l]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Version & Update Check */}
        <div className="px-2 pt-1.5 flex items-center justify-between text-[11px] text-muted-foreground/80">
          <button
            onClick={() => onViewChange("about")}
            className="hover:text-primary transition-colors cursor-pointer font-semibold font-mono"
            title="About Codor"
          >
            v1.0.0
          </button>
          <button
            onClick={handleCheckUpdate}
            className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer underline underline-offset-2"
          >
            <RefreshCw size={11} className={cn(checkingUpdate && "animate-spin")} />
            <span>{t("checkUpdates")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
