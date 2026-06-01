/**
 * SitesWebScenarios — « 3 profils de site » avec avant/après mesuré, repris de
 * l'ancienne page `/codage-developpement/web-digital`.
 *
 * Fusion 2026-06-01 (Will) — pendant « réalisations » du template /audit, ici
 * en 3 cartes avant/après (plus lisible qu'un marquee pour 3 cas). Aucun nom de
 * marque : profil de plateforme + stack + résultat mesurable.
 *
 * Server Component pur, zéro JS. FR canonique — EN = miroir (locale 301→FR).
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";

interface Scenario {
  readonly typeFr: string;
  readonly typeEn: string;
  readonly stackFr: string;
  readonly stackEn: string;
  readonly beforeFr: string;
  readonly beforeEn: string;
  readonly afterFr: string;
  readonly afterEn: string;
  readonly metricFr: string;
  readonly metricEn: string;
}

const SCENARIOS: ReadonlyArray<Scenario> = [
  {
    typeFr: "Plateforme SaaS B2B",
    typeEn: "B2B SaaS platform",
    stackFr: "Next.js + Laravel + Postgres · construite par Axion-IA",
    stackEn: "Next.js + Laravel + Postgres · built by Axion-IA",
    beforeFr: "Vous voulez lancer une plateforme métier mais sans savoir intégrer l'IA.",
    beforeEn: "You want to launch a business platform but don't know how to integrate AI.",
    afterFr:
      "Plateforme livrée avec agents IA, automatisations métier, search sémantique et chatbot intégrés dès le premier sprint.",
    afterEn:
      "Platform delivered with AI agents, business automations, semantic search and chatbot integrated from the first sprint.",
    metricFr: "IA-native dès J+1",
    metricEn: "AI-native from day 1",
  },
  {
    typeFr: "Application web existante",
    typeEn: "Existing web application",
    stackFr: "Next.js, Laravel ou toute stack avec API",
    stackEn: "Next.js, Laravel or any API-enabled stack",
    beforeFr:
      "Plateforme fonctionnelle mais sans IA — utilisateurs qui cherchent dans la doc, tickets pour des questions simples.",
    beforeEn:
      "Working platform but no AI — users searching docs, opening tickets for simple questions.",
    afterFr:
      "Assistant IA contextuel greffé dans l'interface, recherche documentaire sémantique, automatisations ajoutées sans refonte.",
    afterEn:
      "Contextual AI assistant grafted into the interface, semantic doc search, automations added without a rebuild.",
    metricFr: "−40 % tickets niveau 1",
    metricEn: "−40% level-1 tickets",
  },
  {
    typeFr: "Portail client / espace membre",
    typeEn: "Client portal / member area",
    stackFr: "Stack custom ou Webflow + API",
    stackEn: "Custom stack or Webflow + API",
    beforeFr: "Clients qui ne trouvent pas l'information, support surchargé, relances manuelles.",
    beforeEn: "Clients can't find information, support overwhelmed, manual follow-ups.",
    afterFr:
      "Chatbot RAG formé sur vos contenus, relances automatiques, personnalisation par profil client.",
    afterEn:
      "RAG chatbot trained on your content, automatic follow-ups, personalisation by client profile.",
    metricFr: "−60 % charge support",
    metricEn: "−60% support load",
  },
];

export interface SitesWebScenariosProps {
  readonly isFr: boolean;
}

export function SitesWebScenarios({ isFr }: SitesWebScenariosProps): ReactNode {
  return (
    <Section
      tone="canvas"
      eyebrow={isFr ? "3 profils de site" : "3 site profiles"}
      title={isFr ? "Quel que soit votre" : "Whatever your"}
      titleEm={isFr ? "stack, l'IA s'intègre" : "stack, AI fits in"}
      description={
        isFr
          ? "Nouvelle plateforme ou existante — l'IA est au cœur, les automatisations sont intégrées, les résultats sont mesurés."
          : "New platform or existing one — AI is at the core, automations are built in, results are measured."
      }
    >
      <ul className="grid list-none gap-5 p-0 lg:grid-cols-3">
        {SCENARIOS.map((s) => (
          <li
            key={s.typeFr}
            className="border-border bg-paper shadow-subtle flex flex-col gap-4 rounded-2xl border p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="bg-terracotta-soft text-terracotta-deep inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase">
                  {isFr ? s.typeFr : s.typeEn}
                </span>
                <p className="text-fg-muted mt-2 text-xs">{isFr ? s.stackFr : s.stackEn}</p>
              </div>
              <p
                className="text-terracotta-deep shrink-0 text-right text-lg leading-tight font-medium"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? s.metricFr : s.metricEn}
              </p>
            </div>
            <div className="border-border space-y-2.5 border-t pt-4">
              <p className="text-fg-soft flex items-start gap-2 text-sm leading-relaxed">
                <span className="text-fg-muted mt-0.5 w-12 shrink-0 text-[10px] font-semibold tracking-widest uppercase">
                  {isFr ? "Avant" : "Before"}
                </span>
                <span>{isFr ? s.beforeFr : s.beforeEn}</span>
              </p>
              <p className="text-fg flex items-start gap-2 text-sm leading-relaxed">
                <span className="text-terracotta-deep mt-0.5 w-12 shrink-0 text-[10px] font-semibold tracking-widest uppercase">
                  {isFr ? "Après" : "After"}
                </span>
                <span>{isFr ? s.afterFr : s.afterEn}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-fg-muted mt-8 text-xs">
        {isFr
          ? "Scénarios représentatifs. Les résultats varient selon le contenu disponible, le volume de trafic et l'engagement des équipes. Devis personnalisé sous 48 h."
          : "Representative scenarios. Results vary by available content, traffic volume and team engagement. Personalised quote within 48 h."}
      </p>
    </Section>
  );
}
