/**
 * ImplementationPillarChoices — 3 portes d'entrée (audit / direct / sans abo).
 *
 * Sprint A · Phase 2 Extract-3 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/implementation/page.tsx` (l.872-914). 3 cartes orienteurs
 * avec CTAs (audit, ancre catalogue, méthodologie). Sert de pivot vers le
 * catalogue ou un audit selon la maturité du visiteur.
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";

export interface ImplementationPillarChoicesProps {
  readonly isFr: boolean;
}

export function ImplementationPillarChoices({ isFr }: ImplementationPillarChoicesProps): ReactNode {
  const pillars = isFr
    ? [
        {
          eyebrow: "Idéal",
          title: "Audit d'abord",
          description:
            "Pour cadrer votre projet et identifier les usages à plus fort impact avant d'investir. Quatre niveaux d'audit, du diagnostic Flash à l'audit stratégique ETI.",
          ctaLabel: "Voir les niveaux d'audit",
          ctaHref: "/audit",
        },
        {
          eyebrow: "Si vous savez",
          title: "Implémentation directe",
          description:
            "Vous avez une idée précise (chatbot, devis auto, assistant commercial). On l'installe en 2 à 6 semaines, en forfait fixe.",
          ctaLabel: "Voir le catalogue",
          ctaHref: "#catalogue",
        },
        {
          eyebrow: "Notre engagement",
          title: "Sans abonnement",
          description:
            "Vous payez une fois, c'est à vous. Pas de maintenance mensuelle imposée. Évolutions plus tard si vous le décidez.",
          ctaLabel: "Comment ça marche",
          ctaHref: "/methodologie",
        },
      ]
    : [
        {
          eyebrow: "Ideal",
          title: "Audit first",
          description:
            "To frame your project and identify the highest-impact uses before investing. Four audit levels, from Flash diagnosis to strategic mid-cap audit.",
          ctaLabel: "See audit levels",
          ctaHref: "/audit",
        },
        {
          eyebrow: "If you know",
          title: "Direct implementation",
          description:
            "You have a clear idea (chatbot, auto-quoting, sales assistant). We install it in 2 to 6 weeks, fixed fee.",
          ctaLabel: "See the catalogue",
          ctaHref: "#catalogue",
        },
        {
          eyebrow: "Our commitment",
          title: "No subscription",
          description:
            "You pay once, it's yours. No imposed monthly maintenance. Future evolutions only if you decide so.",
          ctaLabel: "How it works",
          ctaHref: "/methodologie",
        },
      ];

  return (
    <Section
      eyebrow={isFr ? "Deux portes d'entrée" : "Two ways in"}
      title={isFr ? "Audit, ou directement implémentation" : "Audit, or straight to implementation"}
    >
      <ul className="grid gap-6 md:grid-cols-3">
        {pillars.map((p) => (
          <li
            key={p.title}
            className="border-border bg-paper flex flex-col gap-5 rounded-2xl border p-7 sm:p-8"
          >
            <p className="text-fg-muted text-[12px] font-medium tracking-[0.18em] uppercase">
              {p.eyebrow}
            </p>
            <h3
              className="text-fg text-[1.6rem] leading-tight font-medium"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {p.title}
            </h3>
            <p className="text-fg-soft text-base leading-relaxed">{p.description}</p>
            <div className="mt-auto pt-2">
              {p.ctaHref.startsWith("#") ? (
                <a
                  href={p.ctaHref}
                  className="text-terracotta-deep hover:text-terracotta inline-flex items-center gap-1 text-sm font-semibold"
                >
                  {p.ctaLabel} →
                </a>
              ) : (
                <Link
                  href={p.ctaHref as never}
                  className="text-terracotta-deep hover:text-terracotta inline-flex items-center gap-1 text-sm font-semibold"
                >
                  {p.ctaLabel} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
