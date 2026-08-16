/**
 * Content Generator — Augmentation de prompt PH3b (plan §4/§7).
 *
 * Injecte (de façon ADDITIVE, derrière le flag `QUALITY_PROFILES_ENABLED`) :
 *   - le contexte DOULEUR sectoriel (pain-matrix) → profil COMMERCIAL uniquement,
 *     quand le job porte `targetSecteur` + `vertical` (injectés par une campagne pilote) ;
 *   - le bloc d'ANCRAGE LOCAL (données économiques réelles de la ville) → dès qu'un
 *     `anchorVilleSlug` est présent (mode dégradé sans invention si pas de data).
 *
 * Rend `""` si le flag est OFF ⇒ les générateurs concaténent une chaîne vide ⇒
 * prompt (et hash) bit-à-bit identiques à l'actuel. À appendre APRÈS la persona/
 * brand-voice (jamais en remplacement — cf. plan, anti-perte directAnswer/Manon).
 */

import type { ContentType, SearchIntent } from "../../../prisma/generated/client";
import { resolveQualityProfile } from "./profiles/quality-profile-table";
import {
  getSectorPainContext,
  serializePainContextForPrompt,
  type Secteur,
  type Verticale,
} from "./kb/sector-pain-matrix";
import { buildLocalAnchorBlock, villeEconomicToAnchorFacts } from "./local/local-anchor";
import { getVilleCore, getRegionByDepartement } from "@/content/villes/core";
import { getVilleEconomicData } from "@/content/villes/economic-data";

export interface Ph3AugmentationInput {
  readonly contentType: ContentType;
  readonly targetSearchIntent: SearchIntent;
  readonly anchorVilleSlug?: string;
  /** Secteur INDUSTRIE (pain-matrix), injecté par une campagne pilote. */
  readonly targetSecteur?: string;
  /** Verticale = ServiceSector (pain-matrix), injectée par une campagne pilote. */
  readonly vertical?: string;
}

/**
 * Construit le bloc d'augmentation à appendre au system prompt. Pur, déterministe,
 * 0 I/O réseau (lit des SSOT en mémoire). `""` si flag OFF ou rien à injecter.
 */
export function buildPh3PromptAugmentation(input: Ph3AugmentationInput): string {
  if (process.env.QUALITY_PROFILES_ENABLED !== "true") return "";

  const profile = resolveQualityProfile(input.contentType, input.targetSearchIntent);
  const parts: string[] = [];

  // 1. Contexte douleur sectoriel — COMMERCIAL uniquement (price-gate-safe).
  if (profile === "commercial" && input.targetSecteur && input.vertical) {
    const ctx = getSectorPainContext(input.targetSecteur as Secteur, input.vertical as Verticale);
    if (ctx) parts.push(serializePainContextForPrompt(ctx));
  }

  // 2. Ancrage local — dès qu'une ville est ancrée (tous profils). Mode dégradé
  //    (kbFacts null) géré par buildLocalAnchorBlock : aucune invention.
  if (input.anchorVilleSlug) {
    const v = getVilleCore(input.anchorVilleSlug);
    if (v) {
      const region = getRegionByDepartement(v.departement)?.nameFr ?? v.region;
      const departement = v.departementLabel ?? v.departement;
      const kbFacts = villeEconomicToAnchorFacts(getVilleEconomicData(input.anchorVilleSlug), {
        ville: v.nameFr,
        departement,
        region,
      });
      parts.push(buildLocalAnchorBlock({ ville: v.nameFr, departement, region, kbFacts }));
    }
  }

  return parts.length > 0 ? `\n\n${parts.join("\n\n")}` : "";
}
