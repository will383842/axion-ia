// Server Component — corps de la page recrutement commerciaux (page France
// unique). Décision Will 2026-06-08 : une seule page indexée (pas de pages
// ville, qui étaient quasi-dupliquées = doorway). La visibilité par ville passe
// par le JobPosting multi-lieux (Google for Jobs) sur la page France.

import type { ReactNode } from "react";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { DevenirCommercialHero } from "./DevenirCommercialHero";
import { CommercialOpportunity } from "./CommercialOpportunity";
import { CommercialProductsEarnings } from "./CommercialProductsEarnings";
import { CommercialProcess } from "./CommercialProcess";
import { CommercialHowItWorks } from "./CommercialHowItWorks";
import { CommercialContactBand } from "./CommercialContactBand";
import { CommercialReassurance } from "./CommercialReassurance";
import { CommercialProfiles } from "./CommercialProfiles";
import { CommercialStatus } from "./CommercialStatus";
import { CommercialMindset } from "./CommercialMindset";
import { CommercialFounder } from "./CommercialFounder";
import { CommercialFaq } from "./CommercialFaq";
import { COMMERCIAL_FAQ_FIXED, type FaqItem } from "@/content/recrutement/commercial-offer";

/** Items FAQ (fixe). Partagé page ↔ JSON-LD. */
export function buildCommercialFaqItems(): ReadonlyArray<FaqItem> {
  return [...COMMERCIAL_FAQ_FIXED];
}

export interface CommercialPageBodyProps {
  readonly isFr: boolean;
}

export function CommercialPageBody({ isFr }: CommercialPageBodyProps): ReactNode {
  const faqItems = buildCommercialFaqItems();
  return (
    <>
      <DevenirCommercialHero isFr={isFr} />
      <CommercialOpportunity isFr={isFr} />
      <CommercialHowItWorks isFr={isFr} />
      <CommercialContactBand isFr={isFr} trackSuffix="-mid" />
      <CommercialReassurance isFr={isFr} />
      <CommercialProductsEarnings isFr={isFr} />
      <CommercialProcess isFr={isFr} />
      <CommercialProfiles isFr={isFr} />
      <CommercialStatus isFr={isFr} />
      <CommercialMindset isFr={isFr} />
      <CommercialFounder isFr={isFr} />
      <CommercialFaq isFr={isFr} items={faqItems} />
      <CommercialContactBand isFr={isFr} trackSuffix="-final" />

      <StickyMobileCta
        href="/devenir-commercial-ia/candidature"
        label={isFr ? "Devenir commercial" : "Become a rep"}
        track="commercial-sticky-apply"
        threshold={500}
      />
    </>
  );
}
