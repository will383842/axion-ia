/**
 * Admin — Qualiopi · Liste des sessions de formation (T8).
 *
 * Affiche toutes les sessions avec : numéro, titre, formation, dates,
 * modalité, statut, nb inscrits, taux de présence moyen.
 * Lien vers la page émargement par session.
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listSessionsForAdmin } from "@/server/qualiopi/presence/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Sessions | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const STATUT_LABELS: Record<string, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
};

const MODALITE_LABELS: Record<string, string> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  hybride: "Hybride",
};

function formatDateFR(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiSessionsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const sessions = await listSessionsForAdmin();

  const enCours = sessions.filter((s) => s.statut === "en_cours").length;
  const planifiees = sessions.filter((s) => s.statut === "planifiee").length;
  const realisees = sessions.filter((s) => s.statut === "realisee").length;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Sessions"
        description="Toutes les sessions de formation. Cliquez sur « Émargement » pour saisir ou importer les présences."
      />

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Total sessions" value={sessions.length} />
        <AdminStatCard
          label="En cours"
          value={enCours}
          tone={enCours > 0 ? "warning" : "default"}
        />
        <AdminStatCard label="Planifiées" value={planifiees} />
        <AdminStatCard
          label="Réalisées"
          value={realisees}
          tone={realisees > 0 ? "success" : "default"}
        />
      </div>

      {sessions.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune session trouvée. Créez une session depuis la page Formations.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>N°</th>
                <th className={headCls}>Titre</th>
                <th className={headCls}>Dates</th>
                <th className={headCls}>Modalité</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Inscrits</th>
                <th className={headCls}>Taux présence</th>
                <th className={headCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  {/* Numéro */}
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">{s.numero}</span>
                  </td>

                  {/* Titre + formationId */}
                  <td className={cellCls}>
                    <div className="font-medium">{s.titreSession ?? "—"}</div>
                    <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      Formation : {s.formationId.slice(0, 8)}…
                    </div>
                  </td>

                  {/* Dates */}
                  <td className={cellCls}>
                    <div className="whitespace-nowrap">{formatDateFR(s.dateDebut)}</div>
                    <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      → {formatDateFR(s.dateFin)}
                    </div>
                  </td>

                  {/* Modalité */}
                  <td className={cellCls}>{MODALITE_LABELS[s.modalite] ?? s.modalite}</td>

                  {/* Statut */}
                  <td className={cellCls}>
                    {s.statut === "realisee" ? (
                      <span className="text-[color:var(--color-admin-success)]">
                        ● {STATUT_LABELS[s.statut]}
                      </span>
                    ) : s.statut === "annulee" ? (
                      <span className="text-[color:var(--color-admin-error)]">
                        ○ {STATUT_LABELS[s.statut]}
                      </span>
                    ) : s.statut === "en_cours" ? (
                      <span className="text-[color:var(--color-admin-warning)]">
                        ◑ {STATUT_LABELS[s.statut]}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">
                        ○ {STATUT_LABELS[s.statut] ?? s.statut}
                      </span>
                    )}
                  </td>

                  {/* Inscrits */}
                  <td className={cellCls}>{s.nbInscrits}</td>

                  {/* Taux présence moyen */}
                  <td className={cellCls}>
                    {s.tauxPresenceMoyen !== null ? (
                      <span
                        className={
                          s.tauxPresenceMoyen >= 80
                            ? "text-[color:var(--color-admin-success)]"
                            : s.tauxPresenceMoyen >= 60
                              ? "text-[color:var(--color-admin-warning)]"
                              : "text-[color:var(--color-admin-error)]"
                        }
                      >
                        {s.tauxPresenceMoyen} %
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className={cellCls}>
                    <div className="flex flex-col gap-[var(--space-admin-1)]">
                      <Link
                        href={`/${locale}/${adminPrefix}/qualiopi/sessions/${s.id}/emargement`}
                        className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                      >
                        Émargement
                      </Link>
                      <Link
                        href={`/${locale}/${adminPrefix}/qualiopi/sessions/${s.id}/evaluations`}
                        className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                      >
                        Évaluations
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
