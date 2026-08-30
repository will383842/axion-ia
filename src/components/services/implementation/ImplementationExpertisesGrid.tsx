/**
 * ImplementationExpertisesGrid — « Le champ des possibles » affiché on-page.
 *
 * 2026-06-04 (Will) — remplace le popup `ImplementationExpertisesDialog` : les
 * 16 domaines d'expertise (SSOT `implementation-expertises.ts`, dont Vision,
 * Données/prévision, e-commerce, marketing, finance, RH, logistique…) sont
 * désormais rendus directement sur le hub `/implementation`. Objectif : densité
 * perçue + contenu indexable/citable par les LLM (vs grille cachée derrière un
 * clic), aligné sur `SitesWebCapabilitiesGrid`. Zéro JS client (vs Radix Dialog)
 * → budget Web Vitals 2026 amélioré.
 *
 * Server Component pur. FR canonique — EN = miroir (locale 301→FR).
 */

import type { ReactNode } from "react";
import {
  Bot,
  MessagesSquare,
  Workflow,
  Plug,
  FileText,
  Search,
  PenTool,
  ScanEye,
  BarChart3,
  Headset,
  TrendingUp,
  ShoppingCart,
  Calculator,
  Users,
  Truck,
  Network,
  type LucideIcon,
} from "lucide-react";
import { Section } from "@/components/layout/Section";
import {
  IMPLEMENTATION_EXPERTISES,
  type ExpertiseIconName,
} from "@/content/implementation-expertises";

const ICONS: Record<ExpertiseIconName, LucideIcon> = {
  Bot,
  MessagesSquare,
  Workflow,
  Plug,
  FileText,
  Search,
  PenTool,
  ScanEye,
  BarChart3,
  Headset,
  TrendingUp,
  ShoppingCart,
  Calculator,
  Users,
  Truck,
  Network,
};

export interface ImplementationExpertisesGridProps {
  readonly isFr: boolean;
}

export function ImplementationExpertisesGrid({
  isFr,
}: ImplementationExpertisesGridProps): ReactNode {
  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Le champ des possibles" : "The field of possibilities"}
      title={isFr ? "Tout ce qu'on peut" : "Everything we can"}
      titleEm={isFr ? "implémenter pour vous" : "implement for you"}
      titleTail="."
      description={
        isFr
          ? "De la PME au grand groupe, mono-site ou multi-sites : on conçoit, développe et livre des solutions IA sur-mesure, branchées sur vos outils. Du socle technique (agents, RAG, automatisations) aux fonctions métier (relation client, vente, finance, RH, logistique, vision, prévision…). Vous n'avez pas besoin de tout — on part de votre besoin et de ce qui rapporte le plus vite."
          : "From micro-business to large enterprise, single-site or multi-site: we design, build and ship custom AI solutions, wired into your tools. From the technical core (agents, RAG, automations) to business functions (customer service, sales, finance, HR, logistics, vision, forecasting…). You don't need all of it — we start from your need and what pays off fastest."
      }
    >
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {IMPLEMENTATION_EXPERTISES.map((domain) => {
          const Icon = ICONS[domain.icon];
          return (
            <li
              key={domain.title}
              className="bg-paper border-border shadow-subtle hover:border-terracotta/50 hover:shadow-card flex h-full flex-col rounded-2xl border p-5 transition"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="text-fg text-[15px] leading-tight font-semibold tracking-tight">
                  {domain.title}
                </h3>
              </div>
              <p className="text-terracotta-deep mb-3 text-[13px] leading-snug font-medium">
                {domain.intro}
              </p>
              <ul className="text-fg-soft space-y-1.5 p-0 text-[13px] leading-snug">
                {domain.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="text-terracotta mt-[3px] leading-none">
                      ·
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <div className="border-terracotta/30 bg-terracotta-soft/40 mx-auto mt-10 max-w-3xl rounded-2xl border p-5 text-center sm:p-6">
        <p className="text-fg text-[15px] leading-relaxed font-semibold">
          {isFr
            ? "Et si ce n'est pas dans la liste ? On le construit quand même."
            : "Not on the list? We build it anyway."}
        </p>
        <p className="text-fg-soft mx-auto mt-2 max-w-2xl text-sm leading-relaxed">
          {isFr
            ? "Cette liste est un aperçu, pas une limite. Vous décrivez ce que vous voulez, on conçoit la solution sur-mesure qui s'y adapte, quelle que soit la taille de votre entreprise."
            : "This list is a glimpse, not a limit. You describe what you want, we design the custom solution that fits, whatever the size of your company."}
        </p>
      </div>
    </Section>
  );
}
