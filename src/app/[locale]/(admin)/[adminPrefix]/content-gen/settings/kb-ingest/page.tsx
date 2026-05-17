/**
 * Content Generator — KB ingest externe (Sprint 11.5 V2).
 *
 * UI admin pour ingérer du contenu externe dans la KB :
 *   - 1 URL → 1 entrée KB (article tier)
 *   - 1 sitemap.xml → batch 50 URLs max
 *
 * Use cases :
 *   - Veille concurrentielle (URLs de blogs concurrents)
 *   - Études d'autorité (rapports publics)
 *   - Migration depuis ancien site (sitemap.xml)
 *
 * Sécurité : RequireAdmin sur les actions server. Quota 50 URLs/sitemap par appel.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  ingestKbFromSitemap,
  ingestKbFromUrl,
} from "@/server/actions/content-gen/kb-ingest-external";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { KbIngestV2 } from "./_v2/KbIngestV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function KbIngestExternalPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <KbIngestV2 />;
  }

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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">KB ingest externe</h1>
          <p className="admin-meta">
            Ingère du contenu depuis des sources externes (articles concurrents, études, sitemaps
            d&apos;autorité) dans la Knowledge Base. L&apos;extraction utilise un parseur léger (pas
            de Readability + jsdom). Quota par appel sitemap : 50 URLs max.
          </p>
        </div>
      </div>

      <form action={submitUrl} className="admin-card">
        <h2 className="admin-h2">Ingest une URL</h2>
        <p className="admin-meta" style={{ marginBottom: "1rem" }}>
          Fetch l&apos;URL, extrait <code>main / article</code>, strip nav/footer/script, et insère
          dans la KB comme <code>type=article</code>, tags <code>external + &lt;domain&gt;</code>.
          Rejet auto si page &lt; 100 mots.
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

      <form action={submitSitemap} className="admin-card" style={{ marginTop: "1.5rem" }}>
        <h2 className="admin-h2">Ingest un sitemap</h2>
        <p className="admin-meta" style={{ marginBottom: "1rem" }}>
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

      <div className="admin-card admin-meta" style={{ marginTop: "1.5rem" }}>
        <h3>Notes</h3>
        <ul>
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
      </div>
    </section>
  );
}
