// Server Component — corps partagé des pages recrutement commerciaux. Composé
// par la page France générique (sans `ville`) ET par la page [ville] (avec
// `ville` = contexte local réel). Les sections VARIABLES (Territoire, clôture
// ville, 2 Q FAQ locales) ne s'affichent que si `ville` est fourni — c'est ce
// qui rend chaque page unique (anti-doorway).

import type { ReactNode } from "react";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { DevenirCommercialHero } from "./DevenirCommercialHero";
import { CommercialOpportunity } from "./CommercialOpportunity";
import { CommercialProductsEarnings } from "./CommercialProductsEarnings";
import { CommercialProcess } from "./CommercialProcess";
import { CommercialHowItWorks } from "./CommercialHowItWorks";
import { CommercialContactBand } from "./CommercialContactBand";
import { CommercialReassurance } from "./CommercialReassurance";
import {
  CommercialTerritory,
  type TerritorySector,
  type TerritoryGroup,
  type TerritoryCommune,
} from "./CommercialTerritory";
import { CommercialProfiles } from "./CommercialProfiles";
import { CommercialStatus } from "./CommercialStatus";
import { CommercialMindset } from "./CommercialMindset";
import { CommercialFounder } from "./CommercialFounder";
import { CommercialFaq } from "./CommercialFaq";
import { CommercialVilleClosing } from "./CommercialVilleClosing";
import { COMMERCIAL_FAQ_FIXED, type FaqItem } from "@/content/recrutement/commercial-offer";

/** Contexte local réel d'une ville (dérivé des données INSEE/economic-data). */
export interface CommercialVilleContext {
  readonly name: string;
  readonly departementLabel?: string | undefined;
  readonly region?: string | undefined;
  readonly etablissementsActifs?: number | undefined;
  readonly creationsEntreprises?: number | undefined;
  readonly anneeReference?: number | undefined;
  readonly topSectors: ReadonlyArray<TerritorySector>;
  readonly grandsGroupes: ReadonlyArray<TerritoryGroup>;
  readonly communesBassin: ReadonlyArray<TerritoryCommune>;
  readonly specificite?: string | undefined;
}

/** Construit les items FAQ (fixe + 2 Q locales variables). Partagé page ↔ JSON-LD. */
export function buildCommercialFaqItems(ctx?: CommercialVilleContext): ReadonlyArray<FaqItem> {
  const items: FaqItem[] = [...COMMERCIAL_FAQ_FIXED];
  if (ctx) {
    const zoneFr = [
      `${ctx.name} et son agglomération`,
      ctx.departementLabel ? `le département (${ctx.departementLabel})` : null,
      ctx.region ? `la région ${ctx.region}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const zoneEn = [
      `${ctx.name} and its metro area`,
      ctx.departementLabel ? `the department (${ctx.departementLabel})` : null,
      ctx.region ? `the ${ctx.region} region` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const sectors = ctx.topSectors.slice(0, 2).map((s) => s.label);
    items.push(
      {
        q: {
          fr: `Sur quelle zone puis-je vendre autour de ${ctx.name} ?`,
          en: `What area can I sell in around ${ctx.name}?`,
        },
        a: {
          fr: `Vous couvrez ${zoneFr}, sans oublier votre propre portefeuille d'entreprises, que vous gardez.`,
          en: `You cover ${zoneEn}, plus your own portfolio of companies, which you keep.`,
        },
      },
      {
        q: {
          fr: `Quelles entreprises cibler à ${ctx.name} ?`,
          en: `Which companies should I target in ${ctx.name}?`,
        },
        a: {
          fr: `Tous types d'entreprises — TPE, artisans, commerçants, PME, ETI et grandes entreprises${
            sectors.length > 0
              ? `, notamment dans les secteurs forts du territoire comme ${sectors.join(" et ")}`
              : ""
          }.`,
          en: `All kinds of companies — micro-businesses, artisans, retailers, SMEs, mid-caps and large enterprises${
            sectors.length > 0
              ? `, especially in the territory's strong sectors such as ${sectors.join(" and ")}`
              : ""
          }.`,
        },
      },
    );
  }
  return items;
}

export interface CommercialPageBodyProps {
  readonly isFr: boolean;
  readonly ville?: CommercialVilleContext;
}

export function CommercialPageBody({ isFr, ville }: CommercialPageBodyProps): ReactNode {
  const faqItems = buildCommercialFaqItems(ville);
  return (
    <>
      <DevenirCommercialHero isFr={isFr} villeName={ville?.name} />
      <CommercialOpportunity isFr={isFr} />
      <CommercialContactBand isFr={isFr} trackSuffix="-mid" />
      <CommercialReassurance isFr={isFr} />
      <CommercialProductsEarnings isFr={isFr} />
      <CommercialProcess isFr={isFr} />
      <CommercialHowItWorks isFr={isFr} />

      {/* ⭐ VARIABLE — uniquement sur les pages ville (anti-doorway) */}
      {ville ? (
        <CommercialTerritory
          isFr={isFr}
          villeName={ville.name}
          departementLabel={ville.departementLabel}
          region={ville.region}
          etablissementsActifs={ville.etablissementsActifs}
          creationsEntreprises={ville.creationsEntreprises}
          anneeReference={ville.anneeReference}
          topSectors={ville.topSectors}
          grandsGroupes={ville.grandsGroupes}
          communesBassin={ville.communesBassin}
          specificite={ville.specificite}
        />
      ) : null}

      <CommercialProfiles isFr={isFr} />
      <CommercialStatus isFr={isFr} />
      <CommercialMindset isFr={isFr} />
      <CommercialFounder isFr={isFr} />
      <CommercialFaq isFr={isFr} items={faqItems} />

      {/* ⭐ VARIABLE — clôture locale (ville pages) sinon bandeau générique */}
      {ville ? (
        <CommercialVilleClosing
          isFr={isFr}
          villeName={ville.name}
          departementLabel={ville.departementLabel}
          region={ville.region}
          communesBassin={ville.communesBassin.map((c) => c.nameFr)}
        />
      ) : (
        <CommercialContactBand isFr={isFr} trackSuffix="-final" />
      )}

      <StickyMobileCta
        href="/devenir-commercial-ia/candidature"
        label={isFr ? "Devenir commercial" : "Become a rep"}
        track="commercial-sticky-apply"
        threshold={500}
      />
    </>
  );
}
