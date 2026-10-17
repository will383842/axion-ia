/**
 * Chantier QNC, lot L05 — la convocation v2 (NC3). Module PUR : la décision se
 * teste sans base.
 *
 * Ce que la v2 change, et ce qu'elle laisse :
 *   - l'envoi est BLOQUÉ tant que la convention n'est pas entièrement signée,
 *     ou qu'un besoin d'adaptation déclaré (L04) n'a pas de réponse consignée ;
 *   - le motif est dit en clair, pour la console ;
 *   - le lien et l'outil de visioconférence sont remis par le courriel (jamais
 *     imprimés sur la pièce archivée, ADR 0048 §4.1) ;
 *   - le numéro de l'accès à l'espace stagiaire est dérivé de l'identifiant de
 *     l'accès — jamais du jeton, qui reste un secret.
 *
 * ⚠️ Atteint par le WORKER et par un composant client (console) : aucun import
 * Prisma, Next ni `server-only`.
 */

export const MOTIF_CONVENTION_NON_SIGNEE = "convention_non_signee" as const;
export const MOTIF_ADAPTATION_NON_TRAITEE = "adaptation_non_traitee" as const;

export type MotifBlocageConvocation =
  typeof MOTIF_CONVENTION_NON_SIGNEE | typeof MOTIF_ADAPTATION_NON_TRAITEE;

/** Le libellé que la console affiche — un motif, une phrase. */
export const LIBELLE_MOTIF_BLOCAGE: Readonly<Record<MotifBlocageConvocation, string>> = {
  convention_non_signee:
    "La convention n'est pas entièrement signée : la convocation attend la dernière signature.",
  adaptation_non_traitee:
    "Un besoin d'adaptation est déclaré et n'a pas encore de réponse consignée : la convocation attend la réponse du référent.",
};

export interface FaitsConvocation {
  /** `conventionSigneePourInscription` — signée par toutes les parties de son circuit. */
  readonly conventionSignee: boolean;
  /** `etatReponseAdaptation(...) === "a_consigner"` (L04). */
  readonly adaptationNonTraitee: boolean;
}

export interface DecisionConvocation {
  readonly autorisee: boolean;
  readonly motifs: readonly MotifBlocageConvocation[];
}

/** La règle d'envoi — dans l'ordre où le référent les lève. */
export function decisionEnvoiConvocation(faits: FaitsConvocation): DecisionConvocation {
  const motifs: MotifBlocageConvocation[] = [];
  if (!faits.conventionSignee) motifs.push(MOTIF_CONVENTION_NON_SIGNEE);
  if (faits.adaptationNonTraitee) motifs.push(MOTIF_ADAPTATION_NON_TRAITEE);
  return { autorisee: motifs.length === 0, motifs };
}

export function libellesMotifs(motifs: readonly MotifBlocageConvocation[]): string[] {
  return motifs.map((m) => LIBELLE_MOTIF_BLOCAGE[m]);
}

/** Même ensemble de motifs, dans le même ordre ? (dédoublonnage du journal) */
export function memesMotifs(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.length === b.length && a.every((m, i) => m === b[i]);
}

// ── Effectif et modalité : les mots de la v2 ─────────────────────────────────

export const EFFECTIF_MIN = 2;
export const EFFECTIF_MAX = 15;

/** « 2 à 15 » — la fourchette dite aux stagiaires, écrite une fois. */
export const LIBELLE_EFFECTIF = `${EFFECTIF_MIN} à ${EFFECTIF_MAX} participants`;

/** Le séminaire a son propre effectif (« jusqu'à 50 »), en présentiel seul. */
export const EFFECTIF_MAX_SEMINAIRE = 50;
export const LIBELLE_EFFECTIF_SEMINAIRE = `jusqu'à ${EFFECTIF_MAX_SEMINAIRE} participants`;

/**
 * La phrase « modalité et effectif » de la v2. « 2 à 15 » ne s'applique qu'aux
 * formations : le séminaire se déroule en présentiel, jusqu'à 50 participants.
 */
export function phraseEffectifEtModalite(seminaire: boolean | undefined): string {
  return seminaire === true
    ? `Ce séminaire se déroule en présentiel, en groupe ${LIBELLE_EFFECTIF_SEMINAIRE}.`
    : `Nos formations se déroulent en présentiel ou en distanciel, en groupe de ${LIBELLE_EFFECTIF}.`;
}

// ── Visioconférence ──────────────────────────────────────────────────────────

/** L'outil de l'organisme (ADR 0048 : Zoom Pro) — celui qu'on nomme sans lien. */
export const OUTIL_VISIO_PAR_DEFAUT = "Zoom";

/** Mention remise quand le champ « lien de visioconférence » est vide. */
export const MENTION_LIEN_ENVOYE_AVANT = "Lien envoyé avant la formation";

/**
 * Nom de l'outil d'après l'adresse du lien. Un lien reconnu l'emporte (un client
 * qui impose son Teams reste servi, ADR 0048 §2) ; sinon l'outil de l'organisme.
 */
export function outilVisio(lien: string | null): string {
  if (lien === null || lien.trim() === "") return OUTIL_VISIO_PAR_DEFAUT;
  let hote: string;
  try {
    hote = new URL(lien.trim()).hostname.toLowerCase();
  } catch {
    return OUTIL_VISIO_PAR_DEFAUT;
  }
  const est = (domaine: string): boolean => hote === domaine || hote.endsWith(`.${domaine}`);
  if (est("zoom.us") || est("zoom.com")) return "Zoom";
  if (est("teams.microsoft.com") || est("teams.live.com")) return "Microsoft Teams";
  if (est("meet.google.com")) return "Google Meet";
  return "visioconférence";
}

export interface ModaliteVisio {
  readonly outil: string;
  /** Le lien à remettre, ou `null` quand le champ est vide. */
  readonly lien: string | null;
  /** Dit au stagiaire quand il recevra le lien, s'il ne l'a pas encore. */
  readonly mentionLien: string | null;
}

export function modaliteVisio(lien: string | null): ModaliteVisio {
  const propre = lien === null || lien.trim() === "" ? null : lien.trim();
  return {
    outil: outilVisio(propre),
    lien: propre,
    mentionLien: propre === null ? MENTION_LIEN_ENVOYE_AVANT : null,
  };
}

// ── Numéro de l'accès à l'espace stagiaire ───────────────────────────────────

/**
 * « ACC-1A2B3C4D » — dérivé de l'IDENTIFIANT de l'accès (`portail_acces.id`),
 * jamais du jeton ni de son empreinte : le numéro se lit à voix haute au
 * téléphone, il ne doit rien ouvrir.
 */
export function numeroAcces(accesId: string): string {
  return `ACC-${accesId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
