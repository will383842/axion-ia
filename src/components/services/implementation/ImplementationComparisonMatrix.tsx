/**
 * ImplementationComparisonMatrix — Comparatif Make/Zapier vs Agence vs Axion-IA.
 *
 * Sprint A · Phase 2 Extract-3 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/implementation/page.tsx` (l.1046-1193). Matrice 3 colonnes
 * × 4 critères (forfait fixe / délai ≤ 6 sem / vraie IA / propriété), pros/cons
 * détaillés + verdict. Colonne Axion-IA mise en avant (scale + ring + badge).
 */

import type { ReactNode } from "react";
import { ArrowRight, Check, Minus, X } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";

export interface ImplementationComparisonMatrixProps {
  readonly isFr: boolean;
}

export function ImplementationComparisonMatrix({
  isFr,
}: ImplementationComparisonMatrixProps): ReactNode {
  const loc: "fr" | "en" = isFr ? "fr" : "en";
  const axionPrice = `${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, loc, { compact: true })} → ${isFr ? "sur devis" : "on quote"}`;

  const comparison = isFr
    ? {
        eyebrow: "On peut comparer",
        title: "Make · agence ·",
        titleEm: "Axion-IA",
        description:
          "Trois manières d'automatiser votre entreprise avec l'IA. Sur 4 critères qui comptent vraiment, voici comment chacun se positionne.",
        criteriaLabels: [
          "Forfait fixe (pas de dépassement)",
          "Livraison ≤ 6 semaines",
          "Vraie IA (pas juste no-code)",
          "Vous êtes propriétaire · sans abonnement",
        ],
        cols: [
          {
            name: "Make / Zapier",
            tag: "Plateforme no-code (DIY)",
            price: "0 € → 99 €/mois",
            highlight: false,
            badge: undefined,
            pros: [
              "Bon pour automatisations très simples (si A → alors B)",
              "Démarrage gratuit possible",
            ],
            cons: [
              "Vous configurez tout vous-même : aucun service, aucun accompagnement",
              "Forte courbe d'apprentissage technique pour des cas avancés",
              "Plafonne vite : pas d'IA réelle, pas d'intelligence métier",
              "Coûts qui explosent au volume (facturé à la tâche)",
              "Abonnement permanent — vous payez tant que ça tourne",
              "Maintenance et corrections de pannes à votre charge",
            ],
            criteria: ["no", "yes", "no", "no"] as const,
            verdict:
              "C'est une plateforme, pas un partenaire. À vous de tout faire, de tout maintenir.",
          },
          {
            name: "Agence classique",
            tag: "Sur mesure profond",
            price: "25 k€ → 200 k€",
            highlight: false,
            badge: undefined,
            pros: [
              "Capacité à traiter des sujets très complexes",
              "Sur mesure poussé, équipe dédiée",
            ],
            cons: [
              "Devis élastiques, dépassements fréquents",
              "Délais 3 à 6 mois minimum",
              "Régie au temps : vous payez les hésitations",
              "Maintenance continue souvent imposée",
            ],
            criteria: ["no", "no", "yes", "partial"] as const,
            verdict: "Pertinent pour des projets très grands ou avec contraintes techniques rares.",
          },
          {
            name: "Axion-IA",
            tag: "Cabinet IA & automatisation",
            price: axionPrice,
            highlight: true,
            badge: "Optimisé pour votre ROI",
            pros: [
              "Cabinet spécialisé IA & automatisation — vous avez un partenaire, pas un outil",
              "Forfait fixe · devis ferme avant tout démarrage",
              "Vraie IA connectée à vos outils (pas juste un workflow)",
              "Livraison en 2 à 6 semaines, sprints + démos hebdo",
              "Vous êtes propriétaire — code, données, accès",
              "Pas d'abonnement mensuel imposé",
              "Catalogue éprouvé (~50 automatisations) + sur mesure",
              "S'adapte de l'artisan à l'ETI · IA Custom pour les grands comptes",
            ],
            cons: ["Pas de régie continue (volontairement — vous restez libre)"],
            criteria: ["yes", "yes", "yes", "yes"] as const,
            verdict:
              "L'expertise d'un cabinet IA, l'agilité d'une équipe spécialisée, sans la facture ni la dépendance — l'équilibre que personne d'autre ne propose en France.",
          },
        ],
      }
    : {
        eyebrow: "Let's compare",
        title: "Make · agency ·",
        titleEm: "Axion-IA",
        description:
          "Three ways to automate your business with AI. On the 4 criteria that actually matter, here is how each positions itself.",
        criteriaLabels: [
          "Fixed fee (no overrun)",
          "Delivery ≤ 6 weeks",
          "Real AI (not just no-code)",
          "You own it · no subscription",
        ],
        cols: [
          {
            name: "Make / Zapier",
            tag: "DIY no-code platform",
            price: "€0 → €99/mo",
            highlight: false,
            badge: undefined,
            pros: ["Good for very simple automations (if A → then B)", "Free tier to start"],
            cons: [
              "You configure everything yourself — no service, no support",
              "Steep learning curve for advanced cases",
              "Caps quickly: no real AI, no business intelligence",
              "Costs explode with volume (per-task billing)",
              "Permanent subscription — you pay as long as it runs",
              "Maintenance and outages on you",
            ],
            criteria: ["no", "yes", "no", "no"] as const,
            verdict: "It's a platform, not a partner. You do everything, you maintain everything.",
          },
          {
            name: "Classic agency",
            tag: "Deep custom",
            price: "€25k → €200k",
            highlight: false,
            badge: undefined,
            pros: ["Can tackle very complex topics", "Deep custom, dedicated team"],
            cons: [
              "Elastic quotes, frequent overruns",
              "3 to 6 month minimum delivery",
              "Time-and-materials: you pay the hesitations",
              "Continuous maintenance often required",
            ],
            criteria: ["no", "no", "yes", "partial"] as const,
            verdict: "Right for very large projects or rare technical constraints.",
          },
          {
            name: "Axion-IA",
            tag: "AI & automation consultancy",
            price: axionPrice,
            highlight: true,
            badge: "Best of both worlds",
            pros: [
              "Specialized AI & automation consultancy — a partner, not a tool",
              "Fixed fee · firm quote before any kick-off",
              "Real AI wired to your tools (not just a workflow)",
              "Delivery in 2 to 6 weeks, sprints + weekly demos",
              "You own it — code, data, access",
              "No imposed monthly subscription",
              "Proven catalogue (~50 automations) + custom",
              "Scales from trades to mid-cap · Custom AI for enterprise",
            ],
            cons: ["No continuous time-and-materials (by design — you stay free)"],
            criteria: ["yes", "yes", "yes", "yes"] as const,
            verdict:
              "An AI consultancy's expertise, a specialized team's agility, without the bill or the lock-in — the balance no one else offers.",
          },
        ],
      };

  return (
    <Section
      tone="sand"
      eyebrow={comparison.eyebrow}
      title={comparison.title}
      titleEm={comparison.titleEm}
      description={comparison.description}
    >
      <ul className="grid items-stretch gap-6 md:grid-cols-3 md:gap-5 lg:gap-6">
        {comparison.cols.map((col) => (
          <li
            key={col.name}
            className={
              col.highlight
                ? "border-terracotta bg-paper ring-terracotta/25 relative z-10 flex flex-col gap-5 rounded-2xl border-2 p-7 shadow-2xl ring-4 sm:p-8 lg:scale-[1.04]"
                : "border-border bg-paper/70 relative flex flex-col gap-5 rounded-2xl border p-7 sm:p-8"
            }
          >
            {col.highlight ? (
              <span className="bg-terracotta text-mocha-fg absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase shadow-lg">
                {"★"} {col.badge ?? (isFr ? "Notre approche" : "Our approach")}
              </span>
            ) : null}

            <div className="space-y-1">
              <h3
                className={
                  col.highlight
                    ? "text-terracotta-deep text-2xl leading-tight font-medium sm:text-[1.6rem]"
                    : "text-fg-soft text-2xl leading-tight font-medium"
                }
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {col.name}
              </h3>
              <p className="text-fg-muted text-[12px] font-medium tracking-[0.16em] uppercase">
                {col.tag}
              </p>
            </div>

            <p
              className={
                col.highlight
                  ? "text-fg text-3xl leading-none font-medium tracking-tight sm:text-[2.5rem]"
                  : "text-fg-soft text-2xl leading-none font-medium"
              }
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {col.price}
            </p>

            <ul className="space-y-2.5">
              {col.pros.map((pro) => (
                <li key={pro} className="flex items-start gap-2.5">
                  <Check
                    aria-hidden="true"
                    className={
                      col.highlight
                        ? "text-sage mt-0.5 h-4 w-4 shrink-0"
                        : "text-fg-muted mt-0.5 h-4 w-4 shrink-0"
                    }
                  />
                  <span
                    className={
                      col.highlight
                        ? "text-fg text-sm leading-relaxed"
                        : "text-fg-soft text-sm leading-relaxed"
                    }
                  >
                    {pro}
                  </span>
                </li>
              ))}
              {col.cons.map((con) => (
                <li key={con} className="flex items-start gap-2.5">
                  <Minus aria-hidden="true" className="text-fg-muted mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-fg-muted text-sm leading-relaxed">{con}</span>
                </li>
              ))}
            </ul>

            <ul
              className={
                col.highlight
                  ? "border-terracotta/40 space-y-2 border-t pt-4"
                  : "border-border space-y-2 border-t pt-4"
              }
              aria-label={isFr ? "Comparatif sur 4 critères" : "Comparison on 4 criteria"}
            >
              {comparison.criteriaLabels.map((label, i) => {
                const state = col.criteria[i];
                return (
                  <li
                    key={label}
                    className="flex items-center justify-between gap-3 text-[12.5px] leading-snug"
                  >
                    <span className={col.highlight ? "text-fg" : "text-fg-soft"}>{label}</span>
                    {state === "yes" ? (
                      <span
                        aria-label={isFr ? "Oui" : "Yes"}
                        className="bg-sage/15 text-sage flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      >
                        <Check aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                    ) : state === "no" ? (
                      <span
                        aria-label={isFr ? "Non" : "No"}
                        className="bg-fg-muted/15 text-fg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      >
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span
                        aria-label={isFr ? "Partiel" : "Partial"}
                        className="bg-fg-muted/15 text-fg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      >
                        <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <p
              className={
                col.highlight
                  ? "text-terracotta-deep mt-auto text-base leading-relaxed font-semibold"
                  : "text-fg-soft mt-auto text-sm leading-relaxed italic"
              }
            >
              {col.verdict}
            </p>

            {col.highlight ? (
              <Cta
                href="/contact"
                size="lg"
                track="impl-compare-axionia"
                className="mt-2 w-full justify-center"
              >
                {isFr ? "Décrire mon besoin · 48 h" : "Describe my need · 48 h"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}
