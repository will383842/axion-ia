// Server Component — schéma visuel du hero /methodologie.
// FLOW NARRATIF en 3 actes (variante AuditHeroSchema) adaptée à la
// méthodologie Axion-IA en 4 étapes :
//
//   ACTE 1 — INPUT : votre entreprise telle qu'elle est aujourd'hui.
//   ACTE 2 — PROCESSUS : 4 étapes méthodologiques (Identifier, Auditer,
//                        Implémenter, Mesurer).
//   ACTE 3 — OUTPUT : 4 résultats opérationnels concrets.
//
// Doctrine identique à AuditHeroSchema : zéro fond (transparent), pas de
// halos massifs, pas de grille. Langage simple, business, pas de jargon.
// Pas de chiffres engagés sur durée (consultent CLAUDE.md règles
// éditoriales).
//
// Chaque acte = un bloc autonome ; lecture du haut vers le bas.

import type { ReactNode } from "react";
import {
  Building2,
  Search,
  ClipboardList,
  Rocket,
  LineChart,
  Target,
  Wallet,
  Zap,
  GraduationCap,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";

export interface MethodologyHeroSchemaProps {
  /** Localisation des labels — FR ou EN. */
  isFr: boolean;
  /** Texte alternatif pour les lecteurs d'écran (le SVG est décoratif). */
  ariaLabel: string;
  className?: string;
}

interface ProcessStep {
  icon: LucideIcon;
  title: string;
  detail: string;
}

interface Outcome {
  icon: LucideIcon;
  label: string;
}

export function MethodologyHeroSchema({
  isFr,
  ariaLabel,
  className,
}: MethodologyHeroSchemaProps): ReactNode {
  // 4 étapes méthodologiques — ce qu'on FAIT pendant un cycle complet
  // Axion-IA (Identifier → Auditer → Implémenter → Mesurer).
  const steps: ReadonlyArray<ProcessStep> = isFr
    ? [
        {
          icon: Search,
          title: "Identifier",
          detail: "Cartographie terrain : on repère les process où l'IA peut faire la différence.",
        },
        {
          icon: ClipboardList,
          title: "Auditer",
          detail: "Plan chiffré priorisé : ROI, complexité, ordre de déploiement.",
        },
        {
          icon: Rocket,
          title: "Implémenter",
          detail: "Mise en production progressive avec vos équipes, pas à leur place.",
        },
        {
          icon: LineChart,
          title: "Mesurer",
          detail: "ROI réel post-déploiement. Itération si besoin. Pas d'engagement long.",
        },
      ]
    : [
        {
          icon: Search,
          title: "Identify",
          detail: "Field mapping: spot the processes where AI can actually move the needle.",
        },
        {
          icon: ClipboardList,
          title: "Audit",
          detail: "Costed prioritised plan: ROI, complexity, deployment order.",
        },
        {
          icon: Rocket,
          title: "Implement",
          detail: "Progressive go-live with your teams, not in their place.",
        },
        {
          icon: LineChart,
          title: "Measure",
          detail: "Real ROI post-deployment. Iterate if needed. No long-term lock-in.",
        },
      ];

  // 4 résultats opérationnels — ce que la méthode produit concrètement.
  const outcomes: ReadonlyArray<Outcome> = isFr
    ? [
        { icon: Target, label: "Un plan IA chiffré et priorisé" },
        { icon: Zap, label: "Des process clés automatisés" },
        { icon: GraduationCap, label: "Vos équipes formées et autonomes" },
        { icon: Wallet, label: "Un ROI mesuré, pas promis" },
      ]
    : [
        { icon: Target, label: "A costed prioritised AI plan" },
        { icon: Zap, label: "Key processes automated" },
        { icon: GraduationCap, label: "Your teams trained and autonomous" },
        { icon: Wallet, label: "ROI measured, not promised" },
      ];

  return (
    <div role="img" aria-label={ariaLabel} className={className ?? "hero-schema"}>
      {/* === ACTE 1 — Votre entreprise (input) === */}
      <div className="border-border-strong bg-paper shadow-subtle relative rounded-2xl border-2 p-4 sm:p-5">
        <p className="text-fg-muted mb-2.5 text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px]">
          {isFr ? "Au départ" : "Starting point"}
        </p>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="bg-terracotta-soft text-terracotta-deep flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12">
            <Building2 aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p
              className="text-fg text-xl leading-tight font-medium tracking-tight italic sm:text-2xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "Votre entreprise" : "Your company"}
            </p>
            <p className="text-fg-soft mt-1 text-[12.5px] leading-snug sm:text-[13.5px]">
              {isFr
                ? "Telle qu'elle tourne aujourd'hui — équipes, outils, dépenses."
                : "As it runs today — teams, tools, spending."}
            </p>
          </div>
        </div>
      </div>

      {/* Connecteur — flèche vers le bas */}
      <FlowArrow label={isFr ? "Notre méthode" : "Our method"} />

      {/* === ACTE 2 — Processus 4 étapes === */}
      <div className="border-terracotta/40 bg-halo-warm relative rounded-2xl border-2 p-4 sm:p-5">
        <p className="text-terracotta-deep mb-3 text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px]">
          <span
            aria-hidden="true"
            className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
          />
          {isFr ? "4 étapes vers le ROI" : "4 steps to ROI"}
        </p>
        <ol className="space-y-2.5">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const num = String(i + 1).padStart(2, "0");
            return (
              <li
                key={s.title}
                className="border-terracotta/15 bg-paper relative flex items-start gap-2.5 rounded-lg border p-3 sm:p-3.5"
              >
                <span
                  aria-hidden="true"
                  className="text-terracotta-deep mt-0.5 text-[10px] font-bold tracking-[0.12em] uppercase tabular-nums"
                >
                  {num}
                </span>
                <span className="bg-terracotta-soft text-terracotta-deep flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                  <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <p className="text-fg text-[13.5px] leading-tight font-bold sm:text-[14.5px]">
                    {s.title}
                  </p>
                  <p className="text-fg-soft mt-0.5 text-[12px] leading-snug sm:text-[12.5px]">
                    {s.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Connecteur */}
      <FlowArrow label={isFr ? "Vos résultats" : "Your results"} />

      {/* === ACTE 3 — Résultats opérationnels (output) === */}
      <div className="border-mocha-fg/20 bg-mocha-rich text-mocha-fg relative rounded-2xl border-2 p-4 sm:p-5">
        <p className="text-mocha-fg/70 mb-3 text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px]">
          <span
            aria-hidden="true"
            className="bg-terracotta-soft mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
          />
          {isFr ? "Ce que vous obtenez" : "What you get"}
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {outcomes.map((o) => {
            const Icon = o.icon;
            return (
              <li
                key={o.label}
                className="border-mocha-fg/15 bg-mocha-soft flex items-center gap-2.5 rounded-lg border p-2.5 sm:p-3"
              >
                <span className="bg-terracotta text-mocha-fg flex h-7 w-7 shrink-0 items-center justify-center rounded-md sm:h-8 sm:w-8">
                  <Icon
                    aria-hidden="true"
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                    strokeWidth={2.25}
                  />
                </span>
                <span className="text-mocha-fg text-[12.5px] leading-tight font-semibold sm:text-[13.5px]">
                  {o.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Flèche verticale décorative entre deux actes du flow — compacte. */
function FlowArrow({ label }: { label: string }) {
  return (
    <div aria-hidden="true" className="relative flex flex-col items-center py-2.5">
      <div className="bg-border-strong h-4 w-0.5" />
      <span className="bg-terracotta-soft text-terracotta-deep border-terracotta/30 shadow-subtle my-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.14em] uppercase">
        <ArrowDown className="h-3 w-3" strokeWidth={3} />
        {label}
      </span>
      <div className="bg-border-strong h-4 w-0.5" />
    </div>
  );
}
