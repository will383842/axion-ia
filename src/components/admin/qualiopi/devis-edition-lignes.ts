/**
 * Lignes stockées (JSON) d'un devis CLASSIQUE → lignes du formulaire `DevisForm` (mode édition).
 *
 * Schéma STRICT : une ligne porteuse d'un champ que le formulaire ne sait pas représenter (par
 * exemple un taux de TVA propre à la ligne) rend l'ensemble illisible. Mieux vaut ne pas ouvrir
 * le formulaire que d'enregistrer en silence un devis amputé : jamais d'écrasement.
 */

import { z } from "zod";

/** Ligne telle que le formulaire la manipule (tout en chaînes, sauf le drapeau). */
export interface LigneFormulaire {
  designation: string;
  quantite: string;
  prixUnitaireHtCents: string;
  offreTierId: string;
  offreCode: string;
  designationDepuisOffre: boolean;
}

const ligneStockeeSchema = z
  .object({
    designation: z.string().min(1).max(500),
    quantite: z.number().positive(),
    prixUnitaireHtCents: z.number().int().min(0),
    offreTierId: z.string().max(80).optional(),
    offreCode: z.string().max(40).optional(),
  })
  .strict();

const lignesStockeesSchema = z.array(ligneStockeeSchema).min(1);

/** `null` si les lignes stockées sont illisibles (le formulaire ne doit alors pas s'ouvrir). */
export function lignesVersFormulaire(brut: unknown): LigneFormulaire[] | null {
  const r = lignesStockeesSchema.safeParse(brut);
  if (!r.success) return null;
  return r.data.map((l) => ({
    designation: l.designation,
    quantite: String(l.quantite),
    prixUnitaireHtCents: String(l.prixUnitaireHtCents),
    offreTierId: l.offreTierId ?? "",
    offreCode: l.offreCode ?? "",
    designationDepuisOffre: false,
  }));
}
