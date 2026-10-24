/**
 * Liste FERMÉE des chiffres publics que les générateurs de blog ont le droit de citer
 * en plus des faits fournis dans leur prompt (audit blog/RAG 24/10/2026).
 *
 * Règle d'alimentation : une entrée n'est ajoutée qu'après vérification sur la source
 * officielle (URL https réelle, date de consultation). Sans source vérifiée, on n'ajoute
 * rien : la liste reste vide et les prompts disent alors « aucun chiffre hors faits fournis ».
 * Aucun chiffre attribué à Axion-IA, aucune promesse, aucun prix.
 */

export interface ChiffreVerifie {
  /** Valeur telle qu'on peut l'écrire dans un article (ex. « 12 % »). */
  readonly valeur: string;
  /** Ce que mesure le chiffre, en une phrase complète avec son périmètre. */
  readonly libelle: string;
  /** Nom de l'organisme source (ex. « Insee »). */
  readonly source: string;
  /** Adresse https de la page officielle où le chiffre figure. */
  readonly url: string;
  /** Date de vérification, au format AAAA-MM-JJ. */
  readonly date: string;
}

/** Vide tant qu'aucun chiffre n'a été vérifié sur sa source publique. */
export const CHIFFRES_VERIFIES: readonly ChiffreVerifie[] = [];

/** Règle commune des prompts : un chiffre n'existe que s'il est sourcé. */
export const REGLE_CHIFFRES_SOURCES =
  "Un chiffre seulement s'il figure dans les faits fournis ou dans la section CHIFFRES VÉRIFIÉS (quand elle existe), avec sa source nommée ; sinon aucun chiffre, écris qualitativement. Aucun chiffre inventé, aucun chiffre attribué à Axion-IA.";

/**
 * Section de prompt listant les chiffres vérifiés.
 * Renvoie une chaîne vide quand la liste est vide (le prompt reste inchangé).
 */
export function sectionChiffresVerifies(
  liste: readonly ChiffreVerifie[] = CHIFFRES_VERIFIES,
): string {
  if (liste.length === 0) return "";
  const lignes = liste.map(
    (c) => `- ${c.valeur} : ${c.libelle} (${c.source}, vérifié le ${c.date}, ${c.url})`,
  );
  return `\n## CHIFFRES VÉRIFIÉS (liste fermée : aucun autre chiffre n'est permis hors faits fournis)\n${lignes.join("\n")}\n`;
}
