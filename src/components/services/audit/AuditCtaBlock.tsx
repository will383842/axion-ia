/**
 * AuditCtaBlock — CTA final « Réservez votre Flash terrain » (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis `src/app/[locale]/audit/page.tsx`
 * (l.541-562). Bloc CTA mocha-rich pleine largeur. Quand `villeContext` est
 * fourni, le titre devient « Flash terrain dans {ville} » et le prix reste
 * dynamique (issu de `AUDIT_TIERS`).
 */

import type { ReactNode } from "react";
import { Calendar } from "lucide-react";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import { AUDIT_TIERS, formatAmount, getTierById } from "@/content/pricing";
import type { VilleContext } from "@/components/services/types";

export interface AuditCtaBlockProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function AuditCtaBlock({ isFr, villeContext }: AuditCtaBlockProps): ReactNode {
  const loc: "fr" | "en" = isFr ? "fr" : "en";
  const flashTier = getTierById(AUDIT_TIERS, "audit-flash");
  const onsitePrice = formatAmount(flashTier.priceFlatOnsite ?? 890, loc, { compact: true });

  const title = villeContext
    ? isFr
      ? `Réservez votre Flash terrain à ${villeContext.name}`
      : `Book your on-site Flash in ${villeContext.name}`
    : isFr
      ? "Réservez votre Flash terrain"
      : "Book your on-site Flash";

  const titleEm = isFr ? `à ${onsitePrice}` : `at ${onsitePrice}`;

  const description = villeContext
    ? isFr
      ? `1 journée complète dans vos locaux à ${villeContext.name}, démos live, plan d'action sous 48 h. Réservation directe sur le calendrier. Sans engagement avant signature.`
      : `Full day on your premises in ${villeContext.name}, live demos, action plan within 48 h. Direct booking on the calendar. No commitment before signing.`
    : isFr
      ? "1 journée complète dans vos locaux, démos live, plan d'action sous 48 h. Réservation directe sur le calendrier maison. Sans engagement avant signature."
      : "Full day on your premises, live demos, action plan within 48 h. Direct booking on our calendar. No commitment before signing.";

  return (
    <CtaBlock
      eyebrow={isFr ? "Démarrer concrètement" : "Start concretely"}
      title={title}
      titleEm={titleEm}
      description={description}
      cta={
        <Cta
          href="/reserver?intervention=audit-flash-onsite"
          size="lg"
          className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
          track={
            villeContext
              ? `audit-cta-flash-ville-${villeContext.villeSlug}`
              : "audit-cta-flash"
          }
        >
          <Calendar aria-hidden="true" className="h-4 w-4" />
          {isFr ? "Réserver sur le calendrier" : "Book on the calendar"}
        </Cta>
      }
      tone="dark"
    />
  );
}
