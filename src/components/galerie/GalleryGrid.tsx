/**
 * GalleryGrid.tsx — Grille publique image bank, style SOS-Expat.
 *
 * Gère deux familles de filePath :
 *   - Slug-based  : "images/axion-ia-*.webp" → servi depuis public/images/ (seeded)
 *   - UUID-based  : "/image-bank/{uuid}/…"   → servi depuis Docker volume (admin upload)
 */

import Image from "next/image";
import Link from "next/link";
import type { ImageAsset, ImageAssetTranslation } from "../../../prisma/generated/client";

type ImageWithTranslation = ImageAsset & {
  translations: ImageAssetTranslation[];
};

type Props = {
  images: ImageWithTranslation[];
  locale: "fr" | "en";
  cdnUrl?: string;
  /**
   * Précharge (priority + fetchPriority high) la 1ʳᵉ image. `true` sur la grille
   * hub (above-fold = candidate LCP). À passer `false` quand la grille est rendue
   * sous la ligne de flottaison (ex. « Images similaires » de la page détail) pour
   * ne pas concurrencer le LCP de l'image principale — budget Web Vitals strict.
   */
  firstImagePriority?: boolean;
  /**
   * `default` = grille hub /galerie (vignettes confortables, jusqu'à 5 col).
   * `compact` = teaser dense (vignettes plus petites, jusqu'à 6 col) — utilisé
   * dans l'espace presse où la galerie n'est qu'un aperçu. `sizes` réduit en
   * conséquence (perf : on ne sert pas une image surdimensionnée).
   */
  variant?: "default" | "compact";
};

/** Résout l'URL d'affichage en fonction du type de stockage.
 *  Priorité : filePath (image principale) — Next.js Image redimensionne
 *  automatiquement via sizes. Les thumbnails basse résolution sont exclus
 *  pour éviter les rendus flous sur la grille publique.
 */
function resolveImgSrc(img: ImageWithTranslation, baseUrl: string): string {
  // Slug-based : image principale depuis public/ (Next.js optimise la taille)
  if (img.filePath && !img.filePath.startsWith("/image-bank")) {
    const p = img.filePath.startsWith("/") ? img.filePath : `/${img.filePath}`;
    return p;
  }
  // UUID-based (admin upload via Docker volume) — medium variant
  return `${baseUrl}/image-bank/${img.id}/image-md.webp`;
}

export function GalleryGrid({
  images,
  locale,
  cdnUrl,
  firstImagePriority = true,
  variant = "default",
}: Props) {
  const baseUrl = cdnUrl ?? process.env.IMAGE_BANK_CDN_URL ?? "";
  const segment = locale === "fr" ? "galerie" : "gallery";
  const isCompact = variant === "compact";
  const gridClassName = isCompact
    ? "grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
  // `sizes` aligné sur la largeur réelle d'une colonne pour ne pas servir une
  // image trop lourde (budget Web Vitals). Compact = colonnes plus étroites.
  const imgSizes = isCompact
    ? "(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 640px) 25vw, 33vw"
    : "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

  if (images.length === 0) {
    return (
      <p className="py-12 text-center text-gray-500">
        {locale === "fr"
          ? "Aucune image pour les filtres sélectionnés."
          : "No images for the selected filters."}
      </p>
    );
  }

  return (
    <ul
      className={gridClassName}
      aria-label={locale === "fr" ? "Galerie d'images" : "Image gallery"}
    >
      {images.map((img, idx) => {
        const t = img.translations[0];
        if (!t) return null;

        const detailUrl = `/${locale}/${segment}/${t.slug}`;
        const imgSrc = resolveImgSrc(img, baseUrl);
        const lqipDataUrl = img.lqipDataUri ?? undefined;

        return (
          <li key={img.id}>
            <Link
              href={detailUrl}
              className="group focus-visible:ring-terracotta block rounded focus:outline-none focus-visible:ring-2"
              aria-label={t.alt ?? t.title ?? "Image"}
            >
              <article className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
                {/* Image + badge CC BY — aspect-[4/3] fixe pour uniformité des cartes */}
                <figure className="bg-bg relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={imgSrc}
                    alt={t.alt ?? t.title ?? "Visuel Axion-IA"}
                    fill
                    quality={85}
                    sizes={imgSizes}
                    placeholder={lqipDataUrl ? "blur" : "empty"}
                    {...(lqipDataUrl ? { blurDataURL: lqipDataUrl } : {})}
                    priority={idx === 0 && firstImagePriority}
                    {...(idx === 0 && firstImagePriority ? { fetchPriority: "high" as const } : {})}
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  {/* Badge CC BY 4.0 */}
                  <span className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    CC BY 4.0
                  </span>
                </figure>

                {/* Texte */}
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs leading-snug font-semibold text-gray-900">
                    {t.title}
                  </p>
                  {img.module && (
                    <span className="bg-bg mt-1 inline-block rounded-full border border-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                      {img.module}
                    </span>
                  )}
                </div>
              </article>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
