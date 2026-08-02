// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
// Sprint v7 post-audit FIX (F2) — migration UI legacy `rss.ts` (ContentGenConfig
// JSON, keyed by URL) → `rss-sources.ts` (Prisma `rss_sources`, keyed by id).
// Voir audit A22 frontend-backend-wiring.
//
// RSS list V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Server Actions toggleRssSourceInDb + removeRssSourceFromDb (Prisma-backed).
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// statut Actif → <AdminBadge>.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import {
  listRssSourcesFromDb,
  removeRssSourceFromDb,
  toggleRssSourceInDb,
} from "@/server/actions/content-gen/rss-sources";

type RssSourceRow = Awaited<ReturnType<typeof listRssSourcesFromDb>>[number];

interface Props {
  adminPrefix: string;
}

export async function RssListV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const sources = await listRssSourcesFromDb();

  async function doToggle(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const enabled = formData.get("enabled") === "true";
    await toggleRssSourceInDb(id, enabled);
  }

  async function doRemove(formData: FormData) {
    "use server";
    await removeRssSourceFromDb(String(formData.get("id") ?? ""));
  }

  const columns: ReadonlyArray<AdminTableColumn<RssSourceRow>> = [
    { key: "name", header: "Nom", cell: (s) => s.name },
    {
      key: "url",
      header: "URL",
      cell: (s) => (
        <a href={s.url} target="_blank" rel="noopener" className="admin-link">
          <code>{s.url.slice(0, 60)}</code>
        </a>
      ),
    },
    { key: "tags", header: "Tags", cell: (s) => s.tags.join(", ") },
    { key: "poll", header: "Poll (min)", cell: (s) => s.pollIntervalMin },
    { key: "autoPublish", header: "Auto-pub", cell: (s) => (s.autoPublish ? "✅" : "—") },
    {
      key: "enabled",
      header: "Actif",
      cell: (s) => (
        <AdminBadge tone={s.enabled ? "success" : "neutral"}>{s.enabled ? "✅" : "🚫"}</AdminBadge>
      ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Sources RSS"
        description={`${sources.length} source${sources.length > 1 ? "s" : ""} · Pipeline 2 actualités · poll via cron \`content-rss-fetch\` toutes les heures.`}
        actions={
          <div className="flex gap-[var(--space-admin-2)]">
            <Link href={`/fr/${adminPrefix}/content-gen/rss/import`} className="admin-button-ghost">
              ⇪ Import en masse
            </Link>
            <Link href={`/fr/${adminPrefix}/content-gen/rss/new`} className="admin-button">
              + Ajouter source
            </Link>
          </div>
        }
      />

      {sources.length === 0 ? (
        <AdminEmptyState title="Aucune source RSS configurée." />
      ) : (
        <AdminTable
          columns={columns}
          rows={sources}
          getRowId={(s) => s.id}
          caption="Liste des sources RSS"
          rowAction={(s) => (
            <div className="flex gap-[var(--space-admin-2)]">
              <form action={doToggle}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="enabled" value={(!s.enabled).toString()} />
                <button
                  type="submit"
                  className="admin-button-ghost text-[length:var(--text-admin-xs)]"
                >
                  {s.enabled ? "Désactiver" : "Activer"}
                </button>
              </form>
              <Link
                href={`/fr/${adminPrefix}/content-gen/rss/${s.id}`}
                className="admin-button-ghost text-[length:var(--text-admin-xs)]"
              >
                Éditer
              </Link>
              <form action={doRemove}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className="admin-button-ghost admin-button-ghost-danger">
                  Retirer
                </button>
              </form>
            </div>
          )}
        />
      )}
    </AdminPageShell>
  );
}
