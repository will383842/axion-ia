/**
 * AuditCrossModules — 2 CTA cross-modules Former / Implémenter (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis `src/app/[locale]/audit/page.tsx`
 * (l.431-484). Quand l'audit n'est pas le bon format pour le prospect, on
 * propose le module Interventions (formation équipe) ou Implémentation (mise
 * en œuvre). Universel — pas de villeContext.
 */

import type { ReactNode } from "react";
import { FileText, Users } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";

const TIGHT_X = "lg:px-6 xl:px-10";

export interface AuditCrossModulesProps {
  readonly isFr: boolean;
}

export function AuditCrossModules({ isFr }: AuditCrossModulesProps): ReactNode {
  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Pas le bon format ?" : "Not the right format?"}
      title={isFr ? "Vous préférez" : "Would you rather"}
      titleEm={isFr ? "former ou implémenter ?" : "train or implement?"}
      description={
        isFr
          ? "L'audit est l'angle « comprendre et chiffrer ». Si vous savez déjà ce que vous voulez et cherchez à former vos équipes ou à passer à l'action, ces 2 modules sont vos prochaines étapes."
          : "Audit is the « understand and quantify » angle. If you already know what you want and seek to train teams or move to action, these 2 modules are your next steps."
      }
      contentClassName={TIGHT_X}
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:gap-7">
        <Cta
          href="/interventions"
          variant="outline"
          size="lg"
          className="hover:bg-terracotta-soft justify-start py-6 text-left"
        >
          <Users aria-hidden="true" className="text-terracotta-deep h-5 w-5" />
          <span className="flex flex-col items-start gap-0.5">
            <span className="text-fg text-base font-semibold">
              {isFr ? "Former vos équipes →" : "Train your teams →"}
            </span>
            <span className="text-fg-soft text-[13px] leading-snug">
              {isFr
                ? "14 formats interventions IA · Collectives, individuelles, dirigeants, conférences"
                : "14 AI session formats · Team, individual, executive, talks"}
            </span>
          </span>
        </Cta>
        <Cta
          href="/implementation"
          variant="outline"
          size="lg"
          className="hover:bg-terracotta-soft justify-start py-6 text-left"
        >
          <FileText aria-hidden="true" className="text-terracotta-deep h-5 w-5" />
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
