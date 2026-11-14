/**
 * UN GUIDE EST-IL CONNU ? (lot LIA-F, 2026-11-12)
 *
 * ÉTEINT (`GUIDES_RESEAU_CATALOGUE_ENABLED` OU `GUIDES_RESEAU_LIVRAISON_ENABLED` éteint ; éteints par défaut) : la liste figée
 * `GUIDES_RESEAU_CONNUS`, exactement comme avant, SANS lecture en base.
 * ALLUMÉ (les DEUX) : la liste figée OU une ligne `cibles_reseau` active, de type `guide`, qui n'est pas une
 * cible d'essai. Une cible `adresse`, inactive ou d'essai est refusée. Base illisible : la liste
 * figée seule (fermé, jamais plus large). Aucune adresse n'est lue ni journalisée.
 */
import { GUIDES_RESEAU_CONNUS } from "@/content/guides-reseau";
import { prisma } from "@/lib/prisma";
import { catalogueGuidesActif } from "./config";

/**
 * Le catalogue n'est accepté que si LES DEUX interrupteurs valent exactement `"true"`.
 * À remplacer par `catalogueGuidesActif() && livraisonCatalogueActive()` une fois la PR de
 * livraison fusionnée (ordre de fusion : 1992, 1994, puis celle-ci).
 */
export function catalogueAccepteActif(): boolean {
  return catalogueGuidesActif() && process.env.GUIDES_RESEAU_LIVRAISON_ENABLED === "true";
}

/** Forme d'un code du catalogue : au-delà, aucune lecture en base. */
const FORME_CODE_CATALOGUE = /^gde-[a-z0-9-]{6,24}$/;

export async function cibleGuideConnue(code: string): Promise<boolean> {
  const figee = GUIDES_RESEAU_CONNUS.includes(code);
  if (!FORME_CODE_CATALOGUE.test(code)) return figee;
  if (!catalogueAccepteActif() || figee) return figee;
  try {
    const ligne = await prisma.cibleReseau.findUnique({
      where: { code },
      select: { type: true, actif: true, test: true },
    });
    return ligne !== null && ligne.actif === true && ligne.type === "guide" && ligne.test === false;
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
