/**
 * Content Generator — Publications history + actions (P0-9/10/11 fix).
 *
 * § 14 master prompt — liste des Articles publiés via content-gen + actions
 * inline (édit, demote tier-1, archive, rollback, delete) via formulaires
 * Server Actions. Fix audit opérationnel 2026-05-14.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  archiveArticle,
  demoteArticle,
  rollbackArticle,
  unarchiveArticle,
} from "@/server/actions/content-gen/article";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ status?: string; tier?: string }>;
}

export default async function PublicationsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const where: {
    generatedByJobId?: { not: null };
    status?: "published" | "draft" | "archived";
    indexationTier?: "tier_1_indexable" | "tier_2_noindex_follow" | "tier_3_noindex_nofollow";
  } = {
    generatedByJobId: { not: null },
  };
  if (sp.status === "published" || sp.status === "draft" || sp.status === "archived") {
    where.status = sp.status;
  } else {
    where.status = "published";
  }
  if (
    sp.tier === "tier_1_indexable" ||
    sp.tier === "tier_2_noindex_follow" ||
    sp.tier === "tier_3_noindex_nofollow"
  ) {
    where.indexationTier = sp.tier;
  }

  const recent = await prisma.article.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: 100,
    include: {
      translations: { where: { locale: "fr" }, take: 1, select: { title: true, slug: true } },
    },
  });

  const base = `/fr/${adminPrefix}/content-gen/publications`;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Publications</h1>
          <p className="admin-meta">
            {recent.length} article{recent.length > 1 ? "s" : ""} content-gen ·{" "}
            {(where.status ?? "published") as string}
            {where.indexationTier ? ` · ${where.indexationTier}` : ""}
          </p>
        </div>
      </div>

      <form className="admin-card admin-filters">
        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="status" className="admin-label">
              Statut
            </label>
            <select
              id="status"
              name="status"
              defaultValue={sp.status ?? "published"}
              className="admin-input"
            >
              <option value="published">Publié</option>
              <option value="draft">Draft (rollback)</option>
              <option value="archived">Archivé</option>
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="tier" className="admin-label">
              Tier
            </label>
            <select id="tier" name="tier" defaultValue={sp.tier ?? ""} className="admin-input">
              <option value="">Tous</option>
              <option value="tier_1_indexable">tier-1 indexable</option>
              <option value="tier_2_noindex_follow">tier-2 noindex</option>
              <option value="tier_3_noindex_nofollow">tier-3 nofollow</option>
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
              <th>Publié le</th>
              <th>Titre</th>
              <th>Tier</th>
              <th>Quality</th>
              <th>SEO</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={6}>Aucune publication.</td>
              </tr>
            ) : (
              recent.map((a) => {
                const t = a.translations[0];
                return (
                  <tr key={a.id}>
                    <td>{a.publishedAt?.toISOString().slice(0, 16) ?? "—"}</td>
                    <td>
                      {t ? (
                        <>
                          <a href={`${base}/${a.id}/edit`}>{t.title.slice(0, 70)}</a>
                          <br />
                          <code style={{ fontSize: 11 }}>{t.slug}</code>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{a.indexationTier.replace(/^tier_/, "tier-").replace(/_.*$/, "")}</td>
                    <td>{a.qualityScore ?? "—"}</td>
                    <td>{a.seoScore ?? "—"}</td>
                    <td>
                      <ActionsCell
                        articleId={a.id}
                        status={a.status}
                        tier={a.indexationTier}
                        adminPrefix={adminPrefix}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionsCell({
  articleId,
  status,
  tier,
  adminPrefix,
}: {
  readonly articleId: string;
  readonly status: "draft" | "published" | "archived";
  readonly tier: "tier_1_indexable" | "tier_2_noindex_follow" | "tier_3_noindex_nofollow";
  readonly adminPrefix: string;
}) {
  async function doDemote() {
    "use server";
    await demoteArticle(articleId);
  }
  async function doArchive() {
    "use server";
    await archiveArticle(articleId);
  }
  async function doUnarchive() {
    "use server";
    await unarchiveArticle(articleId);
  }
  async function doRollback() {
    "use server";
    await rollbackArticle(articleId);
  }
  // Delete = page dédiée /publications/[id]/edit avec confirmation explicite
  // (anti-clic accidentel sur table list).

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      <a
        href={`/fr/${adminPrefix}/content-gen/publications/${articleId}/edit`}
        className="admin-button-ghost"
        style={{ fontSize: 11, padding: "2px 6px" }}
      >
        Éditer
      </a>
      {status === "published" && tier === "tier_1_indexable" ? (
        <form action={doDemote}>
          <button
            type="submit"
            className="admin-button-ghost"
            style={{ fontSize: 11, padding: "2px 6px" }}
          >
            Demote tier-2
          </button>
        </form>
      ) : null}
      {status === "published" ? (
        <form action={doArchive}>
          <button
            type="submit"
            className="admin-button-ghost"
            style={{ fontSize: 11, padding: "2px 6px" }}
          >
            Archive
          </button>
        </form>
      ) : null}
      {status === "archived" ? (
        <form action={doUnarchive}>
          <button
            type="submit"
            className="admin-button"
            style={{ fontSize: 11, padding: "2px 6px" }}
          >
            Restaurer
          </button>
        </form>
      ) : null}
      {status === "published" ? (
        <form action={doRollback}>
          <button
            type="submit"
            className="admin-button-ghost"
            style={{ fontSize: 11, padding: "2px 6px" }}
          >
            Rollback
          </button>
        </form>
      ) : null}
    </div>
  );
}
