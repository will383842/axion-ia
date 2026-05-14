/**
 * Content Generator — RSS sources list (§ 28 v1.7).
 *
 * V1 (Sprint 3) = squelette. Les modèles `RssSource` + `RssItem` arrivent
 * Sprint 4 (pipeline 2 actualités). Pour l'instant on lit `ContentGenConfig`
 * key="rss_sources" comme stockage temporaire.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { removeRssSource, toggleRssSource } from "@/server/actions/content-gen/rss";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

interface RssSource {
  readonly url: string;
  readonly name: string;
  readonly tags: ReadonlyArray<string>;
  readonly pollIntervalMin: number;
  readonly autoPublish: boolean;
  readonly enabled: boolean;
}

export default async function RssListPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Sources RSS</h1>
          <p className="admin-meta">
            {sources.length} source{sources.length > 1 ? "s" : ""} · Pipeline 2 actualités · poll
            via cron `content-rss-fetch` toutes les heures.
          </p>
        </div>
        <a href={`/fr/${adminPrefix}/content-gen/rss/new`} className="admin-button">
          + Ajouter source
        </a>
      </div>

      <div className="admin-card admin-table-wrapper">
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
                <td colSpan={7}>Aucune source RSS configurée.</td>
              </tr>
            ) : (
              sources.map((s) => (
                <tr key={s.url}>
                  <td>{s.name}</td>
                  <td>
                    <a href={s.url} target="_blank" rel="noopener">
                      <code>{s.url.slice(0, 60)}</code>
                    </a>
                  </td>
                  <td>{s.tags.join(", ")}</td>
                  <td>{s.pollIntervalMin}</td>
                  <td>{s.autoPublish ? "✅" : "—"}</td>
                  <td>{s.enabled ? "✅" : "🚫"}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <form action={doToggle}>
                      <input type="hidden" name="url" value={s.url} />
                      <input type="hidden" name="enabled" value={(!s.enabled).toString()} />
                      <button
                        type="submit"
                        className="admin-button-ghost"
                        style={{ fontSize: 11, padding: "2px 6px" }}
                      >
                        {s.enabled ? "Désactiver" : "Activer"}
                      </button>
                    </form>
                    <a
                      href={`/fr/${adminPrefix}/content-gen/rss/${encodeURIComponent(s.url)}`}
                      className="admin-button-ghost"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                    >
                      Éditer
                    </a>
                    <form action={doRemove}>
                      <input type="hidden" name="url" value={s.url} />
                      <button
                        type="submit"
                        className="admin-button-ghost"
                        style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          color: "var(--color-terracotta)",
                        }}
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
    </section>
  );
}
