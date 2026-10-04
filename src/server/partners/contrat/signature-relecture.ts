/**
 * PROVISOIRE (wip INT-T72-A) : remplacé, avant toute PR, par la copie à l'octet de
 * `packages/contracts/signature-relecture.ts` d'axion-apporteurs (INT-T74-P), sous l'empreinte de
 * `contracts.sha256`. API confirmée par A02.
 *
 * La chaîne canonique que signe la réponse de relecture (contrat v3, `api_relecture_reponse_entetes`) :
 * `<horodatage>.<after_sequence>.<limit>.<x-axionia-derniere-sequence>.<x-axionia-suite>.<corps exact>`.
 * Fonction PURE, sans import : chaque côté calcule son HMAC avec son propre module. L'horodatage
 * passe tel que reçu ; les trois nombres sont des entiers non négatifs en base 10 sans zéro de tête,
 * en CHAÎNES (les séquences dépassent `Number.MAX_SAFE_INTEGER`) ; tout autre est refusé, jamais
 * normalisé. Le corps passe à l'octet.
 */
const NOMBRE = /^(0|[1-9][0-9]*)$/;

export function chaineCanoniqueDeRelecture(e: {
  horodatage: string;
  afterSequence: string;
  limit: string;
  derniereSequence: string;
  suite: string;
  corps: string;
}): string {
  for (const [champ, valeur] of [
    ["afterSequence", e.afterSequence],
    ["limit", e.limit],
    ["derniereSequence", e.derniereSequence],
  ] as const) {
    if (!NOMBRE.test(valeur)) throw new Error(`signature-relecture : ${champ} hors forme`);
  }
  if (e.suite !== "0" && e.suite !== "1") throw new Error("signature-relecture : suite hors forme");
  return [e.horodatage, e.afterSequence, e.limit, e.derniereSequence, e.suite, e.corps].join(".");
}
