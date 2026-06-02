/**
 * ImplementationServices — « Nos services » : positionnement (façon AuditWhyAudit)
 * + carte « chaîne IA » (mocha, stepper Formation → Audit → Implémentation) +
 * les 4 piliers en cartes verticales hautes, alignées sur une seule ligne.
 *
 * Server Component pur, zéro JS (budget Web Vitals). Aucun prix. Tokens
 * uniquement. FR canonique — EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import Image from "next/image";
import { Rocket, Bot, Network, Gauge, ArrowRight, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";

interface Pillar {
  readonly icon: LucideIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly emFr: string;
  readonly emEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;
}

const PILLARS: ReadonlyArray<Pillar> = [
  {
    icon: Rocket,
    titleFr: "Implémentation",
    titleEn: "Implementation",
    emFr: "De la stratégie à la réalité",
    emEn: "From strategy to reality",
    bodyFr: "On transforme vos idées en solutions IA concrètes, livrées et performantes.",
    bodyEn: "We turn your ideas into concrete, delivered, high-performing AI solutions.",
  },
  {
    icon: Bot,
    titleFr: "Agents IA",
    titleEn: "AI agents",
    emFr: "Vos collaborateurs intelligents",
    emEn: "Your intelligent coworkers",
    bodyFr: "Des agents IA sur-mesure pour automatiser, assister et accélérer vos équipes.",
    bodyEn: "Custom AI agents to automate, assist and accelerate your teams.",
  },
  {
    icon: Network,
    titleFr: "Intégration native",
    titleEn: "Native integration",
    emFr: "dans votre écosystème",
    emEn: "into your ecosystem",
    bodyFr:
      "On se branche à vos outils et systèmes existants pour créer plus de valeur, plus vite.",
    bodyEn: "We plug into your existing tools and systems to create more value, faster.",
  },
  {
    icon: Gauge,
    titleFr: "Performance",
    titleEn: "Performance",
    emFr: "Mesurable. Durable. Réelle.",
    emEn: "Measurable. Lasting. Real.",
    bodyFr: "On pilote, on mesure et on optimise l'impact de vos solutions IA dans la durée.",
    bodyEn: "We steer, measure and optimise the impact of your AI solutions over time.",
  },
];

export interface ImplementationServicesProps {
  readonly isFr: boolean;
}

export function ImplementationServices({ isFr }: ImplementationServicesProps): ReactNode {
  return (
    <Section tone="canvas" className="py-16 sm:py-20 lg:py-24">
      {/* Ligne du haut — titre à gauche, carte « chaîne IA » mocha à droite */}
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Nos services" : "Our services"}
          </p>
          <h2 className="text-fg mt-5 text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
            {isFr ? "L'IA, tout le monde en parle." : "Everyone talks about AI."}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "Nous, on la met en production" : "We put it into production"}
            </span>
            .
          </h2>
          <p className="text-fg-soft mt-5 max-w-xl text-lg leading-relaxed">
            {isFr
              ? "Pas une démo, pas un proof-of-concept qui dort dans un tiroir : des solutions IA qui tournent vraiment dans votre entreprise. De la conception au déploiement, on couvre quatre piliers."
              : "Not a demo, not a proof-of-concept gathering dust: AI solutions that actually run inside your company. From design to deployment, we cover four pillars."}
          </p>
        </div>

        {/* Carte chaîne IA — l'implémentation comme aboutissement */}
        <div className="bg-mocha-rich text-mocha-fg shadow-card rounded-3xl px-6 py-7 text-center sm:px-8">
          <ul className="mb-5 flex list-none flex-wrap items-center justify-center gap-2.5 p-0">
            {[
              { label: isFr ? "Formation" : "Training", active: false },
              { label: "Audit", active: false },
              { label: isFr ? "Implémentation" : "Implementation", active: true },
            ].map((step, i) => (
              <li key={step.label} className="flex items-center gap-2.5">
                {i > 0 ? (
                  <ArrowRight
                    aria-hidden="true"
                    className="text-mocha-fg/40 h-4 w-4"
                    strokeWidth={2}
                  />
                ) : null}
                <span
                  className={
                    step.active
                      ? "bg-terracotta text-mocha-fg rounded-full px-4 py-1.5 text-[13px] font-bold tracking-wide"
                      : "border-mocha-fg/25 text-mocha-fg/80 rounded-full border px-4 py-1.5 text-[13px] font-semibold"
                  }
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ul>
          <p
            className="text-[clamp(1.1rem,2vw,1.45rem)] leading-snug font-medium"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr
              ? "De la formation à l'intégration, nous maîtrisons toute la chaîne de l'IA. "
              : "From training to integration, we master the entire AI chain. "}
            <span className="text-terracotta-soft italic">
              {isFr
                ? "Et tout se concrétise ici, en production — du premier agent connecté à vos outils au déploiement à l'échelle de toute l'entreprise."
                : "And it all comes to life here, in production — from your first agent wired into your tools to deployment across the whole company."}
            </span>
          </p>
        </div>
      </div>

      {/* 4 piliers — cartes VERTICALES hautes, sur une seule ligne dès md */}
      <ul className="mt-12 grid list-none grid-cols-2 gap-4 p-0 sm:gap-5 md:grid-cols-4">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <li
              key={p.titleFr}
              className="bg-paper border-border shadow-subtle hover:border-terracotta/50 hover:shadow-card flex h-full min-h-[18rem] flex-col overflow-hidden rounded-3xl border transition"
            >
              <span aria-hidden="true" className="bg-terracotta block h-1.5 w-full shrink-0" />
              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <span className="bg-terracotta-soft text-terracotta-deep mb-5 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h3 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                  {isFr ? p.titleFr : p.titleEn}
                </h3>
                <p
                  className="text-terracotta mt-1 text-[15px] leading-snug italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? p.emFr : p.emEn}
                </p>
                <p className="text-fg-soft mt-4 text-[14px] leading-relaxed">
                  {isFr ? p.bodyFr : p.bodyEn}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Visuel des 4 piliers — sous la section, SANS cadre ni fond (le visuel
          a son propre fond, il se pose à même la section comme l'image
          méthodologie d'audit). Below-the-fold → lazy, aucun coût LCP. */}
      <figure className="m-0 mt-12 overflow-hidden rounded-2xl">
        <Image
          src="/illustrations/implementation-piliers-axion-ia.webp"
          alt={
            isFr
              ? "Les 4 piliers de l'implémentation IA Axion-IA : Implémentation (de la stratégie à la réalité), Agents IA (vos collaborateurs intelligents), Intégration native (dans votre écosystème) et Performance (mesurable, durable, réelle)."
              : "The 4 pillars of Axion-IA AI implementation: Implementation, AI agents, Native integration and Performance."
          }
          width={1600}
          height={484}
          loading="lazy"
          decoding="async"
          sizes="(max-width: 1520px) 92vw, 1456px"
          className="h-auto w-full"
        />
      </figure>
    </Section>
  );
}
