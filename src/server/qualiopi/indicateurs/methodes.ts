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
   * Seuil de présence « complète » (%). Vient de `seuil_presence_pct` quand la
   * base répond ; du défaut du registre quand elle ne répond pas (build SSG).
   */
  seuilPresencePct: number;
  /** Nombre de questionnaires de satisfaction retenus — 0 est une réponse. */
  nbSatisfaction: number;
}

/**
 * Construit les quatre phrases de méthode. Aucune ne peut être vide : chaque
 * branche produit du texte, y compris à effectif nul.
 */
export function buildMethodesCalcul({
  annee,
  seuilPresencePct,
  nbSatisfaction,
}: ParametresMethodes): MethodesCalcul {
  const debutStr = `01/01/${annee}`;
  const finStr = `31/12/${annee}`;

  return {
    satisfaction:
      `Calculé sur la note globale (1 à 5) de tous les questionnaires de satisfaction ` +
      `remplis à l'issue de chaque session, rapportée à 100. ` +
      `(${nbSatisfaction} évaluation${nbSatisfaction > 1 ? "s" : ""} du ${debutStr} au ${finStr}).`,
    reussite:
      `Pourcentage de stagiaires ayant obtenu le niveau « acquis » à l'évaluation finale ` +
      `parmi l'ensemble des évaluations finales de l'année.`,
    completion:
      `Pourcentage de stagiaires ayant atteint ou dépassé le seuil de présence requis ` +
      `(${seuilPresencePct} %) sur l'ensemble des inscriptions actives de sessions réalisées.`,
    delaiAcces:
      `Délai moyen en jours entre la date d'inscription et le début de la session, ` +
      `sur les sessions réalisées de l'année.`,
  };
}
