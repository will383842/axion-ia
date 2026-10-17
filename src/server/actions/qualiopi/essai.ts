"use server";

/**
 * QNC L02 — réglage de la liste blanche des adresses d'essai.
 *
 * Super-administrateur seulement : la liste décide où partent les e-mails
 * d'une session d'essai. Réglage ET journal dans la même transaction
 * (`definirAdressesDEssai`) ; le journal ne garde que le nombre d'adresses.
 */

import { requireSuperAdmin } from "@/server/actions/qualiopi/_guards";
import {
  analyserSaisieAdresses,
  definirAdressesDEssai,
  ListeBlancheInvalide,
} from "@/server/qualiopi/essai/liste-blanche";

type ActionResult<T> = { data: T } | { error: string };

export async function definirAdressesDEssaiAction(input: {
  saisie: string;
}): Promise<ActionResult<{ adresses: string[] }>> {
  const session = await requireSuperAdmin();
  if (typeof input?.saisie !== "string" || input.saisie.length > 5000) {
    return { error: "Données invalides" };
  }
  let adresses: ReadonlyArray<string>;
  try {
    adresses = analyserSaisieAdresses(input.saisie);
  } catch (err) {
    if (err instanceof ListeBlancheInvalide) return { error: err.message };
    throw err;
  }
  try {
    const ecrites = await definirAdressesDEssai({ adresses, adminUserId: session.userId });
    return { data: { adresses: [...ecrites] } };
  } catch {
    return { error: "La liste n'a pas pu être enregistrée : rien n'a changé." };
  }
}
