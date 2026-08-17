/**
 * Qualiopi — un dossier de financement n'est plus OPTIONNEL (sous-lot 8C).
 *
 * ## Le défaut fermé ici
 *
 * Constat de l'audit OPCO du 15/08 (`_AUDIT/OPCO-COMMERCIAL-2026-08-15/`, T1) :
 * `creerDossierDepuisSession` n'avait **qu'un seul appelant**, un bouton du hub
 * facturation. Rien ne le déclenchait à la déclaration du financement ni à la
 * conclusion de la convention.
 *
 * Or **tout** le suivi financeur pend à ce modèle : les deux alertes de suivi
 * (« envoyé sans réponse +30 j », « paiement financeur en retard ») portent sur
 * `DossierFinancement`, et le cockpit le lit. Pas de dossier → pas d'alerte,
 * pas de ligne au cockpit, pas de colonne « à solder ». Le suivi était opt-in.
 *
 * 🔴 Vérifié en production : **zéro dossier existait**. La chaîne de suivi OPCO
 * était donc, en pratique, entièrement éteinte — sans que rien ne le signale.
 *
 * ## 🔑 La frontière qui rend l'automatisation légitime
 *
 * Le bouton manuel est gardé par l'habilitation `deposer_demande_financeur`
 * (Lot 10, #609), au motif que **déposer une demande engage l'organisme au nom
 * du client** — cela suppose un mandat écrit. Automatiser cet acte serait une
 * faute grave.
 *
 * Mais ce n'est pas le même acte. La doctrine du projet — **produire ≠
 * remettre** — le tranche :
 *
 * | Acte | Engage l'organisme ? | Régime |
 * |---|---|---|
 * | **Ouvrir** le dossier de suivi (`a_monter`) | non — c'est un classeur vide | **automatique** |
 * | **Déposer** la demande au financeur (`a_monter → envoye`) | oui | **habilité, humain** |
 *
 * Un dossier `a_monter` ne parle à personne, n'envoie rien, ne promet rien : il
 * rend visible une affaire dont l'argent n'est pas sécurisé. C'est exactement
 * ce qui manquait. La machine à états, elle, ne bouge pas d'un mot : la porte
 * `a_monter → envoye` reste le clic habilité qu'elle a toujours été.
 *
 * Aucun import Prisma ni Next : mêmes entrées, mêmes sorties.
 */

/**
 * Financements qui appellent un dossier de suivi.
 *
 * `direct` en est absent, et c'est le seul cas : il n'y a pas de financeur, donc
 * rien à suivre. Ouvrir un dossier pour une affaire payée par l'entreprise sur
 * fonds propres ajouterait une ligne vide au cockpit, et une ligne vide finit
 * par apprendre à ne plus regarder le cockpit.
 *
 * `mixte` EST visé : il porte une part mutualisée, donc un financeur à relancer.
 */
const FINANCEMENTS_A_SUIVRE = ["opco", "cpf", "france_travail", "mixte"] as const;

/**
 * Cette session appelle-t-elle un dossier de financement ?
 *
 * ⚠️ Répond `false` sur un financement inconnu ou absent : ouvrir un dossier
 * « au cas où » créerait des dossiers fantômes qu'aucune alerte ne saurait
 * fermer. On n'ouvre que ce qu'on sait suivre.
 */
export function sessionExigeUnDossier(financementType: string | null | undefined): boolean {
  const normalise = (financementType ?? "").trim().toLowerCase();
  return (FINANCEMENTS_A_SUIVRE as readonly string[]).includes(normalise);
}

/**
 * Le passage d'un financement à un autre doit-il ouvrir un dossier ?
 *
 * 🔴 Distinct de `sessionExigeUnDossier` : on n'ouvre PAS un dossier à chaque
 * enregistrement du formulaire, seulement quand le financement **entre** dans le
 * périmètre suivi. Sans cette distinction, corriger une faute de frappe sur le
 * numéro de dossier OPCO rouvrirait un dossier qu'on vient de clore.
 *
 * Le sens inverse (mutualisé → direct) ne SUPPRIME jamais le dossier existant :
 * un dossier porte des dates, des montants et un historique de transitions —
 * c'est une pièce de suivi, pas un cache. Le refermer est une décision humaine
 * (`clos`), pas un effet de bord d'un changement de menu déroulant.
 */
export function changementOuvreUnDossier(
  financementAvant: string | null | undefined,
  financementApres: string | null | undefined,
): boolean {
  return sessionExigeUnDossier(financementApres) && !sessionExigeUnDossier(financementAvant);
}
