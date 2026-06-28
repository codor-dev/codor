import { useState, useEffect } from "react";
import { getBackups, deleteBackupRecord, BackupRecord } from "../db";
import { useI18n } from "../i18n";
import { Archive, Trash2, Copy, Check } from "lucide-react";

export default function BackupManager() {
  const { t } = useI18n();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadBackups();
  }, []);

  async function loadBackups() {
    const list = await getBackups();
    setBackups(list);
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("confirmDeleteBackup"))) return;
    await deleteBackupRecord(id);
    loadBackups();
  }

  function handleCopy(path: string, id: string) {
    navigator.clipboard.writeText(path);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 select-none animate-in fade-in duration-300">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Archive size={20} className="text-primary" />
              {t("backupsTitle")}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
              {t("backupsDesc")}
            </p>
          </div>
          <div className="text-[10px] text-muted-foreground bg-secondary/80 border border-border/40 px-2.5 py-1.5 rounded-md font-mono">
            {t("locallyStoredIn")} <span className="font-semibold text-primary">~/.codor_backups/</span>
          </div>
        </div>

        {/* Backups List */}
        <div className="grid grid-cols-1 gap-4">
          {backups.map((bk) => {
            const formattedDate = new Date(bk.created_at).toLocaleString();
            return (
              <div key={bk.id} className="bg-card border border-border rounded-md p-4 flex flex-col shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4 space-y-2">
                    {/* Timestamp & Description */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded border border-border/30">
                        {formattedDate}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {bk.description}
                      </span>
                    </div>

                    {/* Path details */}
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 w-24">{t("originalLabel")}</span>
                        <code className="text-[11px] font-mono text-foreground/80 break-all select-text bg-background/50 px-1.5 py-0.5 rounded border border-border/20">
                          {bk.original_path}
                        </code>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 w-24">{t("backupFileLabel")}</span>
                        <code className="text-[11px] font-mono text-primary/80 break-all select-text bg-background/50 px-1.5 py-0.5 rounded border border-border/20">
                          {bk.filepath}
                        </code>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Copy Backup File Path */}
                    <button
                      onClick={() => handleCopy(bk.filepath, bk.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-accent rounded-md cursor-pointer border border-border/30"
                      title={t("copyPath")}
                    >
                      {copiedId === bk.id ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
                    </button>

                    {/* Delete record */}
                    <button
                      onClick={() => handleDelete(bk.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-2 hover:bg-destructive/15 rounded-md cursor-pointer border border-border/30"
                      title={t("removeRecord")}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {backups.length === 0 && (
            <div className="text-center py-12 border border-dashed border-border rounded-lg bg-card/50 text-muted-foreground text-xs select-none">
              {t("noBackups")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
