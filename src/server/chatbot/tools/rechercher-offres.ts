// Outil chatbot `rechercher_offres` (T-35, 6e tool, ADR-CB-11, doc 16 G-1).
//
// Function-calling DÉTERMINISTE sur le catalogue typé (offers-catalog.ts), PAS du
// RAG : une requête « formations entre X et Y € », « 1 jour pour 8 pers sur Claude »,
// « le moins cher pour une TPE » est STRUCTURÉE → réponse exacte, zéro hallucination
// de prix/offre. Multi-facettes : prix, durée, effectif, sujet/outil, format,
// audience, tri. tenant_id injecté serveur (catalogue partagé au MVP single-tenant).
//
// Les PRIX d'affichage viennent des formatteurs pricing.ts (SSOT) — jamais générés.
// Chaque résultat porte une urlFR résoluble (T-34). Si 0 résultat → repli (T-36).

import { z } from "zod";
import { OFFERS, type Offer, type OfferFormat, type OfferVertical } from "@/content/offers-catalog";
import { formatAmount, formatAmountRange } from "@/content/pricing";

/** Verticales publiques exposées au filtre (maintenance reste hors filtre direct). */
export const SEARCHABLE_VERTICALS = [
  "formation",
  "audit",
  "implementation",
  "sites-web",
  "un-a-un",
] as const;

/** Schéma Zod de l'input du tool — validé côté serveur (refus payload invalide). */
export const RechercherOffresInputSchema = z
  .object({
    vertical: z.enum(SEARCHABLE_VERTICALS).optional(),
    prixMin: z.number().nonnegative().optional(),
    prixMax: z.number().positive().optional(),
    /** Durée max en jours (« 4 h » → 0.5 ; « 1 jour » → 1 ; converti par le slot-filling T-37). */
    dureeMaxJours: z.number().positive().optional(),
    /** Nombre de personnes à former. */
    effectif: z.number().int().positive().optional(),
    /** Sujet/outil (« claude », …). */
    sujet: z.string().min(1).max(60).optional(),
    format: z.enum(["presentiel", "distanciel", "mixte"]).optional(),
    audience: z.enum(["tpe", "pme", "eti", "grande-entreprise"]).optional(),
    /** « le moins cher » → prix_asc. */
    tri: z.enum(["prix_asc", "prix_desc"]).optional(),
  })
  .strict();

export type RechercherOffresInput = z.infer<typeof RechercherOffresInputSchema>;

/** Vue d'offre renvoyée au LLM/widget (libellé + prix SSOT + lien). */
export interface OfferResult {
  readonly id: string;
  readonly titre: string;
  readonly vertical: OfferVertical;
  /** Prix formaté SSOT (« 2 450 € HT », « 2 000 € → 30 000 € HT », « Sur devis »). */
  readonly prix: string;
  /** Prix le plus bas (nombre) pour tri/affichage côté client ; undefined si sur devis. */
  readonly prixMinNum?: number;
  readonly dureeFr?: string;
  readonly effectifFr?: string;
  readonly format: ReadonlyArray<OfferFormat>;
  readonly urlFR: string;
  readonly onQuote: boolean;
}

export interface RechercherOffresResult {
  readonly offres: ReadonlyArray<OfferResult>;
  /** true si les offres proviennent du repli (aucun match exact). */
  readonly replied: boolean;
  /** Stratégie de repli appliquée (T-36), si replied. */
  readonly repliStrategy?: string;
  /** true → la réponse devrait aussi proposer un RDV découverte (repli faible). */
  readonly proposeRdv?: boolean;
}

// ── Moteur de recherche pur (déterministe) ────────────────────────────────

/** Filtre le catalogue selon les facettes (sans tri ni repli). */
export function filterOffers(
  criteria: RechercherOffresInput,
  catalog: ReadonlyArray<Offer> = OFFERS,
): Offer[] {
  const priceFilterActive = criteria.prixMin !== undefined || criteria.prixMax !== undefined;
  const qMin = criteria.prixMin ?? 0;
  const qMax = criteria.prixMax ?? Number.POSITIVE_INFINITY;

  return catalog.filter((o) => {
    if (criteria.vertical && o.vertical !== criteria.vertical) return false;

    if (priceFilterActive) {
      // onQuote / offres sans prix exclues des filtres prix.
      if (o.onQuote || o.prixMin === undefined || o.prixMax === undefined) return false;
      // Chevauchement de la fourchette offre [prixMin,prixMax] avec [qMin,qMax].
      if (o.prixMax < qMin || o.prixMin > qMax) return false;
    }

    if (criteria.dureeMaxJours !== undefined) {
      if (o.dureeJours === undefined || o.dureeJours > criteria.dureeMaxJours) return false;
    }

    if (criteria.effectif !== undefined) {
      if (o.effectifMin === undefined || o.effectifMax === undefined) return false;
      if (criteria.effectif < o.effectifMin || criteria.effectif > o.effectifMax) return false;
    }

    if (criteria.sujet) {
      if ((o.sujet ?? "").toLowerCase() !== criteria.sujet.toLowerCase()) return false;
    }

    if (criteria.format && !o.format.includes(criteria.format)) return false;

    if (criteria.audience && !o.audienceSizes?.includes(criteria.audience)) return false;

    return true;
  });
}

