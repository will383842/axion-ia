/**
 * AuditWhyChooseUs — « Pourquoi nous choisir » : section premium de
 * positionnement, placée juste après « À qui s'adressent nos audits IA ? ».
 *
 * Refonte 2026-05-31 (Will) — message différenciant fort, distinct du reste de
 * la page :
 *   - On maîtrise TOUTE la chaîne IA & automatisation, de bout en bout : de la
 *     formation à l'implémentation complète, avec la même équipe (spécialistes,
 *     architectes, experts seniors).
 *   - La première plateforme à tout couvrir avec du VRAI code source sur-mesure
 *     — pas du rafistolage de connecteurs no-code grand public (non nommés).
 *   - De l'audit au cadrage de vos premiers agents IA : on enchaîne dans la
 *     continuité, recommandations directement exploitables.
 *   - Interventions présentielles partout en France.
 *
 * Fond clair `halo-warm` (Will 2026-05-31 : le fond sombre était trop dur).
 * Server Component pur, zéro JS (budget Web Vitals). FR canonique — EN = miroir
 * (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import {
  Workflow,
  Code2,
  Award,
  Rocket,
  MapPin,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/layout/Container";

interface Differentiator {
  readonly icon: LucideIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;
}

interface ChainStep {
  readonly labelFr: string;
  readonly labelEn: string;
  readonly descFr: string;
  readonly descEn: string;
  /** Étape mise en avant (l'audit, point d'entrée). */
  readonly active?: boolean;
  /** Étape renforcée visuellement (le code source, preuve du de-bout-en-bout). */
  readonly strong?: boolean;
}

export interface AuditWhyChooseUsProps {
  readonly isFr: boolean;
}

