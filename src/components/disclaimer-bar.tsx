import { Info } from "lucide-react";

/**
 * Barra di disclaimer sempre visibile: chiarisce che il servizio non è
 * ufficiale INPS. Va mostrata sia sulla landing sia dentro l'app.
 */
export function DisclaimerBar() {
  return (
    <div className="sticky top-0 z-40 w-full border-b border-amber-300/50 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/60 dark:text-amber-100">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5 text-[11px] leading-snug md:text-xs">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <p>
          <strong className="font-semibold">Servizio informativo indipendente.</strong>{" "}
          Non è un servizio ufficiale INPS e non sostituisce i canali istituzionali.
          Le risposte non hanno valore legale.
        </p>
      </div>
    </div>
  );
}
