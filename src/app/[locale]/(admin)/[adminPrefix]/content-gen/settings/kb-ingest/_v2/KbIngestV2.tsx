// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// KB ingest V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import {
  ingestKbFromSitemap,
  ingestKbFromUrl,
} from "@/server/actions/content-gen/kb-ingest-external";

export function KbIngestV2(): React.ReactElement {
  async function submitUrl(formData: FormData) {
    "use server";
    const url = String(formData.get("url") ?? "");
    await ingestKbFromUrl(url);
  }

  async function submitSitemap(formData: FormData) {
    "use server";
    const sitemapUrl = String(formData.get("sitemapUrl") ?? "");
    const limit = Number(formData.get("limit") ?? 10);
    await ingestKbFromSitemap(sitemapUrl, limit);
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="KB ingest externe"
        description="Ingère du contenu depuis des sources externes (articles concurrents, études, sitemaps d'autorité) dans la Knowledge Base. L'extraction utilise un parseur léger. Quota par appel sitemap : 50 URLs max."
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form action={submitUrl}>
          <h2 className="admin-h2">Ingest une URL</h2>
          <p className="admin-meta-block">
            Fetch l&apos;URL, extrait <code>main / article</code>, strip nav/footer/script, et
            insère dans la KB comme <code>type=article</code>, tags{" "}
            <code>external + &lt;domain&gt;</code>. Rejet auto si page &lt; 100 mots.
          </p>

          <div className="admin-field">
            <label htmlFor="url" className="admin-label">
              URL à ingérer
            </label>
            <input
              id="url"
              name="url"
              type="url"
              placeholder="https://exemple.com/article-interessant"
              className="admin-input"
              required
            />
          </div>

          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Lancer l&apos;ingest
            </button>
          </div>
        </form>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form action={submitSitemap}>
          <h2 className="admin-h2">Ingest un sitemap</h2>
          <p className="admin-meta-block">
            Parse <code>sitemap.xml</code> (supporte sitemap-index récursif) puis ingère les{" "}
            <em>limit</em> premières URLs. Idéal pour migration d&apos;un ancien site ou import en
            masse d&apos;une source d&apos;autorité.
          </p>

          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="sitemapUrl" className="admin-label">
                URL du sitemap
              </label>
              <input
                id="sitemapUrl"
                name="sitemapUrl"
                type="url"
                placeholder="https://exemple.com/sitemap.xml"
                className="admin-input"
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="limit" className="admin-label">
                Limite URLs (1-50)
              </label>
              <input
                id="limit"
                name="limit"
                type="number"
                min="1"
                max="50"
                defaultValue={10}
                className="admin-input"
                required
              />
            </div>
          </div>

          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Lancer l&apos;ingest batch
            </button>
          </div>
        </form>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Notes</h2>
        <ul className="admin-meta-block">
          <li>
            L&apos;ingest tourne en <strong>foreground</strong> (action server). Pour des batchs
            &gt; 50, lance plusieurs appels successifs avec différentes limites.
          </li>
          <li>
            Les entrées créées sortent en <code>tier-2-noindex-follow</code> par défaut
            (anti-doorway HCU). Promote tier-1 manuellement via review queue après contrôle.
          </li>
          <li>
            <strong>Ne pas</strong> ingérer du contenu sous copyright sans autorisation.
            L&apos;ingest stocke le bodyText brut — usage interne uniquement (RAG generation).
          </li>
        </ul>
      </AdminCard>
    </AdminPageShell>
  );
}
