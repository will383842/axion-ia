/**
 * SitesWebModules — « Les 4 briques IA les plus rentables » : modules chiffrés
 * (métrique + délai), repris de l'ancienne page `/codage-developpement/web-digital`.
 *
 * Fusion 2026-06-01 (Will) — style aligné `AuditBenefits` (template /audit) :
 * cards avec accent terracotta + icône + métrique serif en avant. Chaque module
 * est déployable seul ou combiné, sur une nouvelle plateforme ou un site existant.
 *
 * Server Component pur, zéro JS. FR canonique — EN = miroir (locale 301→FR).
 */

import type { ReactNode } from "react";
import { Bot, SearchCheck, Sparkles, Target, Globe, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SitesWebCapabilitiesDialog } from "@/components/services/sites-web/SitesWebCapabilitiesDialog";

interface ModuleCard {
  readonly icon: LucideIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly metricFr: string;
  readonly metricEn: string;
  readonly metricLabelFr: string;
  readonly metricLabelEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;
  readonly delayFr: string;
  readonly delayEn: string;
}

const MODULES: ReadonlyArray<ModuleCard> = [
  {
    icon: Bot,
    titleFr: "Chatbot IA sur mesure",
    titleEn: "Custom AI chatbot",
    metricFr: "80 %",
    metricEn: "80%",
    metricLabelFr: "questions traitées auto",
    metricLabelEn: "auto-resolved questions",
    bodyFr:
      "Formé sur votre base documentaire (FAQ, catalogue, procédures), il répond précisément à vos visiteurs 24h/7j — zéro hallucination, sources citées.",
    bodyEn:
      "Trained on your knowledge base (FAQ, catalogue, procedures), it answers your visitors precisely 24/7 — zero hallucination, sources cited.",
    delayFr: "3 semaines",
    delayEn: "3 weeks",
  },
  {
    icon: SearchCheck,
    titleFr: "Recherche sémantique",
    titleEn: "Semantic search",
    metricFr: "+40 %",
    metricEn: "+40%",
    metricLabelFr: "requêtes résolues précisément",
    metricLabelEn: "queries resolved precisely",
    bodyFr:
      "L'IA comprend l'intention derrière la requête, pas juste les mots. Résultats pertinents même avec des formulations approximatives ou des synonymes métier.",
    bodyEn:
      "AI understands the intent behind the query, not just the words. Relevant results even with approximate phrasing or business-specific synonyms.",
    delayFr: "2 semaines",
    delayEn: "2 weeks",
  },
  {
    icon: Sparkles,
    titleFr: "Suggestions intelligentes",
    titleEn: "Smart suggestions",
    metricFr: "+18 %",
    metricEn: "+18%",
    metricLabelFr: "taux d'engagement",
    metricLabelEn: "engagement rate",
    bodyFr:
      "Un moteur IA qui analyse le comportement de chaque utilisateur et suggère le contenu, la fonctionnalité ou la ressource la plus pertinente à l'instant T.",
    bodyEn:
      "An AI engine that analyses each user's behaviour and suggests the most relevant content, feature or resource at the right moment.",
    delayFr: "4 semaines",
    delayEn: "4 weeks",
  },
  {
    icon: Target,
    titleFr: "Personnalisation dynamique",
    titleEn: "Dynamic personalisation",
    metricFr: "−30 %",
    metricEn: "−30%",
    metricLabelFr: "visiteurs perdus sans action",
    metricLabelEn: "visitors lost without action",
    bodyFr:
      "Contenu, CTAs et offres adaptés au profil de chaque visiteur (secteur, historique, source). Sans cookie tiers — IA côté serveur, RGPD strict.",
    bodyEn:
      "Content, CTAs and offers adapted to each visitor's profile (sector, history, source). No third-party cookie — server-side AI, strict GDPR.",
    delayFr: "6 semaines",
    delayEn: "6 weeks",
  },
];

export interface SitesWebModulesProps {
  readonly isFr: boolean;
}

export function SitesWebModules({ isFr }: SitesWebModulesProps): ReactNode {
  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "4 briques IA" : "4 AI bricks"}
      title={isFr ? "L'IA au cœur de votre site," : "AI at the core of your site,"}
      titleEm={isFr ? "pas en option" : "not an option"}
      titleTail="."
      description={
        isFr
          ? "Sur une nouvelle plateforme ou un site existant, ces 4 modules sont les plus demandés et les plus rentables — déployables seuls ou combinés."
          : "On a new platform or an existing site, these 4 modules are the most requested and most profitable — deployable standalone or combined."
      }
    >
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-6">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <li
              key={m.titleFr}
              className="bg-paper border-border shadow-subtle hover:border-terracotta/50 hover:shadow-card flex h-full flex-col overflow-hidden rounded-2xl border transition"
            >
              <span aria-hidden="true" className="bg-terracotta block h-1 w-full shrink-0" />
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-start justify-between gap-4">
                  <span className="bg-terracotta-soft text-terracotta-deep flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                    <Icon aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={1.75} />
                  </span>
                  <div className="shrink-0 text-right">
                    <p
                      className="text-terracotta-deep text-2xl leading-none font-medium tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {isFr ? m.metricFr : m.metricEn}
                    </p>
                    <p className="text-fg-muted mt-1 text-[11px] leading-tight tracking-wide uppercase">
                      {isFr ? m.metricLabelFr : m.metricLabelEn}
                    </p>
                  </div>
                </div>
                <h3 className="text-fg mt-4 text-[17px] leading-tight font-semibold tracking-tight">
                  {isFr ? m.titleFr : m.titleEn}
                </h3>
                <p className="text-fg-soft mt-2 text-[13.5px] leading-relaxed">
                  {isFr ? m.bodyFr : m.bodyEn}
                </p>
                <p className="text-fg-muted mt-auto pt-4 text-[12px] font-medium">
                  <Globe aria-hidden="true" className="mr-1.5 inline-block h-3.5 w-3.5" />
                  {isFr ? `Opérationnel en ${m.delayFr}` : `Live in ${m.delayEn}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* CTA → popup du champ des possibles (toutes les capacités IA web) */}
      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <SitesWebCapabilitiesDialog isFr={isFr} />
        <p className="text-fg-muted text-[13px]">
          {isFr
            ? "Chatbot, search, agents, génération, e-commerce, vision, multilingue, perso… on passe chaque usage au crible."
            : "Chatbot, search, agents, generation, e-commerce, vision, multilingual, personalisation… we comb through every use case."}
        </p>
      </div>
    </Section>
  );
}
