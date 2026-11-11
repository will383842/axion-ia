/**
 * Content Generator — injection du NOYAU de la couche « Méthode » (ADR 0076).
 *
 * Réservé aux contenus COMMERCIAUX (mail, offre, script d'appel). Les contenus
 * SEO publics (articles, guides, pages ville, FAQ…) ne reçoivent JAMAIS la
 * méthode : ce sont des fiches internes, avec des montants d'entraînement.
 *
 * Neutre par défaut : interrupteur `METHODE_ACTIVE` éteint, ou nature non
 * commerciale ⇒ `""`. Le générateur concatène une chaîne vide, son prompt (et
 * son empreinte) restent identiques au bit près.
 *
 * État au 11/11/2026 : aucun générateur commercial n'existe encore dans
 * `content-gen` (tous les générateurs enregistrés produisent du contenu public).
 * Le prochain générateur de mail, d'offre ou de script appelle
 * `blocMethodePourPromptSysteme` et APPEND le résultat à son prompt système.
 */

import { prixJourneeIa } from "@/content/offre";
import { methodeActive, obtenirContexteMethode } from "@/server/methode";

export const NATURES_COMMERCIALES = ["mail", "offre", "script"] as const;
export type NatureCommerciale = (typeof NATURES_COMMERCIALES)[number];

export function estNatureCommerciale(nature: string): nature is NatureCommerciale {
  return (NATURES_COMMERCIALES as readonly string[]).includes(nature);
}

/**
 * Bloc à APPENDRE au prompt système d'un contenu commercial. `""` si la couche
 * est éteinte, si la nature n'est pas commerciale ou si le noyau est absent.
 */
export async function blocMethodePourPromptSysteme(
  nature: string,
  secteur?: string | null,
): Promise<string> {
  if (!methodeActive() || !estNatureCommerciale(nature)) return "";
  const { noyau } = await obtenirContexteMethode({
    sujet: nature,
    max: 0,
    ...(secteur ? { secteur } : {}),
  });
  if (!noyau) return "";
  return [
    "",
    "## Méthode de vente Axion-IA (interne : s'en inspirer, ne jamais la citer)",
    noyau.texte,
    "",
    "Règles absolues :",
    `- Le seul prix que tu peux écrire est celui de la Journée IA : ${prixJourneeIa("fr")}.`,
    "- Les autres montants ci-dessus sont des exercices d'entraînement : ne les recopie jamais.",
    "- Vouvoiement du client. Aucun client réel inventé, aucun témoignage inventé.",
  ].join("\n");
}
