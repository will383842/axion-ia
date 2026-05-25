/**
 * SitesWebMethodology — 4 étapes de la méthode augmentation IA (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis le `buildHowToJsonLd`
 * (l.218-265) de `src/app/[locale]/sites-web-augmentes/page.tsx`. Rend les
 * 4 steps visuellement (Audit → Choix briques → Intégration → Formation) +
 * injecte le JSON-LD HowTo inline. Réutilisé par hub + 430 pages ville
 * `/fr/implantations/{region}/{ville}/sites-web-ia`.
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildHowToJsonLd } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";

export interface SitesWebMethodologyProps {
  readonly isFr: boolean;
}

export function SitesWebMethodology({ isFr }: SitesWebMethodologyProps): ReactNode {
  const loc: Locale = isFr ? "fr" : "en";

  const steps = isFr
    ? [
        {
          id: "audit",
          name: "Audit rapide de votre site",
          text: "2 h pour identifier les 3 points d'augmentation IA à plus fort ROI : chatbot, search, génération, personnalisation.",
        },
        {
          id: "choix",
          name: "Choix des briques IA",
          text: "Sélection des modules selon votre priorité business, votre stack et votre budget. Devis ferme 48 h.",
        },
        {
          id: "integration",
          name: "Intégration par sprints",
          text: "Sprints de 1 semaine, démos hebdomadaires. Zéro downtime sur votre site en production.",
        },
        {
          id: "training",
          name: "Formation et transfert",
          text: "Formation de vos équipes, documentation complète, ownership total du code et des données.",
        },
      ]
    : [
        {
          id: "audit",
          name: "Quick audit of your site",
          text: "2 h to identify the 3 highest-ROI AI augmentation points: chatbot, search, generation, personalisation.",
        },
        {
          id: "choix",
          name: "AI bricks selection",
          text: "Module selection based on your business priority, stack and budget. Firm quote 48 h.",
        },
        {
          id: "integration",
          name: "Sprint-based integration",
          text: "1-week sprints, weekly demos. Zero downtime on your live site.",
        },
        {
          id: "training",
          name: "Training and handover",
          text: "Team training, full documentation, complete ownership of code and data.",
        },
      ];

  const howToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: "/sites-web-augmentes",
    name: isFr
      ? "Comment augmenter son site web avec l'intelligence artificielle"
      : "How to augment your website with artificial intelligence",
    description: isFr
      ? "Les 4 étapes d'Axion-IA pour intégrer l'IA dans votre site web existant ou en IA-native."
      : "Axion-IA's 4 steps to integrate AI into your existing website or build AI-native.",
    totalTime: "P3W",
    steps: steps.map((s) => ({ name: s.name, text: s.text })),
  });

  return (
    <>
      <Section
        eyebrow={isFr ? "Notre méthode" : "Our method"}
        title={isFr ? "4 étapes pour" : "4 steps to"}
        titleEm={isFr ? "augmenter votre site" : "augment your site"}
        description={
          isFr
            ? "De l'audit à la mise en production, on cadre, on intègre et on transfère."
            : "From audit to production, we frame, integrate and hand over."
        }
      >
        <ProcessSteps
          steps={steps.map((s) => ({
            id: s.id,
            title: s.name,
            description: s.text,
          }))}
        />
      </Section>
      <JsonLd
        data={howToJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-sites-web-augmentes-howto"
      />
    </>
  );
}
