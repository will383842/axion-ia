// Section « Les plus Axion-IA » — version LÉGÈRE (dé-boxée) : 3 avantages compacts
// (icône + titre + ligne) côté texte, infographie visibilité côté visuel. Server
// Component. Remplace les 3 gros bandeaux image empilés (trop « blocosse »).
//
// ⚠️ Avantage financement OPCO GATÉ Phase B (`ofPublic`) : OPCO cité en TEXTE,
// jamais le logo (financing.ts) ; registre « en tout ou partie / selon situation ».
// L'infographie visibilité est locale (référencée dans page-images.ts → JSON-LD
// ImageObject + sitemap-images / Google Images).

import type { ReactNode } from "react";
import Image from "next/image";
import { Globe, Wallet, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section } from "@/components/layout/Section";

const VISIBILITE_SRC =
  "/illustrations/formations/visibilite-entreprise-podcast-interview-backlink-formation-ia-axion-ia.avif";

export function FormationsLesPlus({
  isFr,
  ofPublic,
}: {
  isFr: boolean;
  ofPublic: boolean;
}): ReactNode {
  const advantages: ReadonlyArray<{
    icon: typeof Zap;
    accent: string;
    title: string;
    body: string;
    on: boolean;
  }> = [
    {
      icon: Zap,
      accent: "bg-terracotta-soft text-terracotta-deep",
      title: isFr ? "Des résultats concrets dès le lendemain" : "Concrete results from day one",
      body: isFr
        ? "Vos équipes s'entraînent sur leurs vrais dossiers et repartent avec un livrable — de 30 min à 2 h gagnées par jour."
        : "Your teams practise on their real files and leave with a deliverable — 30 min to 2 h saved per day.",
      on: true,
    },
    {
      icon: Wallet,
      accent: "bg-sage-soft text-sage",
      title: isFr
        ? "Prise en charge OPCO, en partie ou à 100 %"
        : "OPCO funding, in part or in full",
      body: isFr
        ? "Certifiés Qualiopi : selon votre situation, votre OPCO peut couvrir une partie — voire la totalité — du coût. On monte le dossier avec vous."
        : "Qualiopi-certified: depending on your situation, your OPCO can cover part — or all — of the cost. We build the file with you.",
      on: ofPublic,
    },
    {
      icon: Globe,
      accent: "bg-primary-soft text-primary",
      title: isFr
        ? "La visibilité de votre entreprise, en bonus"
        : "Your company's visibility, as a bonus",
      body: isFr
        ? "Podcast dirigeant, interviews des participants, page dédiée sur axion-ia.com, lien dofollow et relais LinkedIn."
        : "Executive podcast, participant interviews, dedicated page on axion-ia.com, dofollow link and LinkedIn share.",
      on: true,
    },
  ];

  return (
    <Section
      eyebrow={isFr ? "Les plus Axion-IA" : "The Axion-IA edge"}
      title={isFr ? "Ce que" : "What"}
      titleEm={isFr ? "personne n'offre" : "no one else offers"}
      description={
        isFr
          ? "Bien plus qu'une formation : des résultats immédiats, un financement optimisé et un vrai coup de projecteur sur votre entreprise."
          : "Far more than a training: immediate results, optimised funding and real exposure for your company."
      }
    >
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <ul role="list" className="flex flex-col gap-7">
          {advantages
            .filter((a) => a.on)
            .map((a) => (
              <li key={a.title} className="flex gap-4">
                <span
                  className={cn(
                    "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                    a.accent,
                  )}
                >
                  <a.icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-fg text-lg font-semibold tracking-tight">{a.title}</h3>
                  <p data-speakable data-answer className="text-fg-soft mt-1.5 leading-relaxed">
                    {a.body}
                  </p>
                </div>
              </li>
            ))}
        </ul>

        <div className="lg:order-first">
          <Image
            src={VISIBILITE_SRC}
            alt={
              isFr
                ? "Infographie « La visibilité de votre entreprise, en bonus » — Axion-IA : podcast dirigeant ou collaborateur, interviews des participants, page dédiée sur axion-ia.com, lien dofollow et relais LinkedIn."
                : "Infographic “Your company's visibility, as a bonus” — Axion-IA: executive or employee podcast, participant interviews, dedicated page on axion-ia.com, dofollow link and LinkedIn share."
            }
            width={1254}
            height={1254}
            loading="lazy"
            sizes="(min-width: 1024px) 46vw, 100vw"
            className="mx-auto h-auto w-full max-w-[560px] rounded-3xl"
          />
        </div>
      </div>
    </Section>
  );
}
