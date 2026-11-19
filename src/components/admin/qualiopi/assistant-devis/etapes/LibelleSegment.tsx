/**
 * Contenu d'un segment (radio ou case masquée) : une coche visible seulement quand le choix est
 * retenu, pour que l'état ne tienne pas à la seule couleur (WCAG 1.4.1). Aucun décalage :
 * la place de la coche est réservée par le padding du segment, et le libellé réserve sa largeur
 * en gras par un pseudo-élément invisible (CLS 0).
 */
import { Check } from "lucide-react";

export function LibelleSegment({ coche, texte }: { coche: boolean; texte: string }) {
  return (
    <>
      {coche ? (
        <Check
          aria-hidden="true"
          className="pointer-events-none absolute left-[var(--space-admin-4)] size-4"
        />
      ) : null}
      <span
        data-texte={texte}
        className="before:invisible before:block before:h-0 before:overflow-hidden before:font-semibold before:content-[attr(data-texte)]"
      >
        {texte}
      </span>
    </>
  );
}