/** Trie selon `tri` (« le moins cher » = prix_asc). Sur-devis toujours en fin. */
export function sortOffers(offers: ReadonlyArray<Offer>, tri?: "prix_asc" | "prix_desc"): Offer[] {
  if (!tri) return [...offers];
  const priced = offers.filter((o) => !o.onQuote);
  const quoted = offers.filter((o) => o.onQuote);
  priced.sort((a, b) => {
    const av = tri === "prix_asc" ? (a.prixMin ?? 0) : (a.prixMax ?? 0);
    const bv = tri === "prix_asc" ? (b.prixMin ?? 0) : (b.prixMax ?? 0);
    return tri === "prix_asc" ? av - bv : bv - av;
  });
  return [...priced, ...quoted];
}

/** Recherche complète : filtre + tri (sans repli). */
export function searchOffers(
  criteria: RechercherOffresInput,
  catalog: ReadonlyArray<Offer> = OFFERS,
): Offer[] {
  return sortOffers(filterOffers(criteria, catalog), criteria.tri);
}

/** Mappe un Offer vers la vue résultat (prix formaté SSOT). */
export function toOfferResult(o: Offer): OfferResult {
  let prix: string;
  if (o.onQuote || (o.prixMin === undefined && o.prixFlat === undefined)) {
    prix = "Sur devis";
  } else if (o.prixFlat !== undefined && (o.prixMax === undefined || o.prixMax === o.prixFlat)) {
    prix = formatAmount(o.prixFlat, "fr");
  } else if (o.prixMin !== undefined && o.prixMax !== undefined && o.prixMin !== o.prixMax) {
    prix = formatAmountRange(o.prixMin, o.prixMax, "fr");
  } else {
    prix = formatAmount(o.prixMin ?? o.prixFlat!, "fr");
  }

  const effectifFr =
    o.effectifMin !== undefined && o.effectifMax !== undefined
      ? o.effectifMin === o.effectifMax
        ? `${o.effectifMin} personne${o.effectifMin > 1 ? "s" : ""}`
        : `${o.effectifMin} à ${o.effectifMax} personnes`
      : undefined;

  const prixMinNum = o.onQuote ? undefined : (o.prixMin ?? o.prixFlat);
  // exactOptionalPropertyTypes : omettre les clés optionnelles undefined.
  return {
    id: o.id,
    titre: o.titre,
    vertical: o.vertical,
    prix,
    format: o.format,
    urlFR: o.urlFR,
    onQuote: o.onQuote,
    ...(prixMinNum !== undefined && { prixMinNum }),
    ...(o.dureeFr !== undefined && { dureeFr: o.dureeFr }),
    ...(effectifFr !== undefined && { effectifFr }),
  };
}

/** Contexte serveur du tool (tenant injecté serveur ; catalogue partagé au MVP). */
export interface ToolContext {
  readonly tenantId: string;
}

/**
 * Handler du tool `rechercher_offres`. Valide l'input (Zod), cherche dans le
 * catalogue ; si 0 résultat exact, délègue au repli (T-36) — jamais de « non » sec.
 */
export async function rechercherOffres(
  rawInput: unknown,
  _ctx: ToolContext,
): Promise<RechercherOffresResult> {
  const input = RechercherOffresInputSchema.parse(rawInput);
  const matches = searchOffers(input);
  if (matches.length > 0) {
    return { offres: matches.map(toOfferResult), replied: false };
  }
  // 0 match exact → repli (cross-sell / alternative la plus proche).
  const { repli } = await import("@/server/chatbot/catalog/repli");
  const fallback = repli(input);
  return {
    offres: fallback.offres.map(toOfferResult),
    replied: true,
    repliStrategy: fallback.strategy,
    proposeRdv: fallback.proposeRdv,
  };
}
