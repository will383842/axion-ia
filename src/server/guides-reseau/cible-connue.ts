/**
 * UN GUIDE EST-IL CONNU ? (lot LIA-F, 2026-11-12)
 *
 * ÉTEINT (`GUIDES_RESEAU_CATALOGUE_ENABLED` OU `GUIDES_RESEAU_LIVRAISON_ENABLED` éteint ; éteints par défaut) : la liste figée
 * `GUIDES_RESEAU_CONNUS`, exactement comme avant, SANS lecture en base.
 * ALLUMÉ (les DEUX) : la liste figée OU une ligne `cibles_reseau` active, de type `guide`, qui n'est pas une
 * cible d'essai (sauf adresse d'essai connue, voir `cibleGuideConnue`). Une cible `adresse`, inactive ou d'essai est refusée. Base illisible : la liste
 * figée seule (fermé, jamais plus large). Aucune adresse n'est journalisée.
 */
import { GUIDES_RESEAU_CONNUS } from "@/content/guides-reseau";
import { prisma } from "@/lib/prisma";
import { catalogueGuidesActif, livraisonCatalogueActive } from "./config";
import { RE_CODE_GUIDE_CATALOGUE } from "./format-code-guide";
import { adresseDEssai } from "./guide-a-livrer";

/** Le catalogue n'est accepté que si LES DEUX interrupteurs valent exactement `"true"`. */
export function catalogueAccepteActif(): boolean {
  return catalogueGuidesActif() && livraisonCatalogueActive();
}

/**
 * `email` (facultatif) : l'adresse de la personne, SI le contexte la connaît (réception d'un message privé).
 * Une cible d'ESSAI (`test = true`) n'est connue que si cette adresse est fournie ET figure dans
 * `GUIDES_RESEAU_ESSAI_ADRESSES` (même comparaison que la livraison). Sans adresse (page publique,
 * jeton seul), une cible d'essai reste refusée. Jamais journalisée.
 */
export async function cibleGuideConnue(code: string, email?: string): Promise<boolean> {
  const figee = GUIDES_RESEAU_CONNUS.includes(code);
  // Forme d'un code du catalogue : au-delà, aucune lecture en base.
  if (!RE_CODE_GUIDE_CATALOGUE.test(code)) return figee;
  if (!catalogueAccepteActif() || figee) return figee;
  try {
    const ligne = await prisma.cibleReseau.findUnique({
      where: { code },
      select: { type: true, actif: true, test: true },
    });
    if (ligne === null || ligne.actif !== true || ligne.type !== "guide") return false;
    if (ligne.test === false) return true;
    return ligne.test === true && typeof email === "string" && adresseDEssai(email, process.env);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "guides_reseau_catalogue_lecture_echec",
        erreur: err instanceof Error ? err.name : "erreur",
      }),
    );
    return figee;
  }
}
