/**
 * AuditWhyAudit — « Par où commencer ? » : le pourquoi de l'audit, en blocs
 * visuels et scannables (Server Component).
 *
 * Refonte 2026-05-31 (Will) — message clé : tout le monde parle d'IA, peu
 * savent par où démarrer. Se lancer sans diagnostic = tests à l'aveugle,
 * données exposées, budget sans visibilité. L'audit tranche les bonnes
 * questions (process / usages / gains / risques), objective les opportunités
 * et sécurise les décisions avant le moindre euro investi.
 *
 * Rendu en petits blocs (contraste « sans audit » → « ce que l'audit
 * tranche »), pas en pavé verbeux. Server Component pur, zéro JS (budget Web
 * Vitals). FR canonique — EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import {
  FlaskConical,
  ShieldAlert,
  Wallet,
  Workflow,
  Sparkles,
  Gauge,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Section } from "@/components/layout/Section";

interface Block {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly sub: string;
}

export interface AuditWhyAuditProps {
  readonly isFr: boolean;
}

export function AuditWhyAudit({ isFr }: AuditWhyAuditProps): ReactNode {
  // « Se lancer sans audit » — les 3 risques, ton sobre/neutre.
  const risks: ReadonlyArray<Block> = [
    {
      icon: FlaskConical,
      title: isFr ? "Tester à l'aveugle" : "Testing blind",
      sub: isFr
        ? "Multiplier les essais coûteux, sans cap ni priorité."
        : "Multiplying costly trials, with no direction or priority.",
    },
    {
      icon: ShieldAlert,
      title: isFr ? "Exposer vos données" : "Exposing your data",
      sub: isFr
        ? "Brancher des outils IA sans cadrer la sécurité."
        : "Plugging in AI tools without framing security.",
    },
    {
      icon: Wallet,
      title: isFr ? "Investir sans visibilité" : "Investing blind",
      sub: isFr
        ? "Dépenser sans savoir ce que ça rapporte vraiment."
        : "Spending without knowing the real return.",
    },
  ];

  // « Ce que l'audit tranche » — les 4 questions, ton terracotta (positif).
  const questions: ReadonlyArray<Block> = [
    {
      icon: Workflow,
      title: isFr ? "Quels process ?" : "Which processes?",
      sub: isFr
        ? "Ceux qui gagnent vraiment à passer à l'IA."
        : "The ones that truly benefit from AI.",
    },
    {
      icon: Sparkles,
      title: isFr ? "Quels usages ?" : "Which use cases?",
      sub: isFr
        ? "Ceux qui collent à votre organisation, pas à la hype."
        : "The ones that fit your organisation, not the hype.",
    },
    {
      icon: Gauge,
      title: isFr ? "Quels gains ?" : "Which gains?",
      sub: isFr
        ? "Mesurables et chiffrés — pas des promesses."
        : "Measurable and quantified — not promises.",
    },
    {
      icon: ShieldCheck,
      title: isFr ? "Quels risques ?" : "Which risks?",
      sub: isFr
        ? "Identifiés et maîtrisés avant de vous lancer."
        : "Identified and controlled before you start.",
    },
  ];

  return (
    <Section
      tone="canvas"
      eyebrow={isFr ? "Par où commencer" : "Where to start"}
      title={isFr ? "Tout le monde parle d'IA." : "Everyone talks about AI."}
      titleEm={isFr ? "Peu savent par où démarrer" : "Few know where to begin"}
      titleTail="."
      description={
        isFr
          ? "Se lancer sans diagnostic, c'est avancer dans le flou. L'audit pose les bonnes questions, objective les opportunités et sécurise vos décisions — avant le moindre euro investi."
          : "Diving in without a diagnosis means moving in a fog. The audit asks the right questions, objectifies opportunities and secures your decisions — before a single euro is spent."
      }
    >
      {/* Cluster 1 — « Se lancer sans audit » : panneau sobre, 3 risques */}
      <div className="bg-sand border-border-strong/40 rounded-3xl border p-6 sm:p-8">
        <p className="text-fg-muted mb-5 text-[12px] font-bold tracking-[0.16em] uppercase">
          <span
            aria-hidden="true"
            className="bg-fg-muted/60 mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
          />
          {isFr ? "Se lancer sans audit" : "Starting without an audit"}
        </p>
        <ul className="grid list-none gap-5 p-0 sm:grid-cols-3 lg:gap-6">
          {risks.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.title} className="flex items-start gap-3">
                <span className="bg-bg border-border text-fg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-fg text-[15px] leading-tight font-semibold">{r.title}</p>
                  <p className="text-fg-soft mt-1 text-[13px] leading-snug">{r.sub}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Cluster 2 — « Ce que l'audit tranche » : 4 cartes terracotta */}
      <div className="mt-8">
        <p className="text-terracotta-deep mb-5 text-[12px] font-bold tracking-[0.16em] uppercase">
          <span
            aria-hidden="true"
            className="bg-terracotta mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
          />
          {isFr ? "Ce que l'audit tranche" : "What the audit settles"}
        </p>
        <ul className="grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {questions.map((q) => {
            const Icon = q.icon;
            return (
              <li
                key={q.title}
                className="bg-paper border-border shadow-subtle hover:border-terracotta/50 flex h-full flex-col rounded-2xl border p-5 transition-colors"
              >
                <span className="bg-terracotta-soft text-terracotta-deep mb-3 flex h-11 w-11 items-center justify-center rounded-xl">
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <p className="text-fg text-[15.5px] leading-tight font-semibold tracking-tight">
                  {q.title}
                </p>
                <p className="text-fg-soft mt-1.5 text-[13.5px] leading-snug">{q.sub}</p>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Clôture — la trajectoire en quelques semaines (sans pavé) */}
      <p className="text-fg-muted mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed">
        {isFr
          ? "En quelques semaines : cas d'usage prioritaires identifiés, valeur chiffrée, et une trajectoire IA réaliste alignée sur vos équipes, vos données et vos enjeux."
          : "Within weeks: priority use cases identified, value quantified, and a realistic AI trajectory aligned with your teams, your data and your stakes."}
      </p>
    </Section>
  );
}
