// Refonte admin mai 2026 — PR 8 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 8).
//
// Image bank Image detail V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";

interface Translation {
  id: number;
  languageCode: string;
  title: string;
  alt: string;
  isPublished: boolean;
}

interface TagWithSlug {
  id: number;
  slug: string;
  name: string;
}

interface Props {
  base: string;
  image: {
    id: string;
    slug: string;
    fileFormat: string;
    width: number;
    height: number;
    licenseType: string;
    copyrightHolder: string;
    sourceType: string;
    aiModel: string | null;
    module: string | null;
    subModule: string | null;
    seoScore: number | null;
    requiresHumanReview: boolean;
    publishedAt: Date | null;
    translations: ReadonlyArray<Translation>;
    tags: ReadonlyArray<TagWithSlug>;
  };
  titleDisplay: string;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-[var(--space-admin-4)]">
      <dt className="admin-meta">{label}</dt>
      <dd className="admin-meta-strong font-mono">{value}</dd>
    </div>
  );
}

export function ImageDetailV2({ base, image, titleDisplay }: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminBreadcrumbs
        className="mb-[var(--space-admin-4)]"
        items={[
          { label: "Banque d'images", href: base },
          { label: "Bibliothèque", href: `${base}/library` },
          { label: titleDisplay },
        ]}
      />

      <AdminPageHeader
        title={titleDisplay}
        description={`${image.module ?? "—"} / ${image.subModule ?? "—"} · score ${image.seoScore ?? 0}/100`}
      />

      <section className="grid grid-cols-1 gap-[var(--space-admin-6)] lg:grid-cols-2">
        <AdminCard>
          <div className="admin-image-placeholder admin-image-placeholder-large" />
          <dl className="mt-[var(--space-admin-5)] flex flex-col gap-[var(--space-admin-3)]">
            <Row label="ID" value={image.id} />
            <Row label="Slug" value={image.slug} />
            <Row label="Format" value={`${image.fileFormat} · ${image.width}×${image.height}`} />
            <Row label="Licence" value={image.licenseType} />
            <Row label="Droits d'auteur" value={image.copyrightHolder} />
            <Row label="Type de source" value={image.sourceType} />
            {image.aiModel ? <Row label="Modèle IA" value={image.aiModel} /> : null}
            <Row
              label="Publié"
              value={image.publishedAt ? image.publishedAt.toISOString() : "Non publié"}
            />
          </dl>
        </AdminCard>

        <div className="flex flex-col gap-[var(--space-admin-5)]">
          <AdminCard>
            <h2 className="admin-h2">Traductions ({image.translations.length})</h2>
            <ul className="admin-meta-block flex flex-col gap-[var(--space-admin-3)]">
              {image.translations.map((t) => (
                <li
                  key={t.id}
                  className="admin-card admin-card-inline border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]"
                >
                  <p className="admin-meta-strong">
                    [{t.languageCode}] {t.title}
                  </p>
                  <p className="admin-meta">{t.alt}</p>
                  <p className="admin-meta-small">{t.isPublished ? "✓ Publié" : "Brouillon"}</p>
                </li>
              ))}
            </ul>
          </AdminCard>

          <AdminCard>
            <h2 className="admin-h2">Étiquettes ({image.tags.length})</h2>
            <ul className="admin-meta-block flex flex-wrap gap-[var(--space-admin-2)]">
              {image.tags.map((tag) => (
                <li key={tag.id} className="admin-tag-pill">
                  {tag.name}
                </li>
              ))}
            </ul>
          </AdminCard>

          {image.requiresHumanReview && (
            <AdminCard className="border-l-4 border-l-[color:var(--color-admin-warning)]">
              <p className="admin-meta-block">
                ⚠ Cette image est marquée pour relecture humaine (validateurs automatiques échoués).
              </p>
              <Link href={`${base}/quality`} className="admin-link">
                Voir la file Qualité →
              </Link>
            </AdminCard>
          )}
        </div>
      </section>

      <p className="mt-[var(--space-admin-6)]">
        <Link href={`${base}/library`} className="admin-link">
          ← Retour bibliothèque
        </Link>
      </p>
    </AdminPageShell>
  );
}
