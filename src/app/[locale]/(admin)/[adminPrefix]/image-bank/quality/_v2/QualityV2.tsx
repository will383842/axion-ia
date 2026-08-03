// Refonte admin mai 2026 — PR 8 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 8).
//
// Image bank Quality V2 — AdminPageShell + AdminPageHeader + AdminCard +
// AdminEmptyState.

import Link from "next/link";
import { Hourglass, AlertTriangle, Gauge } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminEmptyState,
  AdminStatCard,
} from "@/components/admin/ui";

interface ImageRow {
  id: string;
  slug: string;
  seoScore: number | null;
  requiresHumanReview: boolean;
  requiresHumanTaxonomy: boolean;
  translations: ReadonlyArray<{ title: string }>;
}

interface Props {
  base: string;
  images: ReadonlyArray<ImageRow>;
}

export function QualityV2({ base, images }: Props): React.ReactElement {
  const validatorsCount = images.filter((i) => i.requiresHumanReview).length;
  const taxonomyCount = images.filter((i) => i.requiresHumanTaxonomy).length;
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="File de revue qualité"
        description={`${images.length} image${
          images.length > 1 ? "s" : ""
        } en attente de validation humaine (validateurs auto échoués ou taxonomie incertaine).`}
      />

      <section
        aria-label="KPIs quality"
        className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-3"
      >
        <AdminStatCard label="Total à valider" value={images.length} icon={Hourglass} />
        <AdminStatCard
          label="Validateurs auto échoués"
          value={validatorsCount}
          tone={validatorsCount > 0 ? "warning" : "default"}
          icon={AlertTriangle}
        />
        <AdminStatCard
          label="Taxonomie incertaine"
          value={taxonomyCount}
          tone={taxonomyCount > 0 ? "warning" : "default"}
          icon={Gauge}
        />
      </section>

      {images.length === 0 ? (
        <AdminEmptyState
          title="File vide"
          description="Toutes les images publiées passent les validateurs automatiques."
        />
      ) : (
        <AdminCard variant="compact">
          <ul className="admin-meta-block flex flex-col gap-[var(--space-admin-3)]">
            {images.map((img) => {
              const tr = img.translations[0];
              return (
                <li key={img.id} className="admin-card admin-card-inline">
                  <Link href={`${base}/library/${img.id}`} className="admin-link admin-meta-strong">
                    {tr?.title ?? img.slug}
                  </Link>
                  <p className="admin-meta-small">
                    Score {img.seoScore ?? 0}/100
                    {img.requiresHumanReview ? " · ⚠ Validateurs" : null}
                    {img.requiresHumanTaxonomy ? " · ⚠ Taxonomie" : null}
                  </p>
                </li>
              );
            })}
          </ul>
        </AdminCard>
      )}
    </AdminPageShell>
  );
}
