import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { useI18n } from "../i18n";
import { getApiKey, setApiKey as saveApiKey, getSetting, setSetting } from "../db";

export default function AgentConfig() {
  const { t } = useI18n();
  const [apiKey, setApiKey] = useState("");
  const [userCtx, setUserCtx] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const key = await getApiKey();
        const ctx = await getSetting("user_custom_context");
        if (key) setApiKey(key);
        if (ctx) setUserCtx(ctx);
      } catch (e) {
        console.error("Failed to load config:", e);
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);

    try {
      await saveApiKey(apiKey);
      await setSetting("user_custom_context", userCtx);
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-8">
      <div className="w-full max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">{t("configTitle")}</h1>
        <p className="text-muted-foreground text-sm mb-8">{t("configDesc")}</p>

        <div className="flex flex-col gap-6">
          <div className="bg-card border border-border rounded-md p-6">
            <label className="text-sm font-medium mb-1.5 block">{t("apiKey")}</label>
            <p className="text-muted-foreground text-xs mb-3">
              Get your key at <a href="https://openrouter.ai/keys" target="_blank" className="text-primary underline underline-offset-2">openrouter.ai/keys</a>
            </p>
            <input type="password" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="sk-or-v1-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>

          <div className="bg-card border border-border rounded-md p-6">
            <label className="text-sm font-medium mb-1.5 block">{t("customInstructions")}</label>
            <p className="text-muted-foreground text-xs mb-3">{t("customInstructionsDesc")}</p>
            <textarea className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={6} value={userCtx} onChange={(e) => setUserCtx(e.target.value)} />
          </div>

          <button onClick={handleSave} className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-all self-start">
            <Save size={15} />
            {saved ? t("saved") : t("saveConfig")}
          </button>
        </div>
      </div>
    </div>
  );
}
