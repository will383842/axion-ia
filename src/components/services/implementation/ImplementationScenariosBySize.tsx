/**
 * ImplementationScenariosBySize — 6 scénarios avant/après par taille.
 *
 * Sprint A · Phase 2 Extract-3 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/implementation/page.tsx` (l.1198-1257). Couvre le spectre
 * Artisan → Grand groupe (TPE / PME / ETI / GE explicites). Format avant/après
 * pour rendre tangible, métriques typiques (× 3 devis, − 4 h/sem, etc.).
 * Disclaimer transparence en fin de section (FR L.121-1). Pas de témoignages.
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import type { VilleContext } from "@/components/services/types";

export interface ImplementationScenariosBySizeProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function ImplementationScenariosBySize({
  isFr,
  villeContext,
}: ImplementationScenariosBySizeProps): ReactNode {
  const scenarios = isFr
    ? [
        {
          size: "Artisan / TPE",
          industry: "Plombier, électricien, paysagiste",
          metric: "× 3 devis envoyés",
          before: "Avant : 30 min le soir, devis oubliés, clients qui partent.",
          after:
            "Après : un brief vocal sur chantier, le devis sort en 30 secondes, prêt à envoyer.",
        },
        {
          size: "Commerce / restauration",
          industry: "Boutique, restaurant, hôtel",
          metric: "100 % avis répondus",
          before: "Avant : avis Google ignorés, DM Instagram en retard, clients perdus.",
          after:
            "Après : tous les avis et DM reçoivent une réponse pro 24/7. Les étoiles montent toutes seules.",
        },
        {
          size: "Cabinet libéral / TPE",
          industry: "Expert-comptable, avocat, médecin",
          metric: "− 4 h / semaine",
          before: "Avant : saisie de factures, comptes-rendus tapés à la main, paperasse partout.",
          after:
            "Après : tout est lu, classé, pré-rédigé. L'équipe se recentre sur le conseil et le diagnostic.",
        },
        {
          size: "PME B2B (10-50)",
          industry: "Services, SaaS, distribution spécialisée",
          metric: "+ 22 % taux de signature",
          before: "Avant : devis envoyés et oubliés, commerciaux qui appellent à l'aveugle.",
          after:
            "Après : relances automatiques, leads scorés, commerciaux focalisés sur les chauds.",
        },
        {
          size: "ETI (100-500)",
          industry: "Industrie, distribution, retail multi-sites",
          metric: "20 h récupérées / mois",
          before:
            "Avant : reporting Excel manuel, veille concurrentielle improvisée, données dispersées.",
          after:
            "Après : tableaux de bord auto, prévisions chiffrées, veille hebdo synthétisée, anomalies détectées avant qu'elles coûtent.",
        },
        {
          size: "Grand groupe (500+)",
          industry: "Sièges, multi-pays, fonctions support centralisées",
          metric: "× 5 productivité support",
          before: "Avant : 50 fois la même question RH/IT/paie, équipes interrompues sans cesse.",
          after:
            "Après : chatbot interne sur vos procédures, traduction temps réel, recherche dans Drive en 5 secondes.",
        },
      ]
    : [
        {
          size: "Trades / micro-business",
          industry: "Plumber, electrician, landscaper",
          metric: "3× quotes sent",
          before: "Before: 30 min in the evening, forgotten quotes, customers leaving.",
          after: "After: voice brief on site, quote out in 30 seconds, ready to send.",
        },
        {
          size: "Retail / hospitality",
          industry: "Shop, restaurant, hotel",
          metric: "100% reviews answered",
          before: "Before: Google reviews ignored, Instagram DMs late, customers lost.",
          after: "After: every review and DM gets a pro reply 24/7. Stars climb on their own.",
        },
        {
          size: "Professional firm / small biz",
          industry: "Accountant, lawyer, doctor",
          metric: "−4 h / week",
          before: "Before: invoice entry, hand-typed minutes, paperwork everywhere.",
          after:
            "After: everything read, sorted, pre-drafted. The team refocuses on advice and diagnosis.",
        },
        {
          size: "B2B SMB (10-50)",
          industry: "Services, SaaS, specialty distribution",
          metric: "+22% sign rate",
          before: "Before: quotes sent and forgotten, reps calling blind.",
          after: "After: automatic follow-ups, scored leads, reps focus on the hot ones.",
        },
        {
          size: "Mid-market (100-500)",
          industry: "Manufacturing, distribution, multi-site retail",
          metric: "20 h recovered / month",
          before: "Before: manual Excel reporting, ad-hoc competitive intel, scattered data.",
          after:
            "After: auto dashboards, forecasts, weekly summarized intel, anomalies caught before they cost.",
        },
        {
          size: "Enterprise (500+)",
          industry: "HQs, multi-country, centralized support functions",
          metric: "5× support productivity",
          before: "Before: same HR/IT/payroll question 50 times, teams constantly interrupted.",
          after:
            "After: internal chatbot on your procedures, real-time translation, Drive search in 5 seconds.",
        },
      ];

  const title = villeContext
    ? isFr
      ? `TPE, PME, ETI ou grand groupe à ${villeContext.name} —`
      : `Small, mid-market or enterprise in ${villeContext.name} —`
    : isFr
      ? "TPE, PME, ETI ou grand groupe —"
      : "Small, mid-market or enterprise —";

  const description = villeContext
    ? isFr
      ? `Notre cœur de cible à ${villeContext.name} : les TPE et PME qui veulent une IA opérationnelle vite, sans tunnel ni régie. Mais nos automatisations s'adaptent aussi à l'ETI, au grand groupe et aux institutions locales — IA Custom dédiée pour les périmètres complexes.`
      : `Our core target in ${villeContext.name}: small businesses and SMBs who want operational AI fast, no tunnel, no time-and-materials. But our automations also fit local mid-market, enterprise and institutions — dedicated Custom AI for complex perimeters.`
    : isFr
      ? "Notre cœur de cible : les TPE et PME qui veulent une IA opérationnelle vite, sans tunnel ni régie. Mais nos automatisations s'adaptent aussi à l'ETI, au grand groupe et aux institutions — IA Custom dédiée pour les périmètres complexes."
      : "Our core target: small businesses and SMBs who want operational AI fast, no tunnel, no time-and-materials. But our automations also fit mid-market, enterprise and institutions — dedicated Custom AI for complex perimeters.";

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Pour qui ça change tout" : "For whom it changes everything"}
      title={title}
      titleEm={isFr ? "à chacun son scénario" : "each its own scenario"}
      description={description}
    >
      <ul className="grid gap-5 md:grid-cols-2">
        {scenarios.map((s) => (
          <li
            key={s.industry}
            className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-6 sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="bg-terracotta-soft text-terracotta-deep inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase">
                  {s.size}
                </span>
                <p className="text-fg-soft text-sm">{s.industry}</p>
              </div>
              <p
                className="text-terracotta-deep text-2xl leading-none font-medium tracking-tight sm:text-[1.75rem]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {s.metric}
              </p>
            </div>
            <div className="border-border space-y-2 border-t pt-4">
              <p className="text-fg-muted flex items-start gap-2 text-sm leading-relaxed">
                <span
                  aria-hidden="true"
                  className="text-fg-muted mt-0.5 inline-block w-12 shrink-0 text-[11px] font-semibold tracking-[0.18em] uppercase"
                >
                  {isFr ? "Avant" : "Before"}
                </span>
                <span className="text-fg-soft">{s.before}</span>
              </p>
              <p className="text-fg flex items-start gap-2 text-sm leading-relaxed">
                <span
                  aria-hidden="true"
                  className="text-terracotta-deep mt-0.5 inline-block w-12 shrink-0 text-[11px] font-semibold tracking-[0.18em] uppercase"
                >
                  {isFr ? "Après" : "After"}
                </span>
                <span className="text-fg">{s.after}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-fg-muted mt-10 text-xs leading-relaxed">
        {isFr
          ? "Scénarios représentatifs et non témoignages clients. Les résultats varient selon le contexte, les outils en place et l'engagement des équipes. Votre cas est unique — devis personnalisé sous 48 h."
          : "Representative scenarios, not client testimonials. Outcomes depend on context, existing tools and team engagement. Your case is unique — personalized quote within 48 h."}
      </p>
    </Section>
  );
}
