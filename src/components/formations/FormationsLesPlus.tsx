// Section « Les plus Axion-IA » — 3 avantages en BANDEAUX IMAGE alternés (image
// d'un côté, texte de l'autre), pour un rendu qui donne envie. Server Component.
//
// Images : bandeaux résultats/financement = vraies photos Unsplash (manifeste
// `formations-entreprise-unsplash.ts`, download-trigger CGU §6 + <UnsplashCredit>).
// Bandeau visibilité = infographie locale AVIF (référencée dans page-images.ts pour
// le JSON-LD ImageObject + sitemap-images / Google Images).
//
// ⚠️ Financement : le bandeau OPCO est GATÉ Phase B (`ofPublic`) et cite l'OPCO
// en TEXTE + « Certifié Qualiopi » — JAMAIS le logo OPCO (marque tierce, cf.
// financing.ts). Registre conforme : « en tout ou partie / selon votre situation ».

import type { ReactNode } from "react";
import Image from "next/image";
import { Globe, ShieldCheck, Wallet, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section } from "@/components/layout/Section";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { FORMATIONS_ENTREPRISE_UNSPLASH } from "@/content/formations-entreprise-unsplash";

function bySlot(slot: string) {
  return FORMATIONS_ENTREPRISE_UNSPLASH.find((i) => i.slot === slot);
}

