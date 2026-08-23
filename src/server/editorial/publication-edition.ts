/**
 * Console éditoriale — ce qui déclenche une version, et ce qui n'en déclenche
 * pas (§2 ter, critères 7 et 8 du lot 1).
 *
 * Module PUR : aucun import `next`/prisma.
 *
 * > ⚠️ « Une version est créée à chaque modification de CONTENU, jamais à
 * > chaque changement de statut. Sinon le journal se remplit de bruit. »
 *
 * C'est toute la règle, et elle a deux faces également importantes :
 * versionner ce qui doit l'être (sinon on perd la trace d'une réécriture — le
 * dossier importé en comptait seize), et NE PAS versionner le reste (sinon
 * l'historique devient illisible et plus personne ne l'ouvre).
 */

/** Les seuls champs dont la modification fait une version. */
export const CHAMPS_VERSIONNES = ["accroche", "corps", "premierCommentaire", "tags"] as const;

export type ChampVersionne = (typeof CHAMPS_VERSIONNES)[number];

/** L'état de contenu d'une publication, réduit à ce qui se versionne. */
export interface ContenuPublication {
  accroche: string | null;
  corps: string | null;
  premierCommentaire: string | null;
  tags: string[];
}

/**
 * Une modification demandée : seuls les champs présents sont touchés.
 *
 * Écrit à la main plutôt qu'en `Partial<>` : le dépôt active
 * `exactOptionalPropertyTypes`, sous lequel `Partial<T>` n'accepte PAS
 * `undefined` comme valeur — seulement l'absence de la clé. Or un appelant
 * qui construit son patch depuis un formulaire produit bien des `undefined`.
 */
export interface ModificationContenu {
  accroche?: string | null | undefined;
  corps?: string | null | undefined;
  premierCommentaire?: string | null | undefined;
  tags?: string[] | undefined;
}

/**
 * Compare deux tableaux de tags.
 *
 * L'ORDRE compte : « #RGPD #AIAct » et « #AIAct #RGPD » ne s'affichent pas
 * pareil sous un post, et le §6 précise que l'import « garde l'ordre ».
 * Réordonner est donc bien une modification de contenu.
 */
function tagsDifferents(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((t, i) => t !== b[i]);
}

/** Normalise pour la comparaison : `null` et `""` sont le même vide. */
function texteEgal(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "") === (b ?? "");
}

/**
 * Les champs de contenu réellement modifiés par ce patch.
 *
 * Rend un tableau vide si rien ne change — y compris quand le patch contient
 * les champs mais avec les mêmes valeurs. Enregistrer une version pour une
 * sauvegarde sans changement est le premier pas vers un historique illisible.
 */
export function champsModifies(
  avant: ContenuPublication,
  patch: ModificationContenu,
): ChampVersionne[] {
  const modifies: ChampVersionne[] = [];
  for (const champ of CHAMPS_VERSIONNES) {
    if (!(champ in patch)) continue;
    if (champ === "tags") {
      if (patch.tags && tagsDifferents(avant.tags, patch.tags)) modifies.push("tags");
      continue;
    }
    if (!texteEgal(avant[champ], patch[champ])) modifies.push(champ);
  }
  return modifies;
}

/**
 * Faut-il créer une version ?
 *
 * 🔴 Un patch qui ne touche QUE des statuts rend `false` — critère 8 du lot 1.
 * Le patch ne peut d'ailleurs pas porter de statut : son type ne l'autorise
 * pas, et c'est délibéré. Les transitions de statut passent par une autre
 * porte, qui ne sait pas versionner.
 */
export function doitVersionner(avant: ContenuPublication, patch: ModificationContenu): boolean {
  return champsModifies(avant, patch).length > 0;
}

/**
 * L'instantané à archiver AVANT d'appliquer le patch.
 *
 * ⚠️ On archive l'**ancien** contenu, pas le nouveau. La version N porte donc
 * ce qui était affiché quand la version N était courante — c'est ce qui rend
 * « l'ancienne reste consultable » (critère 7) vrai au sens où on l'entend.
 */
export function instantaneAvant(
  avant: ContenuPublication,
  version: number,
  motif?: string | null,
): ContenuPublication & { version: number; motif: string | null } {
  return {
    version,
    accroche: avant.accroche,
    corps: avant.corps,
    premierCommentaire: avant.premierCommentaire,
    tags: [...avant.tags],
    motif: motif ?? null,
  };
}

/** Applique le patch, en ne touchant que les champs présents. */
export function appliquer(
  avant: ContenuPublication,
  patch: ModificationContenu,
): ContenuPublication {
  return {
    accroche: "accroche" in patch ? (patch.accroche ?? null) : avant.accroche,
    corps: "corps" in patch ? (patch.corps ?? null) : avant.corps,
    premierCommentaire:
      "premierCommentaire" in patch ? (patch.premierCommentaire ?? null) : avant.premierCommentaire,
    tags: "tags" in patch && patch.tags ? [...patch.tags] : [...avant.tags],
  };
}

// ── Les transitions de statut ─────────────────────────────────────────────

export type StatutRedaction = "idee" | "redige" | "valide";
export type StatutDiffusion = "non_programme" | "programme" | "publie" | "annule";

/**
 * Transitions de rédaction autorisées.
 *
 * `valide → redige` est PERMIS : une publication validée qu'on rouvre pour
 * la retoucher redescend, elle ne se bloque pas. `idee → valide` ne l'est
 * pas : on ne valide pas un texte qui n'a jamais été écrit.
 */
const TRANSITIONS_REDACTION: Record<StatutRedaction, readonly StatutRedaction[]> = {
  idee: ["redige"],
  redige: ["valide", "idee"],
  valide: ["redige"],
};

/**
 * Transitions de diffusion autorisées.
 *
 * `publie` est TERMINAL : une publication parue ne redevient pas
 * « non programmée ». Ce qui est en ligne est en ligne — le nier dans
 * l'outil ne le retire pas de LinkedIn.
 */
const TRANSITIONS_DIFFUSION: Record<StatutDiffusion, readonly StatutDiffusion[]> = {
  non_programme: ["programme", "annule"],
  programme: ["publie", "non_programme", "annule"],
  publie: [],
  annule: ["non_programme"],
};

export interface VerdictTransition {
  autorisee: boolean;
  /** Message citant la règle. Vide si autorisée. */
  message: string;
}

export function transitionRedaction(de: StatutRedaction, vers: StatutRedaction): VerdictTransition {
  if (de === vers) return { autorisee: true, message: "" };
  const permises = TRANSITIONS_REDACTION[de];
  if (permises.includes(vers)) return { autorisee: true, message: "" };
  return {
    autorisee: false,
    message:
      `Transition de rédaction « ${de} » → « ${vers} » interdite. ` +
      (permises.length > 0
        ? `Depuis « ${de} », seul « ${permises.join(" » ou « ")} » est possible.`
        : `« ${de} » est un état terminal.`),
  };
}

export function transitionDiffusion(de: StatutDiffusion, vers: StatutDiffusion): VerdictTransition {
  if (de === vers) return { autorisee: true, message: "" };
  const permises = TRANSITIONS_DIFFUSION[de];
  if (permises.includes(vers)) return { autorisee: true, message: "" };
  return {
    autorisee: false,
    message:
      `Transition de diffusion « ${de} » → « ${vers} » interdite. ` +
      (permises.length > 0
        ? `Depuis « ${de} », seul « ${permises.join(" » ou « ")} » est possible.`
        : `« ${de} » est un état terminal : ce qui est publié le reste.`),
  };
}
