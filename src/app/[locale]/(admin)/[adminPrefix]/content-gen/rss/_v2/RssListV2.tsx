// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// RSS list V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Server Actions toggleRssSource + removeRssSource préservées.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { removeRssSource, toggleRssSource } from "@/server/actions/content-gen/rss";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";

interface RssSource {
  readonly url: string;
  readonly name: string;
  readonly tags: ReadonlyArray<string>;
  readonly pollIntervalMin: number;
  readonly autoPublish: boolean;
  readonly enabled: boolean;
}

interface Props {
  adminPrefix: string;
}

export async function RssListV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const sources = await readContentGenConfig<ReadonlyArray<RssSource>>("rss_sources", []);

  async function doToggle(formData: FormData) {
    "use server";
    const url = String(formData.get("url") ?? "");
    const enabled = formData.get("enabled") === "true";
    await toggleRssSource(url, enabled);
  }

  async function doRemove(formData: FormData) {
    "use server";
    await removeRssSource(String(formData.get("url") ?? ""));
  }

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Sources RSS"
        description={`${sources.length} source${sources.length > 1 ? "s" : ""} · Pipeline 2 actualités · poll via cron \`content-rss-fetch\` toutes les heures.`}
        actions={
          <Link href={`/fr/${adminPrefix}/content-gen/rss/new`} className="admin-button">
            + Ajouter source
          </Link>
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
                  <tr key={s.url}>
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
                        <input type="hidden" name="url" value={s.url} />
                        <input type="hidden" name="enabled" value={(!s.enabled).toString()} />
                        <button
                          type="submit"
                          className="admin-button-ghost text-[length:var(--text-admin-xs)]"
                        >
                          {s.enabled ? "Désactiver" : "Activer"}
                        </button>
                      </form>
                      <Link
                        href={`/fr/${adminPrefix}/content-gen/rss/${encodeURIComponent(s.url)}`}
                        className="admin-button-ghost text-[length:var(--text-admin-xs)]"
                      >
                        Éditer
                      </Link>
                      <form action={doRemove}>
                        <input type="hidden" name="url" value={s.url} />
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
