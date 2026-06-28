import { useState, useEffect } from "react";
import Sidebar, { View } from "./components/Sidebar";
import ChatPage from "./pages/ChatPage";
import AgentConfig from "./pages/AgentConfig";
import Vault from "./pages/Vault";
import CommandFilters from "./pages/CommandFilters";
import DevOpsSkills from "./pages/DevOpsSkills";
import BackupManager from "./pages/BackupManager";
import About from "./pages/About";
import IntroModal from "./components/IntroModal";
import { I18nProvider, useI18n } from "./i18n";
import { getSetting, setSetting, checkDbHealth } from "./db";

function AppContent() {
  const { t } = useI18n();
  const [view, setView] = useState<View>("chat");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("codor_theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("codor_theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    checkDbHealth().then((res) => {
      if (!res.ok) {
        setDbError(res.error || "Secure database connection failed.");
      } else {
        getSetting("has_completed_onboarding")
          .then((val) => {
            if (val !== "true") setShowIntro(true);
          })
          .catch((e) => setDbError(e.toString()));
      }
    });
  }, []);

  async function handleIntroComplete() {
    await setSetting("has_completed_onboarding", "true");
    setShowIntro(false);
  }

  if (dbError) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-background text-foreground p-6 select-none animate-in fade-in duration-300">
        <div className="max-w-md w-full flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center mb-6 text-primary">
            🛡️
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground mb-3">
            {t("dbErrorTitle")}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6 font-medium px-4">
            {t("dbErrorDesc")}
          </p>
          {dbError && (
            <div className="w-full bg-muted border border-border rounded-md p-3 text-start font-mono text-[10px] text-destructive overflow-x-auto mb-6 max-h-32">
              {dbError}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto bg-primary text-primary-foreground px-5 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer border border-primary/20"
          >
            {t("retryConnection")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground relative border-t border-border/80">
      <IntroModal show={showIntro} onComplete={handleIntroComplete} />
      <Sidebar
        view={view}
        onViewChange={setView}
        activeChatId={activeChatId}
        onSelectChat={(id) => { setActiveChatId(id); setView("chat"); }}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
      />
      <main className="flex-1 overflow-hidden">
        {view === "chat" && activeChatId && <ChatPage chatId={activeChatId} />}
        {view === "config" && <AgentConfig />}
        {view === "vault" && <Vault />}
        {view === "skills" && <DevOpsSkills />}
        {view === "backups" && <BackupManager />}
        {view === "filters" && <CommandFilters />}
        {view === "about" && <About />}
        {view === "chat" && !activeChatId && (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            {t("createChatToStart")}
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

export default App;
