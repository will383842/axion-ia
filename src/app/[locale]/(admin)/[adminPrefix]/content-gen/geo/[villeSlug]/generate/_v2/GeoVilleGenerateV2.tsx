// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Geo ville generate V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { contentTypeLabelFr, JOB_STATUS_LABELS_FR } from "@/server/content-gen/shared/admin-labels";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { formatDateFr } from "@/lib/format-date-fr";

interface Props {
  adminPrefix: string;
  villeSlug: string;
}

export async function GeoVilleGenerateV2({
  adminPrefix,
  villeSlug,
}: Props): Promise<React.ReactElement> {
  const recentJobs = await prisma.contentGenJob.findMany({
    where: { anchorVilleSlug: villeSlug },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <AdminPageShell>
      <AdminPageHeader title={`Génération ciblée · ${villeSlug}`} />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <p className="admin-meta-block">
          V1 — création de job ciblé via la console{" "}
          <code>pnpm tsx scripts/content-gen/enqueue.ts</code> ou via la campagne{" "}
          <code>scope=ville</code> dans /coverage/new. UI complète avec variants override arrive
          V1.5.
        </p>
        <p>
          <Link
            href={`/fr/${adminPrefix}/content-gen/coverage/new?ville=${villeSlug}`}
            className="admin-button"
          >
            → Créer une mini-campagne pour cette ville
          </Link>
        </p>
      </AdminCard>

      <AdminCard variant="compact">
        <h2 className="admin-h2">10 derniers jobs sur {villeSlug}</h2>
        {recentJobs.length === 0 ? (
          <p className="admin-meta-block">Aucun job pour cette ville.</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Qualité</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <Link
                        href={`/fr/${adminPrefix}/content-gen/jobs/${j.id}`}
                        className="admin-link"
                      >
                        {formatDateFr(j.createdAt)}
                      </Link>
                    </td>
                    <td>{contentTypeLabelFr(j.contentType)}</td>
                    <td>{JOB_STATUS_LABELS_FR[j.status] ?? j.status}</td>
                    <td>{j.qualityScore ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