export function AuditWhyChooseUs({ isFr }: AuditWhyChooseUsProps): ReactNode {
  // La chaîne IA complète — l'audit n'est qu'un maillon, on couvre tout.
  const chain: ReadonlyArray<ChainStep> = [
    {
      labelFr: "Formation",
      labelEn: "Training",
      descFr: "Acculturer vos équipes à l'IA",
      descEn: "Upskill your teams on AI",
    },
    {
      labelFr: "Audit IA",
      labelEn: "AI audit",
      descFr: "Cartographier les usages, chiffrer le ROI",
      descEn: "Map use cases, quantify ROI",
      active: true,
    },
    {
      labelFr: "Architecture",
      labelEn: "Architecture",
      descFr: "Concevoir la solution sur-mesure",
      descEn: "Design the bespoke solution",
    },
    {
      labelFr: "Développement",
      labelEn: "Development",
      descFr: "Du vrai code source, maîtrisé",
      descEn: "Real source code, fully owned",
      strong: true,
    },
    {
      labelFr: "Implémentation",
      labelEn: "Implementation",
      descFr: "Déployer en production, intégré à vos outils",
      descEn: "Deploy to production, integrated with your tools",
    },
    {
      labelFr: "Adoption & pilotage",
      labelEn: "Adoption & steering",
      descFr: "Mesurer, faire durer, améliorer",
      descEn: "Measure, sustain, improve",
    },
  ];

  const points: ReadonlyArray<Differentiator> = [
    {
      icon: Workflow,
      titleFr: "Toute la chaîne IA, de bout en bout",
      titleEn: "The whole AI chain, end to end",
      bodyFr:
        "De la formation à l'implémentation complète : audit, architecture, développement, déploiement, adoption. Une seule équipe, aucun passage de relais.",
      bodyEn:
        "From training to full implementation: audit, architecture, development, deployment, adoption. One team, no handover.",
    },
    {
      icon: Code2,
      titleFr: "Du vrai code source, pas du rafistolage",
      titleEn: "Real source code, not duct tape",
      bodyFr:
        "Des solutions développées sur-mesure et maîtrisées ligne par ligne — pas des connecteurs no-code grand public assemblés à la va-vite, qui cèdent au premier imprévu.",
      bodyEn:
        "Bespoke solutions we own line by line — not mass-market no-code connectors patched together in a hurry that break at the first edge case.",
    },
    {
      icon: Award,
      titleFr: "Architectes & experts seniors",
      titleEn: "Senior architects & experts",
      bodyFr:
        "Des profils qui comprennent à la fois l'enjeu métier, la contrainte technique et la réalité du terrain. Des recommandations directement exploitables, jamais hors-sol.",
      bodyEn:
        "Profiles who grasp the business stakes, the technical constraints and the field reality at once. Recommendations you can act on immediately, never abstract.",
    },
    {
      icon: Rocket,
      titleFr: "De l'audit au cadrage de vos agents IA",
      titleEn: "From audit to scoping your AI agents",
      bodyFr:
        "On ne s'arrête pas au diagnostic : on enchaîne sur le cadrage et la mise en œuvre de vos premiers agents IA, dans la continuité — sans repartir de zéro.",
      bodyEn:
        "We don't stop at the diagnosis: we move straight on to scoping and building your first AI agents, seamlessly — no starting from scratch.",
    },
  ];

  return (
    <section className="bg-halo-warm text-fg relative overflow-hidden py-24 sm:py-28 lg:py-32">
      {/* Halo décoratif terracotta diffus (CSS pur, zéro JS) */}
      <div
        aria-hidden="true"
        className="bg-terracotta/10 pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl"
      />

      <Container className="relative">
        {/* Header 2 colonnes — pitch à gauche, chaîne IA à droite */}
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Pourquoi nous choisir" : "Why choose us"}
            </p>
            <h2 className="text-fg mt-5 text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
              {isFr ? "Le seul partenaire qui maîtrise " : "The only partner who masters "}
              <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
                {isFr ? "toute la chaîne IA, de bout en bout." : "the entire AI chain, end to end."}
              </span>
            </h2>
            <p className="text-fg-soft mt-6 max-w-xl text-lg leading-relaxed">
              {isFr
                ? "Un audit IA n'a de valeur que mené par des profils capables de comprendre l'enjeu métier, la contrainte technique et la réalité de la mise en œuvre. Chez Axion-IA, on combine spécialistes, architectes et experts seniors — et on va jusqu'au bout : de la formation à l'implémentation complète."
                : "An AI audit is only worth what the people running it can grasp — business stakes, technical constraints and delivery reality. At Axion-IA we combine senior specialists, architects and experts — and we go all the way: from training to full implementation."}
            </p>

            {/* Claim de positionnement — la première plateforme bout-en-bout */}
            <p className="border-terracotta/30 bg-terracotta-soft/40 text-fg mt-7 flex items-start gap-3 rounded-2xl border px-5 py-4 text-[15px] leading-snug font-medium">
              <Sparkles
                aria-hidden="true"
                className="text-terracotta-deep mt-0.5 h-5 w-5 shrink-0"
                strokeWidth={2}
              />
              <span>
                {isFr ? (
                  <>
                    La première plateforme à couvrir{" "}
                    <span className="font-bold">toute la chaîne IA & automatisation</span> de bout
                    en bout — avec du <span className="font-bold">vrai code source</span>, pas des
                    applications rafistolées. Avec des interventions{" "}
                    <span className="font-bold">partout en France</span>.
                  </>
                ) : (
                  <>
                    The first platform covering the{" "}
                    <span className="font-bold">entire AI &amp; automation chain</span> end to end —
                    with <span className="font-bold">real source code</span>, not duct-taped apps.
                    With on-site work <span className="font-bold">across France</span>.
                  </>
                )}
              </span>
            </p>
          </div>

          {/* Chaîne IA — stepper vertical, l'audit comme point d'entrée */}
          <div className="border-border bg-paper shadow-card rounded-3xl border p-6 sm:p-8">
            <p className="text-fg-muted mb-6 text-[11px] font-bold tracking-[0.18em] uppercase">
              {isFr ? "La chaîne IA complète" : "The complete AI chain"}
            </p>
            <ol className="relative space-y-0 p-0">
              {chain.map((step, i) => (
                <li key={step.labelFr} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Ligne de liaison verticale */}
                  {i < chain.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="bg-border absolute top-3 left-[5px] h-full w-px"
                    />
                  ) : null}
                  {/* Nœud */}
                  <span
                    aria-hidden="true"
                    className={
                      step.active
                        ? "bg-terracotta ring-terracotta/25 relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full ring-4"
                        : step.strong
                          ? "bg-terracotta/60 relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full"
                          : "bg-border-strong relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full"
                    }
                  />
                  <div className="min-w-0">
                    <p
                      className={
                        step.active
                          ? "text-terracotta-deep text-[15px] leading-tight font-bold"
                          : "text-fg text-[15px] leading-tight font-semibold"
                      }
                    >
                      {isFr ? step.labelFr : step.labelEn}
                      {step.active ? (
                        <span className="bg-terracotta text-paper ml-2 rounded-full px-2 py-0.5 align-middle text-[10px] font-bold tracking-wide uppercase">
                          {isFr ? "vous êtes ici" : "you are here"}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-fg-muted mt-0.5 text-[13px] leading-snug">
                      {isFr ? step.descFr : step.descEn}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* 4 différenciants */}
        <ul className="mt-16 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {points.map((p) => {
            const Icon = p.icon;
            return (
              <li
                key={p.titleFr}
                className="border-border bg-paper shadow-subtle hover:border-terracotta/50 hover:shadow-card flex h-full flex-col rounded-2xl border p-6 transition"
              >
                <span className="bg-terracotta-soft text-terracotta-deep mb-5 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h3 className="text-fg text-[16px] leading-snug font-bold tracking-tight">
                  {isFr ? p.titleFr : p.titleEn}
                </h3>
                <p className="text-fg-soft mt-2.5 text-[13.5px] leading-relaxed">
                  {isFr ? p.bodyFr : p.bodyEn}
                </p>
              </li>
            );
          })}
        </ul>

        {/* Bandeau bas — réassurances de posture */}
        <ul className="mt-12 flex list-none flex-wrap items-center justify-center gap-x-7 gap-y-3 p-0">
          {(isFr
            ? [
                { icon: MapPin, label: "Présentiel partout en France" },
                { icon: Award, label: "Architectes & experts seniors" },
                { icon: Code2, label: "Code source maîtrisé, pas de boîte noire" },
                { icon: ShieldCheck, label: "Conforme RGPD & AI Act 2026" },
              ]
            : [
                { icon: MapPin, label: "On-site across France" },
                { icon: Award, label: "Senior architects & experts" },
                { icon: Code2, label: "Owned source code, no black box" },
                { icon: ShieldCheck, label: "GDPR & AI Act 2026 compliant" },
              ]
          ).map((b) => {
            const Icon = b.icon;
            return (
              <li
                key={b.label}
                className="text-fg-soft flex items-center gap-2 text-[13px] font-semibold"
              >
                <Icon
                  aria-hidden="true"
                  className="text-terracotta-deep h-4 w-4 shrink-0"
                  strokeWidth={2}
                />
                {b.label}
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
