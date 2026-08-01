/**
 * Admin — Qualiopi · Référentiel des offres (T1).
 *
 * Liste les offres `offres_site` (rattachables au Formation Engine). Le prix
 * est résolu depuis pricing.ts (SSOT) — jamais stocké. Server Component
 * force-dynamic.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listOffres } from "@/server/qualiopi/offres/offres";
import { OffreRowActions } from "@/components/admin/qualiopi/OffreRowActions";
import { SeedReferenceDataButton } from "@/components/admin/qualiopi/SeedReferenceDataButton";
import {
  ARCHIVE_FILTER_PARAM,
  applyArchiveFilter,
  parseArchiveFilter,
} from "@/components/admin/qualiopi/archive-filter";
import {
  toggleOffreActifAction,
  verifyAllOffresCoherenceAction,
} from "@/server/actions/qualiopi/offres";
import { getQualiopiReferenceDataStatus } from "@/server/qualiopi/seed/reference-data";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Offres | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const FORMAT_LABELS: Record<string, string> = {
  collectif_4h: "Collectif · 4 h",
  collectif_1jour: "Collectif · 1 jour",
  collectif_2jours: "Collectif · 2 jours",
  collectif_3jours: "Collectif · 3 jours",
  conference: "Conférence",
  dirigeant_1to1: "Dirigeant · 1-to-1",
  individuel: "Individuel",
  sur_devis: "Sur devis",
};

const GAMME_LABELS: Record<string, string> = {
  "ia-standard": "IA",
  "agents-automatisations": "Agents & Auto.",
  claude: "Claude",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function QualiopiOffresPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const vue = parseArchiveFilter((await searchParams)[ARCHIVE_FILTER_PARAM]);

  // Une offre désactivée reste rattachée à des formations archivées et à leur
  // historique → jamais supprimée, seulement masquée de la console.
  const toutes = await listOffres();
  const offresActives = toutes.filter((o) => o.offre.actif);
  const offresInactives = toutes.filter((o) => !o.offre.actif);

  const offres = applyArchiveFilter(vue, offresActives, offresInactives);

  // État vide : Will (non technicien) ne peut pas lancer une commande terminal.
  // On lui propose directement le même bouton que /qualiopi/config plutôt que
  // d'afficher `pnpm qualiopi:seed`.
  const referenceStatus =
    offresActives.length === 0 ? await getQualiopiReferenceDataStatus(prisma) : null;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Offres (référentiel)"
        description="Catalogue des offres rattachables au Formation Engine. Le prix est dérivé de pricing.ts (source unique) — il n'est jamais saisi ici."
        actions={<OffreRowActions mode="verify" verifyAction={verifyAllOffresCoherenceAction} />}
      />

      {/* Une seule mesure a du sens ici : les offres rattachables. Les offres
          désactivées sont hors console (décision Will 2026-07-24) — les compter
          dans une carte les remettrait sous les yeux. */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard
          label="Offres actives"
          value={offresActives.length}
          tone="success"
          icon={FileText}
        />
      </div>

      {offres.length === 0 ? (
        offresActives.length === 0 && referenceStatus ? (
          <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-5)]">
            <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
              Aucune offre. Initialisez le référentiel ci-dessous.
            </p>
            <SeedReferenceDataButton initial={referenceStatus} />
          </div>
        ) : (
          <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
            Aucune offre dans cette vue.
          </p>
        )
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Code</th>
                <th className={headCls}>Titre</th>
                <th className={headCls}>Gamme</th>
                <th className={headCls}>Format</th>
                <th className={headCls}>Durée (h)</th>
                <th className={headCls}>Prix (pricing.ts)</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Action</th>
              </tr>
            </thead>
            <tbody>
              {offres.map(({ offre, prixLabelFr }) => (
                <tr key={offre.id} className="border-b border-[color:var(--color-admin-border)]">
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">
                      {offre.code}
                    </span>
                  </td>
                  <td className={cellCls}>
                    <div className="font-medium">{offre.titreFr}</div>
                    <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      /formations/{offre.slug}
                    </div>
                  </td>
                  <td className={cellCls}>
                    {offre.gamme ? (
                      <span className="inline-block rounded-full border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-2 py-0.5 text-[length:var(--text-admin-xs)] font-medium">
                        {GAMME_LABELS[offre.gamme] ?? offre.gamme}
                        {offre.dureeCode ? ` · ${offre.dureeCode}` : ""}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {FORMAT_LABELS[offre.formatPedagogique] ?? offre.formatPedagogique}
                  </td>
                  <td className={cellCls}>
                    {offre.dureeHeuresMin === offre.dureeHeuresMax
                      ? offre.dureeHeuresMin
                      : `${offre.dureeHeuresMin}–${offre.dureeHeuresMax}`}
                  </td>
                  <td className={cellCls}>{prixLabelFr}</td>
                  <td className={cellCls}>
                    {offre.actif ? (
                      <span className="text-[color:var(--color-admin-success)]">● Active</span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">○ Inactive</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    <OffreRowActions
                      mode="toggle"
                      offreId={offre.id}
                      actif={offre.actif}
                      toggleAction={toggleOffreActifAction}
                    />
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
