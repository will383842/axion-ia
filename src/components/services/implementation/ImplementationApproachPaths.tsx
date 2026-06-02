/**
 * ImplementationApproachPaths — « Deux façons d'implémenter l'IA » : sur votre
 * existant (brownfield) OU de bout en bout / neuf (greenfield).
 *
 * Rôle SEO/AEO (keyword_master) : la page hub joue le pilier de ROUTAGE entre le
 * cluster EXISTANT et le cluster NEUF (anti-cannibalisation). Couverture
 * sémantique des deux intentions sans dupliquer les pages cluster.
 *
 * Server Component pur, zéro JS. Aucun prix. Tokens uniquement. FR canonique —
 * EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { ArrowRight, Plug, Rocket, Check, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";

interface Path {
  readonly icon: LucideIcon;
  readonly tagFr: string;
  readonly tagEn: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;
  readonly itemsFr: ReadonlyArray<string>;
  readonly itemsEn: ReadonlyArray<string>;
  readonly featured: boolean;
}

const PATHS: ReadonlyArray<Path> = [
  {
    icon: Plug,
    tagFr: "Vous avez déjà vos outils",
    tagEn: "You already have your tools",
    titleFr: "Sur votre existant",
    titleEn: "On your existing stack",
    bodyFr:
      "On greffe l'IA sur ce que vous utilisez déjà — CRM, ERP, comptabilité, site, e-mail — sans tout refaire. Intégrations propres, automatisation de vos process et agents connectés à vos données.",
    bodyEn:
      "We graft AI onto what you already use — CRM, ERP, accounting, website, email — without rebuilding everything. Clean integrations, automation of your processes and agents wired into your data.",
    itemsFr: [
      "Connecter l'IA à votre CRM / ERP",
      "Automatiser vos process existants",
      "Brancher l'IA sur vos outils métier",
      "Vos données restent chez vous",
    ],
    itemsEn: [
      "Connect AI to your CRM / ERP",
      "Automate your existing processes",
      "Plug AI into your business tools",
      "Your data stays with you",
    ],
    featured: true,
  },
  {
    icon: Rocket,
    tagFr: "Une solution complète, sur-mesure",
    tagEn: "A complete, custom solution",
    titleFr: "De bout en bout",
    titleEn: "End to end",
    bodyFr:
      "Pas encore d'outil, ou besoin d'un système dédié ? On conçoit et on développe de A à Z : agent IA sur-mesure, plateforme ou système métier complet, pensé pour votre activité.",
    bodyEn:
      "No tool yet, or need a dedicated system? We design and build it from A to Z: a custom AI agent, platform or full business system, made for your activity.",
    itemsFr: [
      "Créer un agent IA sur-mesure",
      "Développer une solution IA complète",
      "IA custom pour votre métier",
      "Conçu pour évoluer dans la durée",
    ],
    itemsEn: [
      "Build a custom AI agent",
      "Develop a complete AI solution",
      "Custom AI for your business",
      "Designed to scale over time",
    ],
    featured: false,
  },
];

export interface ImplementationApproachPathsProps {
  readonly isFr: boolean;
}

export function ImplementationApproachPaths({ isFr }: ImplementationApproachPathsProps): ReactNode {
  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Sur existant ou de bout en bout" : "Existing stack or end to end"}
      title={isFr ? "Deux façons d'implémenter l'IA" : "Two ways to implement AI"}
      titleEm={isFr ? "selon votre point de départ" : "based on your starting point"}
      titleTail="."
      description={
        isFr
          ? "Vous avez déjà des outils, ou vous partez de zéro ? On s'adapte à votre situation — et on vous oriente vers la bonne approche, sans jargon."
          : "Already have tools, or starting from scratch? We adapt to your situation — and steer you toward the right approach, no jargon."
      }
    >
      <ul className="grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 md:gap-6">
        {PATHS.map((p) => {
          const Icon = p.icon;
          return (
            <li
              key={p.titleFr}
              className={`flex h-full flex-col overflow-hidden rounded-3xl border-2 transition ${
                p.featured
                  ? "border-terracotta bg-paper shadow-card"
                  : "border-border bg-sand hover:border-terracotta/50 hover:shadow-card"
              }`}
            >
              <span
                aria-hidden="true"
                className={`block h-1.5 w-full shrink-0 ${p.featured ? "bg-terracotta" : "bg-terracotta/40"}`}
              />
              <div className="flex flex-1 flex-col p-6 sm:p-8">
                <span className="bg-terracotta-soft text-terracotta-deep mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <p className="text-terracotta-deep text-[12px] font-bold tracking-[0.14em] uppercase">
                  {isFr ? p.tagFr : p.tagEn}
                </p>
                <h3 className="text-fg mt-1 text-2xl leading-tight font-semibold tracking-tight">
                  {isFr ? p.titleFr : p.titleEn}
                </h3>
                <p className="text-fg-soft mt-3 text-[15px] leading-relaxed">
                  {isFr ? p.bodyFr : p.bodyEn}
                </p>
                <ul className="mt-6 space-y-2.5">
                  {(isFr ? p.itemsFr : p.itemsEn).map((item) => (
                    <li
                      key={item}
                      className="text-fg flex items-start gap-2.5 text-[14px] leading-snug"
                    >
                      <Check
                        aria-hidden="true"
                        className="text-terracotta mt-0.5 h-4 w-4 shrink-0"
                        strokeWidth={2.5}
                      />
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <p className="text-fg-soft text-[15px] leading-relaxed">
          {isFr
            ? "Pas sûr de votre cas ? On vous aide à trancher entre greffer l'IA sur votre existant ou construire du sur-mesure."
            : "Not sure which fits? We help you decide between grafting AI onto your stack or building custom."}
        </p>
        <Cta href="/contact" size="lg" track="impl-approach-paths">
          {isFr ? "Décrire mon besoin" : "Describe my need"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Cta>
      </div>
    </Section>
  );
}
