"use client";
// use-client: partage le format d affichage entre les onglets de paiement.

/** Rappel en lecture des phases (étape 1b) ; montants du serveur affichés tels quels. */
import type { PhaseAssistant } from "../../types";

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

// Teintes de la barre : un même accent, plus ou moins dense (aucune couleur littérale).
const TEINTES = ["opacity-100", "opacity-70", "opacity-45", "opacity-25"] as const;

export function RappelPhases({
  nom,
  phases,
  montants,
  mention,
}: {
  nom: string;
  phases: readonly PhaseAssistant[];
  montants?: ReadonlyArray<number | null> | undefined;
  /** « TTC » en prix unique, « HT » en formules : précise ce que le montant du serveur couvre. */
  mention?: "TTC" | "HT" | undefined;
}) {
  const parts = phases.map((p) => {
    const n = Number.parseFloat(p.pourcentage.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const resume = phases.map((p) => `${p.libelle} ${p.pourcentage} %`).join(", ");
  return (
    <div className="mb-[var(--space-admin-8)]">
      <div
        role="img"
        aria-label={`Répartition des versements : ${resume}`}
        className="mb-[var(--space-admin-5)] flex h-3 gap-0.5 overflow-hidden rounded-full bg-[color:var(--color-admin-surface-sunken)]"
      >
        {parts.map((n, i) =>
          n > 0 ? (
            <span
              key={phases[i]!.id}
              style={{ flexGrow: n, flexBasis: 0 }}
              className={`bg-[color:var(--color-admin-accent)] ${TEINTES[i % TEINTES.length]}`}
            />
          ) : null,
        )}
      </div>
      <ol aria-label={nom} className="m-0 grid list-none gap-[var(--space-admin-3)] p-0">
        {phases.map((p, i) => (
          <li
            key={p.id}
            className="flex min-h-[44px] items-center justify-between gap-[var(--space-admin-4)] rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-5)] py-[var(--space-admin-3)]"
          >
            <span>
              {i + 1}. {p.libelle} · {p.pourcentage} %
            </span>
            <span className="text-right font-semibold whitespace-nowrap tabular-nums">
              {montants?.[i] == null ? "—" : EUROS.format(montants[i]! / 100)}
              {montants?.[i] != null && mention ? (
                <span className="ml-1 text-[length:var(--text-admin-xs)] font-normal">
                  {mention}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
