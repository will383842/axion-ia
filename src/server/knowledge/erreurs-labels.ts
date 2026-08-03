/**
 * Messages français des erreurs du cycle de validation des connaissances.
 *
 * 🔴 L'ÉCRAN AFFICHAIT LE CODE MACHINE. « Erreur : transition_refused
 * (must_differ_from_author) », « Erreur : slug_already_used », « Erreur :
 * entry_not_found ». Les Server Actions de ce domaine ne renvoient que des
 * codes `snake_case` anglais — c'est le bon choix côté serveur, mais personne
 * ne les traduisait avant l'affichage, sur six écrans.
 *
 * Un code inconnu est CITÉ plutôt que remplacé par un message générique : si le
 * serveur invente une raison, on veut la voir, pas la masquer derrière
 * « une erreur est survenue ».
 */
export const ERREURS_KB: Record<string, string> = {
  transition_refused: "Ce changement d'état n'est pas autorisé depuis l'état actuel.",
  self_review_refused: "Vous ne pouvez pas relire votre propre contenu.",
  must_differ_from_author: "Le relecteur doit être différent de l'auteur.",
  reviewer_not_active: "Le relecteur désigné n'a pas de compte actif.",
  slug_already_used: "Cette adresse est déjà utilisée par une autre entrée.",
  already_exists: "Une entrée porte déjà ces valeurs.",
  entry_not_found: "Entrée introuvable — elle a peut-être été supprimée entre-temps.",
  not_found: "Élément introuvable.",
  version_not_found: "Cette version n'existe plus.",
  already_deleted: "Cette entrée est déjà à la corbeille.",
  snapshot_invalid: "La version enregistrée est illisible : restauration impossible.",
  status_change_forbidden_use_workflow:
    "Le statut ne se change pas ici : passez par le cycle de validation.",
  cycle_detected: "Ce lien créerait une boucle entre entrées.",
  self_loop: "Une entrée ne peut pas se lier à elle-même.",
  banned_words_violation: "Le texte contient des expressions interdites par la charte éditoriale.",
  alt_text_violation: "Une image n'a pas de texte alternatif.",
  rename_via_update_entry_action: "Le renommage se fait depuis le formulaire d'édition.",
  validation: "Certains champs sont incomplets ou invalides.",
};

/** Message lisible d'un code d'erreur, avec sa raison éventuelle. */
export function messageErreurKb(code: string, raison?: string | null): string {
  const principal = ERREURS_KB[code] ?? `Erreur inattendue (« ${code} »).`;
  if (raison === undefined || raison === null || raison === "") return principal;
  const detail = ERREURS_KB[raison] ?? `« ${raison} »`;
  return `${principal} ${detail}`;
}
