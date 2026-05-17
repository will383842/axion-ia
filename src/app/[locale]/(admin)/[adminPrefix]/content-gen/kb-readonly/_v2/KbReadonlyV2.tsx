// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// KB read-only V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

interface Props {
  adminPrefix: string;
}

export async function KbReadonlyV2({ adminPrefix }: Props): Promise<React.ReactElement> {
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

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="KB · lecture seule"
        description={`${totalPublished} entrées publiées. Gestion via /connaissances/ (skill axionia-connaissances).`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Répartition par type</h2>
        <ul className="admin-inline-list">
          {byType.map((r) => (
            <li key={r.type}>
              <strong>{r.type}</strong> : {r._count._all}
            </li>
          ))}
        </ul>
      </AdminCard>

      <AdminCard variant="compact">
        <h2 className="admin-h2">25 dernières entrées publiées</h2>
        <div className="admin-table-wrapper">
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
                    <Link
                      href={`/fr/${adminPrefix}/content-gen/kb-readonly/${e.id}`}
                      className="admin-link"
                    >
                      <code>{e.slug}</code>
                    </Link>
                  </td>
                  <td>{e.type}</td>
                  <td>{e.audience}</td>
                  <td>{e.updatedAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
