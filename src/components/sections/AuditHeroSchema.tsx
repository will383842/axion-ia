// Server Component — schéma visuel du hero /audit.
// FLOW NARRATIF en 3 actes : ce QU'EST un audit + COMMENT IL FONCTIONNE.
//
//   ACTE 1 — INPUT : Votre entreprise telle qu'elle est aujourd'hui.
//   ACTE 2 — PROCESSUS : 4 étapes méthodologiques de l'audit.
//   ACTE 3 — OUTPUT : les 5 gains business concrets que ça vous apporte.
//
// Doctrine : zéro fond (transparent). Pas de halos massifs, pas de grille.
// Langage simple, business, sans jargon. Aucun chiffre engagé sur durée.
//
// Chaque acte = un bloc autonome ; la lecture se fait de haut en bas.

import type { ReactNode } from "react";
import {
  Building2,
  Eye,
  Map as MapIcon,
  TrendingUp,
  ClipboardCheck,
  Zap,
  Clock,
  Wallet,
  GraduationCap,
  LineChart,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";

export interface AuditHeroSchemaProps {
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

export function AuditHeroSchema({ isFr, ariaLabel, className }: AuditHeroSchemaProps): ReactNode {
  // 4 étapes méthodologiques — ce qu'on FAIT pendant un audit.
  const steps: ReadonlyArray<ProcessStep> = isFr
    ? [
        {
          icon: Eye,
          title: "On observe",
          detail: "Entretiens équipes, lecture de vos process tels qu'ils sont.",
        },
        {
          icon: MapIcon,
          title: "On cartographie",
          detail: "On repère où l'IA peut faire gagner du temps ou de l'argent.",
        },
        {
          icon: TrendingUp,
          title: "On priorise",
          detail: "Le plus rentable, le plus simple, le plus rapide à mettre.",
        },
        {
          icon: ClipboardCheck,
          title: "On vous remet le plan",
          detail: "Document clair : quoi faire, combien ça rapporte, par où commencer.",
        },
      ]
    : [
        {
          icon: Eye,
          title: "We observe",
          detail: "Meet your team, read your processes as they are today.",
        },
        {
          icon: MapIcon,
          title: "We map",
          detail: "Spot where AI can save you time or money.",
        },
        {
          icon: TrendingUp,
          title: "We prioritise",
          detail: "Biggest gain, simplest move, quickest win first.",
        },
        {
          icon: ClipboardCheck,
          title: "We hand over the plan",
          detail: "Clear document: what to do, what it brings in, where to start.",
        },
      ];

  // 6 gains business — pourquoi ça vaut le coup. Pas de chiffres engagés.
  // Ordre : top-line (CA, rentabilité) → opérationnel (auto, heures) →
  // capital humain (formation) → pilotage (suivi temps réel).
  const outcomes: ReadonlyArray<Outcome> = isFr
    ? [
        { icon: TrendingUp, label: "Chiffre d'affaires en hausse" },
        { icon: Wallet, label: "Rentabilité améliorée" },
        { icon: Zap, label: "Tâches répétitives automatisées" },
        { icon: Clock, label: "Heures équipes libérées" },
        { icon: GraduationCap, label: "Commerciaux & équipes formés à l'IA" },
        { icon: LineChart, label: "Pilotage de l'activité au jour le jour" },
      ]
    : [
        { icon: TrendingUp, label: "Revenue growth" },
        { icon: Wallet, label: "Improved profitability" },
        { icon: Zap, label: "Repetitive tasks automated" },
        { icon: Clock, label: "Team hours freed up" },
        { icon: GraduationCap, label: "Sales & teams trained in AI" },
        { icon: LineChart, label: "Day-to-day activity tracking" },
      ];

  return (
    <div role="img" aria-label={ariaLabel} className={className ?? "mx-auto w-full max-w-xl"}>
      {/* === ACTE 1 — Votre entreprise (input) === */}
      <div className="border-border-strong bg-paper shadow-subtle relative rounded-2xl border-2 p-4 sm:p-5">
        <p className="text-fg-muted mb-2.5 text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px]">
          {isFr ? "Au départ" : "Starting point"}
        </p>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="bg-terracotta-soft text-terracotta-deep flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12">
            <Building2
              aria-hidden="true"
              className="h-5 w-5 sm:h-6 sm:w-6"
              strokeWidth={2.25}
            />
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
      <FlowArrow label={isFr ? "Notre audit" : "Our audit"} />

      {/* === ACTE 2 — Processus de l'audit (4 étapes) === */}
      <div className="border-terracotta/40 bg-halo-warm relative rounded-2xl border-2 p-4 sm:p-5">
        <p className="text-terracotta-deep mb-3 text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px]">
          <span
            aria-hidden="true"
            className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
          />
          {isFr ? "Comment se déroule un audit" : "How an audit unfolds"}
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
                  <Icon
                    aria-hidden="true"
                    className="h-4 w-4"
                    strokeWidth={2.25}
                  />
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
      <FlowArrow label={isFr ? "Vos gains" : "Your gains"} />

      {/* === ACTE 3 — Bénéfices business (output) === */}
      <div className="border-mocha-fg/20 bg-mocha-rich text-mocha-fg relative rounded-2xl border-2 p-4 sm:p-5">
        <p className="text-mocha-fg/70 mb-3 text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px]">
          <span
            aria-hidden="true"
            className="bg-terracotta-soft mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
          />
          {isFr ? "Ce que ça vous apporte concrètement" : "What it actually brings you"}
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
