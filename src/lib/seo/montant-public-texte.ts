/**
 * R7 (ordre de Williams du 08/11/2026) — montants des canaux TEXTE servis aux robots
 * (`llms.txt`, `llms-full.txt`).
 *
 * « Il ne faut plus de prix affichés pour les formations, les audits ou autres. La seule
 * chose à mettre en avant est la journée audit à 1 490 €. »
 *
 * Ces fichiers écrivent leurs montants au milieu d'une phrase (« à partir de X », « dès X »).
 * `montantPublic` rend le montant formaté si l'interrupteur `PRIX_PUBLICS_AFFICHES` est
 * allumé, sinon un MARQUEUR ; `recollerMontantsMasques` réécrit ensuite la préposition qui
 * le portait (« à partir de [marqueur] » → « sur devis »). Les montants restent dans
 * `pricing.ts` : rallumer l'interrupteur rend le texte d'avant, à l'octet près.
 *
 * Garde : `src/app/canaux-machine-sans-prix.spec.ts`.
 */

import { PRIX_PUBLICS_AFFICHES, formatAmount } from "@/content/pricing";

/** Caractères de contrôle : ne peut pas apparaître dans une copy. */
const MARQUEUR = "\u0000MONTANT-MASQUE\u0000";

/** Le montant formaté, ou le marqueur à recoller si l'interrupteur est coupé. */
export function montantPublic(
  montant: number,
  locale: "fr" | "en",
  opts?: Parameters<typeof formatAmount>[2],
): string {
  return PRIX_PUBLICS_AFFICHES ? formatAmount(montant, locale, opts) : MARQUEUR;
}

/**
 * Marque le libellé « Sur devis » d'un formateur d'affichage (`getEntryLabel`), pour qu'il
 * soit recollé comme un montant masqué (en minuscule au milieu d'une phrase). Tout autre
 * libellé — un montant affichable, interrupteur allumé — passe tel quel.
 */
export function marquerSurDevis(libelle: string): string {
  return /^(?:Sur devis|On request|On quote)$/.test(libelle) ? MARQUEUR : libelle;
}

/**
 * Réécrit la prose autour de chaque montant masqué, puis remplace le marqueur restant. Seuls
 * les montants MARQUÉS (`montantPublic`, `marquerSurDevis`) sont touchés : un « Sur devis »
 * déjà écrit dans la copy reste tel quel.
 */
export function recollerMontantsMasques(texte: string): string {
  return texte
    .replace(new RegExp(`(?:à partir de|À partir de|dès|Dès)\\s+${MARQUEUR}`, "g"), "sur devis")
    .replace(new RegExp(`(?:from|From|starting at)\\s+${MARQUEUR}`, "g"), "on request")
    .replaceAll(MARQUEUR, "sur devis");
}
