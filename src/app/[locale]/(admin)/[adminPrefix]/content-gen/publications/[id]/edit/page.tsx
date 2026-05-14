/**
 * Content Generator — Édition Article publié (Fix P0-9 audit opérationnel 2026-05-14).
 *
 * § 14 master prompt + M1/P6 audit. Permet à Will d'éditer un Article publié
 * sans devoir dégommer + régénérer : titre, slug, body HTML, meta. Sanitize
 * DOMPurify côté Server Action. Ping IndexNow si tier-1.
 *
 * Inclut aussi le bouton "Supprimer définitivement" avec double confirmation
 * (champ texte `DELETE` à taper).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  deleteArticle,
  getArticleDetail,
  updateArticle,
} from "@/server/actions/content-gen/article";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function ArticleEditPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const article = await getArticleDetail(id);
  if (!article) notFound();
  const t = article.translation;
  if (!t) notFound();

  async function save(formData: FormData) {
    "use server";
    const slug = String(formData.get("slug") ?? "").trim();
    const excerpt = String(formData.get("excerpt") ?? "").trim();
    const metaTitle = String(formData.get("metaTitle") ?? "").trim();
    const metaDescription = String(formData.get("metaDescription") ?? "").trim();
    await updateArticle({
      articleId: id,
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      ...(slug ? { slug } : {}),
      ...(excerpt ? { excerpt } : {}),
      ...(metaTitle ? { metaTitle } : {}),
      ...(metaDescription ? { metaDescription } : {}),
    });
  }

  async function destroy(formData: FormData) {
    "use server";
    const confirmation = String(formData.get("confirmation") ?? "");
    await deleteArticle(id, confirmation);
    redirect(`/fr/${adminPrefix}/content-gen/publications`);
  }

  const base = `/fr/${adminPrefix}/content-gen`;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Édition · {t.title}</h1>
          <p className="admin-meta">
            <code>{article.id}</code> · {article.indexationTier} · {article.status} · score{" "}
            {article.qualityScore ?? "—"}/{article.seoScore ?? "—"}
          </p>
        </div>
        <div className="admin-dashboard-actions">
          <a
            href={article.isNews ? `/fr/actualites/${t.slug}` : `/fr/blog/${t.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-button-ghost"
          >
            👁️ Voir la page publique
          </a>
          <a href={`${base}/publications`} className="admin-button-ghost">
            ← Retour publications
          </a>
        </div>
      </div>

      <form action={save} className="admin-card">
        <div className="admin-field">
          <label htmlFor="title" className="admin-label">
            Titre
          </label>
          <input
            id="title"
            name="title"
            defaultValue={t.title}
            required
            minLength={3}
            maxLength={255}
            className="admin-input"
          />
        </div>

        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="slug" className="admin-label">
              Slug (URL)
            </label>
            <input
              id="slug"
              name="slug"
              defaultValue={t.slug}
              className="admin-input"
              placeholder="laisser vide pour conserver"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="metaTitle" className="admin-label">
              Meta title (≤ 70)
            </label>
            <input
              id="metaTitle"
              name="metaTitle"
              defaultValue={t.metaTitle ?? ""}
              maxLength={70}
              className="admin-input"
            />
          </div>
        </div>

        <div className="admin-field">
          <label htmlFor="excerpt" className="admin-label">
            Excerpt (résumé carte / liste)
          </label>
          <textarea
            id="excerpt"
            name="excerpt"
            rows={3}
            defaultValue={t.excerpt ?? ""}
            className="admin-input"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="metaDescription" className="admin-label">
            Meta description (≤ 160)
          </label>
          <textarea
            id="metaDescription"
            name="metaDescription"
            rows={2}
            defaultValue={t.metaDescription ?? ""}
            maxLength={160}
            className="admin-input"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="body" className="admin-label">
            Body HTML (DOMPurify côté serveur)
          </label>
          <textarea
            id="body"
            name="body"
            rows={20}
            defaultValue={t.body}
            required
            minLength={50}
            className="admin-input"
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
          />
        </div>

        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Enregistrer + revalidate + IndexNow ping (si tier-1)
          </button>
        </div>
      </form>

      <div className="admin-card" style={{ borderColor: "var(--color-terracotta)", marginTop: 24 }}>
        <h2>Suppression définitive</h2>
        <p>
          Cette opération supprime l&apos;article et sa traduction de la base. La row{" "}
          <code>ContentGenJob</code> reste pour l&apos;audit trail (RGPD article 30). Les FAQ
          enfantes voient leur <code>parentArticleId</code> mis à null (préservées).
        </p>
        <form action={destroy} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            name="confirmation"
            placeholder="Taper DELETE pour confirmer"
            className="admin-input"
            required
            pattern="DELETE"
            style={{ flex: 1, maxWidth: 280 }}
          />
          <button
            type="submit"
            className="admin-button"
            style={{ background: "var(--color-terracotta)", color: "var(--color-paper)" }}
          >
            🗑️ Supprimer définitivement
          </button>
        </form>
      </div>
    </section>
  );
}
