/**
 * Admin — Qualiopi · Catalogue des formations (T3).
 *
 * Liste les formations issues du Formation Engine. Miroir du pattern
 * `qualiopi/offres/page.tsx` (auth, AdminPageShell, AdminStatCard,
 * force-dynamic, noindex). Server Component.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, GraduationCap, Hourglass } from "lucide-react";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { ImportCatalogFormationsButton } from "@/components/admin/qualiopi/ImportCatalogFormationsButton";
import {
  ARCHIVE_FILTER_PARAM,
  applyArchiveFilter,
  parseArchiveFilter,
} from "@/components/admin/qualiopi/archive-filter";
import { listFormations } from "@/server/qualiopi/formations/formations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Formations | Axion-IA Admin",
  robots: { index: false, follow: false },
};

/** Libellés humains pour les statuts de génération. */
const GENERATION_LABELS: Record<string, string> = {
  intention: "Intention",
  structure_generee: "Structure générée",
  contenu_evalue: "Contenu évalué",
  structure_validee: "Structure validée",
  contenu_genere: "Contenu généré",
  contenu_valide: "Contenu validé",
  assemble: "Assemblé",
  publie: "Publié",
  archive: "Archivé",
};

/** Libellés humains pour les statuts de formation. */
const STATUT_LABELS: Record<string, string> = {
  actif: "Actif",
  publie: "Publié",
  archive: "Archivé",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function QualiopiFormationsPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const vue = parseArchiveFilter((await searchParams)[ARCHIVE_FILTER_PARAM]);

  // Une formation « vivante » n'est pas archivée. Attention : le statut porté par
  // les formations en service est `actif` (posé par l'import catalogue), PAS
  // `publie` — compter `publie` renvoyait 0 alors que 22 formations tournent.
  const toutes = await listFormations();
  const actives = toutes.filter((f) => f.statut !== "archive");
  const archivees = toutes.filter((f) => f.statut === "archive");

  const formations = applyArchiveFilter(vue, actives, archivees);

  // Compteurs sur la SEULE offre vivante : les archives sont hors console
  // (décision Will), les afficher dans une carte les remettrait sous les yeux.
  const brouillons = actives.filter((f) => f.statutGeneration !== "publie").length;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Formations"
        description="Catalogue des formations issues du Formation Engine. Chaque formation est rattachée à une offre du référentiel offres_site."
        actions={
          <div className="flex flex-wrap items-start justify-end gap-[var(--space-admin-3)]">
            <ImportCatalogFormationsButton />
            <Link
              href={`/${locale}/${adminPrefix}/qualiopi/formations/new`}
              className="admin-button shrink-0"
            >
              + Nouvelle formation
            </Link>
          </div>
        }
      />

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard label="Total" value={actives.length} icon={GraduationCap} />
        <AdminStatCard label="Actives" value={actives.length} tone="success" icon={CheckCircle2} />
        <AdminStatCard
          label="Brouillons / en cours"
          value={brouillons}
          tone={brouillons > 0 ? "warning" : "default"}
          icon={Hourglass}
        />
      </div>

      {formations.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          {actives.length === 0 ? (
            <>
              Aucune formation active. Cliquez sur <strong>« Importer le catalogue »</strong> pour
              créer d&apos;un coup les formations du catalogue public (prêtes pour sessions,
              conventions et factures), ou lancez une génération depuis le Formation Engine.
            </>
          ) : (
            <>Aucune formation dans cette vue.</>
          )}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Numéro</th>
                <th className={headCls}>Titre</th>
                <th className={headCls}>Offre</th>
                <th className={headCls}>Durée (h)</th>
                <th className={headCls}>Statut génération</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Validée</th>
                <th className={headCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {formations.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  {/* Numéro */}
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">{f.numero}</span>
                  </td>

                  {/* Titre + slug */}
                  <td className={cellCls}>
                    <div className="font-medium">{f.titre}</div>
                    <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      /formations/{f.slug}
                    </div>
                  </td>

                  {/* Offre — code lisible (AXI-OFF-NNN) résolu via la relation
                      offreSite, plutôt que l'UUID offreSiteId brut. */}
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">
                      {f.offreSite.code}
                    </span>
                    <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {f.offreSite.titreFr}
                    </div>
                  </td>

                  {/* Durée */}
                  <td className={cellCls}>{f.dureeHeures}</td>

                  {/* Statut génération */}
                  <td className={cellCls}>
                    <span
                      className={
                        f.statutGeneration === "publie"
                          ? "text-[color:var(--color-admin-success)]"
                          : f.statutGeneration === "archive"
                            ? "text-[color:var(--color-admin-fg-muted)]"
                            : "text-[color:var(--color-admin-warning)]"
                      }
                    >
                      {GENERATION_LABELS[f.statutGeneration] ?? f.statutGeneration}
                    </span>
                  </td>

                  {/* Statut formation */}
                  <td className={cellCls}>
                    {f.statut === "publie" ? (
                      <span className="text-[color:var(--color-admin-success)]">
                        ● {STATUT_LABELS[f.statut]}
                      </span>
                    ) : f.statut === "archive" ? (
                      <span className="text-[color:var(--color-admin-fg-muted)]">
                        ○ {STATUT_LABELS[f.statut]}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-warning)]">
                        ◑ {STATUT_LABELS[f.statut] ?? f.statut}
                      </span>
                    )}
                  </td>

                  {/* Validée */}
                  <td className={cellCls}>
                    {f.validatedAt != null ? (
                      <span className="text-[color:var(--color-admin-success)]">Oui</span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">Non</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className={cellCls}>
                    <div className="flex flex-col gap-[var(--space-admin-1)]">
                      <Link
                        href={`/${locale}/${adminPrefix}/qualiopi/formations/${f.id}`}
                        className="text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-accent)] underline hover:no-underline"
                      >
                        Éditer
                      </Link>
                      <Link
                        href={`/${locale}/${adminPrefix}/qualiopi/formations/${f.id}/supports`}
                        className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
                      >
                        Supports
                      </Link>
                      <Link
                        href={`/${locale}/${adminPrefix}/qualiopi/formations/${f.id}/certification`}
                        className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
                      >
                        Certification
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
