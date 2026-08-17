/**
 * 🔴 LES ANCRES DU HUB DE SESSION — module PUR.
 *
 * ## Le défaut
 *
 * La page d'une session fait 928 lignes et empile **dix sections** sans aucun
 * moyen d'atteindre l'une d'elles autrement qu'en déroulant tout. Un admin qui
 * vient poser un émargement traverse les informations générales, le cycle de
 * vie, le lieu, le formateur, l'inter-entreprises, les sous-pages et les
 * stagiaires avant de trouver ce pour quoi il est venu. C'est le premier grief
 * de Will sur la console : « incompréhensible ».
 *
 * ## Pourquoi la liste ne peut pas être une constante rendue telle quelle
 *
 * ⚠️ Une section est **conditionnelle** — la préparation du kit, rendue
 * seulement si `preparationKit.aPreparer`. Une barre qui l'afficherait
 * toujours produirait un lien qui ne mène **nulle part** : le
 * clic ne bouge pas, et l'utilisateur croit l'interface cassée. Un lien mort
 * est pire que pas de lien — il enseigne à ne plus faire confiance à la barre.
 *
 * D'où la forme : le catalogue déclare ce qui PEUT exister, la page dit ce qui
 * existe VRAIMENT à ce rendu, et `ancresVisibles` fait l'intersection.
 *
 * ## Pourquoi un module pur plutôt qu'un tableau dans la page
 *
 * L'identifiant d'ancre est écrit **deux fois** : dans la barre (`href="#x"`)
 * et sur la section (`id="x"`). Deux copies d'une même frontière divergent —
 * c'est la doctrine SSOT du dépôt, et le défaut qu'on a déjà payé sept fois
 * sur les habilitations. Ici la constante est unique, et un test statique
 * vérifie que la page porte bien un `id` pour chaque entrée.
 */

/** Une section atteignable du hub. */
export interface AncreHub {
  /** Fragment d'URL. Sert de `id=` sur la section ET de `href="#…"` dans la barre. */
  readonly id: string;
  /** Intitulé affiché dans la barre. Court : la barre tient sur une ligne. */
  readonly libelle: string;
  /**
   * `true` quand la section n'est pas toujours rendue. La page DOIT alors dire
   * si elle l'est, via `presentes` — sinon l'ancre est écartée par défaut.
   *
   * ⚠️ Le défaut est l'ABSENCE : une ancre conditionnelle qu'on oublie de
   * déclarer disparaît de la barre. C'est le bon sens du défaut — on préfère
   * une barre incomplète à une barre qui ment.
   */
  readonly conditionnelle?: true;
}

/**
 * Catalogue ordonné. **L'ordre est celui du DOM**, pas un ordre d'importance :
 * une barre d'ancres qui ne suit pas l'ordre de la page fait sauter le lecteur
 * en arrière sans qu'il comprenne pourquoi.
 */
export const ANCRES_HUB_SESSION: readonly AncreHub[] = [
  { id: "infos", libelle: "Informations" },
  // Conditionnelle : sans parcours calculé (session hors périmètre, ou lecture
  // en échec), la section n'est pas rendue du tout — une checklist vide se
  // lirait comme « aucune obligation », le contraire de la vérité.
  { id: "checklist", libelle: "Où en est ce dossier", conditionnelle: true },
  { id: "cycle-de-vie", libelle: "Cycle de vie" },
  { id: "lieu", libelle: "Lieu" },
  { id: "formateur", libelle: "Formateur" },
  // Rendue même quand la session n'est pas inter-entreprises : la section porte
  // alors le moyen de la basculer. Donc PAS conditionnelle — la marquer telle
  // l'aurait fait disparaître de la barre pour tout le monde.
  { id: "inter-entreprises", libelle: "Inter-entreprises" },
  { id: "preparation-kit", libelle: "Préparation du kit", conditionnelle: true },
  { id: "sous-pages", libelle: "Sous-pages" },
  { id: "stagiaires", libelle: "Stagiaires" },
  { id: "documents", libelle: "Documents" },
  { id: "questionnaires", libelle: "Questionnaires" },
] as const;

/**
 * Les ancres à afficher pour CE rendu.
 *
 * @param presentes — ids des sections conditionnelles effectivement rendues.
 *   Les sections inconditionnelles n'ont pas à y figurer.
 */
export function ancresVisibles(presentes: Iterable<string> = []): readonly AncreHub[] {
  const rendues = new Set(presentes);
  return ANCRES_HUB_SESSION.filter((a) => !a.conditionnelle || rendues.has(a.id));
}

/**
 * Décalage de défilement, en unités CSS.
 *
 * 🔴 La topbar de la console est **collante** (`sticky`). Sans marge de
 * défilement, l'ancre place le titre de la section EXACTEMENT sous la topbar,
 * qui le recouvre : le lecteur atterrit sur un paragraphe orphelin et ne voit
 * pas de quoi il s'agit.
 *
 * ⚠️ On réutilise le jeton `--admin-topbar-h` (49 px), **jamais une valeur en
 * dur** : la topbar a déjà changé de hauteur une fois, et un `scroll-mt-12`
 * figé aurait recouvert ou décollé selon le sens du changement. On ajoute une
 * respiration d'un cran d'espacement pour que le titre ne colle pas au bord.
 */
export const CLASSE_ANCRE_SECTION = "scroll-mt-[calc(var(--admin-topbar-h)+var(--space-admin-4))]";
