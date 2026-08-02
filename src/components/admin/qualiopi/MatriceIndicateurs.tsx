/**
 * Qualiopi — Matrice des 32 indicateurs RNQ V9, composant partagé (phase 2
 * de l'audit UX console, 2026-08-01).
 *
 * Avant : « Conformité » (tableaux denses) et « Mode auditeur » (cartes +
 * documents) recopiaient chacun libelleCritere / badge de statut / le
 * regroupement par critère — jusqu'au même commentaire de constat F15
 * dupliqué. Les deux pages fusionnent sur /qualiopi/mode-auditeur avec un
 * commutateur de vue (?vue=tableau|manifeste) ; ce composant rend l'une ou
 * l'autre depuis la même donnée `IndicateurManifeste[]` (sur-ensemble :
 * conformité + comptes de documents).
 *
 * Server Component pur — aucun state, 0 JS client.
 */

import type { IndicateurManifeste } from "@/server/qualiopi/conformite/audit-dossier";

export type MatriceVue = "tableau" | "manifeste";

/** Libellé long du critère Qualiopi RNQ V9. */
function libelleCritere(c: number): string {
  const labels: Record<number, string> = {
    1: "C1 — Conditions d'information du public",
    2: "C2 — Identification et analyse des besoins des bénéficiaires",
    3: "C3 — Adaptation aux bénéficiaires",
    4: "C4 — Adéquation des moyens pédagogiques, techniques et d'encadrement",
    5: "C5 — Qualification et développement des compétences du personnel",
    6: "C6 — Inscription et veille des sous-traitants et formateurs occasionnels",
    7: "C7 — Recueil des appréciations et mise en œuvre de l'amélioration continue",
  };
  return labels[c] ?? `Critère ${c}`;
}

/** Badge de statut coloré selon l'état de couverture de l'indicateur. */
function StatutBadge({ statut }: { statut: IndicateurManifeste["statut"] }): React.ReactElement {
  if (statut === "couvert") {
    return (
      <span className="inline-flex items-center rounded-full bg-[color:var(--color-admin-success-subtle,color-mix(in_srgb,var(--color-admin-success)_15%,transparent))] px-[var(--space-admin-2)] py-0.5 text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-success)]">
        Couvert
      </span>
    );
  }
  if (statut === "a_completer") {
    return (
      <span className="inline-flex items-center rounded-full bg-[color:var(--color-admin-warning-subtle,color-mix(in_srgb,var(--color-admin-warning)_15%,transparent))] px-[var(--space-admin-2)] py-0.5 text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-warning)]">
        À compléter
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[color:var(--color-admin-surface-subtle,color-mix(in_srgb,var(--color-admin-fg)_8%,transparent))] px-[var(--space-admin-2)] py-0.5 text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)]">
      Non applicable
    </span>
  );
}

/** Étoile « NC majeure » commune aux deux vues. */
function SuperStar(): React.ReactElement {
  return (
    <span
      title="NC majeure en audit"
      className="ml-1 text-[color:var(--color-admin-destructive)]"
      aria-label="Indicateur critique (NC majeure)"
    >
      ★
    </span>
  );
}

function groupParCritere(
  indicateurs: ReadonlyArray<IndicateurManifeste>,
): Map<number, IndicateurManifeste[]> {
  const map = new Map<number, IndicateurManifeste[]>();
  for (const ind of indicateurs) {
    const groupe = map.get(ind.critere) ?? [];
    groupe.push(ind);
    map.set(ind.critere, groupe);
  }
  return map;
}

const CRITERE_IDS = [1, 2, 3, 4, 5, 6, 7] as const;

interface Props {
  indicateurs: ReadonlyArray<IndicateurManifeste>;
  vue: MatriceVue;
}

