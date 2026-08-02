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
import { AdminImageThumb } from "@/components/admin/image-bank/AdminImageThumb";
import { ImageReviewActions } from "@/components/admin/image-bank/ImageReviewActions";

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
    requiresHumanTaxonomy: boolean;
    publishedAt: Date | null;
    thumbSrc: string | null;
    lqipDataUri: string | null;
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
          <AdminImageThumb
            src={image.thumbSrc}
            lqip={image.lqipDataUri}
            alt={titleDisplay}
            large
            priority
          />
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
                <li key={t.id} className="admin-card admin-card-inline">
                  <p className="admin-meta-strong">
                    [{t.languageCode}] {t.title}
                  </p>
                  <p className="admin-meta">{t.alt}</p>
                  <p className="admin-meta-small">{t.isPublished ? "Publié" : "Brouillon"}</p>
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

          {(image.requiresHumanReview || image.requiresHumanTaxonomy) && (
            <AdminCard className="border-l-4 border-l-[color:var(--color-admin-warning)]">
              <h2 className="admin-h2">En attente de validation humaine</h2>
              <p className="admin-meta-block mb-[var(--space-admin-4)]">
                {image.requiresHumanReview && image.requiresHumanTaxonomy
                  ? "Les validateurs automatiques ont échoué et la taxonomie est incertaine."
                  : image.requiresHumanReview
                    ? "Les validateurs automatiques ont échoué sur cette image."
                    : "La taxonomie détectée automatiquement est incertaine."}
              </p>
              {/* Correctif P0 audit UX 2026-08 — cette carte renvoyait vers la file
                  « Qualité » sans jamais offrir de sortie : aucun bouton pour valider
                  ou corriger. Voir ImageReviewActions (Server Actions
                  validateImageAction / correctImageModuleAction). */}
              <ImageReviewActions imageId={image.id} module={image.module} />
              <Link href={`${base}/quality`} className="admin-link mt-[var(--space-admin-4)] block">
                ← Retour à la file Qualité
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
