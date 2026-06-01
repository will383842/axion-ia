/**
 * SitesWebMethodology — 5 étapes de la méthode (audit → livraison), Server
 * Component.
 *
 * Fusion 2026-06-01 (Will) — passe de 4 à 5 étapes en absorbant le process
 * « build / augmentation » de l'ancienne page `/codage-developpement/web-digital`
 * (audit 2 h → devis 48 h → intégration sans refonte → tests → livraison +
 * formation). Même process pour un build from scratch ou une augmentation.
 * Rend les steps via `ProcessSteps` + injecte le JSON-LD HowTo inline.
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
          id: "s1",
          name: "Audit de votre existant · 2 h",
          text: "On analyse votre site, votre stack technique et vos données (FAQ, catalogue, docs). On identifie les 2-3 briques IA à plus fort ROI.",
        },
        {
          id: "s2",
          name: "Devis ferme sous 48 h",
          text: "Périmètre exact, modules choisis, prix fixe, délai garanti. Pas d'ambiguïté avant la signature.",
        },
        {
          id: "s3",
          name: "Intégration sans refonte",
          text: "On greffe l'IA via widget JS, API ou plugin — ou on construit IA-native. Pas de migration imposée, zéro downtime.",
        },
        {
          id: "s4",
          name: "Tests & validation",
          text: "Démos hebdomadaires, corrections en continu. Vous validez chaque module avant mise en ligne.",
        },
        {
          id: "s5",
          name: "Livraison + formation incluse",
          text: "Vos équipes prennent la main, documentation complète, code et données dans votre infra. C'est à vous.",
        },
      ]
    : [
        {
          id: "s1",
          name: "Audit of your existing setup · 2 h",
          text: "We analyse your site, tech stack and data (FAQ, catalogue, docs). We identify the 2-3 highest-ROI AI bricks.",
        },
        {
          id: "s2",
          name: "Firm quote within 48 h",
          text: "Exact scope, chosen modules, fixed price, guaranteed timeline. No ambiguity before signing.",
        },
        {
          id: "s3",
          name: "Integration without rebuild",
          text: "We graft AI via JS widget, API or plugin — or build AI-native. No forced migration, zero downtime.",
        },
        {
          id: "s4",
          name: "Tests & validation",
          text: "Weekly demos, continuous fixes. You validate each module before going live.",
        },
        {
          id: "s5",
          name: "Delivery + included training",
          text: "Your teams take over, full documentation, code and data in your infra. It's yours.",
        },
      ];

  const howToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: "/sites-web-augmentes",
    name: isFr
      ? "Comment augmenter son site web avec l'intelligence artificielle"
      : "How to augment your website with artificial intelligence",
    description: isFr
      ? "Les 5 étapes d'Axion-IA pour intégrer l'IA dans votre site web existant ou construire une plateforme IA-native."
      : "Axion-IA's 5 steps to integrate AI into your existing website or build an AI-native platform.",
    totalTime: "P6W",
    steps: steps.map((s) => ({ name: s.name, text: s.text })),
  });

  return (
    <>
      <Section
        eyebrow={isFr ? "Comment ça se passe" : "How it runs"}
        title={isFr ? "5 étapes," : "5 steps,"}
        titleEm={isFr ? "nouvelle ou existante" : "new or existing"}
        description={
          isFr
            ? "Même process pour un build from scratch ou une augmentation de l'existant. Sprints courts, démos hebdomadaires, zéro tunnel."
            : "Same process for a new build or an existing augmentation. Short sprints, weekly demos, zero tunnel effect."
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