/** Vue tableau — balayage rapide, 4 colonnes, zébrage. */
function VueTableau({ lignes }: { lignes: IndicateurManifeste[] }): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
      <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
        <thead>
          <tr className="border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)]">
            <th className="w-16 px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left font-semibold text-[color:var(--color-admin-fg-muted)]">
              N°
            </th>
            <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left font-semibold text-[color:var(--color-admin-fg-muted)]">
              Libellé officiel
            </th>
            <th className="w-28 px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-center font-semibold text-[color:var(--color-admin-fg-muted)]">
              Statut
            </th>
            <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left font-semibold text-[color:var(--color-admin-fg-muted)]">
              Éléments constatés
            </th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ind, idx) => (
            <tr
              key={ind.numero}
              className={
                idx % 2 === 0
                  ? "bg-[color:var(--color-admin-paper)]"
                  : "bg-[color:var(--color-admin-surface)]"
              }
            >
              <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] font-medium whitespace-nowrap text-[color:var(--color-admin-fg-muted)]">
                <span>{ind.numero}</span>
                {ind.super && <SuperStar />}
              </td>
              <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] leading-snug text-[color:var(--color-admin-fg)]">
                {ind.libelle}
              </td>
              <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-center">
                <StatutBadge statut={ind.statut} />
              </td>
              {/* Constat F15 (2026-07-26) : `preuves` mélange preuves réelles
                  et constats d'absence, sans polarité — titre et puces neutres,
                  jamais de ✓ décoratif. Le statut est dit par sa colonne. */}
              <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[color:var(--color-admin-fg-muted)]">
                {ind.preuves.length > 0 ? (
                  <ul className="list-none space-y-0.5">
                    {ind.preuves.map((preuve) => (
                      <li key={preuve} className="flex items-center gap-[var(--space-admin-1)]">
                        <span
                          aria-hidden="true"
                          className="text-xs text-[color:var(--color-admin-fg-muted)]"
                        >
                          •
                        </span>
                        <span className="text-[length:var(--text-admin-xs)]">{preuve}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] italic">
                    Aucun élément enregistré
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Vue manifeste — cartes verbeuses avec comptes de documents (l'auditrice). */
function VueManifeste({ lignes }: { lignes: IndicateurManifeste[] }): React.ReactElement {
  return (
    <div className="space-y-[var(--space-admin-3)]">
      {lignes.map((ind) => (
        <div
          key={ind.numero}
          className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
        >
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-start justify-between gap-[var(--space-admin-3)]">
            <div className="flex items-start gap-[var(--space-admin-3)]">
              <span className="shrink-0 text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)]">
                Ind. {ind.numero}
                {ind.super && <SuperStar />}
              </span>
              <p className="text-[length:var(--text-admin-sm)] leading-snug text-[color:var(--color-admin-fg)]">
                {ind.libelle}
              </p>
            </div>
            <div className="shrink-0">
              <StatutBadge statut={ind.statut} />
            </div>
          </div>

          {/* Constat F15 (2026-07-26) : titre neutre, puce neutre — voir
              VueTableau ci-dessus, même règle. */}
          {ind.preuves.length > 0 && (
            <div className="mb-[var(--space-admin-3)]">
              <p className="mb-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                Éléments constatés
              </p>
              <ul className="space-y-[var(--space-admin-1)]">
                {ind.preuves.map((preuve) => (
                  <li key={preuve} className="flex items-center gap-[var(--space-admin-2)]">
                    <span
                      className="shrink-0 text-xs text-[color:var(--color-admin-fg-muted)]"
                      aria-hidden="true"
                    >
                      •
                    </span>
                    <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)]">
                      {preuve}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ind.documents.length > 0 && (
            <div>
              <p className="mb-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                Documents
              </p>
              <ul className="space-y-[var(--space-admin-2)]">
                {ind.documents.map((doc, i) => (
                  <li
                    key={`${doc.type}-${i}`}
                    className="flex items-center gap-[var(--space-admin-3)] rounded bg-[color:var(--color-admin-surface)] px-[var(--space-admin-3)] py-[var(--space-admin-2)]"
                  >
                    <span className="font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)]">
                      {doc.type}
                    </span>
                    <span className="ml-auto shrink-0 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {doc.count} doc(s)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ind.preuves.length === 0 && ind.documents.length === 0 && (
            <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] italic">
              {ind.statut === "non_applicable"
                ? "Non applicable au périmètre de l'OF."
                : "Aucune preuve enregistrée pour cet indicateur."}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function MatriceIndicateurs({ indicateurs, vue }: Props): React.ReactElement {
  const parCritere = groupParCritere(indicateurs);

  if (indicateurs.length === 0) {
    return (
      <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-8)] text-center">
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune donnée disponible. Les indicateurs seront affichés une fois les services de
          conformité déployés.
        </p>
      </div>
    );
  }

  return (
    <>
      {CRITERE_IDS.map((critereId) => {
        const lignes = parCritere.get(critereId);
        if (!lignes || lignes.length === 0) return null;
        return (
          <section
            key={critereId}
            className="mb-[var(--space-admin-8)]"
            aria-labelledby={`critere-${critereId}-titre`}
          >
            <h2
              id={`critere-${critereId}-titre`}
              className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
            >
              {libelleCritere(critereId)}
            </h2>
            {vue === "tableau" ? <VueTableau lignes={lignes} /> : <VueManifeste lignes={lignes} />}
          </section>
        );
      })}

      <footer className="mt-[var(--space-admin-4)] flex flex-wrap gap-[var(--space-admin-5)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        <span>
          <span className="text-[color:var(--color-admin-destructive)]">★</span> = Indicateur super
          (NC majeure si non couvert en audit)
        </span>
        <span>Score = indicateurs couverts / indicateurs applicables (hors non_applicable)</span>
      </footer>
    </>
  );
}
