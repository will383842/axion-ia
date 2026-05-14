/**
 * Content Generator — Publications history + rollback (§ 14.3).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function PublicationsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const recent = await prisma.contentGenJob.findMany({
    where: { status: "published" },
    orderBy: { completedAt: "desc" },
    take: 50,
    include: { reviewQueue: true },
  });

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Publications</h1>
          <p className="admin-meta">
            {recent.length} publication{recent.length > 1 ? "s" : ""} récente
            {recent.length > 1 ? "s" : ""}. Rollback via{" "}
            <code>scripts/content-gen/rollback.ts</code> (Sprint 4 → UI bouton).
          </p>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Publié le</th>
              <th>Type</th>
              <th>Ville</th>
              <th>Quality</th>
              <th>SEO</th>
              <th>Tier</th>
              <th>Job</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={7}>Aucune publication enregistrée.</td>
              </tr>
            ) : (
              recent.map((j) => (
                <tr key={j.id}>
                  <td>{j.completedAt?.toISOString().slice(0, 16) ?? "—"}</td>
                  <td>{j.contentType}</td>
                  <td>{j.anchorVilleSlug ?? "—"}</td>
                  <td>{j.qualityScore ?? "—"}</td>
                  <td>{j.seoScore ?? "—"}</td>
                  <td>{j.reviewQueue?.promotedToTier1At ? "tier-1" : "tier-2"}</td>
                  <td>
                    <a href={`/fr/${adminPrefix}/content-gen/jobs/${j.id}`}>
                      <code>{j.id.slice(0, 10)}…</code>
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
