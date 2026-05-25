/**
 * UnAUnCtaBlock — CTA final du service `un-a-un` ("Prêt à progresser ?").
 *
 * Sprint A Phase 2 — extrait depuis `src/app/[locale]/un-a-un/page.tsx`.
 * Réutilise `CtaBlock` (tone="dark") avec le tarif d'entrée injecté via SSOT
 * (`UN_A_UN_TIERS` → `getEntryTier` + `formatPrice`). Quand un `villeContext`
 * est fourni, la description précise "à {ville}" pour ancrer la promesse géo.
 *
 * Server Component pur, zéro JS.
 */

import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { UN_A_UN_TIERS, formatPrice, getEntryTier } from "@/content/pricing";
import type { VilleContext } from "@/components/services/types";

interface UnAUnCtaBlockProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function UnAUnCtaBlock({ isFr, villeContext }: UnAUnCtaBlockProps) {
  const entryTier = getEntryTier(UN_A_UN_TIERS);
  const formattedPrice = formatPrice(entryTier, isFr ? "fr" : "en");

  const description = villeContext
    ? isFr
      ? `À partir de ${formattedPrice}, sans engagement, en visio ou sur site à ${villeContext.name} et partout en France métropolitaine.`
      : `From ${formattedPrice}, no commitment, remote or on-site in ${villeContext.name} and anywhere in metropolitan France.`
    : isFr
      ? `À partir de ${formattedPrice}, sans engagement, en visio ou sur site partout en France métropolitaine.`
      : `From ${formattedPrice}, no commitment, remote or on-site anywhere in metropolitan France.`;

  return (
    <CtaBlock
      title={isFr ? "Prêt à progresser sur l'IA ?" : "Ready to progress on AI?"}
      description={description}
      cta={
        <Cta href="/contact" size="lg" track="un-a-un-cta-block-final">
          {isFr ? "Démarrer mon accompagnement 1-to-1" : "Start my 1-to-1 coaching"}
        </Cta>
      }
      tone="dark"
    />
  );
}
