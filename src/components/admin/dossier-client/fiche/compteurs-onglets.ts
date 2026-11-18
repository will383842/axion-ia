/**
 * Emplacement du lot B1 : seul ce lot modifie ce fichier.
 * Compteurs des onglets. Une lecture en panne = pas de compteur (jamais 0).
 */

import { lireEnTete, type Lecture } from "@/features/dossier-client/fiche/lire-en-tete";

import { lireClient360Cache, type ContexteFiche } from "./contexte";

export interface CompteurOnglet {
  readonly count?: number;
}

const compteur = (l: Lecture<number>): CompteurOnglet => (l.ok ? { count: l.valeur } : {});

export async function compteursOnglets(
  ctx: ContexteFiche,
): Promise<Readonly<Record<string, CompteurOnglet>>> {
  const e = await lireEnTete(ctx, lireClient360Cache);
  if (e === null) return {};
  return {
    activite: compteur(e.nbTachesOuvertes),
    "rendez-vous": compteur(e.nbRendezVous),
    prestations: compteur(e.nbPrestations),
    personnes: compteur(e.nbPersonnes),
    "devis-factures": compteur(e.nbDevisEtFactures),
  };
}
