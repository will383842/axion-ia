// Refonte admin mai 2026 — PR 8 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 8).
//
// Image bank Overview V2 — AdminPageShell + AdminPageHeader + AdminStatCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminStatCard } from "@/components/admin/ui";

interface ImageRow {
  id: string;
  slug: string;
  module: string | null;
  seoScore: number | null;
  embedCount: number;
  downloadCount: number;
  translations: ReadonlyArray<{ title: string }>;
}

interface Props {
  locale: "fr" | "en";
  adminPrefix: string;
  base: string;
  totalCount: number;
  publishedCount: number;
  pendingReviewCount: number;
  avgSeoScore: number;
  recentImages: ReadonlyArray<ImageRow>;
  topEmbedded: ReadonlyArray<ImageRow>;
}

export function OverviewV2({
  locale,
  base,
  totalCount,
  publishedCount,
  pendingReviewCount,
  avgSeoScore,
  recentImages,
  topEmbedded,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Image bank — Overview"
        description={`Dashboard production · ${new Date().toLocaleDateString(locale)}`}
        actions={
          <>
            <Link href={`${base}/upload`} className="admin-button">
              Upload
            </Link>
            <Link href={`${base}/bulk-import`} className="admin-button-ghost">
              Bulk import CSV
            </Link>
          </>
        }
      />

      <section
        aria-label="KPIs image-bank"
        className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStatCard label="Total images" value={totalCount} href={`${base}/library`} />
        <AdminStatCard
          label="Published"
          value={publishedCount}
          tone="success"
          href={`${base}/library?status=published`}
        />
        <AdminStatCard
          label="Needs review"
          value={pendingReviewCount}
          tone={pendingReviewCount > 0 ? "warning" : "default"}
          href={`${base}/quality`}
        />
        <AdminStatCard
          label="Avg SEO score"
          value={`${avgSeoScore}/100`}
          tone={avgSeoScore >= 80 ? "success" : "warning"}
        />
      </section>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Recent uploads</h2>
        <div className="admin-kpi-grid">
          {recentImages.length === 0 ? (
            <p className="admin-meta col-span-4">
              Aucune image — uploadez la première via le bouton ci-dessus.
            </p>
          ) : (
            recentImages.map((img) => {
              const tr = img.translations[0];
              return (
                <Link
                  key={img.id}
                  href={`${base}/library/${img.id}`}
                  className="admin-card admin-card-inline"
                >
                  <div className="admin-image-placeholder" />
                  <p className="admin-meta-strong">{tr?.title ?? img.slug}</p>
                  <p className="admin-meta-small">
                    {img.module ?? "—"} · score {img.seoScore ?? "?"}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Top embedded</h2>
        <div className="admin-kpi-grid">
          {topEmbedded.length === 0 ? (
            <p className="admin-meta col-span-4">Aucune image publiée pour le moment.</p>
          ) : (
            topEmbedded.map((img) => {
              const tr = img.translations[0];
              return (
                <Link
                  key={img.id}
                  href={`${base}/library/${img.id}`}
                  className="admin-card admin-card-inline"
                >
                  <div className="admin-image-placeholder" />
                  <p className="admin-meta-strong">{tr?.title ?? img.slug}</p>
                  <p className="admin-meta-small">
                    {img.embedCount} embeds · {img.downloadCount} downloads
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Quick links</h2>
        <ul className="admin-meta-block flex flex-wrap gap-[var(--space-admin-5)]">
          <li>
            <Link href={`${base}/analytics`} className="admin-link">
              View detailed analytics →
            </Link>
          </li>
          <li>
            <Link href={`${base}/sitemap-status`} className="admin-link">
              Sitemap &amp; IndexNow status →
            </Link>
          </li>
          <li>
            <Link href={`${base}/settings`} className="admin-link">
              Settings →
            </Link>
          </li>
        </ul>
      </AdminCard>
    </AdminPageShell>
  );
}
