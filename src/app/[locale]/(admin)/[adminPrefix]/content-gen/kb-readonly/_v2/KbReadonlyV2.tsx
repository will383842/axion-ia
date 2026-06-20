// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// KB read-only V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

interface Props {
  adminPrefix: string;
}

interface KbRow {
  id: string;
  slug: string;
  type: string;
  audience: string;
  updatedAt: Date;
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

  const columns: ReadonlyArray<AdminTableColumn<KbRow>> = [
    {
      key: "slug",
      header: "Slug",
      cell: (e) => (
        <Link
          href={`/fr/${adminPrefix}/content-gen/kb-readonly/${e.id}`}
          className="admin-link"
        >
          <code>{e.slug}</code>
        </Link>
      ),
    },
    { key: "type", header: "Type", cell: (e) => e.type },
    { key: "audience", header: "Audience", cell: (e) => e.audience },
    { key: "updatedAt", header: "Maj", cell: (e) => e.updatedAt.toISOString().slice(0, 10) },
  ];

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
        {recent.length === 0 ? (
          <AdminEmptyState title="Aucune entrée publiée." />
        ) : (
          <AdminTable
            columns={columns}
            rows={recent}
            getRowId={(e) => e.id}
            caption="25 dernières entrées KB publiées"
          />
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
