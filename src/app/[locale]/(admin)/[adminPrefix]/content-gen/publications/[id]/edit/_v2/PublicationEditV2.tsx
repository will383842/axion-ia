// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Publication edit V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Server Actions save + destroy préservées (updateArticle + deleteArticle).

import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { deleteArticle, updateArticle } from "@/server/actions/content-gen/article";

interface ArticleData {
  id: string;
  indexationTier: string;
  status: string;
  qualityScore: number | null;
  seoScore: number | null;
  isNews: boolean;
  translation: {
    title: string;
    slug: string;
    excerpt: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    body: string;
  };
}

interface Props {
  adminPrefix: string;
  article: ArticleData;
}

export function PublicationEditV2({ adminPrefix, article }: Props): React.ReactElement {
  const id = article.id;
  const t = article.translation;

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
    <AdminPageShell>
      <AdminPageHeader
        title={`Édition · ${t.title}`}
        description={`${id} · ${article.indexationTier} · ${article.status} · score ${article.qualityScore ?? "—"}/${article.seoScore ?? "—"}`}
        actions={
          <div className="flex gap-[var(--space-admin-3)]">
            <a
              href={article.isNews ? `/fr/actualites/${t.slug}` : `/fr/blog/${t.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-button-ghost"
            >
              👁️ Voir la page publique
            </a>
            <Link href={`${base}/publications`} className="admin-button-ghost">
              ← Retour publications
            </Link>
          </div>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form action={save}>
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
              className="admin-input font-mono text-[length:var(--text-admin-sm)]"
            />
          </div>

          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Enregistrer + revalidate + IndexNow ping (si tier-1)
            </button>
          </div>
        </form>
      </AdminCard>

      <AdminCard className="border-l-4 border-l-[color:var(--color-admin-destructive)]">
        <h2 className="admin-h2">Suppression définitive</h2>
        <p className="admin-meta-block">
          Cette opération supprime l&apos;article et sa traduction de la base. La row{" "}
          <code>ContentGenJob</code> reste pour l&apos;audit trail (RGPD article 30). Les FAQ
          enfantes voient leur <code>parentArticleId</code> mis à null (préservées).
        </p>
        <form action={destroy} className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
          <input
            type="text"
            name="confirmation"
            placeholder="Taper DELETE pour confirmer"
            className="admin-input max-w-[280px] flex-1"
            required
            pattern="DELETE"
          />
          <button
            type="submit"
            className="admin-button bg-[color:var(--color-admin-destructive)] text-[color:var(--color-admin-paper)]"
          >
            🗑️ Supprimer définitivement
          </button>
        </form>
      </AdminCard>
    </AdminPageShell>
  );
}
