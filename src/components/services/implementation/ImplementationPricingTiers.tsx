/**
 * ImplementationPricingTiers — Bandeau pricing 3 tiers (transparence totale).
 *
 * Sprint A · Phase 2 Extract-3 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/implementation/page.tsx` (l.986-1040). Mise en route IA
 * (~490 €) / Implémentation standard (sur devis) / IA Custom (sur devis).
 * Tous les montants viennent de la SSOT `@/content/pricing` (pas de hardcode).
 * Footer disclaimer HT + CTA contact.
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";
import type { VilleContext } from "@/components/services/types";

export interface ImplementationPricingTiersProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function ImplementationPricingTiers({
  isFr,
  villeContext,
}: ImplementationPricingTiersProps): ReactNode {
  const loc: "fr" | "en" = isFr ? "fr" : "en";

  const startupAmount = formatAmount(
    getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!,
    loc,
    { compact: true },
  );

  const pricingTiers = isFr
    ? [
        {
          tag: "À partir de",
          price: startupAmount,
          label: "Mise en route IA",
          desc: "Une première automatisation simple installée chez vous. Idéal artisan, commerce, TPE qui veut tester sans risque.",
        },
        {
          tag: "Forfait fixe",
          price: "Sur devis",
          label: "Implémentation standard",
          desc: "Plusieurs automatisations connectées entre elles dans une cohérence métier. Devis personnalisé selon votre périmètre.",
        },
        {
          tag: "Sur mesure",
          price: "Sur devis",
          label: "IA Custom · ETI & grands comptes",
          desc: "Modèles fine-tuned, équipe dédiée, intégration profonde. Pour les périmètres complexes ou les institutions.",
        },
      ]
    : [
        {
          tag: "From",
          price: startupAmount,
          label: "AI start-up",
          desc: "A first simple automation installed at your place. Great for trades, retail, SMB who want a risk-free test.",
        },
        {
          tag: "Fixed fee",
          price: "On quote",
          label: "Standard implementation",
          desc: "Several automations connected together in business coherence. Personalized quote based on your scope.",
        },
        {
          tag: "Custom",
          price: "On quote",
          label: "Custom AI · mid-cap & enterprise",
          desc: "Fine-tuned models, dedicated team, deep integration. For complex perimeters or institutions.",
        },
      ];

  const title = villeContext
    ? isFr
      ? `Combien ça coûte à ${villeContext.name},`
      : `What it costs in ${villeContext.name},`
    : isFr
      ? "Combien ça coûte,"
      : "What it costs,";

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Tarifs · transparence" : "Pricing · full transparency"}
      title={title}
      titleEm={isFr ? "vraiment" : "truly"}
      description={
        isFr
          ? "Forfait fixe systématique. Devis ferme avant tout démarrage. Pas de dépassement, pas d'abonnement, pas de surprise."
          : "Always fixed fee. Firm quote before kick-off. No overrun, no subscription, no surprise."
      }
    >
      <ul className="grid gap-6 md:grid-cols-3">
        {pricingTiers.map((tier) => (
          <li
            key={tier.label}
            className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-7 sm:p-8"
          >
            <p className="text-fg-muted text-[12px] font-medium tracking-[0.18em] uppercase">
              {tier.tag}
            </p>
            <p
              className="text-terracotta-deep text-3xl leading-none font-medium tracking-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {tier.price}
            </p>
            <h3 className="text-fg text-xl leading-tight font-semibold">{tier.label}</h3>
            <p className="text-fg-soft text-base leading-relaxed">{tier.desc}</p>
          </li>
        ))}
      </ul>
      <p className="text-fg-soft mt-8 text-sm">
        {isFr ? (
          <>
            Tous les prix HT. Devis ferme avant signature.{" "}
            <Link
              href="/contact"
              className="text-terracotta-deep font-semibold underline-offset-4 hover:underline"
            >
              Demander un devis pour mon cas →
            </Link>
          </>
        ) : (
          <>
            All prices excl. VAT. Firm quote before signing.{" "}
            <Link
              href="/contact"
              className="text-terracotta-deep font-semibold underline-offset-4 hover:underline"
            >
              Request a quote for my case →
            </Link>
          </>
        )}
      </p>
    </Section>
  );
}
