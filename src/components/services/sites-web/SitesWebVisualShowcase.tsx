/**
 * SitesWebVisualShowcase — bande visuelle « ce qu'on conçoit » (6 photos).
 *
 * 2026-06-04 (Will) — améliore le ratio image/texte de la page hub juste après
 * la grille des capacités (très textuelle) : 6 vraies photos Unsplash illustrant
 * design, dev, e-commerce, mobile, data/SaaS et l'équipe.
 *
 * Conformité Unsplash CGU (cf. docs/content-gen/UNSPLASH-COMPLIANCE.md v3) :
 * - photos free-tier réelles curées via scripts/curate-sites-web-unsplash.mjs
 *   (manifeste `src/content/sites-web-unsplash.ts`, download-trigger §6 déclenché)
 * - attribution photographe obligatoire via <UnsplashCredit> (liens UTM trackés)
 * - hotlink images.unsplash.com (whitelisté next.config) re-optimisé par next/image
 *
 * Server Component pur (zéro JS). next/image lazy + aspect-ratio fixe → CLS=0,
 * budget Web Vitals 2026 préservé. FR canonique — EN = miroir (locale 301→FR).
 */

import type { ReactNode } from "react";
import Image from "next/image";
import { Section } from "@/components/layout/Section";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { SITES_WEB_UNSPLASH } from "@/content/sites-web-unsplash";

export interface SitesWebVisualShowcaseProps {
  readonly isFr: boolean;
}

export function SitesWebVisualShowcase({ isFr }: SitesWebVisualShowcaseProps): ReactNode {
  if (SITES_WEB_UNSPLASH.length === 0) return null;

  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "En images" : "In pictures"}
      title={isFr ? "Du pixel au déploiement," : "From pixel to deployment,"}
      titleEm={isFr ? "un savoir-faire complet" : "end-to-end craft"}
      titleTail="."
      description={
        isFr
          ? "Design d'interface, développement sur mesure, e-commerce, mobile, plateformes data — la même équipe, du premier wireframe à la mise en ligne."
          : "Interface design, bespoke development, e-commerce, mobile, data platforms — the same team, from the first wireframe to go-live."
      }
    >
      <ul className="grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {SITES_WEB_UNSPLASH.map((img) => (
          <li key={img.slot} className="flex flex-col">
            <figure className="m-0 flex flex-col">
              <div className="border-border shadow-subtle relative aspect-[16/10] w-full overflow-hidden rounded-2xl border">
                <Image
                  src={img.src}
                  alt={img.label}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  loading="lazy"
                  className="object-cover"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pt-10 pb-3">
                  <span className="text-[13px] font-semibold tracking-tight text-white">
                    {img.label}
                  </span>
                </figcaption>
              </div>
              <UnsplashCredit
                photographerName={img.photographer}
                photographerUrl={img.photographerUrl}
              />
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  );
}
