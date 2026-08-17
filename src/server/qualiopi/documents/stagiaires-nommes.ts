/**
 * Lot 1ter §6 — LA CONVENTION DOIT NOMMER LES STAGIAIRES. Module PUR.
 *
 * ## Le défaut, vérifié sur pièce réelle
 *
 * 🔴 `AXI-DOC-2026-032` porte « **Effectif prévu : 1 stagiaire** » et **ne nomme
 * personne** — alors que Simone Blanc y était inscrite.
 *
 * Ce n'est pas une coquette d'affichage. La **même personne** doit se retrouver
 * sur l'émargement, sur l'évaluation des acquis et sur l'attestation. Sans nom à
 * la convention, la chaîne de preuve **démarre dans le flou** : un auditeur qui
 * rapproche les pièces ne peut pas relier le contrat à la personne formée, et
 * c'est précisément ce rapprochement qu'il vient faire.
 *
 * ## Ce que le module refuse de faire
 *
 * 🔴 **Il ne se tait jamais.** Si aucun stagiaire n'est inscrit au moment de la
 * génération, la pièce le DIT — « stagiaires à désigner par le client, liste
 * annexée avant le démarrage » — au lieu de rester muette. Une convention muette
 * sur ce point se lit comme une convention sans stagiaire, ce qui n'existe pas :
 * le silence y est une affirmation fausse.
 *
 * ⚠️ Corollaire de parcours, porté par la checklist du Lot 1 : **inscrire les
 * stagiaires AVANT de générer la convention**. C'est une étape ordonnée, pas un
 * choix laissé à la mémoire.
 */

/** Ce dont la mention a besoin. Volontairement minimal. */
export interface StagiaireNommable {
  readonly nom: string;
  readonly prenom: string;
  /** Fonction dans l'entreprise, si elle est connue. */
  readonly fonction?: string | null;
  /** Statut de l'inscription — seules les actives sont nommées. */
  readonly statut: string;
}

/** Ce que le gabarit affiche. */
export interface MentionStagiaires {
  /** Les personnes nommées, prêtes à rendre. Vide si aucune. */
  readonly nommes: ReadonlyArray<string>;
  /**
   * Phrase à rendre quand personne n'est nommé. `null` s'il y a des noms.
   *
   * 🔴 Jamais `""` : une chaîne vide se rend comme un blanc, et un blanc se lit
   * comme « il n'y avait rien à dire ». Le `null` force l'appelant à choisir
   * entre la liste et la phrase, sans troisième voie silencieuse.
   */
  readonly aDesigner: string | null;
  /** Effectif RÉEL — le nombre de personnes nommées. Voir `effectifAAfficher`. */
  readonly effectifNomme: number;
}

/** Statuts d'inscription qui comptent comme « inscrit à la convention ». */
const STATUTS_ACTIFS = new Set(["planifiee", "presente"]);

const PHRASE_A_DESIGNER =
  "Stagiaires à désigner par le client — liste nominative annexée avant le démarrage de l'action.";

/**
 * Formate un stagiaire : « BLANC Simone (Responsable qualité) ».
 *
 * ⚠️ Nom en capitales, prénom en casse normale : c'est la convention des pièces
 * administratives françaises, et c'est celle de l'émargement — les deux doivent
 * se rapprocher à l'œil, pas seulement à la lecture attentive.
 */
function formater(s: StagiaireNommable): string {
  const base = `${s.nom.trim().toUpperCase()} ${s.prenom.trim()}`.trim();
  const fonction = s.fonction?.trim();
  return fonction ? `${base} (${fonction})` : base;
}

/**
 * La mention des stagiaires d'une convention.
 *
 * Les inscriptions annulées ou désistées sont **écartées** : nommer quelqu'un
 * qui ne viendra pas ferait diverger la convention de l'émargement, et c'est
 * exactement l'écart qu'un auditeur relève.
 */
export function mentionStagiaires(
  inscriptions: ReadonlyArray<StagiaireNommable>,
): MentionStagiaires {
  const actifs = inscriptions.filter((i) => STATUTS_ACTIFS.has(i.statut));
  if (actifs.length === 0) {
    return { nommes: [], aDesigner: PHRASE_A_DESIGNER, effectifNomme: 0 };
  }
  // Tri alphabétique : l'ordre d'insertion en base n'a aucun sens pour un
  // lecteur, et deux régénérations de la même pièce doivent produire le même
  // texte — sans quoi la comparaison de deux exemplaires devient impossible.
  const nommes = actifs.map(formater).sort((a, b) => a.localeCompare(b, "fr"));
  return { nommes, aDesigner: null, effectifNomme: nommes.length };
}

/**
 * L'effectif à imprimer, et la mention d'écart s'il y a lieu.
 *
 * 🔴 Le cas qui a motivé cette fonction : `nbParticipantsPrevus` est une
 * PRÉVISION saisie à la création de la session ; le nombre d'inscrits est un
 * FAIT. Les deux divergent régulièrement, et la pièce affichait la prévision en
 * l'appelant « effectif ».
 *
 * On imprime donc la prévision — c'est elle qui fonde le prix convenu — mais on
 * NOMME les inscrits, et l'écart est dit. Le taire laisserait un auditeur
 * découvrir seul que « 3 stagiaires » n'en nomme que 2.
 */
export function ecartEffectif(args: {
  readonly prevu: number;
  readonly nomme: number;
}): string | null {
  if (args.nomme === 0) return null; // la phrase « à désigner » porte déjà le cas
  if (args.nomme === args.prevu) return null;
  return args.nomme < args.prevu
    ? `Effectif prévu : ${args.prevu}. ${args.nomme} stagiaire${args.nomme > 1 ? "s" : ""} nominativement désigné${args.nomme > 1 ? "s" : ""} à ce jour ; le solde sera annexé avant le démarrage.`
    : `Effectif prévu : ${args.prevu}, dépassé — ${args.nomme} stagiaires sont inscrits. Un avenant est requis avant le démarrage.`;
}
