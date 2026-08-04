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

/** Nom affichable d'un bénéficiaire, sans rien de sa situation. */
export interface BeneficiairePourAlerte {
  readonly prenom: string;
  readonly nom: string;
}

/**
 * Construit le titre et le message de l'alerte console.
 *
 * Le message nomme la personne et dit OÙ regarder — une alerte qui tairait les
 * deux ne serait pas actionnable. Il ne dit rien du besoin lui-même : la
 * lecture se fait depuis la fiche stagiaire, réservée au super-administrateur
 * et journalisée.
 */
export function construireAlerteBesoinAdaptation(beneficiaire: BeneficiairePourAlerte): {
  titre: string;
  message: string;
} {
  const identite = `${beneficiaire.prenom} ${beneficiaire.nom}`.trim();
  return {
    titre: "Besoin d'adaptation déclaré par un bénéficiaire",
    message:
      `${identite} a déclaré un besoin d'adaptation depuis son espace. ` +
      `Le détail est chiffré : ouvrez sa fiche stagiaire pour le lire, ` +
      `puis résolvez cette alerte une fois l'adaptation prise en compte.`,
  };
}
