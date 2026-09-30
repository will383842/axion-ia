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
  // 🔴 « Dates », et jamais « Report » : les dates de déroulement sont un
  // ATTRIBUT de la session, au même titre que le lieu. Le report est un
  // ÉVÉNEMENT du cycle de vie, qui crée une seconde session. Les ranger côte à
  // côte ferait choisir le mauvais geste pour une faute de frappe.
  { id: "dates", libelle: "Dates" },
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
  // Conditionnelle : rendue dans l'onglet « Clôturée » seulement — le résumé
  // du verrou, son historique et les gestes encore ouverts.
  { id: "cloture", libelle: "Clôture du dossier", conditionnelle: true },
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
 * La barre d'ancres d'UN onglet : les seuls blocs AFFICHÉS de l'onglet courant.
 *
 * 🔴 Relecture L3 — la barre listait jusqu'à treize sections, y compris
 * celles repliées sous « Autres blocs de la fiche » : une pastille menait
 * alors dans un `<details>` fermé, où le navigateur ne déroule rien. Un lien
 * qui ne montre rien est un lien mort. Les blocs repliés restent atteignables
 * en ouvrant le repli, ou par l'onglet de leur phase.
 */
export function ancresDeLOnglet(affiches: readonly BlocFiche[]): readonly AncreHub[] {
  const montres = new Set<string>(affiches);
  return ANCRES_HUB_SESSION.filter((a) => montres.has(a.id));
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

// ─────────────────────────────────────────────────────────────────────────────
// Sous-pages — les sections où le fil conducteur mène (L3, 30/09/2026)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les `id` stables des sous-pages de la session, ceux que les étapes du
 * parcours visent (`cible.fragment`). Déclarés ICI, une fois : la garde
 * `le-suivi-mene-au-geste.spec.ts` vérifie que chacun existe dans le fichier de
 * sa sous-page, et que chaque cible du parcours est l'un d'eux.
 *
 * `insc-` est un PRÉFIXE : `/evaluations#insc-{enrollmentId}` mène au cadre du
 * stagiaire (évaluer, puis attester).
 */
export const ANCRES_SOUS_PAGES = {
  emargement: ["contresignature", "journees", "liens", "feuille"],
  evaluations: ["evaluations-stagiaires", "insc-"],
  financement: ["facturation"],
  kit: [],
} as const satisfies Record<string, readonly string[]>;

// ─────────────────────────────────────────────────────────────────────────────
// Phases — la fiche s'affiche par onglet, jamais tout à la fois
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 Audit UX du 30/09/2026 : la fiche faisait huit écrans et 77 boutons, tout
 * affiché tout le temps, sur une session à préparer comme sur une session
 * terminée. On ne savait ni quoi faire, ni où.
 *
 * La fiche s'ouvre désormais sur l'onglet de la phase COURANTE du dossier
 * (`phaseDossier`, ADR 0060) ; les blocs des autres phases ne disparaissent
 * pas, ils sont repliés sous « Autres blocs de la fiche ». Aucun contenu n'est perdu.
 */
export type PhaseFiche = "preparer" | "jour_j" | "apres" | "cloturee";

export const PHASES_FICHE: ReadonlyArray<{ readonly id: PhaseFiche; readonly libelle: string }> = [
  { id: "preparer", libelle: "Préparer" },
  { id: "jour_j", libelle: "Le jour J" },
  { id: "apres", libelle: "Après" },
  { id: "cloturee", libelle: "Clôturée" },
];

/**
 * Les blocs de la fiche — les `id` du catalogue ci-dessus. Écrits en toutes
 * lettres (le catalogue est typé `AncreHub[]`, donc `string`) : c'est ce qui
 * oblige `PHASES_DES_BLOCS` à nommer CHAQUE bloc. `ancres.spec.ts` vérifie que
 * les deux listes coïncident.
 */
export type BlocFiche =
  | "infos"
  | "checklist"
  | "cycle-de-vie"
  | "dates"
  | "lieu"
  | "formateur"
  | "inter-entreprises"
  | "preparation-kit"
  | "sous-pages"
  | "stagiaires"
  | "documents"
  | "questionnaires"
  | "cloture";

/**
 * À quelles phases appartient chaque bloc de la fiche. `"toujours"` : le bloc
 * répond à une question de TOUTES les phases (qui, quoi, où en est-on, où
 * aller) — il n'est jamais replié.
 *
 * ⚠️ Un bloc peut appartenir à plusieurs phases : « Stagiaires » sert à
 * inscrire (Préparer) et à constater une absence (Le jour J). Le découper en
 * deux composants ferait deux écrans pour une même liste.
 *
 * Garde : `ancres.spec.ts` — aucun bloc orphelin, aucune phase vide.
 */
export const PHASES_DES_BLOCS: Readonly<Record<BlocFiche, readonly PhaseFiche[] | "toujours">> = {
  infos: "toujours",
  checklist: "toujours",
  // Démarrer (jour J), marquer réalisée (après), reporter ou annuler (préparer).
  "cycle-de-vie": ["preparer", "jour_j", "apres"],
  dates: ["preparer"],
  lieu: ["preparer"],
  // Affecter (préparer) ; absence ou accord hors outil du formateur (jour J).
  formateur: ["preparer", "jour_j"],
  "inter-entreprises": ["preparer"],
  "preparation-kit": ["preparer"],
  // La navigation vers Émargement, Évaluations, Financement : utile partout.
  "sous-pages": "toujours",
  // Inscrire et adapter (préparer) ; statut de présence du jour (jour J).
  stagiaires: ["preparer", "jour_j"],
  // Pièces contractuelles et signatures (préparer) ; attestation, certificat,
  // factures, contreseings restants (après) ; registre et ZIP (clôturée).
  documents: ["preparer", "apres", "cloturee"],
  // Positionnement (préparer) ; à chaud (jour J) ; à froid (après).
  questionnaires: ["preparer", "jour_j", "apres"],
  cloture: ["cloturee"],
};

/** Lit `?phase=` ; une valeur inconnue ou absente rend `null` (onglet par défaut). */
export function lirePhaseFiche(valeur: string | string[] | undefined): PhaseFiche | null {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return PHASES_FICHE.some((p) => p.id === v) ? (v as PhaseFiche) : null;
}

/**
 * Répartit les blocs RENDUS entre l'onglet affiché et « Autres blocs de la fiche ».
 *
 * - l'ordre du catalogue (celui du DOM) est conservé des deux côtés ;
 * - la réunion des deux listes est EXACTEMENT `presents` : aucun bloc perdu,
 *   aucun bloc dupliqué ;
 * - `phase === null` (session annulée ou reportée) : tout est affiché, rien
 *   n'est replié — il n'y a pas de phase courante à privilégier.
 */
export function repartirBlocs(
  phase: PhaseFiche | null,
  presents: Iterable<BlocFiche>,
): { readonly affiches: BlocFiche[]; readonly replies: BlocFiche[] } {
  const rendus = new Set(presents);
  const ordre = ANCRES_HUB_SESSION.map((a) => a.id as BlocFiche).filter((id) => rendus.has(id));
  const affiches: BlocFiche[] = [];
  const replies: BlocFiche[] = [];
  for (const id of ordre) {
    const phases = PHASES_DES_BLOCS[id];
    if (phase === null || phases === "toujours" || phases.includes(phase)) affiches.push(id);
    else replies.push(id);
  }
  return { affiches, replies };
}
