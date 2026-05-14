/**
 * Content Generator — RSS sources list (§ 28 v1.7).
 *
 * V1 (Sprint 3) = squelette. Les modèles `RssSource` + `RssItem` arrivent
 * Sprint 4 (pipeline 2 actualités). Pour l'instant on lit `ContentGenConfig`
 * key="rss_sources" comme stockage temporaire.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
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

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Sources RSS</h1>
          <p className="admin-meta">
            {sources.length} source{sources.length > 1 ? "s" : ""} · Pipeline 2 actualités (Sprint 4
            : workers BullMQ).
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
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 ? (
              <tr>
                <td colSpan={6}>Aucune source RSS configurée.</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
