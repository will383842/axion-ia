/**
 * Pourquoi un contrat de travail n'est pas signable MAINTENANT, dit à celui qui
 * regarde — module PUR.
 *
 * ## 🔴 Le défaut que l'extraction ferme (recette du 13/09)
 *
 * Un SEUL texte était rendu aux deux lecteurs pour le motif « spécimen », et il
 * était écrit pour l'OPÉRATEUR :
 *
 *   « Complétez le paramètre manquant, établissez à nouveau le contrat, puis
 *     signez-le. »
 *
 * Le salarié le lisait dans son espace personnel, sur son propre contrat de
 * travail. Une consigne qu'il ne peut pas exécuter, qui lui expose un défaut de
 * configuration interne, et qui le laisse croire que c'est à lui d'agir — sur la
 * pièce la plus engageante qu'on lui adresse.
 *
 * 🔑 La branche « non habilité » faisait DÉJÀ dépendre son texte du lecteur. Le
 * spécimen était le seul motif à ne pas le faire.
 *
 * ## ⚠️ POURQUOI CE MODULE EXISTE SÉPARÉMENT
 *
 * La fonction vivait au milieu de requêtes Prisma. L'éprouver aurait demandé de
 * simuler une base entière pour vérifier un CHOIX DE PHRASE — donc personne ne
 * l'a fait, donc le texte a dérivé sans qu'aucune garde ne bouge. Un module pur
 * rend le défaut interrogeable là où il vit : dans le texte.
 */

/** Qui regarde la pièce. */
export type LecteurContratTravail =
  { pourPartie: "formateur"; trainerId: string } | { pourPartie: "axionia"; role: string };

export const MOTIF_NON_TITULAIRE =
  "Ce contrat de travail ne vous concerne pas : il nomme une personne précise, et elle seule peut le signer.";

/**
 * La raison du refus, dans l'ordre où elle doit être dite.
 *
 * ⚠️ L'ORDRE compte. Un spécimen relève d'un geste correctif — renseigner la
 * convention collective, régénérer la pièce. Annoncer d'abord « vous avez déjà
 * signé » ferait croire que tout va bien sur un contrat qui n'est pas opposable.
 */
export function raisonDuRefus(ctx: {
  readonly estSpecimen: boolean;
  readonly estTitulaire: boolean;
  readonly habilite: boolean;
  readonly lecteur: LecteurContratTravail;
}): string {
  if (ctx.estSpecimen) {
    // 🔴 LE MOTIF DÉPEND DE QUI LIT — cf. l'en-tête de ce module.
    if (ctx.lecteur.pourPartie === "formateur") {
      return "Ce contrat n'est pas encore signable : une mention obligatoire manque du côté de l'employeur. Il vous sera adressé à nouveau dès qu'il sera complet — ne signez rien d'ici là. Vous n'avez aucune démarche à faire.";
    }
    return "Ce contrat porte la mention SPÉCIMEN : la convention collective de l'organisme, ou son identité, était incomplète au moment de sa génération. Il n'est pas opposable. Complétez le paramètre manquant, établissez à nouveau le contrat, puis signez-le.";
  }
  if (ctx.lecteur.pourPartie === "formateur") {
    if (!ctx.estTitulaire) return MOTIF_NON_TITULAIRE;
    return "Vous avez déjà signé ce contrat. Il reste affiché avec son horodatage et son empreinte : c'est votre preuve.";
  }
  if (!ctx.habilite) {
    return "Signer un contrat de travail engage l'organisme comme employeur : seuls un administrateur ou le dirigeant peuvent le faire.";
  }
  return "L'employeur a déjà signé ce contrat. Il reste affiché avec son horodatage et son empreinte.";
}
