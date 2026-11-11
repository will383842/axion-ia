/**
 * Content Generator — injection du noyau « Méthode » (ADR 0076 § 2.8).
 *
 * Le noyau de la méthode de vente n'est ajouté au prompt système QUE :
 *   1. si `METHODE_ACTIVE === "true"` ;
 *   2. ET pour un contenu COMMERCIAL adressé à un client : `mail`, `offre`, `script`.
 *
 * ⛔ Les générateurs actuels de content-gen (blog, landing ville, comparatifs, FAQ…)
 * produisent des PAGES PUBLIQUES : ils n'appellent PAS cette fonction, et ne doivent
 * jamais l'appeler — la méthode est interne (audience `team`) et ses montants sont
 * des exemples d'entraînement. Un futur générateur de mail, d'offre ou de script
 * l'appelle en passant sa nature.
 *
 * Éteint ou nature non commerciale : le prompt est rendu tel quel (même chaîne), et
 * la base n'est pas lue.
 */

import {
  formaterContextePourPrompt,
  obtenirContexteMethode,
  estMethodeActive,
  type DependancesContexte,
} from "@/server/methode";

export const NATURES_COMMERCIALES = ["mail", "offre", "script"] as const;
export type NatureCommerciale = (typeof NATURES_COMMERCIALES)[number];

export function estNatureCommerciale(nature: string): nature is NatureCommerciale {
  return (NATURES_COMMERCIALES as readonly string[]).includes(nature);
}

/**
 * Rend `promptSysteme` augmenté du noyau (et des extraits liés à `sujet`, s'il est
 * donné). Neutre si l'interrupteur est éteint ou si la nature n'est pas commerciale.
 */
export async function injecterMethodeDansPromptSysteme(
  promptSysteme: string,
  nature: string,
  options: { sujet?: string; secteur?: string | null } = {},
  deps: DependancesContexte = {},
): Promise<string> {
  if (!estNatureCommerciale(nature)) return promptSysteme;
  if (!estMethodeActive(deps.env ?? process.env)) return promptSysteme;
  const contexte = await obtenirContexteMethode(
    {
      sujet: options.sujet ?? "",
      ...(options.secteur !== undefined ? { secteur: options.secteur } : {}),
      max: options.sujet ? 3 : 0,
    },
    deps,
  );
  const bloc = formaterContextePourPrompt(contexte);
  return bloc ? `${promptSysteme}\n\n${bloc}` : promptSysteme;
}
