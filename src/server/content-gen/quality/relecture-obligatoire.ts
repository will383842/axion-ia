/**
 * C2 / C2c — « Arrêter la publication faible » (docs/pilotage-seo-geo/CONCEPTION-CHAINE-EDITORIALE-IA.md § 12).
 *
 * Module PUR (aucun import Prisma/BullMQ). Une seule définition de la règle,
 * lue par le worker de génération, la boucle qualité, le worker de publication,
 * l'orchestrateur et le script des pages villes.
 *
 * Décision de Will : qualité avant volume. Un contenu généré n'est plus publié sans
 * relecture humaine. On n'accélère que si Google et les IA suivent (§ 5, passage à
 * l'automatique par type, éteint tant que la chaîne n'est pas livrée).
 *
 * ── Pourquoi une autorisation EXPLICITE et pas seulement un défaut à faux ──
 * Les interrupteurs `factoryAutoPublishAllBlogTypes` et `newsAutoPublish` valaient
 * « vrai » par défaut et la configuration `policies` enregistrée en base peut déjà
 * contenir « vrai » : changer le défaut du code ne l'arrêterait pas. L'arrêt passe donc
 * par un réglage de plus, `publicationSansRelectureAutorisee`, ABSENT = non autorisé.
 * Pour rétablir l'ancien comportement : cocher la case dans la console
 * (Contenu → Règles de publication) ; les deux interrupteurs historiques redeviennent alors
 * effectifs, tels qu'ils sont enregistrés. Rien n'est supprimé ni désindexé.
 */

import { ARTICLES_MAX_JOUR_DEFAUT } from "../scheduler/anti-burst";

/** Sous-ensemble de `policies` (clé ContentGenConfig) utile à la décision. */
export interface PolitiquesRelecture {
  readonly factoryAutoPublishAllBlogTypes?: boolean;
  readonly newsAutoPublish?: boolean;
  /** Réglage C2 : sans lui à `true`, aucun contenu généré ne se publie sans relecture. */
  readonly publicationSansRelectureAutorisee?: boolean;
}

/** Plafond du jour hérité (même valeur que `DEFAULT_DAILY_GENERATION_CAP`, sans import circulaire). */
const PLAFOND_HERITE_DEFAUT = 20;

export function sansRelectureAutorisee(p: PolitiquesRelecture | null | undefined): boolean {
  return p?.publicationSansRelectureAutorisee === true;
}

export function relectureObligatoire(p: PolitiquesRelecture | null | undefined): boolean {
  return !sansRelectureAutorisee(p);
}

/** Blog (tous types hors actualités RSS) : auto-publication seulement si autorisée ET activée. */
export function autoPublicationBlogActive(p: PolitiquesRelecture | null | undefined): boolean {
  return sansRelectureAutorisee(p) && p?.factoryAutoPublishAllBlogTypes === true;
}

/** Actualités RSS : idem. */
export function autoPublicationNewsActive(p: PolitiquesRelecture | null | undefined): boolean {
  return sansRelectureAutorisee(p) && p?.newsAutoPublish === true;
}

/**
 * Tier d'un contenu à sa publication. Une approbation humaine (`reviewedBy` posé par la
 * console) reste un feu vert délibéré : indexable. Un contenu jamais relu ne naît plus
 * indexable (il reste en ligne, `noindex,follow`, et le cycle de vie le promeut selon ses
 * résultats). En pratique, tant que la relecture est obligatoire, un contenu non relu
 * n'arrive même pas jusque-là (filet du worker de publication).
 */
export function tierNaissancePublication(input: {
  readonly reviewedBy: string | null | undefined;
}): "tier_1_indexable" | "tier_2_noindex_follow" {
  return typeof input.reviewedBy === "string" && input.reviewedBy.trim().length > 0
    ? "tier_1_indexable"
    : "tier_2_noindex_follow";
}

/**
 * Plafond de génération du jour. Relecture obligatoire : au plus `ARTICLES_MAX_JOUR_DEFAUT`
 * (3), sinon la file de relecture sature. Ne relève jamais un plafond déjà plus bas.
 * Retour arrière : plafond d'avant (clé stockée, sinon 20).
 */
export function plafondGenerationEffectif(
  cap: { readonly maxPerDay?: number } | null | undefined,
  politiques: PolitiquesRelecture | null | undefined,
): number {
  const brut = cap?.maxPerDay;
  const herite =
    typeof brut === "number" && Number.isFinite(brut) && brut > 0 ? brut : PLAFOND_HERITE_DEFAUT;
  return relectureObligatoire(politiques) ? Math.min(herite, ARTICLES_MAX_JOUR_DEFAUT) : herite;
}

/**
 * C2c — pages villes gabaritées (`ville-hub-copy`). Une copie générée reste « generated »
 * (page non rendue ; la validation passe par une mise à jour manuelle du statut en base, aucune action console n'existe encore) ; l'auto-approbation sur la note
 * n'a lieu que si `VILLES_AUTO_APPROBATION_ACTIVE=true` (retour arrière, sans déploiement).
 */
export function statutPageVilleApresGeneration(input: {
  readonly qualityScore: number;
  readonly seuil: number;
  readonly env: Readonly<Record<string, string | undefined>>;
}): "generated" | "approved" {
  if (input.env.VILLES_AUTO_APPROBATION_ACTIVE !== "true") return "generated";
  return input.qualityScore >= input.seuil ? "approved" : "generated";
}
