/**
 * AuditWhyAudit — « Pourquoi commencer par un audit », en contraste visuel.
 *
 * Refonte 2026-05-31 (Will) — message : foncer sans diagnostic coûte cher ;
 * l'audit Axion-IA transforme le flou en plan rentable. Posture assumée de
 * référence française. Rendu très visuel : bande de preuves, opposition
 * « foncer tête baissée » ❌ vs « la méthode Axion-IA » ✅ (carte mise en
 * avant), claim de leadership. Écriture propre à Axion-IA (pas de paraphrase
 * du marché).
 *
 * Server Component pur, zéro JS (budget Web Vitals). FR canonique — EN =
 * miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import {
  X,
  Check,
  Target,
  Filter,
  Coins,
  Lock,
  Cpu,
  MapPin,
  ScrollText,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Section } from "@/components/layout/Section";

interface Row {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly sub: string;
}

export interface AuditWhyAuditProps {
  readonly isFr: boolean;
}

export function AuditWhyAudit({ isFr }: AuditWhyAuditProps): ReactNode {
  // Bande de preuves — positionnement défendable, sans chiffres inventés.
  const proofs: ReadonlyArray<{ icon: LucideIcon; label: string }> = [
    { icon: Cpu, label: isFr ? "100 % dédié à l'IA" : "100% AI-focused" },
    { icon: MapPin, label: isFr ? "Partout en France" : "Across France" },
    { icon: ScrollText, label: isFr ? "Conforme AI Act 2026" : "AI Act 2026 ready" },
    { icon: Workflow, label: isFr ? "Du diagnostic à l'exécution" : "From diagnosis to delivery" },
  ];

  // « Foncer tête baissée » — le coût de l'impasse (voix Axion-IA).
  const risks: ReadonlyArray<Pick<Row, "title" | "sub">> = [
    {
      title: isFr ? "Des mois de bricolage" : "Months of tinkering",
      sub: isFr
        ? "Essais sans fin, budget qui file, aucun cap."
        : "Endless trials, budget bleeding, no direction.",
    },
    {
      title: isFr ? "Vos données exposées" : "Your data exposed",
      sub: isFr
        ? "Des outils branchés sans le moindre garde-fou."
        : "Tools plugged in with zero guardrails.",
    },
    {
      title: isFr ? "Un ROI au doigt mouillé" : "A finger-in-the-air ROI",
      sub: isFr
        ? "On investit en espérant. Jamais en sachant."
        : "You invest hoping. Never knowing.",
    },
  ];

  // « La méthode Axion-IA » — ce qu'on verrouille (voix Axion-IA, pas le
  // découpage du marché).
  const wins: ReadonlyArray<Row> = [
    {
      icon: Target,
      title: isFr ? "Vos vrais leviers" : "Your real levers",
      sub: isFr
        ? "Les process où l'IA déplace l'aiguille — pas les gadgets."
        : "The processes where AI moves the needle — not gadgets.",
    },
    {
      icon: Filter,
      title: isFr ? "Le tri des usages" : "Use cases, filtered",
      sub: isFr
        ? "Ce qui colle à votre métier, la hype écartée."
        : "What fits your business, hype removed.",
    },
    {
      icon: Coins,
      title: isFr ? "Des euros, pas des promesses" : "Euros, not promises",
      sub: isFr
        ? "Chaque gain estimé, en heures et en cash."
        : "Each gain estimated, in hours and in cash.",
    },
    {
      icon: Lock,
      title: isFr ? "Risques verrouillés" : "Risks locked down",
      sub: isFr
        ? "Données, conformité, dépendances : cadrés d'entrée."
        : "Data, compliance, dependencies: framed upfront.",
    },
  ];

  return (
    <Section
      tone="canvas"
      eyebrow={isFr ? "Audit IA · la référence française" : "AI audit · the French benchmark"}
      title={isFr ? "L'IA, tout le monde en parle." : "Everyone talks about AI."}
      titleEm={isFr ? "Nous, on la rend rentable" : "We make it pay off"}
      titleTail="."
      description={
        isFr
          ? "Foncer sans diagnostic, c'est payer pour apprendre. Notre audit transforme le flou en plan : les bons usages, chiffrés et sécurisés, avant le premier euro engagé."
          : "Diving in without a diagnosis means paying to learn. Our audit turns the fog into a plan: the right use cases, costed and secured, before the first euro is committed."
      }
    >
      {/* Bande de preuves — positionnement leader, visuel */}
      <ul className="mb-10 flex list-none flex-wrap justify-center gap-3 p-0">
        {proofs.map((p) => {
          const Icon = p.icon;
          return (
            <li
              key={p.label}
              className="border-terracotta/30 bg-terracotta-soft/40 text-terracotta-deep inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold"
            >
              <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              {p.label}
            </li>
          );
        })}
      </ul>

      {/* Opposition visuelle — « foncer » ❌ vs « Axion-IA » ✅ */}
      <div className="relative grid gap-6 lg:grid-cols-2 lg:gap-10">
        {/* Badge VS centré (desktop) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 hidden items-center justify-center lg:flex"
        >
          <span className="bg-fg text-bg shadow-card flex h-14 w-14 items-center justify-center rounded-full text-sm font-black tracking-wide">
            VS
          </span>
        </div>

        {/* Colonne FROIDE — foncer tête baissée */}
        <div className="bg-sand border-border-strong/40 rounded-3xl border p-7 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="bg-bg border-border text-fg-muted flex h-11 w-11 items-center justify-center rounded-2xl border">
              <X aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
            </span>
            <p className="text-fg-muted text-[13px] font-bold tracking-[0.16em] uppercase">
              {isFr ? "Foncer tête baissée" : "Diving in head first"}
            </p>
          </div>
          <ul className="list-none space-y-4 p-0">
            {risks.map((r) => (
              <li key={r.title} className="flex items-start gap-3">
                <X
                  aria-hidden="true"
                  className="text-fg-muted mt-0.5 h-4 w-4 shrink-0"
                  strokeWidth={2.5}
                />
                <div className="min-w-0">
                  <p className="text-fg text-[15px] leading-tight font-semibold">{r.title}</p>
                  <p className="text-fg-soft mt-0.5 text-[13px] leading-snug">{r.sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Colonne CHAUDE — la méthode Axion-IA (mise en avant) */}
        <div className="border-terracotta bg-paper shadow-card relative rounded-3xl border-2 p-7 sm:p-8">
          <span className="bg-terracotta text-mocha-fg absolute -top-3 right-6 rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.14em] uppercase">
            {isFr ? "La méthode Axion-IA" : "The Axion-IA method"}
          </span>
          <div className="mb-6 flex items-center gap-3">
            <span className="bg-terracotta-soft text-terracotta-deep flex h-11 w-11 items-center justify-center rounded-2xl">
              <Check aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
            </span>
            <p className="text-terracotta-deep text-[13px] font-bold tracking-[0.16em] uppercase">
              {isFr ? "Commencer par l'audit" : "Start with the audit"}
            </p>
          </div>
          <ul className="grid list-none gap-4 p-0 sm:grid-cols-2">
            {wins.map((w) => {
              const Icon = w.icon;
              return (
                <li key={w.title} className="flex items-start gap-3">
                  <span className="bg-terracotta-soft text-terracotta-deep flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                    <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-fg text-[14.5px] leading-tight font-semibold">{w.title}</p>
                    <p className="text-fg-soft mt-0.5 text-[12.5px] leading-snug">{w.sub}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Claim de leadership — la sensation « les meilleurs en France » */}
      <div className="bg-mocha-rich text-mocha-fg shadow-card mt-10 rounded-3xl px-7 py-8 text-center sm:px-10">
        <p
          className="mx-auto max-w-3xl text-[clamp(1.15rem,2.2vw,1.6rem)] leading-snug font-medium"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {isFr
            ? "On ne fait que ça — de la TPE à l'ETI, partout en France. "
            : "It's all we do — from micro-business to mid-cap, across France. "}
          <span className="text-terracotta-soft italic">
            {isFr
              ? "Personne ne cartographie votre potentiel IA aussi loin."
              : "No one maps your AI potential this far."}
          </span>
        </p>
      </div>
    </Section>
  );
}
