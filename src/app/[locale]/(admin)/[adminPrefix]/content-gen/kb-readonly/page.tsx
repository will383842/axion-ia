/**
 * Content Generator — KB read-only view (§ 11).
 *
 * VIEW-ONLY STRICT. La KB est gérée via le skill `axionia-connaissances` /
 * `/connaissances/`. Ici on liste juste les entrées avec leurs métadonnées
 * pour vérifier la santé KB avant lancement campagne.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { KbReadonlyV2 } from "./_v2/KbReadonlyV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function KbReadonlyPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <KbReadonlyV2 adminPrefix={adminPrefix} />;
  }

  const [totalPublished, byType, recent] = await Promise.all([
    prisma.knowledgeEntry.count({ where: { status: "published" } }),
    prisma.knowledgeEntry.groupBy({
      by: ["type"],
      _count: { _all: true },
      where: { status: "published" },
    }),
    prisma.knowledgeEntry.findMany({
      where: { status: "published" },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, slug: true, type: true, audience: true, updatedAt: true },
    }),
  ]);
  // Note: titre humain visible via translation FR ; sur la liste on garde le slug
  // pour éviter une N+1 query (chaque entry a 1+ translations). Drill-down dans
  // /kb-readonly/[id] charge la translation.

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">KB · lecture seule</h1>
          <p className="admin-meta">
            {totalPublished} entrées publiées. Gestion via{" "}
            <a href={`/fr/${adminPrefix}/connaissances`}>/connaissances/</a> (skill
            axionia-connaissances).
          </p>
        </div>
      </div>

      <div className="admin-card">
        <h2>Répartition par type</h2>
        <ul className="admin-inline-list">
          {byType.map((r) => (
            <li key={r.type}>
              <strong>{r.type}</strong> : {r._count._all}
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-card admin-table-wrapper">
        <h2>25 dernières entrées publiées</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Type</th>
              <th>Audience</th>
              <th>Maj</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((e) => (
              <tr key={e.id}>
                <td>
                  <a href={`/fr/${adminPrefix}/content-gen/kb-readonly/${e.id}`}>
                    <code>{e.slug}</code>
                  </a>
                </td>
                <td>{e.type}</td>
                <td>{e.audience}</td>
                <td>{e.updatedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
