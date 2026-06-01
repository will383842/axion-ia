/**
 * SitesWebWhy — « Pourquoi augmenter votre site (plutôt que tout refaire) »,
 * en contraste visuel.
 *
 * Fusion 2026-06-01 (Will) — calqué sur `AuditWhyAudit` (template /audit) :
 * bande de preuves + opposition « tout refaire de zéro » ❌ vs « la méthode
 * Axion-IA » ✅ (carte mise en avant). Message : on greffe l'IA sur votre
 * existant — ou on construit IA-native — sans payer une refonte à l'aveugle.
 *
 * Server Component pur, zéro JS (budget Web Vitals). FR canonique — EN = miroir
 * (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import {
  X,
  Check,
  Bot,
  SearchCheck,
  Boxes,
  ShieldCheck,
  Cpu,
  Globe,
  ScrollText,
  Workflow,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Section } from "@/components/layout/Section";

interface Row {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly sub: string;
}

export interface SitesWebWhyProps {
  readonly isFr: boolean;
}

export function SitesWebWhy({ isFr }: SitesWebWhyProps): ReactNode {
  const proofs: ReadonlyArray<{ icon: LucideIcon; label: string }> = [
    { icon: Cpu, label: isFr ? "100 % IA & web sur mesure" : "100% AI & bespoke web" },
    { icon: Globe, label: isFr ? "Toute stack — on s'intègre" : "Any stack — we integrate" },
    { icon: ScrollText, label: isFr ? "RGPD natif · hébergement UE" : "GDPR native · EU hosting" },
    { icon: Workflow, label: isFr ? "Du widget à la plateforme" : "From widget to platform" },
  ];

  // « Tout refaire de zéro » — le coût de l'impasse (voix Axion-IA).
  const risks: ReadonlyArray<Pick<Row, "title" | "sub">> = [
    {
      title: isFr ? "Des mois de refonte" : "Months of rebuild",
      sub: isFr
        ? "Tout reconstruire avant le moindre gain visible."
        : "Rebuild everything before any visible gain.",
    },
    {
      title: isFr ? "Une IA plaquée à la fin" : "AI bolted on at the end",
      sub: isFr
        ? "Un chatbot générique qui invente des réponses."
        : "A generic chatbot that makes answers up.",
    },
    {
      title: isFr ? "Du downtime et des risques" : "Downtime and risk",
      sub: isFr
        ? "Migration lourde, données exposées, dépendances floues."
        : "Heavy migration, data exposed, fuzzy dependencies.",
    },
  ];

  // « La méthode Axion-IA » — ce qu'on verrouille (voix Axion-IA).
  const wins: ReadonlyArray<Row> = [
    {
      icon: Bot,
      title: isFr ? "Un chatbot ancré sur vos données" : "A chatbot grounded in your data",
      sub: isFr
        ? "RAG sur vos contenus : zéro hallucination, sources citées."
        : "RAG on your content: zero hallucination, sources cited.",
    },
    {
      icon: SearchCheck,
      title: isFr ? "Une recherche qui comprend" : "Search that understands",
      sub: isFr
        ? "Vos visiteurs trouvent par le sens, pas par mot-clé."
        : "Visitors find by meaning, not by keyword.",
    },
    {
      icon: Boxes,
      title: isFr ? "Greffé sur votre existant" : "Grafted onto your stack",
      sub: isFr
        ? "Widget, API ou plugin — sans refonte, zéro downtime."
        : "Widget, API or plugin — no rebuild, zero downtime.",
    },
    {
      icon: ShieldCheck,
      title: isFr ? "Vos données, votre code" : "Your data, your code",
      sub: isFr
        ? "Hébergement UE, propriété totale, aucun abonnement imposé."
        : "EU hosting, full ownership, no imposed subscription.",
    },
  ];

  return (
    <Section tone="canvas" className="py-16 sm:py-20 lg:py-24">
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr
              ? "Sites web & SaaS IA · la référence française"
              : "AI websites & SaaS · the French benchmark"}
          </p>
          <h2 className="text-fg mt-5 text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
            {isFr ? "Un site, tout le monde en a un." : "Everyone has a website."}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "Nous, on le rend intelligent" : "We make yours intelligent"}
            </span>
            .
          </h2>
          <p className="text-fg-soft mt-5 max-w-xl text-lg leading-relaxed">
            {isFr
              ? "Refondre à l'aveugle, c'est payer cher pour repartir de zéro. On greffe l'IA sur ce que vous avez déjà — ou on conçoit une plateforme IA-native — et chaque brique sert vos visiteurs dès les premières semaines."
              : "Rebuilding blind means paying a lot to start over. We graft AI onto what you already have — or design an AI-native platform — and every brick serves your visitors within the first weeks."}
          </p>
        </div>

        {/* Bandeau chaîne — l'augmentation comme point d'entrée */}
        <div className="bg-mocha-rich text-mocha-fg shadow-card rounded-3xl px-6 py-7 text-center sm:px-8">
          <ul className="mb-5 flex list-none flex-wrap items-center justify-center gap-2.5 p-0">
            {[
              { label: isFr ? "Audit 2 h" : "2-h audit", active: false },
              { label: isFr ? "Augmentation" : "Augmentation", active: true },
              { label: isFr ? "Plateforme" : "Platform", active: false },
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
              ? "Du chatbot RAG greffé en quelques semaines à la plateforme SaaS sur mesure. "
              : "From a RAG chatbot grafted in weeks to a bespoke SaaS platform. "}
            <span className="text-terracotta-soft italic">
              {isFr
                ? "On démarre à votre échelle, sur votre stack — et on va jusqu'à l'IA-native si vous le voulez."
                : "We start at your scale, on your stack — all the way to AI-native if you want."}
            </span>
          </p>
        </div>
      </div>

      {/* Bande de preuves */}
      <ul className="mt-12 mb-8 flex list-none flex-wrap justify-center gap-3 p-0">
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

      {/* Opposition visuelle — « tout refaire » ❌ vs « Axion-IA » ✅ */}
      <div className="relative mx-auto grid max-w-4xl gap-5 lg:grid-cols-2 lg:gap-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 hidden items-center justify-center lg:flex"
        >
          <span className="bg-fg text-bg shadow-card flex h-14 w-14 items-center justify-center rounded-full text-sm font-black tracking-wide">
            VS
          </span>
        </div>

        {/* Colonne FROIDE — tout refaire de zéro */}
        <div className="bg-sand border-border-strong/40 rounded-3xl border p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="bg-bg border-border text-fg-muted flex h-10 w-10 items-center justify-center rounded-2xl border">
              <X aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
            </span>
            <p className="text-fg-muted text-[13px] font-bold tracking-[0.16em] uppercase">
              {isFr ? "Tout refaire de zéro" : "Rebuild from scratch"}
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

        {/* Colonne CHAUDE — la méthode Axion-IA */}
        <div className="border-terracotta bg-paper shadow-card relative rounded-3xl border-2 p-5 sm:p-6">
          <span className="bg-terracotta text-mocha-fg absolute -top-3 right-6 rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.14em] uppercase">
            {isFr ? "La méthode Axion-IA" : "The Axion-IA method"}
          </span>
          <div className="mb-5 flex items-center gap-3">
            <span className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 items-center justify-center rounded-2xl">
              <Check aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
            </span>
            <p className="text-terracotta-deep text-[13px] font-bold tracking-[0.16em] uppercase">
              {isFr ? "Augmenter l'existant" : "Augment what exists"}
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
    </Section>
  );
}
