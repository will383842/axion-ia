/**
 * Emplacement du lot B1/B8 : seul ce lot modifie ce fichier.
 * Lot 0 (socle) : frise d'étapes accessible (parcours du client, étapes d'une prestation).
 */

import { Check, Circle } from "lucide-react";

export type EtatEtape = "fait" | "courant" | "a_venir" | "hors_parcours";

const TEINTE: Readonly<Record<EtatEtape, string>> = {
  fait: "border-[color:var(--color-admin-bloc-vert-border)] bg-[color:var(--color-admin-bloc-vert-bg)] text-[color:var(--color-admin-bloc-vert-title)]",
  courant:
    "border-[color:var(--color-admin-bloc-bleu-border)] bg-[color:var(--color-admin-bloc-bleu-bg)] text-[color:var(--color-admin-bloc-bleu-title)]",
  a_venir:
    "border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] text-[color:var(--color-admin-fg-muted)]",
  hors_parcours:
    "border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] text-[color:var(--color-admin-fg-muted)]",
};

export function Frise(props: {
  etiquette: string;
  etapes: ReadonlyArray<{ libelle: string; etat: EtatEtape }>;
}): React.ReactElement {
  return (
    <ol aria-label={props.etiquette} className="flex flex-wrap gap-[var(--space-admin-2)]">
      {props.etapes.map((e) => (
        <li
          key={e.libelle}
          {...(e.etat === "courant" ? { "aria-current": "step" as const } : {})}
          className={`inline-flex min-h-[44px] items-center gap-[var(--space-admin-2)] rounded-full border px-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] ${TEINTE[e.etat]}`}
        >
          {e.etat === "fait" ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Circle size={14} aria-hidden="true" />
          )}
          <span>{e.libelle}</span>
          {e.etat === "fait" ? <span className="sr-only">(fait)</span> : null}
        </li>
      ))}
    </ol>
  );
}
