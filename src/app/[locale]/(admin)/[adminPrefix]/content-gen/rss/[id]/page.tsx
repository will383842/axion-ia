/**
 * Content Generator — RSS source detail.
 *
 * V1 minimal : trouve par URL (segment route = url encodé). Items récents
 * arrivent Sprint 4 avec table RssItem.
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { listRssSources, removeRssSource } from "@/server/actions/content-gen/rss";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function RssDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const url = decodeURIComponent(id);
  const sources = await listRssSources();
  const source = sources.find((s) => s.url === url);
  if (!source) notFound();

  async function remove() {
    "use server";
    await removeRssSource(url);
    redirect(`/fr/${adminPrefix}/content-gen/rss`);
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">{source.name}</h1>
          <p className="admin-meta">
            <a href={source.url} target="_blank" rel="noopener">
              <code>{source.url}</code>
            </a>
          </p>
        </div>
        <form action={remove}>
          <button type="submit" className="admin-button-ghost">
            Supprimer
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2>Configuration</h2>
        <ul className="admin-inline-list">
          <li>Intervalle : {source.pollIntervalMin} min</li>
          <li>Tags : {source.tags.join(", ") || "—"}</li>
          <li>Auto-publish : {source.autoPublish ? "✅" : "🚫"}</li>
          <li>Actif : {source.enabled ? "✅" : "🚫"}</li>
        </ul>
      </div>

      <div className="admin-card">
        <h2>Items récents</h2>
        <p>Pipeline 2 RSS (table RssItem) arrive Sprint 4.</p>
      </div>
    </section>
  );
}
