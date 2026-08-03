// Refonte admin mai 2026 — PR 8 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 8).
//
// Image bank Overview V2 — AdminPageShell + AdminPageHeader + AdminStatCard.

import Link from "next/link";
import { ArrowRight, CheckCircle2, Gauge, Hourglass, Image as ImageIcon } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminButton,
} from "@/components/admin/ui";
import { AdminImageThumb } from "@/components/admin/image-bank/AdminImageThumb";
import { libelleModule } from "@/server/image-bank/taxonomy";

interface ImageRow {
  id: string;
  slug: string;
  module: string | null;
  seoScore: number | null;
  embedCount: number;
  downloadCount: number;
  thumbSrc: string | null;
  lqipDataUri: string | null;
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
        title="Banque d'images — Vue d'ensemble"
        description={`Tableau de bord production · ${new Date().toLocaleDateString(locale)}`}
        actions={
          <>
            <Link href={`${base}/upload`} className="admin-button">
              Téléverser
            </Link>
            <Link href={`${base}/bulk-import`} className="admin-button-ghost">
              Import en masse CSV
            </Link>
          </>
        }
      />

      <section
        aria-label="KPIs image-bank"
        className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStatCard
          label="Total des images"
          value={totalCount}
          href={`${base}/library`}
          icon={ImageIcon}
        />
        <AdminStatCard
          label="Publiées"
          value={publishedCount}
          tone="success"
          href={`${base}/library?status=published`}
          icon={CheckCircle2}
        />
        <AdminStatCard
          label="À vérifier"
          value={pendingReviewCount}
          tone={pendingReviewCount > 0 ? "warning" : "default"}
          href={`${base}/quality`}
          icon={Hourglass}
        />
        <AdminStatCard
          label="Score SEO moyen"
          value={`${avgSeoScore}/100`}
          tone={avgSeoScore >= 80 ? "success" : "warning"}
          icon={Gauge}
        />
      </section>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Téléversements récents</h2>
        <div className="admin-kpi-grid">
          {recentImages.length === 0 ? (
            <p className="admin-meta col-span-4">
              Aucune image — téléversez la première via le bouton ci-dessus.
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
                  <AdminImageThumb
                    src={img.thumbSrc}
                    lqip={img.lqipDataUri}
                    alt={tr?.title ?? img.slug}
                  />
                  <p className="admin-meta-strong">{tr?.title ?? img.slug}</p>
                  <p className="admin-meta-small">
                    {libelleModule(img.module)} · score {img.seoScore ?? "?"}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Les plus intégrées</h2>
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
                  <AdminImageThumb
                    src={img.thumbSrc}
                    lqip={img.lqipDataUri}
                    alt={tr?.title ?? img.slug}
                  />
                  <p className="admin-meta-strong">{tr?.title ?? img.slug}</p>
                  <p className="admin-meta-small">
                    {img.embedCount} intégrations · {img.downloadCount} téléchargements
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Liens rapides</h2>
        <ul className="admin-meta-block flex flex-wrap gap-[var(--space-admin-5)]">
          <li>
            <AdminButton
              href={`${base}/analytics`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Voir les statistiques détaillées
            </AdminButton>
          </li>
          <li>
            <AdminButton
              href={`${base}/sitemap-status`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Statut Sitemap &amp; IndexNow
            </AdminButton>
          </li>
          <li>
            <AdminButton href={`${base}/settings`} variant="ghost" size="sm" iconAfter={ArrowRight}>
              Paramètres
            </AdminButton>
          </li>
        </ul>
      </AdminCard>
    </AdminPageShell>
  );
}
