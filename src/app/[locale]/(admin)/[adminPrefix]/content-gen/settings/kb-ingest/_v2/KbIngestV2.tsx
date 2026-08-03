"use client";
// use-client: useActionState (formulaires interactifs + résultat d'ingestion affiché inline).

// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// KB ingest V2 — AdminPageShell + AdminPageHeader + AdminCard.
// B3 (CONTENT-GEN-UX-2026 §5-A/§5-E) : capture le résultat riche des actions
// (accepted / rejected / rejectReason) via useActionState au lieu de le jeter.

import { useActionState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import type {
  IngestSitemapResult,
  IngestUrlResult,
} from "@/server/actions/content-gen/kb-ingest-external";

export interface UrlIngestState {
  readonly status: "idle" | "ok" | "error";
  readonly result?: IngestUrlResult;
  readonly message?: string;
}

export interface SitemapIngestState {
  readonly status: "idle" | "ok" | "error";
  readonly result?: IngestSitemapResult;
  readonly message?: string;
}

const URL_INITIAL: UrlIngestState = { status: "idle" };
const SITEMAP_INITIAL: SitemapIngestState = { status: "idle" };

interface Props {
  readonly urlAction: (prev: UrlIngestState, formData: FormData) => Promise<UrlIngestState>;
  readonly sitemapAction: (
    prev: SitemapIngestState,
    formData: FormData,
  ) => Promise<SitemapIngestState>;
}

export function KbIngestV2({ urlAction, sitemapAction }: Props): React.ReactElement {
  const [urlState, urlFormAction, urlPending] = useActionState(urlAction, URL_INITIAL);
  const [sitemapState, sitemapFormAction, sitemapPending] = useActionState(
    sitemapAction,
    SITEMAP_INITIAL,
  );

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Ingestion base de connaissances"
        description="Ingère du contenu depuis des sources externes (articles concurrents, études, sitemaps d'autorité) dans la base de connaissances. L'extraction utilise un parseur léger. Quota par appel sitemap : 50 URLs max."
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form action={urlFormAction}>
          <h2 className="admin-h2">Ingérer une URL</h2>
          <p className="admin-meta-block">
            Récupère l&apos;URL, extrait <code>main / article</code>, retire nav/footer/script, et
            insère dans la base de connaissances comme <code>type=article</code>, tags{" "}
            <code>external + &lt;domain&gt;</code>. Rejet automatique si la page fait &lt; 100 mots.
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
            <button type="submit" className="admin-button" disabled={urlPending}>
              {urlPending ? "Ingestion en cours…" : "Lancer l'ingestion"}
            </button>
          </div>
        </form>

        {urlState.status === "error" && (
          <p style={{ color: "crimson", marginTop: "1rem" }}>{urlState.message}</p>
        )}

        {urlState.status === "ok" && urlState.result && (
          <div style={{ marginTop: "1rem" }}>
            {urlState.result.accepted ? (
              <p>
                <CheckCircle2 size={14} aria-hidden="true" className="inline align-[-2px]" />{" "}
                <strong>Acceptée</strong>
                {urlState.result.title ? <> — {urlState.result.title}</> : null}
                {typeof urlState.result.wordCount === "number" ? (
                  <> · {urlState.result.wordCount} mots</>
                ) : null}
              </p>
            ) : (
              <p style={{ color: "crimson" }}>
                <XCircle size={14} aria-hidden="true" className="inline align-[-2px]" />{" "}
                <strong>Rejetée</strong> — {urlState.result.rejectReason ?? urlState.result.status}
              </p>
            )}
          </div>
        )}
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form action={sitemapFormAction}>
          <h2 className="admin-h2">Ingérer un sitemap</h2>
          <p className="admin-meta-block">
            Analyse <code>sitemap.xml</code> (gère les sitemap-index récursifs) puis ingère les{" "}
            <em>premières URLs</em> selon la limite. Idéal pour migrer un ancien site ou importer en
            masse une source d&apos;autorité.
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
            <button type="submit" className="admin-button" disabled={sitemapPending}>
              {sitemapPending ? "Ingestion en cours…" : "Lancer l'ingestion par lot"}
            </button>
          </div>
        </form>

        {sitemapState.status === "error" && (
          <p style={{ color: "crimson", marginTop: "1rem" }}>{sitemapState.message}</p>
        )}

        {sitemapState.status === "ok" && sitemapState.result && (
          <div style={{ marginTop: "1rem" }}>
            <p>
              <CheckCircle2 size={14} aria-hidden="true" className="inline align-[-2px]" />{" "}
              <strong>{sitemapState.result.accepted}</strong> acceptée
              {sitemapState.result.accepted > 1 ? "s" : ""} ·{" "}
              <strong>{sitemapState.result.rejected}</strong> rejetée
              {sitemapState.result.rejected > 1 ? "s" : ""} ·{" "}
              <strong>{sitemapState.result.processed}</strong> traitée
              {sitemapState.result.processed > 1 ? "s" : ""} sur{" "}
              <strong>{sitemapState.result.totalUrls}</strong> URL
              {sitemapState.result.totalUrls > 1 ? "s" : ""} du sitemap
            </p>
            {sitemapState.result.errors.length > 0 && (
              <details open>
                <summary style={{ color: "crimson" }}>
                  Rejets ({sitemapState.result.errors.length})
                </summary>
                <ul>
                  {sitemapState.result.errors.map((e) => (
                    <li key={e.url} style={{ color: "crimson" }}>
                      {e.url} — {e.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Notes</h2>
        <ul className="admin-meta-block">
          <li>
            L&apos;ingestion tourne en <strong>premier plan</strong> (action serveur). Pour des lots
            &gt; 50, lancez plusieurs appels successifs avec différentes limites.
          </li>
          <li>
            Les entrées créées sortent en <code>tier-2-noindex-follow</code> par défaut
            (anti-doorway HCU). Promouvez-les en tier-1 manuellement via la file de validation après
            contrôle.
          </li>
          <li>
            <strong>Ne pas</strong> ingérer du contenu sous copyright sans autorisation.
            L&apos;ingestion stocke le texte brut — usage interne uniquement (génération RAG).
          </li>
        </ul>
      </AdminCard>
    </AdminPageShell>
  );
}
