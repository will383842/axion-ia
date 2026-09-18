/**
 * Qualiopi — MÉTHODE de calcul des quatre indicateurs de résultats publiés.
 *
 * ## Le défaut que ce module ferme (mesuré en production le 2026-09-17)
 *
 * `GET https://axion-ia.com/fr/certification-qualiopi` rendait les quatre
 * tuiles d'indicateurs — et **aucune des quatre phrases de méthode** dans
 * 1 411 588 octets de HTML. Chaîne du défaut :
 *
 * 1. la page porte `revalidate = 3600` : elle est PRÉ-RENDUE au build ;
 * 2. au build GitHub Actions, `DATABASE_URL` contient `stub.invalid`
 *    (ADR 0026) → `getIndicateurs` sortait par `buildEmptyResult` ;
 * 3. `buildEmptyResult` rendait `methodes: { satisfaction: "", … }` —
 *    quatre chaînes vides, figées dans le HTML pré-rendu.
 *
 * 🔑 Ce qui rendait le trou INVISIBLE : les **valeurs** chiffrées, elles,
 * étaient correctement protégées (« En cours de constitution »). La page avait
 * donc l'air complète, avec quatre `<p>` vides à la place des méthodes.
 *
 * ## Pourquoi un module à part, et pas une garde au rendu
 *
 * Ces quatre phrases **ne viennent pas de la base**. Il n'existe aucun champ
 * `methodologie` au schéma pour ces indicateurs : ce sont des littéraux
 * construits dans le code. Elles n'avaient donc rien à faire dans le chemin
 * DB-dépendant. Les en sortir fait disparaître le défaut **par construction** :
 * `getIndicateurs` et `buildEmptyResult` appellent la même fonction pure, et il
 * n'existe plus aucun chemin qui rende une méthode vide.
 *
 * 🔑 Une méthode de calcul reste VRAIE quand il n'y a rien à calculer — c'est
 * même précisément ce qu'un auditeur veut lire sur une page « en cours de
 * constitution » : comment le chiffre sera obtenu quand il existera.
 *
 * Module PUR : aucune I/O, aucun import Prisma/Redis. Importable au build.
 */

export interface MethodesCalcul {
  satisfaction: string;
  reussite: string;
  completion: string;
  delaiAcces: string;
}

export interface ParametresMethodes {
  /** Année civile de l'échantillon. */
  annee: number;
  /**
   * Seuil de présence « complète » (%), lu en configuration. `null` quand il
   * est INCONNU — au build SSG, la base ne répond pas.
   */
  seuilPresencePct: number | null;
  /**
   * Nombre de questionnaires de satisfaction retenus. `null` quand il est
   * INCONNU (build SSG) : ce n'est pas zéro.
   */
  nbSatisfaction: number | null;
}

/**
 * Construit les quatre phrases de méthode. Aucune ne peut être vide : chaque
 * branche produit du texte, y compris quand rien n'est connu.
 *
 * 🔴 2026-09-18 (revue sécurité de la PR 1111) — un paramètre INCONNU ne
 * s'imprime pas. Au build, `buildEmptyResult` passait `nbSatisfaction: 0` et
 * le seuil par défaut du registre : la page prérendue affirmait donc
 * « (0 évaluation du 01/01/2026 au 31/12/2026) » alors que la production en
 * comptait une. Ne pas savoir n'est pas compter zéro : sur une page publique
 * lue par l'auditrice, un compteur inventé est une affirmation fausse. Quand
 * la valeur est `null`, la phrase décrit la méthode et s'arrête là.
 */
export function buildMethodesCalcul({
  annee,
  seuilPresencePct,
  nbSatisfaction,
}: ParametresMethodes): MethodesCalcul {
  const periode = `du 01/01/${annee} au 31/12/${annee}`;
  const effectif =
    nbSatisfaction === null
      ? ` Période : ${periode}.`
      : ` (${nbSatisfaction} évaluation${nbSatisfaction > 1 ? "s" : ""} ${periode}).`;
  const seuil = seuilPresencePct === null ? "" : ` (${seuilPresencePct} %)`;

  return {
    satisfaction:
      `Calculé sur la note globale (1 à 5) de tous les questionnaires de satisfaction ` +
      `remplis à l'issue de chaque session, rapportée à 100.` +
      effectif,
    reussite:
      `Pourcentage de stagiaires ayant obtenu le niveau « acquis » à l'évaluation finale ` +
      `parmi l'ensemble des évaluations finales de l'année.`,
    completion:
      `Pourcentage de stagiaires ayant atteint ou dépassé le seuil de présence requis` +
      `${seuil} sur l'ensemble des inscriptions actives de sessions réalisées.`,
    delaiAcces:
      `Délai moyen en jours entre la date d'inscription et le début de la session, ` +
      `sur les sessions réalisées de l'année.`,
  };
}
