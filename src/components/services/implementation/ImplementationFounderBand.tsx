/**
 * ImplementationFounderBand — bandeau « William » adapté à /implementation.
 *
 * Calqué sur FounderTrustSection (home) mais avec une copie propre à
 * l'implémentation : ce qui compte, c'est VOTRE satisfaction — des échanges
 * directs, un état d'esprit travailleur, professionnel et sympa, pour des
 * performances et un résultat optimum. Réutilise le portrait William existant.
 *
 * Server Component pur, zéro JS. Tokens uniquement. Aucun prix. FR canonique —
 * EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";

export interface ImplementationFounderBandProps {
  readonly isFr: boolean;
}

export function ImplementationFounderBand({ isFr }: ImplementationFounderBandProps): ReactNode {
  const stats = isFr
    ? [
        {
          number: "0 intermédiaire",
          label: "Vous échangez directement avec l'expert qui construit",
        },
        { number: "Top 1 %", label: "Architectes & experts IA sélectionnés" },
        { number: "TPE → grands comptes", label: "Tous types de projets, toutes tailles" },
      ]
    : [
        { number: "0 middlemen", label: "You talk directly to the expert who builds" },
        { number: "Top 1%", label: "Selected AI architects & experts" },
        { number: "SMB → key accounts", label: "All project types, all sizes" },
      ];

  return (
    <section
      aria-labelledby="impl-founder-heading"
      className="bg-paper border-border border-t py-20 sm:py-24 lg:py-28"
    >
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Colonne gauche : copy */}
          <div className="max-w-2xl">
            <p className="text-fg-muted mb-6 text-[12px] font-semibold tracking-[0.2em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Qui vous accompagne" : "Who you work with"}
            </p>
            <h2
              id="impl-founder-heading"
              className="text-fg text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.02] font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "Ce qui nous importe," : "What matters to us:"}
              <br />
              <span className="text-terracotta italic">
                {isFr ? "c'est la perfection" : "perfection"}
              </span>
            </h2>
            <p className="text-fg-soft mt-7 text-lg leading-relaxed">
              {isFr
                ? "Avec William et son équipe, votre solution se construit dans des échanges directs et réguliers — un état d'esprit travailleur, professionnel et sympa. L'exigence dans le code, la bonne humeur dans la relation : c'est comme ça qu'on obtient des performances et un résultat optimum. Pas d'intermédiaire, pas de jargon — vous parlez à ceux qui construisent."
                : "With William and his team, your solution is built through direct, regular exchanges — a hardworking, professional and friendly mindset. Rigour in the code, good vibes in the relationship: that's how we reach real performance and an optimal result. No middleman, no jargon — you talk to the people who build it."}
            </p>
            <div className="border-border-strong mt-8 flex items-start gap-4 border-t pt-6">
              <span
                aria-hidden="true"
                className="bg-terracotta mt-1 inline-block h-6 w-0.5 shrink-0 rounded-full"
              />
              <p
                className="text-fg-soft text-base leading-relaxed italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr
                  ? "Votre réussite, c'est la nôtre — du premier échange à la mise en production."
                  : "Your success is ours — from the first chat to go-live."}
              </p>
            </div>
            <p className="mt-6">
              <Link
                href="/a-propos"
                className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {isFr ? "Découvrir notre approche" : "Discover our approach"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </p>
          </div>

          {/* Colonne droite : carte fondateur */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-xs">
              <figure className="shadow-card m-0 overflow-hidden rounded-2xl">
                <Image
                  src="/illustrations/william-fondateur-axion-ia.webp"
                  alt={
                    isFr
                      ? "Portrait de William, fondateur et CEO d'Axion-IA — pilote les implémentations IA avec une exigence technique et une relation directe et humaine."
                      : "Portrait of William, Axion-IA founder and CEO — drives AI implementations with technical rigour and a direct, human relationship."
                  }
                  width={1000}
                  height={1000}
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 1024px) 80vw, 320px"
                  className="aspect-[4/5] h-auto w-full object-cover"
                />
              </figure>
              <div className="mt-4 text-center">
                <p className="text-fg text-lg font-semibold">William</p>
                <p className="text-fg-muted text-sm">
                  {isFr ? "Fondateur & CEO · Axion-IA" : "Founder & CEO · Axion-IA"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar — 3 colonnes, angle humain (pas de redite avec « pourquoi nous ») */}
        <div className="border-border-strong mt-16 grid grid-cols-3 divide-x border-t pt-10">
          {stats.map((stat) => (
            <div key={stat.number} className="flex flex-col gap-1 px-6 first:pl-0 last:pr-0">
              <span
                className="text-fg text-[clamp(1.25rem,2.5vw,1.75rem)] leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {stat.number}
              </span>
              <span className="text-fg-soft text-sm leading-snug">{stat.label}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
