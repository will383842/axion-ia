// Banc @formateurs, équipe sécurité — lire le CORPS d'un message du puits SMTP.
//
// `puits-smtp.ts` dit qu'un message est arrivé ; ici on lit ce qu'il dit, pour
// constater qu'il ne porte pas une donnée qu'il ne doit pas porter.

import { messagesCaptes, URL_PUITS } from "./puits-smtp";

/** Texte et HTML de chaque message capté pour l'adresse. */
export async function corpsCaptes(adresse: string): Promise<string[]> {
  const corps: string[] = [];
  for (const m of await messagesCaptes(adresse)) {
    const r = await fetch(`${URL_PUITS}/api/v1/message/${m.id}`);
    if (!r.ok) throw new Error(`puits SMTP : HTTP ${r.status}`);
    const j = (await r.json()) as { Subject?: string; Text?: string; HTML?: string };
    corps.push(`${j.Subject ?? ""}\n${j.Text ?? ""}\n${j.HTML ?? ""}`);
  }
  return corps;
}
