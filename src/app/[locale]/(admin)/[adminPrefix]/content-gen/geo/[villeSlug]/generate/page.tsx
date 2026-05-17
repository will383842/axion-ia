/**
 * Content Generator — Génération ciblée par ville (§ 12.1).
 *
 * V1 = form simple : variant override + provider override + tags + dry-run.
 * Le worker pick-up le job. Sprint 4 ajoute la mini-campagne en 1 clic.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { GeoVilleGenerateV2 } from "./_v2/GeoVilleGenerateV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; villeSlug: string }>;
}

export default async function GeoVilleGeneratePage({ params }: PageProps) {
  const { adminPrefix, villeSlug } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <GeoVilleGenerateV2 adminPrefix={adminPrefix} villeSlug={villeSlug} />;
  }

  const recentJobs = await prisma.contentGenJob.findMany({
    where: { anchorVilleSlug: villeSlug },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <section>
      <div className="admin-dashboard-head">
        <h1 className="admin-h1-large">
          Génération ciblée · <code>{villeSlug}</code>
        </h1>
      </div>

      <div className="admin-card">
        <p>
          V1 — création de job ciblé via la console{" "}
          <code>pnpm tsx scripts/content-gen/enqueue.ts</code> ou via la campagne{" "}
          <code>scope=ville</code> dans /coverage/new. UI complète avec variants override arrive
          V1.5.
        </p>
        <p>
          <a
            href={`/fr/${adminPrefix}/content-gen/coverage/new?ville=${villeSlug}`}
            className="admin-button"
          >
            → Créer une mini-campagne pour cette ville
          </a>
        </p>
      </div>

      <div className="admin-card admin-table-wrapper">
        <h2>10 derniers jobs sur {villeSlug}</h2>
        {recentJobs.length === 0 ? (
          <p>Aucun job pour cette ville.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Quality</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <a href={`/fr/${adminPrefix}/content-gen/jobs/${j.id}`}>
                      {j.createdAt.toISOString().slice(0, 16)}
                    </a>
                  </td>
                  <td>{j.contentType}</td>
                  <td>{j.status}</td>
                  <td>{j.qualityScore ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
