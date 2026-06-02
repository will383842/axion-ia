/**
 * ImplementationExpertises — « Nos expertises » : 6 expertises phares en cartes
 * + CTA ouvrant la popup exhaustive du champ des possibles (tous les domaines).
 *
 * Calqué sur AuditBenefits (header standard H2, cartes visuelles, popup pour le
 * détail exhaustif). Couverture sémantique SEO/AEO côté serveur via les cartes.
 *
 * Server Component (seul morceau client = la popup importée). Aucun prix. FR
 * canonique — EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import {
  Bot,
  MessagesSquare,
  Workflow,
  Plug,
  FileText,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Section } from "@/components/layout/Section";
import { ImplementationExpertisesDialog } from "@/components/services/implementation/ImplementationExpertisesDialog";

interface Expertise {
  readonly icon: LucideIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;
}

const EXPERTISES: ReadonlyArray<Expertise> = [
  {
    icon: Bot,
    titleFr: "Agents IA autonomes",
    titleEn: "Autonomous AI agents",
    bodyFr:
      "Des collaborateurs numériques branchés sur vos outils, qui exécutent des tâches de bout en bout.",
    bodyEn: "Digital coworkers wired into your tools, executing tasks end to end.",
  },
  {
    icon: MessagesSquare,
    titleFr: "Chatbots & assistants",
    titleEn: "Chatbots & assistants",
    bodyFr: "Répondre vite et juste, 24/7, à partir de vos documents — sans hallucination.",
    bodyEn: "Fast, accurate answers 24/7, grounded in your documents — no hallucination.",
  },
  {
    icon: Workflow,
    titleFr: "Automatisation de processus",
    titleEn: "Process automation",
    bodyFr: "Faire disparaître la saisie et les tâches répétitives, de bout en bout.",
    bodyEn: "Make data entry and repetitive tasks disappear, end to end.",
  },
  {
    icon: Plug,
    titleFr: "Intégrations CRM / ERP",
    titleEn: "CRM / ERP integrations",
    bodyFr: "On se branche sur votre existant (CRM, ERP, e-mail, site) sans tout réinventer.",
    bodyEn: "We plug into your existing stack (CRM, ERP, email, website) without reinventing it.",
  },
  {
    icon: FileText,
    titleFr: "Traitement de documents",
    titleEn: "Document processing",
    bodyFr: "Lire, extraire et structurer factures, devis et contrats automatiquement.",
    bodyEn: "Read, extract and structure invoices, quotes and contracts automatically.",
  },
  {
    icon: Search,
    titleFr: "Recherche interne (RAG)",
    titleEn: "Internal search (RAG)",
    bodyFr: "Toute la connaissance de l'entreprise interrogeable en langage naturel.",
    bodyEn: "All your company knowledge, queryable in natural language.",
  },
];

export interface ImplementationExpertisesProps {
  readonly isFr: boolean;
}

export function ImplementationExpertises({ isFr }: ImplementationExpertisesProps): ReactNode {
  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "Nos expertises" : "Our expertise"}
      title={isFr ? "Ce qu'on construit," : "What we build,"}
      titleEm={isFr ? "concrètement" : "concretely"}
      titleTail="."
      description={
        isFr
          ? "Pas de la théorie : des fonctionnalités qui tournent dans votre entreprise. Agents IA, chatbots, automatisations, intégrations, traitement de documents — du chatbot de site à l'agent connecté à votre CRM."
          : "Not theory: features that run inside your company. AI agents, chatbots, automations, integrations, document processing — from a website chatbot to an agent wired into your CRM."
      }
    >
      <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 lg:grid-cols-3">
        {EXPERTISES.map((e) => {
          const Icon = e.icon;
          return (
            <li
              key={e.titleFr}
              className="bg-paper border-border shadow-subtle hover:border-terracotta/50 hover:shadow-card flex h-full flex-col overflow-hidden rounded-2xl border transition"
            >
              <span aria-hidden="true" className="bg-terracotta block h-1 w-full shrink-0" />
              <div className="flex flex-1 flex-col p-5">
                <span className="bg-terracotta-soft text-terracotta-deep mb-4 flex h-11 w-11 items-center justify-center rounded-2xl">
                  <Icon aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={1.75} />
                </span>
                <h3 className="text-fg text-[15px] leading-tight font-semibold tracking-tight">
                  {isFr ? e.titleFr : e.titleEn}
                </h3>
                <p className="text-fg-soft mt-2 text-[13px] leading-relaxed">
                  {isFr ? e.bodyFr : e.bodyEn}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* CTA → popup du champ des possibles (toutes les expertises) */}
      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <ImplementationExpertisesDialog isFr={isFr} />
        <p className="text-fg-muted text-[13px]">
          {isFr
            ? "Vision, génération de contenu, prévision, tableaux de bord… on passe chaque besoin au crible."
            : "Vision, content generation, forecasting, dashboards… we comb through every need."}
        </p>
      </div>
    </Section>
  );
}
