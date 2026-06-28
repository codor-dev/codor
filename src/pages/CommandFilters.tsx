import { useState, useEffect } from "react";
import { useI18n } from "../i18n";
import { CommandFilter, getCommandFilters, addCommandFilter, deleteCommandFilter } from "../db";
import { ShieldAlert, Plus, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";

export default function CommandFilters() {
  const { t } = useI18n();
  const [filters, setFilters] = useState<CommandFilter[]>([]);
  const [pattern, setPattern] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const list = await getCommandFilters();
    setFilters(list);
  }

  async function handleAdd() {
    if (!pattern.trim()) return;
    await addCommandFilter(pattern.trim(), desc.trim() || "User defined filter");
    setPattern("");
    setDesc("");
    load();
  }

  async function handleDelete(id: string) {
    await deleteCommandFilter(id);
    load();
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-8">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <ShieldAlert size={24} />
          </div>
          <h1 className="text-2xl font-semibold">{t("filtersTitle")}</h1>
        </div>
        <p className="text-muted-foreground text-sm mb-8">{t("filtersDesc")}</p>

        {/* Add filter box */}
        <div className="bg-card border border-border rounded-md p-6 mb-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder={t("pattern")}
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
            />
            <input
              className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder={t("patternDesc")}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity self-start cursor-pointer"
          >
            <Plus size={16} /> {t("addFilter")}
          </button>
        </div>

        {/* Filters List */}
        <div className="border border-border rounded-md overflow-hidden bg-card">
          {filters.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t("noFilters")}</div>
          ) : (
            filters.map((f, i) => (
              <div key={f.id} className={cn("flex items-center justify-between p-4 gap-4", i < filters.length - 1 && "border-b border-border")}>
                <div className="min-w-0">
                  <span className="inline-block px-2 py-0.5 rounded bg-destructive/10 text-destructive font-mono text-xs font-semibold mb-1">
                    {f.pattern}
                  </span>
                  <p className="text-muted-foreground text-xs">{f.description}</p>
                </div>
                <button
                  onClick={() => handleDelete(f.id)}
                  className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
