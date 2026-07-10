import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface HeroBadgeProps {
  /** Contenu de la pastille : texte + éventuel préfixe (drapeau, pastille de couleur). */
  readonly children: ReactNode;
  /** Classes utilitaires additionnelles appliquées au conteneur centreur (ex. `mb-8`). */
  readonly className?: string;
}

/**
 * HeroBadge — pastille (« pill ») centrée affichée en tête des heros de page.
 *
 * Remplace l'ancien eyebrow aligné à gauche et sans fond par une pastille
 * centrée sur la page : fond `paper` translucide + bordure douce + micro-ombre,
 * calée sur le rendu de référence (cf. demande Will 2026-07-10). Le conteneur
 * externe centre horizontalement ; le `<span>` interne se dimensionne au contenu.
 */
export function HeroBadge({ children, className }: HeroBadgeProps): ReactNode {
  return (
    <div className={cn("flex justify-center", className)}>
      <span className="border-border bg-paper/70 text-fg-soft inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium tracking-[0.01em] shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm">
        {children}
      </span>
    </div>
  );
}
