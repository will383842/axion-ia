/**
 * GalleryGrid.tsx — Composant public (Server Component)
 *
 * Affiche une grille d'images avec LQIP blur placeholder pendant load.
 * Cible LCP ≤ 1800ms : la 1ère image est `priority` + `fetchpriority="high"`.
 *
 * À placer dans `axionia/src/components/galerie/GalleryGrid.tsx`.
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

export function GalleryGrid({ images, locale, cdnUrl }: Props) {
  const baseUrl = cdnUrl ?? process.env.IMAGE_BANK_CDN_URL ?? "";

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

        const detailUrl = `/${locale}/galerie/${t.slug}`;
        const lqipDataUrl = img.lqipDataUri ?? undefined;

        return (
          <li key={img.id}>
            <Link
              href={detailUrl}
              className="group block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
              aria-label={t.alt ?? t.title ?? "Image"}
            >
              <figure className="overflow-hidden rounded-lg bg-gray-100">
                <Image
                  src={`${baseUrl}/image-bank/${img.id}/image-md.webp`}
                  alt={t.alt ?? t.title ?? ""}
                  width={960}
                  height={Math.round((img.height / img.width) * 960)}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  placeholder={lqipDataUrl ? "blur" : "empty"}
                  {...(lqipDataUrl ? { blurDataURL: lqipDataUrl } : {})}
                  priority={idx === 0}
                  {...(idx === 0 ? { fetchPriority: "high" as const } : {})}
                  className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <figcaption className="p-3">
                  <p className="line-clamp-2 text-sm font-medium text-gray-900">{t.title}</p>
                  {t.caption ? (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">{t.caption}</p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    {img.module ? (
                      <span className="rounded bg-gray-100 px-2 py-0.5">{img.module}</span>
                    ) : null}
                    {img.targetCity ? <span>· {img.targetCity}</span> : null}
                  </div>
                </figcaption>
              </figure>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
