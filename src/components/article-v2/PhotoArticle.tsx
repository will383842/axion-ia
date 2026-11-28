import Image from "next/image";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { PHOTOS_REPLI, type GabaritPage } from "@/lib/blog/photos-repli";

interface PhotoArticleProps {
  readonly gabarit: GabaritPage;
  readonly src: string | null;
  readonly alt: string | null;
  readonly titre: string;
  readonly photographerName?: string | null | undefined;
  readonly photographerUrl?: string | null | undefined;
  /** Libellé facultatif tiré des métadonnées (décor `aria-hidden`) ; sinon absent. */
  readonly etiquette?: string | null;
}

/**
 * `figure.visuel > div.visuel__cadre` : vraie photo, ratio 16/10 réservé (CLS = 0),
 * `loading="eager"` + `fetchPriority="high"` (élément LCP probable). Sans photo d'article,
 * photo de repli de la banque du site : jamais un dessin, un SVG ni un aplat. La sélection
 * des images et le crédit Unsplash ne sont pas modifiés.
 */
export function PhotoArticle({
  gabarit,
  src,
  alt,
  titre,
  photographerName,
  photographerUrl,
  etiquette,
}: PhotoArticleProps) {
  const repli = src ? null : PHOTOS_REPLI[gabarit];
  const source = src ?? repli!.src;
  // L'alt n'est jamais le titre (doublon du h1) quand il manque : texte descriptif du repli.
  const texte = src ? (alt ?? titre) : repli!.alt; // repli : alt vide (décor, voir photos-repli)
  return (
    <figure className="visuel">
      <div className="visuel__cadre">
        <Image
          src={source}
          alt={texte}
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1024px) 800px, calc(100vw - 32px)"
          className="object-cover"
        />
        {etiquette ? (
          <span className="visuel__etiquette" aria-hidden="true">
            {etiquette}
          </span>
        ) : null}
      </div>
      {src && photographerName ? (
        <figcaption>
          <UnsplashCredit photographerName={photographerName} photographerUrl={photographerUrl} />
        </figcaption>
      ) : null}
    </figure>
  );
}
