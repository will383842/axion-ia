/**
 * ImplementationCtaBlock — CTA final double (Contact + Audit), tone mocha.
 *
 * Sprint A · Phase 2 Extract-3 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/implementation/page.tsx` (l.1322-1344). Bloc closing du
 * funnel : « Vous payez une fois. C'est à vous. » avec 2 CTAs (Décrire mon
 * besoin → /contact, Commencer par un audit → /audit). Quand `villeContext`
 * est fourni, accroche ville-aware « Réponse à votre brief à {ville} ».
 */

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import type { VilleContext } from "@/components/services/types";

export interface ImplementationCtaBlockProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function ImplementationCtaBlock({
  isFr,
  villeContext,
}: ImplementationCtaBlockProps): ReactNode {
  const description = villeContext
    ? isFr
      ? `Forfait fixe, livraison en 2 à 6 semaines, formation incluse. Pas d'abonnement, pas de maintenance imposée. Réponse à votre brief à ${villeContext.name} sous 48 h ouvrées.`
      : `Fixed fee, 2 to 6 week delivery, training included. No subscription, no imposed maintenance. Reply to your ${villeContext.name} brief within 48 business hours.`
    : isFr
      ? "Forfait fixe, livraison en 2 à 6 semaines, formation incluse. Pas d'abonnement, pas de maintenance imposée. Réponse à votre brief sous 48 h ouvrées."
      : "Fixed fee, 2 to 6 week delivery, training included. No subscription, no imposed maintenance. Reply to your brief within 48 business hours.";

  return (
    <CtaBlock
      eyebrow={isFr ? "Prêt à démarrer" : "Ready to start"}
      title={isFr ? "Vous payez une fois." : "You pay"}
      titleEm={isFr ? "C'est à vous." : "once."}
      titleTail={isFr ? "" : " It's yours."}
      description={description}
      cta={
        <>
          <Cta href="/contact" size="lg" track="impl-final-primary">
            {isFr ? "Décrire mon besoin · réponse 48 h" : "Describe my need · 48 h reply"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Cta>
          <Cta href="/audit" size="lg" variant="outline" track="impl-final-audit">
            {isFr ? "Commencer par un audit" : "Start with an audit"}
          </Cta>
        </>
      }
      tone="mocha"
    />
  );
}
