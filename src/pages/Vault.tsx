import { useState, useEffect } from "react";
import { Trash2, Plus, KeyRound } from "lucide-react";
import { cn } from "../lib/utils";
import { useI18n } from "../i18n";
import { VaultCredential, getVaultCredentials, addVaultCredential, deleteVaultCredential } from "../db";

export default function Vault() {
  const { t } = useI18n();
  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [secret, setSecret] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const stored = await getVaultCredentials();
      if (stored) setCredentials(stored);
    } catch (e) {
      console.error("Failed to load vault:", e);
    }
  }

  async function handleAdd() {
    if (!name || !desc || !secret) return;
    const cred: VaultCredential = { id: Date.now().toString(), name, llm_description: desc, secret_value: secret };
    const updated = [...credentials, cred];
    setCredentials(updated);
    setOpen(false); setName(""); setDesc(""); setSecret("");

    try {
      await addVaultCredential(cred);
    } catch (e) {
      console.error("Failed to save secret:", e);
    }
  }

  async function handleDelete(id: string) {
    const updated = credentials.filter((c) => c.id !== id);
    setCredentials(updated);

    try {
      await deleteVaultCredential(id);
    } catch (e) {
      console.error("Failed to delete secret:", e);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-8">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold">{t("vaultTitle")}</h1>
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} /> {t("addSecret")}
          </button>
        </div>
        <p className="text-muted-foreground text-sm mb-6">{t("vaultDesc")}</p>

        <div className="border border-border rounded-md overflow-hidden bg-card">
          {credentials.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t("noSecrets")}</div>
          ) : (
            credentials.map((cred, i) => (
              <div key={cred.id} className={cn("flex items-start justify-between p-4 gap-4", i < credentials.length - 1 && "border-b border-border")}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 p-1.5 bg-primary/10 rounded-md shrink-0"><KeyRound size={14} className="text-primary" /></div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{cred.name}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{cred.llm_description}</p>
                    <p className="text-muted-foreground/50 text-xs mt-1 font-mono">ID: {cred.id}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(cred.id)} className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={14} /></button>
              </div>
            ))
          )}
        </div>

        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-md p-6 w-full max-w-md shadow-2xl">
              <h2 className="text-lg font-semibold mb-4">{t("addSecret")}</h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("name")}</label>
                  <input className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="e.g. Hetzner Server 1" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("llmContext")}</label>
                  <textarea className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("secretValue")}</label>
                  <textarea className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={4} value={secret} onChange={(e) => setSecret(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setOpen(false)} className="flex-1 border border-border rounded-md py-2 text-sm hover:bg-accent transition-colors">{t("cancel")}</button>
                <button onClick={handleAdd} className="flex-1 bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:opacity-90 transition-opacity">{t("saveSecurely")}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
