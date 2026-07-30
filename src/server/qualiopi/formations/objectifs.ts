/**
 * Qualiopi — lecture des objectifs pédagogiques d'une formation.
 *
 * ## Pourquoi ce module existe
 *
 * `Formation.objectifsPedagogiques` est une colonne `Json`, et sa forme dépend
 * de l'origine de la formation :
 *
 * - **import du catalogue** (`catalog-import.ts`) → `{ id, verbe, description }[]`
 *   — c'est la forme des 22 formations réellement en production ;
 * - **moteur de génération** ou saisie manuelle → `{ objectif }[]`,
 *   `{ libelle }[]`, `string[]`, voire une chaîne unique.
 *
 * 🔴 Constat du parcours à blanc 2026-07-27. Quatre lieux normalisaient cette
 * valeur, chacun à sa façon, et un seul connaissait `description` :
 *
 * | Lieu                     | Reconnaissait          | Rendu réel sur le catalogue |
 * |--------------------------|------------------------|-----------------------------|
 * | `documents.ts`           | `description`          | correct                     |
 * | `evaluations/page.tsx`   | `libelle`              | « [object Object] » × 5     |
 * | `attestation-service.ts` | rien (`as string[]`)   | « [object Object], … »      |
 * | `portail-service.ts`     | `objectif`/`libelle`/… | liste VIDE                  |
 * | `attestation-1to1.ts`    | `libelle`              | liste VIDE                  |
 *
 * Autrement dit : la grille d'évaluation des acquis proposait cinq compétences
 * nommées « [object Object] », l'attestation de fin de formation imprimait la
 * même chose sous « Objectifs », et le portail stagiaire n'affichait aucun
 * objectif. Trois pièces vues par le stagiaire ET par l'auditeur.
 *
 * Une seule fonction, donc, et un seul endroit à corriger quand une nouvelle
 * forme apparaîtra. `String(o)` n'est JAMAIS un repli acceptable ici : sur un
 * objet il produit « [object Object] », c'est-à-dire du bruit imprimé sur une
 * pièce probante. Une entrée illisible est ignorée — mieux vaut un objectif
 * manquant qu'un objectif faux.
 *
 * Logique pure — aucun import Prisma, aucune I/O.
 */

/**
 * Clés porteuses du libellé, par ordre de priorité.
 *
 * `description` d'abord : c'est la forme du catalogue, donc le cas courant.
 * `verbe` n'est PAS dans cette liste — il ne porte que le premier mot de
 * l'objectif (« Décrire »), et le retenir tronquerait la phrase.
 */
const CLES_LIBELLE = ["description", "objectif", "libelle", "label", "titre", "intitule"] as const;

/**
 * Normalise `objectifsPedagogiques` en liste de libellés lisibles.
 *
 * Accepte une chaîne, un tableau de chaînes, un tableau d'objets, ou `null`.
 * Les entrées vides ou non exploitables sont écartées silencieusement : elles
 * ne doivent ni faire échouer un document, ni s'y imprimer.
 */
export function normaliserObjectifsPedagogiques(valeur: unknown): string[] {
  if (typeof valeur === "string") {
    const seul = valeur.trim();
    return seul.length > 0 ? [seul] : [];
  }
  if (!Array.isArray(valeur)) return [];

  return valeur
    .map((entree): string => {
      if (typeof entree === "string") return entree.trim();
      if (entree === null || typeof entree !== "object") return "";
      const rec = entree as Record<string, unknown>;
      for (const cle of CLES_LIBELLE) {
        const v = rec[cle];
        if (typeof v === "string" && v.trim().length > 0) return v.trim();
      }
      return "";
    })
    .filter((libelle) => libelle.length > 0);
}

/**
 * Même normalisation, rendue en une seule ligne — pour les champs de document
 * qui attendent un `string` (« Objectifs : … » sur l'attestation).
 *
 * Retourne `""` quand rien n'est exploitable : l'appelant décide s'il masque la
 * ligne ou imprime un tiret. Renvoyer « [object Object] » n'a jamais été une
 * option, et renvoyer « Non renseigné » d'autorité n'en est pas une non plus.
 */
export function objectifsPedagogiquesEnTexte(valeur: unknown, separateur = ", "): string {
  return normaliserObjectifsPedagogiques(valeur).join(separateur);
}
