/**
 * Content Generator — Templates list (§ 12.1).
 *
 * Affiche tous les ContentTemplate (9 ContentType × N variantes). Filtre par
 * contentType + isActive. Toggle on/off inline.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listTemplates, toggleTemplate } from "@/server/actions/content-gen/templates";
import type { ContentType } from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const CONTENT_TYPES: ReadonlyArray<ContentType> = [
  "landing_ville",
  "blog_article",
  "blog_from_title",
  "blog_from_keywords",
  "blog_from_rss",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
] satisfies ReadonlyArray<ContentType>;

export default async function TemplatesListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const rows = await listTemplates({
    ...(sp.contentType ? { contentType: sp.contentType as ContentType } : {}),
    ...(sp.isActive === "true"
      ? { isActive: true }
      : sp.isActive === "false"
        ? { isActive: false }
        : {}),
  });

  const base = `/fr/${adminPrefix}/content-gen/templates`;

  async function toggle(formData: FormData) {
    "use server";
    await toggleTemplate(String(formData.get("id")), formData.get("isActive") === "true");
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Templates de prompts</h1>
          <p className="admin-meta">
            {rows.length} template{rows.length > 1 ? "s" : ""}
          </p>
        </div>
        <a href={`${base}/new`} className="admin-button">
          + Nouveau template
        </a>
      </div>

      <form className="admin-card admin-filters">
        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="contentType" className="admin-label">
              Type
            </label>
            <select
              id="contentType"
              name="contentType"
              defaultValue={sp.contentType ?? ""}
              className="admin-input"
            >
              <option value="">Tous</option>
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="isActive" className="admin-label">
              Actif
            </label>
            <select
              id="isActive"
              name="isActive"
              defaultValue={sp.isActive ?? ""}
              className="admin-input"
            >
              <option value="">Tous</option>
              <option value="true">Actif</option>
              <option value="false">Inactif</option>
            </select>
          </div>
        </div>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Filtrer
          </button>
          <a href={base} className="admin-button-ghost">
            Réinitialiser
          </a>
        </div>
      </form>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Slug</th>
              <th>Variant</th>
              <th>Version</th>
              <th>Gen/Pub/Failed</th>
              <th>Modèle</th>
              <th>Actif</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8}>Aucun template — créez-en un.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.contentType}</td>
                  <td>
                    <a href={`${base}/${r.id}`}>
                      <code>{r.slug}</code>
                    </a>
                  </td>
                  <td>{r.variant ?? "—"}</td>
                  <td>v{r.version}</td>
                  <td>
                    {r.generatedItems} / {r.publishedItems} / {r.failedItems}
                  </td>
                  <td>{r.defaultModel ?? "—"}</td>
                  <td>{r.isActive ? "✅" : "🚫"}</td>
                  <td>
                    <a href={`${base}/${r.id}`} className="admin-button-ghost">
                      Éditer
                    </a>{" "}
                    <form action={toggle} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="isActive" value={r.isActive ? "false" : "true"} />
                      <button type="submit" className="admin-button-ghost">
                        {r.isActive ? "Désactiver" : "Activer"}
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
