/**
 * Lot OPCO A8 — le téléphone du contact dans le message d'une alerte « à
 * appeler » devient un lien `tel:` dans la CONSOLE (module PUR).
 *
 * Limité aux codes qui donnent un numéro à composer : on ne transforme pas en
 * lien un nombre quelconque d'une autre alerte (un SIRET contient dix chiffres
 * qui commencent parfois par 0). Jamais utilisé dans un e-mail.
 */

export const CODES_A_APPELER: ReadonlySet<string> = new Set([
  "entreprise_a_appeler_depot",
  "entreprise_a_appeler_reponse_opco",
  "opco_refus_a_traiter",
]);

/** Numéro français : 0X XX XX XX XX ou +33 X XX XX XX XX (espaces, points, tirets). */
const TELEPHONE = /(?<![\d+])(?:\+33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}(?!\d)/g;

export type Segment = { texte: string; tel: string | null };

export function segmentsAvecTelephone(code: string, message: string): Segment[] {
  if (!CODES_A_APPELER.has(code)) return [{ texte: message, tel: null }];
  const out: Segment[] = [];
  let i = 0;
  for (const m of message.matchAll(TELEPHONE)) {
    const debut = m.index ?? 0;
    if (debut > i) out.push({ texte: message.slice(i, debut), tel: null });
    out.push({ texte: m[0], tel: m[0].replace(/[\s.-]/g, "") });
    i = debut + m[0].length;
  }
  if (i < message.length) out.push({ texte: message.slice(i), tel: null });
  return out;
}
