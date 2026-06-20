// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Publications list V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Server Actions archive/demote/rollback/unarchive préservées.
// SP-04 P0-9 — pagination prev/next + indicateur Page X / Y.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { resolveArticleRoute } from "@/server/content-gen/blog/resolve-article-route";
import {
  archiveArticle,
  demoteArticle,
  rollbackArticle,
  unarchiveArticle,
} from "@/server/actions/content-gen/article";

const PAGE_SIZE = 100;

interface Props {
  adminPrefix: string;
  searchParams: { status?: string; tier?: string; page?: string };
}

export async function PublicationsV2({
  adminPrefix,
  searchParams: sp,
}: Props): Promise<React.ReactElement> {
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

  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const [total, recent] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        translations: { where: { locale: "fr" }, take: 1, select: { title: true, slug: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = `/fr/${adminPrefix}/content-gen/publications`;

  function pageUrl(p: number): string {
    const params = new URLSearchParams();
    if (sp.status) params.set("status", sp.status);
    if (sp.tier) params.set("tier", sp.tier);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  type ArticleRow = (typeof recent)[number];

  const columns: ReadonlyArray<AdminTableColumn<ArticleRow>> = [
    {
      key: "publishedAt",
      header: "Publié le",
      cell: (a) => a.publishedAt?.toISOString().slice(0, 16) ?? "—",
    },
    {
      key: "title",
      header: "Titre",
      cell: (a) => {
        const t = a.translations[0];
        return t ? (
          <>
            <Link href={`${base}/${a.id}/edit`} className="admin-link">
              {t.title.slice(0, 70)}
            </Link>
            <br />
            <code className="text-[length:var(--text-admin-xs)]">{t.slug}</code>
            {a.status === "published" ? (
              <>
                {" · "}
                <a
                  href={`/fr/${resolveArticleRoute({
                    isNews: a.isNews,
                    templateVariant: a.templateVariant,
                    slug: t.slug,
                  })}/${t.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-link text-[length:var(--text-admin-xs)]"
                >
                  Voir en ligne ↗
                </a>
              </>
            ) : null}
          </>
        ) : (
          "—"
        );
      },
    },
    {
      key: "tier",
      header: "Tier",
      cell: (a) => a.indexationTier.replace(/^tier_/, "tier-").replace(/_.*$/, ""),
    },
    { key: "quality", header: "Quality", cell: (a) => a.qualityScore ?? "—" },
    { key: "seo", header: "SEO", cell: (a) => a.seoScore ?? "—" },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Publications"
        description={`${total} article${total > 1 ? "s" : ""} content-gen · ${(where.status ?? "published") as string}${where.indexationTier ? ` · ${where.indexationTier}` : ""} · page ${page}/${totalPages}`}
        actions={
          <a
            href={`/api/content-gen/export?type=articles${sp.status ? `&status=${sp.status}` : ""}${sp.tier ? `&tier=${sp.tier}` : ""}`}
            className="admin-button-ghost"
            title="Export CSV avec filtres actifs"
          >
            📥 Export CSV
          </a>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
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
            <Link href={base} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      <AdminCard variant="compact" className="mb-0">
        {recent.length === 0 ? (
          <AdminEmptyState title="Aucune publication." />
        ) : (
          <AdminTable
            columns={columns}
            rows={recent}
            getRowId={(a) => a.id}
            caption="Liste des publications content-gen"
            rowAction={(a) => (
              <ActionsCell
                articleId={a.id}
                status={a.status}
                tier={a.indexationTier}
                adminPrefix={adminPrefix}
              />
            )}
          />
        )}

        {/* Pagination P0-9 */}
        {totalPages > 1 && (
          <div className="mt-[var(--space-admin-5)] flex items-center justify-between">
            <p className="admin-meta">
              Page {page} / {totalPages} · {total} articles
            </p>
            <div className="flex gap-[var(--space-admin-3)]">
              {page > 1 && (
                <Link href={pageUrl(page - 1)} className="admin-button-ghost">
                  ← Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link href={pageUrl(page + 1)} className="admin-button-ghost">
                  Suivant →
                </Link>
              )}
            </div>
          </div>
        )}
      </AdminCard>
    </AdminPageShell>
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

  return (
    <div className="flex flex-wrap gap-[var(--space-admin-2)]">
      <Link
        href={`/fr/${adminPrefix}/content-gen/publications/${articleId}/edit`}
        className="admin-button-ghost text-[length:var(--text-admin-xs)]"
      >
        Éditer
      </Link>
      {status === "published" && tier === "tier_1_indexable" ? (
        <form action={doDemote}>
          <button type="submit" className="admin-button-ghost text-[length:var(--text-admin-xs)]">
            Demote tier-2
          </button>
        </form>
      ) : null}
      {status === "published" ? (
        <form action={doArchive}>
          <button type="submit" className="admin-button-ghost text-[length:var(--text-admin-xs)]">
            Archive
          </button>
        </form>
      ) : null}
      {status === "archived" ? (
        <form action={doUnarchive}>
          <button type="submit" className="admin-button text-[length:var(--text-admin-xs)]">
            Restaurer
          </button>
        </form>
      ) : null}
      {status === "published" ? (
        <form action={doRollback}>
          <button type="submit" className="admin-button-ghost text-[length:var(--text-admin-xs)]">
            Rollback
          </button>
        </form>
      ) : null}
    </div>
  );
}
