/**
 * InterventionsCrossModules — 2 cards cross-link (Audit ↔ Implémentation).
 *
 * Sprint A Phase 2 (2026-05-25). Server Component. Symétrie avec /audit qui
 * propose Interventions+Implémentation. Pas de villeContext : reco neutre.
 *
 * Sprint 14.10.8 (Will 2026-05-12) — si l'intervention n'est pas le bon angle,
 * proposer Audit (comprendre) ou Implémentation (passer à l'action).
 */

import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { AUDIT_TIERS, formatAmount, getTierById } from "@/content/pricing";

interface InterventionsCrossModulesProps {
  readonly isFr: boolean;
}

export function InterventionsCrossModules({ isFr }: InterventionsCrossModulesProps) {
  const loc: "fr" | "en" = isFr ? "fr" : "en";
  const flashTier = getTierById(AUDIT_TIERS, "audit-flash");
  const strategicEtiTier = getTierById(AUDIT_TIERS, "audit-strategique-eti");
  const flashRemote = formatAmount(flashTier.priceFlat ?? 490, loc, { compact: true });
  const strategicMin = formatAmount(strategicEtiTier.priceMin ?? 12000, loc, { compact: true });

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Pas le bon format ?" : "Not the right format?"}
      title={isFr ? "Vous préférez" : "Would you rather"}
      titleEm={isFr ? "auditer ou implémenter ?" : "audit or implement?"}
      description={
        isFr
          ? "Les interventions forment vos équipes. Si vous voulez d'abord comprendre où l'IA peut servir, ou si vous voulez directement passer à l'action sur un cas précis, ces 2 modules sont vos prochaines étapes."
          : "Sessions train your teams. If you want to first understand where AI can help, or to directly move to action on a specific case, these 2 modules are your next steps."
      }
    >
      <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2 lg:gap-7">
        <Cta
          href="/audit"
          variant="outline"
          size="lg"
          className="hover:bg-terracotta-soft justify-start py-6 text-left"
        >
          <span className="flex flex-col items-start gap-0.5">
            <span className="text-fg text-base font-semibold">
              {isFr ? "Auditer d'abord →" : "Audit first →"}
            </span>
            <span className="text-fg-soft text-[13px] leading-snug">
              {isFr
                ? `4 niveaux d'audit · Flash ${flashRemote} → Stratégique ETI ${strategicMin}+`
                : `4 audit levels · Flash ${flashRemote} → Strategic mid-cap ${strategicMin}+`}
            </span>
          </span>
        </Cta>
        <Cta
          href="/implementation"
          variant="outline"
          size="lg"
          className="hover:bg-terracotta-soft justify-start py-6 text-left"
        >
          <span className="flex flex-col items-start gap-0.5">
            <span className="text-fg text-base font-semibold">
              {isFr ? "Implémenter l'IA →" : "Implement AI →"}
            </span>
            <span className="text-fg-soft text-[13px] leading-snug">
              {isFr
                ? "Mise en production IA · agents, automatisations, IA custom, intégrations"
                : "Production AI · agents, automations, custom AI, integrations"}
            </span>
          </span>
        </Cta>
      </div>
    </Section>
  );
}
