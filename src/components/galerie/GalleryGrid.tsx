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
};

/** Résout l'URL d'affichage en fonction du type de stockage. */
function resolveImgSrc(img: ImageWithTranslation, baseUrl: string): string {
  // Slug-based (seeded via public/images/) — priorité thumbnail
  if (img.thumbnailPath && !img.thumbnailPath.startsWith("/image-bank")) {
    const p = img.thumbnailPath.startsWith("/") ? img.thumbnailPath : `/${img.thumbnailPath}`;
    return p;
  }
  if (img.filePath && !img.filePath.startsWith("/image-bank")) {
    const p = img.filePath.startsWith("/") ? img.filePath : `/${img.filePath}`;
    return p;
  }
  // UUID-based (admin upload via Docker volume)
  return `${baseUrl}/image-bank/${img.id}/image-md.webp`;
}

export function GalleryGrid({ images, locale, cdnUrl }: Props) {
  const baseUrl = cdnUrl ?? process.env.IMAGE_BANK_CDN_URL ?? "";
  const segment = locale === "fr" ? "galerie" : "gallery";

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
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      aria-label={locale === "fr" ? "Galerie d'images" : "Image gallery"}
    >
      {images.map((img, idx) => {
        const t = img.translations[0];
        if (!t) return null;

        const detailUrl = `/${locale}/${segment}/${t.slug}`;
        const imgSrc = resolveImgSrc(img, baseUrl);
        const lqipDataUrl = img.lqipDataUri ?? undefined;
        const aspectRatio = img.width && img.height ? img.height / img.width : 9 / 16;

        return (
          <li key={img.id}>
            <Link
              href={detailUrl}
              className="group focus-visible:ring-terracotta block rounded focus:outline-none focus-visible:ring-2"
              aria-label={t.alt ?? t.title ?? "Image"}
            >
              <article className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
                {/* Image + badge CC BY */}
                <figure className="bg-bg relative overflow-hidden">
                  <Image
                    src={imgSrc}
                    alt={t.alt ?? t.title ?? ""}
                    width={640}
                    height={Math.round(640 * aspectRatio)}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    placeholder={lqipDataUrl ? "blur" : "empty"}
                    {...(lqipDataUrl ? { blurDataURL: lqipDataUrl } : {})}
                    priority={idx === 0}
                    {...(idx === 0 ? { fetchPriority: "high" as const } : {})}
                    className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  {/* Badge CC BY 4.0 */}
                  <span className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    CC BY 4.0
                  </span>
                </figure>

                {/* Texte */}
                <div className="p-4">
                  <p className="line-clamp-2 text-sm leading-snug font-semibold text-gray-900">
                    {t.title}
                  </p>
                  {(t.caption || t.description) && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                      {t.caption ?? t.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {img.module && (
                      <span className="bg-bg rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] text-gray-600">
                        {img.module}
                      </span>
                    )}
                    {img.targetCity && (
                      <span className="text-[11px] text-gray-400">· {img.targetCity}</span>
                    )}
                  </div>
                </div>
              </article>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
