import { useI18n } from "../i18n";
import { ShieldCheck, Database, Cpu, ExternalLink } from "lucide-react";

export default function About() {
  const { t } = useI18n();

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 select-none animate-in fade-in duration-300">
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center mt-8 space-y-8">
        
        {/* Animated Brand Logo Container */}
        <div className="relative group">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/30 to-emerald-500/20 blur-xl opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative w-28 h-28 rounded-3xl bg-[#14151a] border border-border/40 shadow-2xl flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-105">
            <img src="/logo.svg" className="w-20 h-20 object-contain" alt="Codor Logo" />
          </div>
        </div>

        {/* Title and Tagline */}
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center justify-center gap-2">
            {t("appName")}
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary self-center">
              v0.2.2
            </span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {t("aboutDesc")}
          </p>
        </div>

        {/* Badges row */}
        <div className="flex gap-2 flex-wrap justify-center text-[10px] font-semibold text-muted-foreground select-none">
          <span className="bg-secondary/70 border border-border/40 px-2.5 py-1 rounded-md">TAURI 2.0</span>
          <span className="bg-secondary/70 border border-border/40 px-2.5 py-1 rounded-md">RUST NATIVE</span>
          <span className="bg-secondary/70 border border-border/40 px-2.5 py-1 rounded-md">REACT 19</span>
          <span className="bg-secondary/70 border border-border/40 px-2.5 py-1 rounded-md">SQLITE SECURED</span>
        </div>

        {/* Divider */}
        <div className="w-full max-w-md border-t border-border/30"></div>

        {/* System Architecture Grid */}
        <div className="w-full max-w-lg space-y-4 text-start">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 px-1">
            {t("systemStatus")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* SQLite */}
            <div className="bg-card border border-border rounded-lg p-4 flex gap-3 shadow-sm">
              <Database className="text-primary shrink-0 mt-0.5" size={18} />
              <div>
                <h3 className="text-xs font-semibold text-foreground">{t("localDbStatus")}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t("connected")}</p>
              </div>
            </div>

            {/* Encrypted Vault */}
            <div className="bg-card border border-border rounded-lg p-4 flex gap-3 shadow-sm">
              <ShieldCheck className="text-emerald-500 shrink-0 mt-0.5" size={18} />
              <div>
                <h3 className="text-xs font-semibold text-foreground">{t("secureStorage")}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t("releaseType")}</p>
              </div>
            </div>
            
          </div>
        </div>

        {/* DevOps Command Engine */}
        <div className="w-full max-w-lg bg-card/40 border border-border/50 rounded-lg p-4 flex gap-3 text-start items-start">
          <Cpu className="text-primary shrink-0 mt-0.5" size={18} />
          <div>
            <h3 className="text-xs font-semibold text-foreground">Local Host Shell &amp; SSH Tunnel Agent</h3>
            <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
              Commands execute locally or securely over Vault-mapped tunnels. Absolute paths are evaluated against active security block filters.
            </p>
          </div>
        </div>

        {/* Credits footer */}
        <div className="pt-4 text-center space-y-2 select-none">
          <p className="text-[10px] text-muted-foreground/50 tracking-wide uppercase font-semibold">
            &copy; {new Date().getFullYear()} Codor AI. All rights reserved.
          </p>
          <div className="flex justify-center gap-4 text-xs">
            <a
              href="https://codor.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-medium cursor-pointer"
            >
              codor.dev <ExternalLink size={10} />
            </a>
            <span className="text-border/40">|</span>
            <a
              href="https://github.com/codor-dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-medium cursor-pointer"
            >
              GitHub
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
