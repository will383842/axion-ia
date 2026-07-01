// Refonte admin mai 2026 — PR 8 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 8).
//
// Image bank Library V2 — AdminPageShell + AdminPageHeader + AdminFilterTabs.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminEmptyState,
  AdminFilterTabs,
} from "@/components/admin/ui";

interface ImageRow {
  id: string;
  slug: string;
  module: string | null;
  seoScore: number | null;
  publishedAt: Date | null;
  translations: ReadonlyArray<{ title: string }>;
}

interface Props {
  base: string;
  status: string | undefined;
  module: string | undefined;
  images: ReadonlyArray<ImageRow>;
}

export function LibraryV2({ base, status, images }: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Bibliothèque"
        description={`${images.length} image${images.length > 1 ? "s" : ""} affiché${
          images.length > 1 ? "es" : "e"
        } (max 60)`}
        actions={
          <Link href={`${base}/upload`} className="admin-button">
            + Téléverser
          </Link>
        }
      />

      <AdminFilterTabs
        className="mb-[var(--space-admin-5)]"
        current={status ?? "all"}
        options={[
          { value: "all", label: "Tous", href: `${base}/library` },
          { value: "published", label: "Publiés", href: `${base}/library?status=published` },
          { value: "draft", label: "Brouillons", href: `${base}/library?status=draft` },
        ]}
      />

      {images.length === 0 ? (
        <AdminEmptyState
          title="Aucune image"
          description="Aucune image dans la bibliothèque pour ces critères."
          primaryAction={
            <Link href={`${base}/upload`} className="admin-button">
              Téléverser la première image
            </Link>
          }
        />
      ) : (
        <AdminCard variant="compact">
          <ul className="admin-kpi-grid">
            {images.map((img) => {
              const tr = img.translations[0];
              return (
                <li key={img.id}>
                  <Link href={`${base}/library/${img.id}`} className="admin-card admin-card-inline">
                    <div className="admin-image-placeholder" />
                    <p className="admin-meta-strong">{tr?.title ?? img.slug}</p>
                    <p className="admin-meta-small">
                      {img.module ?? "—"} · score {img.seoScore ?? 0} ·{" "}
                      {img.publishedAt ? "publié" : "brouillon"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </AdminCard>
      )}
    </AdminPageShell>
  );
}
