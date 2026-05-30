/**
 * AuditCtaBlock — CTA final bifurqué (Server Component).
 *
 * Brief Audit 2026 §11 (Will) — CTA final : « Réserver un appel » (/appel) +
 * « Nous écrire » (/contact), avec le pont explicite audit → implémentation
 * (l'audit est la porte d'entrée, on peut ensuite déployer) + réassurance
 * « sans engagement ». Bloc CtaBlock tone dark pleine largeur.
 */

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import type { VilleContext } from "@/components/services/types";

export interface AuditCtaBlockProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function AuditCtaBlock({ isFr, villeContext }: AuditCtaBlockProps): ReactNode {
  const title = villeContext
    ? isFr
      ? "Prêt à passer votre entreprise à l'IA"
      : "Ready to move your company to AI"
    : isFr
      ? "Prêt à passer votre entreprise"
      : "Ready to move your company";

  const titleEm = villeContext
    ? isFr
      ? `à ${villeContext.name} ?`
      : `in ${villeContext.name}?`
    : isFr
      ? "à l'IA ?"
      : "to AI?";

  const description = isFr
    ? "L'audit est la porte d'entrée. On réserve un appel, on cadre votre besoin — sans engagement. Et si vous décidez ensuite de déployer, on s'en charge de bout en bout."
    : "The audit is the entry door. We book a call and scope your need — no commitment. And if you then decide to deploy, we handle it end to end.";

  return (
    <CtaBlock
      eyebrow={isFr ? "Démarrer concrètement" : "Start concretely"}
      title={title}
      titleEm={titleEm}
      description={description}
      cta={
        <>
          <Cta
            href="/appel"
            size="lg"
            className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
            track={
              villeContext ? `audit-cta-call-ville-${villeContext.villeSlug}` : "audit-cta-call"
            }
          >
            {isFr ? "Réserver un appel" : "Book a call"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Cta>
          <Cta
            href="/contact"
            variant="outline"
            size="lg"
            className="bg-paper text-terracotta hover:bg-paper border-terracotta-deep shadow-subtle border-2"
            track="audit-cta-contact"
          >
            {isFr ? "Nous écrire" : "Email us"}
          </Cta>
        </>
      }
      tone="dark"
    />
  );
}
