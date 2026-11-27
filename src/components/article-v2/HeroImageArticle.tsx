import Image from "next/image";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";

interface HeroImageArticleProps {
  readonly src: string;
  /** Texte alternatif : inchangé (la correction du `alt` relève de la PR d'images). */
  readonly alt: string;
  readonly photographerName: string | null | undefined;
  readonly photographerUrl: string | null | undefined;
}

/**
 * ENVELOPPE l'`<Image>` et `UnsplashCredit` actuels : ni la sélection de
 * l'image ni l'attribution du photographe ne changent, seule la position.
 * Ratio 16/10 réservé (CLS = 0) ; `loading="eager"` + `fetchPriority="high"`
 * (le `priority` de Next 16 est déprécié, PLAN §3) ; `sizes` corrigé.
 */
export function HeroImageArticle({
  src,
  alt,
  photographerName,
  photographerUrl,
}: HeroImageArticleProps) {
  return (
    <figure className="art-hero">
      <div className="art-hero-cadre">
        <Image
          src={src}
          alt={alt}
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1366px) 565px, (min-width: 1024px) 45vw, calc(100vw - 2rem)"
        />
      </div>
      <UnsplashCredit photographerName={photographerName} photographerUrl={photographerUrl} />
    </figure>
  );
}
