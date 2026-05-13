// Helpers Quote — Sprint X.7 / Booking V1.
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.7
//   - 03-ARCHITECTURE-CIBLE §5.1.7 (model Quote)
//   - I4 (state-machine) — requiresQuote(interventionType, basePriceHtCents)

import type { InterventionType, PrismaClient } from "../../prisma/generated/client";

/**
 * Détermine si un booking nécessite un devis formel avant contrat.
 *
 * Règles V1 (volontairement simples, à durcir par Will via ADR future) :
 *   - Toutes interventions Sur devis (conference, dirigeant-vision-strategique,
 *     claude-dirigeant, conference-keynote, coaching-*, claude-implementation-individuel)
 *     → requiresQuote=true.
 *   - basePriceHtCents > 5 000 € HT (500 000 cents) → requiresQuote=true.
 *   - Sinon → false (passe direct en contract_pending).
 *
 * Note : la liste « Sur devis » est codée en dur ici car les tiers pricing.ts
 * `onQuote=true` ne sont pas directement visibles depuis Prisma (différent
 * mapping). Aligner si l'évolution du catalogue change ça.
 */
export function requiresQuote(
  interventionType: InterventionType,
  basePriceHtCents: number | null | undefined,
): boolean {
  // Liste explicite des slugs Sur devis (cf. interventions-taxonomy.ts).
  // Ces slugs sont en snake_case (enum DB) — voir slugToEnum().
  const QUOTE_ONLY_TYPES: ReadonlySet<InterventionType> = new Set<InterventionType>([
    "conference",
    // Note: pas tous les variants Dirigeant/Claude. `dirigeant-vision-strategique`,
    // `claude-dirigeant`, etc. utilisent l'enum `dirigeants` côté DB (pas
    // d'enum distinct pour ces variants en V1 — seule la taxonomy UI les distingue).
    // Pour le moment, on traite tous les `dirigeants` comme prix fixe.
  ]);
  if (QUOTE_ONLY_TYPES.has(interventionType)) return true;
  if (typeof basePriceHtCents === "number" && basePriceHtCents > 500_000) return true;
  return false;
}

/**
 * Génère un numéro de devis séquentiel `DEVIS-YYYY-NNNN`.
 *
 * Implémentation V1 (skeleton) : count existing pour l'année courante + 1.
 * Race conditions possibles si 2 admins génèrent en parallèle — à durcir
 * Sprint X.10 via `pg_advisory_lock(hashtext('quote_counter_' || year))`.
 *
 * Format aligné avec `Invoice.number` (Sprint X.10) qui suivra `AXION-2026-NNNN`
 * — ici on garde `DEVIS-YYYY-NNNN` pour distinguer (Will visuel).
 */
export async function generateQuoteNumber(
  prismaClient: Pick<PrismaClient, "quote">,
  year: number = new Date().getUTCFullYear(),
): Promise<string> {
  const prefix = `DEVIS-${year}-`;
  // count via where startsWith — index sur `number` côté Postgres rend ça rapide.
  const count = await prismaClient.quote.count({
    where: { number: { startsWith: prefix } },
  });
  const padded = String(count + 1).padStart(4, "0");
  return `${prefix}${padded}`;
}

/**
 * Pricing breakdown standard d'un Quote (V1 minimal).
 *
 * Pour V1, on calcule un TTC simple à partir du HT + taux TVA (snapshot
 * `Booking.vatRate` ou par défaut 20 % FR / 0 % EE selon ADR 0015).
 *
 * Architecture TVA-agnostique : le caller fournit `vatRate` et
 * `vatReverseCharge` (auto-liquidation). Pas de calcul fiscal magique ici.
 */
export interface QuotePricingInput {
  amountHtCents: number;
  vatRate: number; // ex: 20.0 (FR) ou 0.0 (EE reverse-charge)
  vatReverseCharge: boolean;
}

export interface QuotePricingResult {
  amountHtCents: number;
  vatAmountCents: number;
  amountTtcCents: number;
  vatRate: number;
  vatReverseCharge: boolean;
  vatMention: string;
}

export function computeQuotePricing(input: QuotePricingInput): QuotePricingResult {
  const vatAmountCents = input.vatReverseCharge
    ? 0
    : Math.round((input.amountHtCents * input.vatRate) / 100);
  const amountTtcCents = input.amountHtCents + vatAmountCents;
  const vatMention = input.vatReverseCharge
    ? "TVA non applicable — art. 196 directive 2006/112/CE (autoliquidation)"
    : `TVA ${input.vatRate.toFixed(2)} %`;
  return {
    amountHtCents: input.amountHtCents,
    vatAmountCents,
    amountTtcCents,
    vatRate: input.vatRate,
    vatReverseCharge: input.vatReverseCharge,
    vatMention,
  };
}
