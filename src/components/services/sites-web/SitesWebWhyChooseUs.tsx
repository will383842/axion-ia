/**
 * SitesWebWhyChooseUs — « Pourquoi nous choisir » : positionnement premium +
 * transparence « ce qu'on fait / ce qu'on ne fait pas ».
 *
 * Fusion 2026-06-01 (Will) — calqué sur `AuditWhyChooseUs` (template /audit,
 * fond `halo-warm`, 4 différenciants) et enrichi de la matrice de transparence
 * reprise de l'ancienne page `/codage-developpement/web-digital`.
 *
 * Server Component pur, zéro JS (budget Web Vitals). FR canonique — EN = miroir
 * (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { Workflow, Code2, ShieldCheck, Boxes, Check, type LucideIcon } from "lucide-react";
import { Container } from "@/components/layout/Container";

interface Differentiator {
  readonly icon: LucideIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;
}

export interface SitesWebWhyChooseUsProps {
  readonly isFr: boolean;
}

export function SitesWebWhyChooseUs({ isFr }: SitesWebWhyChooseUsProps): ReactNode {
  const points: ReadonlyArray<Differentiator> = [
    {
      icon: Boxes,
      titleFr: "On s'intègre à votre stack",
      titleEn: "We integrate with your stack",
      bodyFr:
        "WordPress, Webflow, Shopify, Next.js, Laravel, Django, Rails — toute stack exposant une API. On greffe l'IA sur votre existant, ou on construit IA-native. On s'adapte, jamais l'inverse.",
      bodyEn:
        "WordPress, Webflow, Shopify, Next.js, Laravel, Django, Rails — any stack exposing an API. We graft AI onto your existing setup, or build AI-native. We adapt, never the other way around.",
    },
    {
      icon: Code2,
      titleFr: "Du vrai code, pas du rafistolage",
      titleEn: "Real code, not patchwork",
      bodyFr:
        "Des intégrations développées sur-mesure et maîtrisées de bout en bout — robustes et durables, là où les connecteurs no-code grand public montrent vite leurs limites.",
      bodyEn:
        "Bespoke integrations we own end to end — robust and durable, where mass-market no-code connectors quickly hit their limits.",
    },
    {
      icon: Workflow,
      titleFr: "Toute la chaîne IA, de bout en bout",
      titleEn: "The whole AI chain, end to end",
      bodyFr:
        "Audit, architecture, développement, déploiement, formation : une seule équipe, aucun passage de relais. De la première brique IA à la plateforme complète.",
      bodyEn:
        "Audit, architecture, development, deployment, training: one team, no handover. From the first AI brick to the full platform.",
    },
    {
      icon: ShieldCheck,
      titleFr: "Vos données, votre code",
      titleEn: "Your data, your code",
      bodyFr:
        "Hébergement UE (Hetzner Frankfurt), RGPD natif. Code source, bases et modèles livrés dans votre infra. Propriété totale, aucun abonnement imposé.",
      bodyEn:
        "EU hosting (Hetzner Frankfurt), GDPR native. Source code, databases and models delivered into your infra. Full ownership, no imposed subscription.",
    },
  ];

  const weDo = isFr
    ? [
        "Conception UX/UI & product design (research, wireframes, design system, prototype Figma)",
        "Sites web & plateformes SaaS sur mesure, IA-native ou augmentation de l'existant",
        "E-commerce : Shopify, WordPress / WooCommerce, PrestaShop, Magento",
        "Applications mobiles : natif iOS / Android, Flutter, React Native",
        "Chatbot RAG formé sur vos données, recherche sémantique & recommandations IA",
        "Agents, automatisations métier & génération de contenu IA",
        "Vision / OCR, systèmes prédictifs & intégration d'API LLM dans vos outils",
        "Audit, architecture, développement, déploiement & formation — une seule équipe",
      ]
    : [
        "UX/UI design & product design (research, wireframes, design system, Figma prototype)",
        "Bespoke websites & SaaS platforms, AI-native or augmentation of your existing setup",
        "E-commerce: Shopify, WordPress / WooCommerce, PrestaShop, Magento",
        "Mobile apps: native iOS / Android, Flutter, React Native",
        "RAG chatbot trained on your data, semantic search & AI recommendations",
        "Agents, business automations & AI content generation",
        "Vision / OCR, predictive systems & LLM API integration in your tools",
        "Audit, architecture, development, deployment & training — one single team",
      ];

  const weDont = isFr
    ? [
        "Maintenance ou abonnement mensuel imposé sans votre accord",
        "Revente d'hébergement ou d'infra généraliste",
        "Commissions ou partenariats cachés sur les outils qu'on recommande",
      ]
    : [
        "Imposed monthly maintenance or subscription without your agreement",
        "Reselling of generic hosting or infrastructure",
        "Hidden commissions or partnerships on the tools we recommend",
      ];

  return (
    <section className="bg-halo-warm text-fg relative overflow-hidden py-24 sm:py-28 lg:py-32">
      <div
        aria-hidden="true"
        className="bg-terracotta/10 pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl"
      />

      <Container className="relative">
        <div className="max-w-3xl">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Pourquoi nous choisir" : "Why choose us"}
          </p>
          <h2 className="text-fg mt-5 text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
            {isFr ? "L'IA dans votre site, " : "AI in your site, "}
            <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
              {isFr ? "sans boîte noire ni dépendance." : "no black box, no lock-in."}
            </span>
          </h2>
          <p className="text-fg-soft mt-6 text-lg leading-relaxed">
            {isFr
              ? "On s'intègre à votre environnement, on livre du vrai code que vous possédez, et on couvre toute la chaîne — du chatbot greffé à la plateforme SaaS sur mesure."
              : "We integrate with your environment, deliver real code you own, and cover the whole chain — from a grafted chatbot to a bespoke SaaS platform."}
          </p>
        </div>

        {/* 4 différenciants */}
        <ul className="mt-14 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* Transparence — ce qu'on fait / ce qu'on ne fait pas */}
        <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
          <div className="border-border bg-paper rounded-2xl border p-6">
            <p className="text-sage mb-4 text-sm font-semibold tracking-wider uppercase">
              {isFr ? "Ce qu'on fait" : "What we do"}
            </p>
            <ul className="space-y-2.5">
              {weDo.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check aria-hidden="true" className="text-sage mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-fg text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-border bg-paper rounded-2xl border p-6">
            <p className="text-fg-muted mb-4 text-sm font-semibold tracking-wider uppercase">
              {isFr ? "Ce qu'on ne fait pas" : "What we don't do"}
            </p>
            <ul className="space-y-2.5">
              {weDont.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="text-fg-muted mt-2 h-1 w-4 shrink-0 border-t-2 border-current"
                  />
                  <span className="text-fg-muted text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
