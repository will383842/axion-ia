/**
 * Bande visuelle « En images » de la landing /formations/entreprise — 4 vraies
 * photos Unsplash pour aérer la page (ratio image/texte) entre les sections
 * denses (secteurs → process).
 *
 * Conformité Unsplash CGU (cf. docs/content-gen/UNSPLASH-COMPLIANCE.md v3) :
 * - photos free-tier curées via scripts/curate-formations-entreprise-unsplash.mjs
 *   (manifeste `src/content/formations-entreprise-unsplash.ts`, download-trigger §6)
 * - attribution photographe obligatoire via <UnsplashCredit> (liens UTM trackés)
 * - hotlink images.unsplash.com (whitelisté next.config) re-optimisé par next/image
 *
 * Server Component pur (zéro JS). next/image lazy + aspect-ratio fixe → CLS=0.
 * Le héro et le bandeau restent des visuels Axion-IA AUTHENTIQUES (équipe réelle,
 * scènes de formation) — Unsplash ne sert qu'aux sections illustratives.
 */

import type { ReactNode } from "react";
import Image from "next/image";
import { Section } from "@/components/layout/Section";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { FORMATIONS_ENTREPRISE_UNSPLASH } from "@/content/formations-entreprise-unsplash";

export function FormationsVisualShowcase({ isFr }: { isFr: boolean }): ReactNode {
  if (FORMATIONS_ENTREPRISE_UNSPLASH.length === 0) return null;

  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "En images" : "In pictures"}
      title={isFr ? "La formation IA en entreprise," : "Corporate AI training,"}
      titleEm={isFr ? "concrètement" : "in practice"}
      titleTail="."
      description={
        isFr
          ? "Vos équipes, en présentiel dans vos locaux : ateliers pratiques sur vos vrais outils, un formateur dédié, dirigeants comme opérationnels embarqués."
          : "Your teams, in person at your premises: hands-on workshops on your real tools, a dedicated trainer, executives and operational staff on board."
      }
    >
      <ul className="xs:grid-cols-2 grid list-none grid-cols-1 gap-5 p-0 lg:grid-cols-4">
        {FORMATIONS_ENTREPRISE_UNSPLASH.map((img) => (
          <li key={img.slot} className="flex flex-col">
            <figure className="m-0 flex flex-col">
              <div className="border-border shadow-subtle relative aspect-[4/3] w-full overflow-hidden rounded-2xl border">
                <Image
                  src={img.src}
                  alt={isFr ? img.label : img.alt}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 479px) 50vw, 100vw"
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
