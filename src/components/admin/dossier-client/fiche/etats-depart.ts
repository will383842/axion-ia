/**
 * Lecture du départ des personnes d'une fiche, UNE fois par affichage (React `cache`) : la carte
 * « Qui décide » et chaque « Noter le départ » la partagent, au lieu d'une requête par personne.
 */

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import {
  lireEtatsDeDepart,
  type EtatDeDepart,
} from "@/features/dossier-client/fiche/depart-personne";

export type LectureDeparts =
  { readonly ok: true; readonly etats: ReadonlyMap<string, EtatDeDepart> } | { readonly ok: false };

/** Ne rejette jamais : une panne est une valeur, lue pareil par tous les appelants. */
export const lireDepartsCache = cache(async (clientId: string): Promise<LectureDeparts> => {
  try {
    return { ok: true, etats: await lireEtatsDeDepart(prisma, clientId) };
  } catch {
    return { ok: false };
  }
});

/** Un seul « Lecture impossible » par affichage : le premier qui le demande le dit, les autres se taisent. */
export const panneDejaDite = cache(() => ({ dite: false }));
