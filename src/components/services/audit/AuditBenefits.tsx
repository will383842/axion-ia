/**
 * AuditBenefits — « Ce qu'un audit IA vous apporte » : header 2 colonnes (H2
 * grande taille + image) + 5 bénéfices en rectangles verticaux sur une ligne +
 * CTA ouvrant la popup du champ des possibles IA.
 *
 * Refonte 2026-05-31 (Will) — H2 à la même taille que les autres sections
 * (clamp 2.25→4rem, rendu manuellement pour permettre le header 2 colonnes).
 * Image servie en `unoptimized` (graphique riche en texte → pas de recompression,
 * texte net). Couverture sémantique SEO/AEO via la sous-ligne des domaines + alt.
 *
 * Server Component (seul morceau client = la popup importée). FR canonique —
 * EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import Image from "next/image";
import { Compass, Target, Coins, ShieldCheck, Map as MapIcon, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { AuditCapabilitiesDialog } from "@/components/services/audit/AuditCapabilitiesDialog";

interface Benefit {
  readonly icon: LucideIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;
}

const BENEFITS: ReadonlyArray<Benefit> = [
  {
    icon: Compass,
    titleFr: "Une vision claire",
    titleEn: "A clear vision",
    bodyFr:
      "Une cartographie IA complète de votre activité : où l'IA change vraiment la donne, secteur par secteur.",
    bodyEn:
      "A complete AI mapping of your activity: where AI truly moves the needle, department by department.",
  },
  {
    icon: Target,
    titleFr: "Les bons cas d'usage",
    titleEn: "The right use cases",
    bodyFr:
      "Ce qui crée de la valeur, distingué de ce qui fait perdre du temps. Priorisé par impact.",
    bodyEn: "What creates value, told apart from what wastes time. Prioritised by impact.",
  },
  {
    icon: Coins,
    titleFr: "Des gains chiffrés",
    titleEn: "Quantified gains",
    bodyFr: "Chaque opportunité estimée en temps et en argent. Le ROI réel, pas des promesses.",
    bodyEn: "Each opportunity estimated in time and money. Real ROI, not promises.",
  },
  {
    icon: ShieldCheck,
    titleFr: "Des décisions sécurisées",
    titleEn: "Secured decisions",
    bodyFr: "Faisabilité, qualité des données, conformité AI Act : vous décidez sur du solide.",
    bodyEn: "Feasibility, data quality, AI Act compliance: you decide on solid ground.",
  },
  {
    icon: MapIcon,
    titleFr: "Une feuille de route",
    titleEn: "A roadmap",
    bodyFr: "Par quoi commencer, quand, avec quelles ressources. Prêt à exécuter, à votre rythme.",
    bodyEn: "Where to start, when, with which resources. Ready to execute, at your pace.",
  },
];

export interface AuditBenefitsProps {
  readonly isFr: boolean;
}

export function AuditBenefits({ isFr }: AuditBenefitsProps): ReactNode {
  return (
    <Section tone="sand" className="py-16 sm:py-20 lg:py-24">
      {/* Header 2 colonnes — H2 grande taille (= autres sections) à gauche, image à droite */}
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Ce que ça change pour vous" : "What it changes for you"}
          </p>
          <h2 className="text-fg mt-5 text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
            {isFr ? "Ce qu'un audit IA vous apporte," : "What an AI audit gives you,"}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "concrètement" : "concretely"}
            </span>
            .
          </h2>
          <p className="text-fg-soft mt-6 max-w-xl text-lg leading-relaxed">
            {isFr
              ? "Pas un rapport qui dort dans un tiroir : une vision claire, des gains chiffrés et une feuille de route pour avancer — de la relation client à la finance, du marketing aux opérations."
              : "Not a report gathering dust: a clear vision, quantified gains and a roadmap to move forward — from customer service to finance, from marketing to operations."}
          </p>
        </div>

        <figure className="border-border shadow-card m-0 overflow-hidden rounded-2xl border">
          <Image
            src="/illustrations/audit-segments-entreprise-v2.webp"
            alt={
              isFr
                ? "Audit IA en entreprise Axion-IA par taille : TPE, artisans et commerçants (1 journée sur site), PME (de 2 jours à plusieurs semaines), ETI et grandes entreprises (multi-sites, accompagnement long terme) — durée, prix et périmètre adaptés à chaque profil."
                : "Axion-IA enterprise AI audit by company size: small businesses, artisans and retailers (1 on-site day), SMEs (2 days to several weeks), mid-caps and large enterprises (multi-site, long-term support) — duration, price and scope tailored to each profile."
            }
            width={1536}
            height={1024}
            loading="lazy"
            decoding="async"
            unoptimized
            className="h-auto w-full"
          />
        </figure>
      </div>

      {/* 5 bénéfices — rectangles verticaux (portrait) sur une seule ligne en lg */}
      <ul className="mt-14 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-5">
        {BENEFITS.map((b) => {
          const Icon = b.icon;
          return (
            <li
              key={b.titleFr}
              className="bg-paper border-border shadow-subtle hover:border-terracotta/50 hover:shadow-card flex h-full min-h-[15rem] overflow-hidden rounded-2xl border transition"
            >
              <span aria-hidden="true" className="bg-terracotta w-1.5 shrink-0" />
              <div className="flex flex-1 flex-col p-6">
                <span className="bg-terracotta-soft text-terracotta-deep mb-5 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h3 className="text-fg text-base leading-tight font-semibold tracking-tight">
                  {isFr ? b.titleFr : b.titleEn}
                </h3>
                <p className="text-fg-soft mt-2.5 text-[13.5px] leading-relaxed">
                  {isFr ? b.bodyFr : b.bodyEn}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* CTA → popup du champ des possibles (tous les secteurs) */}
      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <AuditCapabilitiesDialog isFr={isFr} />
        <p className="text-fg-muted text-[13px]">
          {isFr
            ? "Relation client, commercial, marketing, finance, RH, juridique, logistique, production, data… on passe chaque fonction au crible."
            : "Customer service, sales, marketing, finance, HR, legal, logistics, production, data… we comb through every function."}
        </p>
      </div>
    </Section>
  );
}
