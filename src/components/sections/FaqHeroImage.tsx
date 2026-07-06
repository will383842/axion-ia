// Server Component — visuel héro des pages FAQ (photo Unsplash locale + crédit).
// 0 KB JS client. `slot` = "hub" | "topics" | slug de catégorie FAQ. Le crédit
// photographe est rendu sous l'image (CGU Unsplash §9).

import Image from "next/image";
import type { ReactNode } from "react";
import { getFaqImage } from "@/content/faq/faq-images";
import { getFaqPhotoCredit } from "@/content/faq/faq-photos";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";

interface Props {
  /** "hub" | "topics" | slug de catégorie FAQ (general, interventions, …). */
  readonly slot: string;
  readonly isFr: boolean;
  /** LCP : true sur le héro above-the-fold. */
  readonly priority?: boolean;
  readonly className?: string;
}

export function FaqHeroImage({ slot, isFr, priority = false, className }: Props): ReactNode {
  const img = getFaqImage(slot);
  const credit = getFaqPhotoCredit(slot);
  return (
    <figure className={className}>
      <Image
        src={img.src}
        alt={isFr ? img.altFr : img.altEn}
        width={img.width}
        height={img.height}
        priority={priority}
        sizes="(max-width: 1024px) 100vw, 48vw"
        className="border-border shadow-card h-auto w-full rounded-2xl border object-cover"
      />
      {credit ? (
        <UnsplashCredit
          photographerName={credit.photographer}
          photographerUrl={credit.photographerUrl}
          className="text-[11px]"
        />
      ) : null}
    </figure>
  );
}
