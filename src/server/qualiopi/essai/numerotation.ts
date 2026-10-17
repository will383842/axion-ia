/**
 * CHANTIER QNC, LOT L02 — LA NUMÉROTATION D'ESSAI, HORS SUITE LÉGALE.
 *
 * Une pièce d'essai (session, facture, attestation, convention…) ne prend
 * JAMAIS un numéro de la série légale : la série des factures doit rester
 * chronologique et continue (art. 242 nonies A ann. II CGI), et un numéro
 * émis puis « annulé » parce que c'était un essai y laisserait un trou.
 *
 * Forme : `AXI-<TYPE>-ESSAI-<AAAA>-<6 hex>` — par ex. `AXI-FACT-ESSAI-2026-3F9A0C`.
 *   - le segment `-ESSAI-` se lit à l'œil sur la pièce et dans toute liste ;
 *   - il est placé AVANT le millésime : aucune série légale (`AXI-FACT-2026-`)
 *     n'a ce préfixe, donc `nextNumero` ne le lit jamais (ni dans la table
 *     métier, ni dans `numeros_emis`, que le déclencheur alimente quand même) ;
 *   - `isValidDocumentNumber` le refuse : ce n'est pas une pièce officielle ;
 *   - le suffixe est aléatoire, pas séquentiel : il n'existe pas de « suite
 *     d'essai » à tenir. L'index unique de chaque table reste le garde-fou ;
 *     une collision (1 sur 16 millions) lève P2002 et l'appelant réessaie.
 *
 * Le millésime est celui de Paris (une pièce émise le 31/12 à 23 h 30 à Paris
 * appartient à l'année qui finit).
 */

import { randomBytes } from "node:crypto";
import { NUMBERING_PREFIX, type NumberingType } from "@/server/qualiopi/numbering/formats";

export const SEGMENT_ESSAI = "-ESSAI-" as const;

/** Année civile à Paris. */
export function anneeParis(maintenant: Date = new Date()): number {
  const annee = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
  }).format(maintenant);
  return Number(annee);
}

/** Numéro d'essai d'une pièce du type donné. Le tirage aléatoire est injectable pour les tests. */
export function numeroEssai(
  type: NumberingType,
  maintenant: Date = new Date(),
  tirage: () => string = () => randomBytes(3).toString("hex").toUpperCase(),
): string {
  return `${NUMBERING_PREFIX[type]}${SEGMENT_ESSAI}${anneeParis(maintenant)}-${tirage()}`;
}

/** Ce numéro est-il un numéro d'essai ? */
export function estNumeroEssai(numero: string | null | undefined): boolean {
  return typeof numero === "string" && /^AXI-[A-Z]+-ESSAI-\d{4}-[0-9A-F]{6}$/.test(numero);
}
