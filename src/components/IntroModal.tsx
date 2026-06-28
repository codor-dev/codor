import { useI18n, LOCALE_LABELS, Locale } from "../i18n";
import { Globe, ArrowRight } from "lucide-react";

interface IntroModalProps {
  show: boolean;
  onComplete: () => void;
}

export default function IntroModal({ show, onComplete }: IntroModalProps) {
  const { t, locale, setLocale } = useI18n();

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6 animate-in fade-in duration-250 select-none">
      {/* Top right language picker for clean layout */}
      <div className="absolute top-6 right-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Globe size={13} className="text-muted-foreground/80" />
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="bg-transparent border-0 text-muted-foreground hover:text-foreground font-medium focus:outline-none focus:ring-0 cursor-pointer text-xs"
        >
          {Object.entries(LOCALE_LABELS).map(([k, label]) => (
            <option key={k} value={k} className="bg-card text-foreground">{label}</option>
          ))}
        </select>
      </div>

      <div className="max-w-sm w-full flex flex-col items-center text-center">
        {/* Crisp clean logo */}
        <img src="/logo.svg" className="w-14 h-14 mb-4" alt="Codor Logo" />
        
        <h1 className="text-xl font-bold tracking-tight text-foreground mb-1">{t("introTitle")}</h1>
        <a 
          href="https://codor.dev" 
          target="_blank" 
          rel="noreferrer" 
          className="text-xs text-primary font-mono mb-8 hover:underline"
        >
          codor.dev
        </a>

        {/* Start button */}
        <button
          onClick={onComplete}
          className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity cursor-pointer border border-primary/10 mb-8"
        >
          <span>{t("startApp")}</span>
          <ArrowRight size={15} />
        </button>

        {/* Minimal native-like disclaimer */}
        <div className="w-full border-t border-border/50 pt-4 text-start">
          <p className="text-[10px] text-muted-foreground leading-relaxed text-center font-medium">
            {t("introWarning")}
          </p>
        </div>
      </div>
    </div>
  );
}
