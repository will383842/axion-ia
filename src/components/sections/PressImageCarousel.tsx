/**
 * PressImageCarousel.tsx — Banque d'images presse en CARROUSEL horizontal.
 *
 * Refonte 2026-06-23 (Will) : sur la page presse, les visuels libres de droits
 * étaient rendus dans une grande grille (images « trop grosses »). Ici on les
 * présente sur UNE seule ligne qui défile (overflow-x + scroll-snap, cartes à
 * largeur fixe). Server component, zéro JS client (scroll natif) → budget Web
 * Vitals respecté. Distinct de `GalleryGrid` (réutilisé tel quel sur /galerie).
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

/** Résout l'URL d'affichage selon le type de stockage (miroir de GalleryGrid). */
function resolveImgSrc(img: ImageWithTranslation, baseUrl: string): string {
  if (img.filePath && !img.filePath.startsWith("/image-bank")) {
    return img.filePath.startsWith("/") ? img.filePath : `/${img.filePath}`;
  }
  return `${baseUrl}/image-bank/${img.id}/image-md.webp`;
}

export function PressImageCarousel({ images, locale, cdnUrl }: Props) {
  const baseUrl = cdnUrl ?? process.env.IMAGE_BANK_CDN_URL ?? "";
  const segment = locale === "fr" ? "galerie" : "gallery";

  if (images.length === 0) return null;

  return (
    <ul
      // Une seule ligne, défilement horizontal au doigt/trackpad + scroll-snap.
      // `-mx-4 px-4` : le rail déborde jusqu'aux bords du conteneur sur mobile.
      className="-mx-4 flex snap-x snap-mandatory [scrollbar-width:thin] gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0"
      aria-label={
        locale === "fr" ? "Visuels presse libres de droits" : "Royalty-free press visuals"
      }
    >
      {images.map((img, idx) => {
        const t = img.translations[0];
        if (!t) return null;

        const detailUrl = `/${locale}/${segment}/${t.slug}`;
        const imgSrc = resolveImgSrc(img, baseUrl);
        const lqipDataUrl = img.lqipDataUri ?? undefined;

        return (
          <li key={img.id} className="w-64 shrink-0 snap-start sm:w-72">
            <Link
              href={detailUrl}
              className="group focus-visible:ring-terracotta block rounded-xl focus:outline-none focus-visible:ring-2"
              aria-label={t.alt ?? t.title ?? "Image"}
            >
              <article className="border-border bg-paper overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-[var(--shadow-card)]">
                <figure className="bg-bg relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={imgSrc}
                    alt={t.alt ?? t.title ?? "Visuel Axion-IA"}
                    fill
                    quality={80}
                    sizes="288px"
                    placeholder={lqipDataUrl ? "blur" : "empty"}
                    {...(lqipDataUrl ? { blurDataURL: lqipDataUrl } : {})}
                    loading={idx < 3 ? "eager" : "lazy"}
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <span className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    CC BY 4.0
                  </span>
                </figure>
                <div className="p-3">
                  <p className="text-fg line-clamp-2 text-xs leading-snug font-semibold">
                    {t.title}
                  </p>
                </div>
              </article>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
