// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
// Sprint v7 post-audit FIX (F2) — migration UI legacy `rss.ts` (ContentGenConfig
// JSON, keyed by URL) → `rss-sources.ts` (Prisma `rss_sources`, keyed by id).
//
// RSS detail V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { redirect } from "next/navigation";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { removeRssSourceFromDb, type RssSourceRow } from "@/server/actions/content-gen/rss-sources";

interface Props {
  adminPrefix: string;
  source: RssSourceRow;
}

export function RssDetailV2({ adminPrefix, source }: Props): React.ReactElement {
  const id = source.id;

  async function remove() {
    "use server";
    await removeRssSourceFromDb(id);
    redirect(`/fr/${adminPrefix}/content-gen/rss`);
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={source.name}
        description={source.url}
        actions={
          <form action={remove}>
            <button type="submit" className="admin-button-ghost">
              Supprimer
            </button>
          </form>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Configuration</h2>
        <ul className="admin-inline-list">
          <li>Intervalle : {source.pollIntervalMin} min</li>
          <li>Tags : {source.tags.join(", ") || "—"}</li>
          <li>Verticale : {source.verticale ?? "—"}</li>
          <li>Langue : {source.language}</li>
          <li>Auto-publish : {source.autoPublish ? "✅" : "🚫"}</li>
          <li>Actif : {source.enabled ? "✅" : "🚫"}</li>
          <li>Échecs consécutifs : {source.failureCount}</li>
        </ul>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Items récents</h2>
        <p className="admin-meta-block">Pipeline 2 RSS (table RssItem) arrive Sprint 4.</p>
      </AdminCard>
    </AdminPageShell>
  );
}
