// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
// Sprint v7 post-audit FIX (F2) — migration UI legacy `rss.ts` (ContentGenConfig
// JSON, keyed by URL) → `rss-sources.ts` (Prisma `rss_sources`, keyed by id).
// Voir audit A22 frontend-backend-wiring.
//
// RSS list V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Server Actions toggleRssSourceInDb + removeRssSourceFromDb (Prisma-backed).

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import {
  listRssSourcesFromDb,
  removeRssSourceFromDb,
  toggleRssSourceInDb,
} from "@/server/actions/content-gen/rss-sources";

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

      <AdminCard variant="compact">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>URL</th>
                <th>Tags</th>
                <th>Poll (min)</th>
                <th>Auto-pub</th>
                <th>Actif</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    Aucune source RSS configurée.
                  </td>
                </tr>
              ) : (
                sources.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>
                      <a href={s.url} target="_blank" rel="noopener" className="admin-link">
                        <code>{s.url.slice(0, 60)}</code>
                      </a>
                    </td>
                    <td>{s.tags.join(", ")}</td>
                    <td>{s.pollIntervalMin}</td>
                    <td>{s.autoPublish ? "✅" : "—"}</td>
                    <td>{s.enabled ? "✅" : "🚫"}</td>
                    <td className="flex gap-[var(--space-admin-2)]">
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
                        <button
                          type="submit"
                          className="admin-button-ghost text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-destructive)]"
                        >
                          Retirer
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
