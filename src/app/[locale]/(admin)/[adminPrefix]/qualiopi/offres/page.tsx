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
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listOffres } from "@/server/qualiopi/offres/offres";
import { OffreRowActions } from "@/components/admin/qualiopi/OffreRowActions";
import {
  toggleOffreActifAction,
  verifyAllOffresCoherenceAction,
} from "@/server/actions/qualiopi/offres";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Offres | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const FORMAT_LABELS: Record<string, string> = {
  collectif_4h: "Collectif · 4 h",
  collectif_1jour: "Collectif · 1 jour",
  collectif_2jours: "Collectif · 2 jours",
  conference: "Conférence",
  dirigeant_1to1: "Dirigeant · 1-to-1",
  individuel: "Individuel",
  sur_devis: "Sur devis",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiOffresPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const offres = await listOffres();
  const actives = offres.filter((o) => o.offre.actif).length;

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

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard label="Offres au catalogue" value={offres.length} />
        <AdminStatCard label="Offres actives" value={actives} tone="success" />
        <AdminStatCard
          label="Inactives"
          value={offres.length - actives}
          tone={offres.length - actives > 0 ? "warning" : "default"}
        />
      </div>

      {offres.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune offre. Lancez <code>pnpm qualiopi:seed</code> pour initialiser le référentiel.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Code</th>
                <th className={headCls}>Titre</th>
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
