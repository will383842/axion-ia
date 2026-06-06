/**
 * Admin — Qualiopi · Matrice de conformité 32 indicateurs (T12).
 *
 * Server Component : lit `evaluerConformite()` côté serveur.
 * Affiche la matrice complète des indicateurs avec numéro, critère,
 * libellé officiel, flag super (NC majeure), statut coloré et preuves.
 * Score global = couverts / applicables.
 * Force-dynamic + noindex.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import {
  evaluerConformite,
  type IndicateurConformite,
} from "@/server/qualiopi/conformite/conformite-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Matrice de conformité | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

/** Badge de statut coloré selon l'état de couverture de l'indicateur. */
function StatutBadge({
  statut,
}: {
  statut: "couvert" | "a_completer" | "non_applicable";
}): React.ReactElement {
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

/** Groupe les indicateurs par critère. */
function groupParCritere(indicateurs: IndicateurConformite[]): Map<number, IndicateurConformite[]> {
  const map = new Map<number, IndicateurConformite[]>();
  for (const ind of indicateurs) {
    const groupe = map.get(ind.critere) ?? [];
    groupe.push(ind);
    map.set(ind.critere, groupe);
  }
  return map;
}

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

export default async function QualiopiConformitePage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const conformite = await evaluerConformite();

  const criteres = groupParCritere(conformite.indicateurs);
  const critereIds = [1, 2, 3, 4, 5, 6, 7] as const;

  const toneBilan =
    conformite.scorePct >= 80 ? "success" : conformite.scorePct >= 60 ? "warning" : "destructive";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Matrice de conformité Qualiopi"
        description="État de couverture des 32 indicateurs du Référentiel National Qualité (RNQ V9). Statut déduit de la présence de données et de preuves dans le système."
      />

      {/* ── Score global ──────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-8)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard
          label="Score de conformité"
          value={`${conformite.scorePct} %`}
          meta={`${conformite.nbCouverts} indicateur(s) couvert(s) sur ${conformite.nbApplicables} applicable(s)`}
          tone={toneBilan}
        />
        <AdminStatCard label="Indicateurs couverts" value={conformite.nbCouverts} tone="success" />
        <AdminStatCard
          label="À compléter"
          value={conformite.nbApplicables - conformite.nbCouverts}
          tone={conformite.nbApplicables - conformite.nbCouverts > 0 ? "warning" : "success"}
        />
      </div>

      {/* ── Matrice par critère ───────────────────────────────────────── */}
      {critereIds.map((critereId) => {
        const lignes = criteres.get(critereId);
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
                      Preuves disponibles
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
                      {/* Numéro + super ★ */}
                      <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] font-medium whitespace-nowrap text-[color:var(--color-admin-fg-muted)]">
                        <span>{ind.numero}</span>
                        {ind.super && (
                          <span
                            title="NC majeure en audit"
                            className="ml-1 text-[color:var(--color-admin-destructive)]"
                            aria-label="Indicateur critique (NC majeure)"
                          >
                            ★
                          </span>
                        )}
                      </td>

                      {/* Libellé */}
                      <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] leading-snug text-[color:var(--color-admin-fg)]">
                        {ind.libelle}
                      </td>

                      {/* Statut */}
                      <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-center">
                        <StatutBadge statut={ind.statut} />
                      </td>

                      {/* Preuves */}
                      <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[color:var(--color-admin-fg-muted)]">
                        {ind.preuves.length > 0 ? (
                          <ul className="list-none space-y-0.5">
                            {ind.preuves.map((preuve) => (
                              <li
                                key={preuve}
                                className="flex items-center gap-[var(--space-admin-1)]"
                              >
                                <span
                                  aria-hidden="true"
                                  className="text-xs text-[color:var(--color-admin-success)]"
                                >
                                  ✓
                                </span>
                                <span className="text-[length:var(--text-admin-xs)]">{preuve}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] italic">
                            Aucune preuve enregistrée
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {/* ── Légende ───────────────────────────────────────────────────── */}
      <footer className="mt-[var(--space-admin-4)] flex flex-wrap gap-[var(--space-admin-5)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        <span>
          <span className="text-[color:var(--color-admin-destructive)]">★</span> = Indicateur super
          (NC majeure si non couvert en audit)
        </span>
        <span>Score = indicateurs couverts / indicateurs applicables (hors non_applicable)</span>
      </footer>
    </AdminPageShell>
  );
}