function Banner({
  slot,
  localSrc,
  reverse,
  alt,
  children,
}: {
  /** Slot d'une photo Unsplash du manifeste (rendue object-cover + crédit). */
  slot?: string;
  /** Image locale (illustration/infographie) — rendue object-contain, sans crédit. */
  localSrc?: string;
  reverse?: boolean;
  alt: string;
  children: ReactNode;
}): ReactNode {
  const image = slot ? bySlot(slot) : undefined;
  return (
    <div>
      <div className="border-border bg-bg grid grid-cols-1 overflow-hidden rounded-3xl border lg:grid-cols-2 lg:items-stretch">
        <figure
          className={cn(
            "relative order-first m-0 min-h-[240px] lg:min-h-[380px]",
            reverse && "lg:order-last",
          )}
        >
          {localSrc ? (
            <Image
              src={localSrc}
              alt={alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              loading="lazy"
              className="object-contain p-4"
            />
          ) : image ? (
            <Image
              src={image.src}
              alt={alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              loading="lazy"
              className="object-cover"
            />
          ) : (
            <span className="bg-sand block h-full w-full" aria-hidden="true" />
          )}
        </figure>
        <div className="flex flex-col justify-center gap-4 p-8 lg:p-10">{children}</div>
      </div>
      {image && !localSrc ? (
        <UnsplashCredit
          photographerName={image.photographer}
          photographerUrl={image.photographerUrl}
          className="mt-1.5 px-1"
        />
      ) : null}
    </div>
  );
}

export function FormationsLesPlus({
  isFr,
  ofPublic,
}: {
  isFr: boolean;
  ofPublic: boolean;
}): ReactNode {
  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Les plus Axion-IA" : "The Axion-IA edge"}
      title={isFr ? "Ce que" : "What"}
      titleEm={isFr ? "personne n'offre" : "no one else offers"}
      description={
        isFr
          ? "Bien plus qu'une formation : des résultats immédiats, un financement optimisé et un vrai coup de projecteur sur votre entreprise."
          : "Far more than a training: immediate results, optimised funding and real exposure for your company."
      }
    >
      <div className="flex flex-col gap-8">
        {/* 1 — Résultats concrets (image à gauche) */}
        <Banner
          slot="resultats"
          alt="Équipe d'entreprise obtenant des résultats concrets après une formation IA"
        >
          <span className="bg-terracotta-soft text-terracotta-deep inline-flex h-12 w-12 items-center justify-center rounded-2xl">
            <Zap aria-hidden="true" className="h-6 w-6" />
          </span>
          <h3 className="text-fg text-xl font-semibold tracking-tight lg:text-2xl">
            {isFr ? "Des résultats concrets dès le lendemain" : "Concrete results from day one"}
          </h3>
          <p className="text-fg-soft leading-relaxed">
            {isFr
              ? "Pas de théorie hors-sol : vos équipes s'entraînent sur leurs vrais dossiers. Chaque participant repart avec un livrable terminé et des gains de temps immédiats — de 30 minutes à 2 heures gagnées par jour, dès le lendemain."
              : "No abstract theory: your teams practise on their real files. Every participant leaves with a finished deliverable and immediate time savings — 30 minutes to 2 hours saved per day, from the very next day."}
          </p>
        </Banner>

        {/* 2 — Prise en charge OPCO (image à droite) — GATÉ Phase B, sans logo OPCO */}
        {ofPublic ? (
          <Banner
            slot="financement"
            reverse
            alt="Dossier de prise en charge d'une formation professionnelle"
          >
            <span className="bg-sage-soft text-sage inline-flex h-12 w-12 items-center justify-center rounded-2xl">
              <Wallet aria-hidden="true" className="h-6 w-6" />
            </span>
            <div>
              <span className="bg-sage-soft text-fg border-border mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
                <ShieldCheck aria-hidden="true" className="text-sage h-3.5 w-3.5" />
                {isFr ? "Organisme certifié Qualiopi" : "Qualiopi-certified provider"}
              </span>
              <h3 className="text-fg text-xl font-semibold tracking-tight lg:text-2xl">
                {isFr
                  ? "Une formation prise en charge, en partie ou à 100 %"
                  : "A training funded, in part or in full"}
              </h3>
            </div>
            <p className="text-fg-soft leading-relaxed">
              {isFr
                ? "Certifiés Qualiopi, nos parcours sont finançables. Selon votre branche et votre situation, votre OPCO peut prendre en charge une partie — voire la totalité (100 %) — du coût de la formation. Nous montons le dossier avec vous."
                : "Qualiopi-certified, our programmes are fundable. Depending on your branch and situation, your OPCO can cover part — or all (100%) — of the training cost. We build the file with you."}
            </p>
          </Banner>
        ) : null}

        {/* 3 — Visibilité offerte (infographie locale, image à gauche) */}
        <Banner
          localSrc="/illustrations/formations/visibilite-entreprise-podcast-interview-backlink-formation-ia-axion-ia.avif"
          alt={
            isFr
              ? "Infographie « La visibilité de votre entreprise, en bonus » — Axion-IA : podcast dirigeant ou collaborateur, interviews des participants, page dédiée sur axion-ia.com, lien dofollow et relais LinkedIn."
              : "Infographic “Your company's visibility, as a bonus” — Axion-IA: executive or employee podcast, participant interviews, dedicated page on axion-ia.com, dofollow link and LinkedIn share."
          }
        >
          <span className="bg-primary-soft text-primary inline-flex h-12 w-12 items-center justify-center rounded-2xl">
            <Globe aria-hidden="true" className="h-6 w-6" />
          </span>
          <h3 className="text-fg text-xl font-semibold tracking-tight lg:text-2xl">
            {isFr
              ? "La visibilité de votre entreprise, en bonus"
              : "Your company's visibility, as a bonus"}
          </h3>
          <p className="text-fg-soft leading-relaxed">
            {isFr
              ? "Nous ne formons pas que vos équipes : nous mettons votre entreprise en lumière, localement ou nationalement."
              : "We don't just train your teams: we put your company in the spotlight, locally or nationally."}
          </p>
          <p className="text-fg text-sm leading-relaxed font-medium">
            {isFr
              ? "Podcast dirigeant ou collaborateur · interviews des participants · page dédiée à votre entreprise sur axion-ia.com · lien dofollow vers votre site (SEO) · relais LinkedIn."
              : "Executive or employee podcast · participant interviews · dedicated page on axion-ia.com · dofollow link to your site (SEO) · LinkedIn share."}
          </p>
        </Banner>
      </div>
    </Section>
  );
}
