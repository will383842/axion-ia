/**
 * Admin — Qualiopi · Mode auditeur (T12).
 *
 * Server Component : lit `genererManifesteAudit()` côté serveur.
 * Affiche par indicateur la liste des preuves disponibles (types de documents,
 * comptes) et l'état de couverture.
 * Bouton export manifeste (JSON + MD) via `ExportManifesteButton` (client).
 * Force-dynamic + noindex.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { ExportManifesteButton } from "@/components/admin/qualiopi/ExportManifesteButton";
import {
  genererManifesteAudit,
  type IndicateurManifeste,
} from "@/server/qualiopi/conformite/audit-dossier";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Mode auditeur | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

/** Libellé du critère pour le regroupement visuel. */
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

/**
 * Badge d'état coloré basé sur le statut de l'indicateur.
 */
function EtatBadge({ statut }: { statut: IndicateurManifeste["statut"] }): React.ReactElement {
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

export default async function QualiopiModeAuditeurPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const manifeste = await genererManifesteAudit();
  const indicateurs = manifeste.json.indicateurs;

  // Regroupement par critère
  const critereIds = [1, 2, 3, 4, 5, 6, 7] as const;
  const parCritere = new Map<number, IndicateurManifeste[]>();
  for (const ind of indicateurs) {
    const groupe = parCritere.get(ind.critere) ?? [];
    groupe.push(ind);
    parCritere.set(ind.critere, groupe);
  }

  const nbCouverts = manifeste.json.meta.nbCouverts;
  const nbApplicables = manifeste.json.meta.nbApplicables;
  const scorePct = manifeste.json.meta.scorePct;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Mode auditeur Qualiopi"
        description="Vue auditeur : manifeste des preuves disponibles par indicateur du Référentiel National Qualité (RNQ V9). Exportable au format JSON et Markdown pour transmission à l'organisme certificateur."
        actions={<ExportManifesteButton />}
      />

      {/* ── Résumé global ─────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
          <span className="font-semibold text-[color:var(--color-admin-fg)]">{nbCouverts}</span>
          {" indicateur(s) couvert(s) sur "}
          <span className="font-semibold text-[color:var(--color-admin-fg)]">{nbApplicables}</span>
          {" applicable(s) — "}
          <span className="font-semibold text-[color:var(--color-admin-fg)]">
            {scorePct}
            {" %"}
          </span>
          {" de conformité · Référentiel "}
          <span className="font-mono text-[length:var(--text-admin-xs)]">
            {manifeste.json.meta.version}
          </span>
        </p>
      </div>

      {/* ── Manifeste par critère ─────────────────────────────────────── */}
      {indicateurs.length === 0 ? (
        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-8)] text-center">
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucune donnée disponible. Les indicateurs seront affichés une fois les services de
            conformité déployés.
          </p>
        </div>
      ) : (
        critereIds.map((critereId) => {
          const lignes = parCritere.get(critereId);
          if (!lignes || lignes.length === 0) return null;

          return (
            <section
              key={critereId}
              className="mb-[var(--space-admin-8)]"
              aria-labelledby={`critere-auditeur-${critereId}-titre`}
            >
              <h2
                id={`critere-auditeur-${critereId}-titre`}
                className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
              >
                {libelleCritere(critereId)}
              </h2>

              <div className="space-y-[var(--space-admin-3)]">
                {lignes.map((ind) => (
                  <div
                    key={ind.numero}
                    className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
                  >
                    {/* En-tête indicateur */}
                    <div className="mb-[var(--space-admin-3)] flex flex-wrap items-start justify-between gap-[var(--space-admin-3)]">
                      <div className="flex items-start gap-[var(--space-admin-3)]">
                        <span className="shrink-0 text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)]">
                          Ind. {ind.numero}
                          {ind.super && (
                            <span
                              title="NC majeure en audit"
                              className="ml-1 text-[color:var(--color-admin-destructive)]"
                              aria-label="Indicateur critique (NC majeure)"
                            >
                              ★
                            </span>
                          )}
                        </span>
                        <p className="text-[length:var(--text-admin-sm)] leading-snug text-[color:var(--color-admin-fg)]">
                          {ind.libelle}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <EtatBadge statut={ind.statut} />
                      </div>
                    </div>

                    {/* Preuves textuelles */}
                    {ind.preuves.length > 0 && (
                      <div className="mb-[var(--space-admin-3)]">
                        <p className="mb-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                          Preuves
                        </p>
                        <ul className="space-y-[var(--space-admin-1)]">
                          {ind.preuves.map((preuve) => (
                            <li
                              key={preuve}
                              className="flex items-center gap-[var(--space-admin-2)]"
                            >
                              <span
                                className="shrink-0 text-xs text-[color:var(--color-admin-success)]"
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                              <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)]">
                                {preuve}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Documents Prisma */}
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
                              <span
                                className="shrink-0 text-xs text-[color:var(--color-admin-success)]"
                                aria-hidden="true"
                              >
                                ✓
                              </span>
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
            </section>
          );
        })
      )}

      {/* ── Markdown brut (aperçu) ────────────────────────────────────── */}
      {manifeste.markdown.length > 0 && (
        <details className="mt-[var(--space-admin-8)]">
          <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-soft)] transition-colors hover:text-[color:var(--color-admin-fg)]">
            Aperçu Markdown du manifeste
          </summary>
          <pre className="mt-[var(--space-admin-4)] max-h-96 overflow-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)] font-mono text-[length:var(--text-admin-xs)] whitespace-pre-wrap text-[color:var(--color-admin-fg)]">
            {manifeste.markdown}
          </pre>
        </details>
      )}
    </AdminPageShell>
  );
}
