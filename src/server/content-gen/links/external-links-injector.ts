/**
 * External Links Injector — Couche d'adaptation generators ↔ external-links DB.
 *
 * Encapsule la sélection contextuelle pour les 7 generators :
 *  - Mapping templateVariant → vertical
 *  - Mapping anchor* → cityId / regionSlug
 *  - Section markdown formatée pour le userPrompt
 *
 * Sprint External Links Database 2026-05-22.
 */

import type { GeneratorBaseInput } from "../generators/types";
import { selectExternalLinks } from "@/data/external-links/helpers";
import { buildExternalLinksPromptSection } from "@/data/external-links/helpers";
import type { ExternalLink, ExternalLinkAuthority } from "@/data/external-links/types";

/**
 * Mappe templateVariant Axion-IA → slug vertical du catalogue.
 */
function mapTemplateVariantToVertical(templateVariant?: string): string | undefined {
  if (!templateVariant) return undefined;
  const v = templateVariant.toLowerCase();
  if (v.includes("audit")) return "audits";
  if (v.includes("formation") || v.includes("intervention")) return "interventions_formations";
  if (v.includes("un-a-un") || v.includes("un_a_un") || v.includes("1to1") || v.includes("1-to-1"))
    return "un_a_un";
  if (v.includes("implement")) return "implementations";
  if (v.includes("site") || v.includes("web")) return "sites_web_augmentes";
  return undefined;
}

export interface InjectExternalLinksOpts {
  readonly count?: number;
  readonly minAuthority?: ExternalLinkAuthority;
  /** IDs déjà utilisés dans la session (cross-article diversification). */
  readonly excludeIds?: ReadonlyArray<string>;
  /** Topic override (sinon dérivé du templateVariant). */
  readonly topic?: string;
}

export interface InjectedExternalLinks {
  readonly links: ReadonlyArray<ExternalLink>;
  readonly markdownSection: string;
  readonly ids: ReadonlyArray<string>;
}

/**
 * Sélectionne ≥ N liens externes pertinents pour un article + retourne la
 * section markdown à injecter dans le userPrompt.
 *
 * Si zéro lien sélectionné (cas exceptionnel : catalogue vide ou filtre trop
 * strict), retourne markdown vide → le generator continue sans section.
 */
export function injectExternalLinks(
  input: GeneratorBaseInput,
  opts: InjectExternalLinksOpts = {},
): InjectedExternalLinks {
  const vertical = mapTemplateVariantToVertical(input.templateVariant);
  const links = selectExternalLinks({
    count: opts.count ?? 4,
    minAuthority: opts.minAuthority ?? 4,
    ...(vertical ? { vertical } : {}),
    ...(input.anchorVilleSlug ? { cityId: input.anchorVilleSlug } : {}),
    ...(input.anchorRegionSlug ? { regionSlug: input.anchorRegionSlug } : {}),
    ...(opts.topic ? { topic: opts.topic } : {}),
    ...(opts.excludeIds ? { excludeIds: opts.excludeIds } : {}),
    language: "fr",
    rotationMode: "round_robin",
  });

  return {
    links,
    markdownSection: buildExternalLinksPromptSection(links),
    ids: links.map((l) => l.id),
  };
}
