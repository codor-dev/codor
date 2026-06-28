import { useState, useEffect } from "react";
import { getSkills, addSkill, deleteSkill, toggleSkill, Skill } from "../db";
import { useI18n } from "../i18n";
import { BookOpen, Plus, Trash2, Code, Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/utils";

export default function DevOpsSkills() {
  const { t } = useI18n();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [promptText, setPromptText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [viewPromptId, setViewPromptId] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
  }, []);

  async function loadSkills() {
    const list = await getSkills();
    setSkills(list);
  }

  async function handleAddSkill(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !promptText.trim()) return;

    await addSkill(name, description, promptText);
    setName("");
    setDescription("");
    setPromptText("");
    setIsOpen(false);
    loadSkills();
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("confirmDeleteSkill"))) return;
    await deleteSkill(id);
    loadSkills();
  }

  async function handleToggle(id: string, currentStatus: number) {
    const newStatus = currentStatus === 1 ? false : true;
    await toggleSkill(id, newStatus);
    loadSkills();
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 select-none animate-in fade-in duration-300">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BookOpen size={20} className="text-primary" />
              {t("skillsTitle")}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
              {t("skillsDesc")}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-md"
          >
            <Plus size={14} />
            {t("addSkill")}
          </button>
        </div>

        {/* Add Skill Modal/Drawer */}
        {isOpen && (
          <form onSubmit={handleAddSkill} className="bg-card border border-border rounded-md p-5 mb-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <h3 className="text-sm font-semibold">{t("addSkill")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">{t("skillNameLabel")}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Terraform Deployment"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-foreground"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">{t("descriptionLabel")}</label>
                <input
                  type="text"
                  placeholder="Brief summary of when to use this skill"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-foreground"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">{t("skillPrompt")}</label>
              <textarea
                required
                rows={5}
                placeholder={t("skillPromptPlaceholder")}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 font-mono text-foreground leading-relaxed resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-2 rounded text-xs hover:bg-accent text-muted-foreground transition-colors cursor-pointer border border-border"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="bg-primary text-primary-foreground px-4 py-2 rounded text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
              >
                {t("saveSkill")}
              </button>
            </div>
          </form>
        )}

        {/* Skills Grid */}
        <div className="grid grid-cols-1 gap-4">
          {skills.map((skill) => {
            const isPromptVisible = viewPromptId === skill.id;
            return (
              <div key={skill.id} className="bg-card border border-border rounded-md p-4 flex flex-col shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
                      {skill.name}
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase",
                        skill.is_enabled === 1 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {skill.is_enabled === 1 ? t("active") : t("disabled")}
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {skill.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* View code button */}
                    <button
                      onClick={() => setViewPromptId(isPromptVisible ? null : skill.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1.5 hover:bg-accent rounded cursor-pointer"
                      title="Toggle System Prompt Instructions"
                    >
                      {isPromptVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>

                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggle(skill.id, skill.is_enabled)}
                      className={cn(
                        "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-border/40 transition-colors duration-200 ease-in-out focus:outline-none",
                        skill.is_enabled === 1 ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out mt-[1px] ml-[1px]",
                          skill.is_enabled === 1 ? "translate-x-3" : "translate-x-0"
                        )}
                      />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(skill.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1.5 hover:bg-destructive/15 rounded cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded Prompt Instructions */}
                {isPromptVisible && (
                  <div className="mt-3 p-3 bg-muted border border-border rounded-md font-mono text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap animate-in fade-in duration-200">
                    <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 select-none">
                      <Code size={10} />
                      {t("injectedPrompts")}
                    </div>
                    {skill.system_prompt}
                  </div>
                )}
              </div>
            );
          })}

          {skills.length === 0 && (
            <div className="text-center py-12 border border-dashed border-border rounded-lg bg-card/50 text-muted-foreground text-xs select-none">
              {t("noSkills")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
