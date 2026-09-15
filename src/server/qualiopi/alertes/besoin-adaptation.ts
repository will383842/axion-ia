/**
 * Qualiopi — Alerte « besoin d'adaptation déclaré » (indicateur 26).
 *
 * ## Pourquoi ce module existe séparément
 *
 * Le texte de l'alerte porte une contrainte que le reste du code ne peut pas
 * garantir tout seul : **le besoin déclaré est une donnée de santé (RGPD
 * art. 9) et ne doit JAMAIS y figurer**. Une alerte s'affiche sur
 * /qualiopi/a-traiter, se recopie dans une pastille, part en notification — et
 * une fois écrite, son texte est FIGÉ en base : il ne se corrige plus.
 *
 * En isolant la construction ici, la fonction ne reçoit tout simplement PAS le
 * besoin en paramètre. La fuite n'est pas « évitée par vigilance » : elle est
 * hors de portée. C'est la même doctrine que `construireAlerteJobIaEchoue`,
 * qui refuse de prendre `err` pour la même raison.
 *
 * Module PUR (aucun import Prisma / Next) : testable sans monter la chaîne des
 * Server Actions, qui tire `next/headers` et casse la collecte Vitest.
 */

/** Nom affichable d'un bénéficiaire et INSTANT de sa déclaration, sans rien de sa situation. */
export interface BeneficiairePourAlerte {
  readonly prenom: string;
  readonly nom: string;
  /**
   * Quand la déclaration a été faite. 🔴 Obligatoire : c'est ce qui distingue
   * une NOUVELLE déclaration d'une déclaration déjà traitée (cf. plus bas).
   */
  readonly declareLe: Date;
}

const instantParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "medium",
  timeZone: "Europe/Paris",
});

/**
 * Construit le titre et le message de l'alerte console.
 *
 * Le message nomme la personne et dit OÙ regarder — une alerte qui tairait les
 * deux ne serait pas actionnable. Il ne dit rien du besoin lui-même : la
 * lecture se fait depuis la fiche stagiaire, réservée au super-administrateur
 * et journalisée.
 *
 * 🔴 2026-09-15 (relecture #1095) — le message ne dépendait que de l'IDENTITÉ.
 * Le code est en `resolutionAuto: false` : `creerOuDedup` écarte donc toute
 * alerte dont une sœur RÉSOLUE porte le même message. Une fois la première
 * déclaration traitée (« aucune adaptation nécessaire »), une nouvelle
 * déclaration de la même personne — un vrai besoin, cette fois — ne levait plus
 * RIEN. Le message porte désormais l'instant de la déclaration, à la seconde :
 * la même déclaration redite reste écartée, une nouvelle revient. C'est la
 * doctrine du dédoublonnage (« message différent = fait nouveau »), appliquée
 * au seul fait qui distingue deux déclarations. Une date n'est pas une donnée
 * de santé.
 */
export function construireAlerteBesoinAdaptation(beneficiaire: BeneficiairePourAlerte): {
  titre: string;
  message: string;
} {
  const identite = `${beneficiaire.prenom} ${beneficiaire.nom}`.trim();
  return {
    titre: "Besoin d'adaptation déclaré par un bénéficiaire",
    // 🔴 2026-09-15 — « résolvez cette alerte une fois l'adaptation prise en
    // compte » faisait fermer l'alerte sans rien consigner : l'indicateur 10
    // restait sans trace de la réponse. Le geste demandé est la CONSIGNATION,
    // et c'est elle qui ferme l'alerte.
    message:
      `${identite} a déclaré un besoin d'adaptation depuis son espace le ` +
      `${instantParis.format(beneficiaire.declareLe)}. ` +
      `Une réponse consignée AVANT cette déclaration ne la couvre pas. ` +
      `Le détail est chiffré : ouvrez sa fiche stagiaire pour le lire, échangez avec la ` +
      `personne, puis consignez la réponse de l'organisme — adaptation prévue, ou « aucune ` +
      `adaptation nécessaire » — dans la colonne « Adaptations (ind. 10) » de la fiche ` +
      `session. Cette alerte se fermera d'elle-même.`,
  };
}
