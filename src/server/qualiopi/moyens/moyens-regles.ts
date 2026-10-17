/**
 * 🔴 CHANTIER QNC, LOT L07 — MOYENS (NC7, indicateur 17 ; exigence orale O11).
 *
 * Règles PURES des moyens pédagogiques : aucun accès base, aucune horloge
 * cachée (le « maintenant » est toujours passé par l'appelant, et c'est celui
 * du SERVEUR). Testables sans Prisma ni Next.
 *
 * Ce que ces règles empêchent :
 *   - une modification de moyen SANS motif (≥ 10 caractères, comme le CHECK SQL
 *     `moyens_pedagogiques_historique_motif`) ;
 *   - une date de vérification antérieure à la création de la ligne (on ne
 *     « vérifie » pas un moyen avant qu'il existe) ou postérieure à aujourd'hui ;
 *   - un bloc « Vérification des moyens » daté APRÈS le début de la session :
 *     une preuve écrite après coup n'en est pas une ;
 *   - une formation chez l'entreprise sans trace de ce qu'elle fournit ni de sa
 *     confirmation (O11).
 */

/** Même seuil que les CHECK SQL du socle (`btrim(motif)` ≥ 10). */
export const MOTIF_LONGUEUR_MIN = 10;

/** L'outil de visioconférence décidé : Zoom Pro. */
export const OUTIL_VISIO = "Zoom Pro" as const;

export type Modalite = "presentiel" | "distanciel" | "hybride";
export type CategorieMoyen = "salle" | "materiel" | "plateforme" | "humain";

// ─────────────────────────────────────────────────────────────────────────────
// Motif
// ─────────────────────────────────────────────────────────────────────────────

export type ResultatMotif = { ok: true; motif: string } | { ok: false };

export function validerMotif(motif: string | null | undefined): ResultatMotif {
  const net = (motif ?? "").trim();
  return net.length >= MOTIF_LONGUEUR_MIN ? { ok: true, motif: net } : { ok: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Date de vérification
// ─────────────────────────────────────────────────────────────────────────────

export type ResultatDateVerification =
  { ok: true } | { ok: false; raison: "invalide" | "anterieure_creation" | "future" };

/**
 * Une date de vérification est un JOUR, pas un instant : le formulaire envoie
 * `AAAA-MM-JJ` (minuit UTC). On compare donc en jour civil de Paris — un moyen
 * créé le jour J à 14 h et vérifié « le jour J » est valide, et une
 * vérification datée d'aujourd'hui l'est aussi à la création.
 */
export function validerDateVerification(
  date: Date,
  creeLe: Date,
  maintenant: Date,
): ResultatDateVerification {
  if (Number.isNaN(date.getTime())) return { ok: false, raison: "invalide" };
  const jour = jourParisDe(date);
  if (jour < jourParisDe(creeLe)) return { ok: false, raison: "anterieure_creation" };
  if (jour > jourParisDe(maintenant)) return { ok: false, raison: "future" };
  return { ok: true };
}

/**
 * Même date de vérification au jour civil de Paris (ou toutes deux vides) :
 * renvoyer la date stockée n'est PAS un changement, on ne la revalide pas et
 * elle n'entre pas dans l'historique.
 */
export function memeJourVerification(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return jourParisDe(a) === jourParisDe(b);
}

// ─────────────────────────────────────────────────────────────────────────────
// Avant / après
// ─────────────────────────────────────────────────────────────────────────────

export interface DifferencesMoyen {
  readonly avant: Record<string, unknown>;
  readonly apres: Record<string, unknown>;
  readonly vide: boolean;
}

function memeValeur(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

/** Ne garde que les champs qui changent, avec leur valeur d'avant et d'après. */
export function differencesMoyen(
  avant: Record<string, unknown>,
  apres: Record<string, unknown>,
): DifferencesMoyen {
  const a: Record<string, unknown> = {};
  const b: Record<string, unknown> = {};
  for (const cle of Object.keys(apres)) {
    if (!memeValeur(avant[cle], apres[cle])) {
      a[cle] = avant[cle] ?? null;
      b[cle] = apres[cle];
    }
  }
  return { avant: a, apres: b, vide: Object.keys(b).length === 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Modalité
// ─────────────────────────────────────────────────────────────────────────────

const TOUTES_CATEGORIES: ReadonlyArray<CategorieMoyen> = [
  "salle",
  "materiel",
  "plateforme",
  "humain",
];

/**
 * Les catégories de moyens qui ont un sens pour une modalité : une salle ne
 * sert pas une formation à distance, une plateforme ne sert pas une formation
 * en salle. Le matériel et l'humain valent partout.
 */
export function categoriesPourModalite(modalite: Modalite): ReadonlyArray<CategorieMoyen> {
  if (modalite === "presentiel") return ["salle", "materiel", "humain"];
  if (modalite === "distanciel") return ["plateforme", "materiel", "humain"];
  return TOUTES_CATEGORIES;
}

/** Le lien de visio est obligatoire en distanciel (décision : Zoom Pro). */
export function lienVisioRequis(modalite: Modalite): boolean {
  return modalite === "distanciel";
}

/** Lien Zoom : https, hôte `zoom.us` ou sous-domaine (jamais « contient zoom.us »). */
export function estLienZoom(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" && (u.hostname === "zoom.us" || u.hostname.endsWith(".zoom.us"));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pièces de la session
// ─────────────────────────────────────────────────────────────────────────────

export interface PieceSession {
  readonly id: string;
  readonly type: string;
  readonly creeLe: Date;
}

export interface ChangementSession {
  readonly nature: "modalite" | "lieu";
  readonly creeLe: Date;
}

export interface AlertePiece {
  readonly pieceId: string;
  readonly type: string;
  /** Ce qui a changé depuis l'émission de la pièce. */
  readonly natures: ReadonlyArray<"modalite" | "lieu">;
}

/**
 * Une pièce émise AVANT un changement de modalité ou de lieu porte l'ancienne
 * valeur : un PDF émis est figé. On alerte pour qu'elle soit réémise.
 */
export function alertesPiecesSession(
  pieces: ReadonlyArray<PieceSession>,
  changements: ReadonlyArray<ChangementSession>,
): AlertePiece[] {
  const alertes: AlertePiece[] = [];
  for (const p of pieces) {
    const natures = new Set<"modalite" | "lieu">();
    for (const c of changements) {
      if (c.creeLe.getTime() > p.creeLe.getTime()) natures.add(c.nature);
    }
    if (natures.size > 0) {
      alertes.push({ pieceId: p.id, type: p.type, natures: [...natures].sort() });
    }
  }
  return alertes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc « Vérification des moyens »
// ─────────────────────────────────────────────────────────────────────────────

export const POINTS_VERIFICATION = [
  "salle",
  "wifi",
  "projection",
  "postes",
  "comptes",
  "materielStagiaire",
] as const;

export type PointVerification = (typeof POINTS_VERIFICATION)[number];

export interface BlocVerification {
  readonly salle: boolean;
  readonly wifi: boolean;
  readonly projection: boolean;
  readonly postes: boolean;
  readonly comptes: boolean;
  readonly materielStagiaire: boolean;
  /** Ce que l'entreprise fournit quand la formation a lieu chez elle (O11). */
  readonly fourniParEntreprise?: ReadonlyArray<string>;
  /**
   * Confirmation de l'entreprise : la FONCTION de la personne (jamais son nom)
   * et la date. Texte libre, pas de coordonnée : gardé dans `activity_logs`.
   */
  readonly confirmationEntreprise?: { readonly par: string; readonly le: string };
}

export type ResultatBloc =
  | { ok: true }
  | {
      ok: false;
      raison:
        | "point_manquant"
        | "apres_debut"
        | "fourniture_entreprise_manquante"
        | "confirmation_entreprise_manquante";
    };

export function validerBlocVerification(
  bloc: Partial<Record<PointVerification, unknown>> & {
    fourniParEntreprise?: ReadonlyArray<string>;
    confirmationEntreprise?: { par?: string; le?: string };
  },
  contexte: { debut: Date; maintenant: Date; chezEntreprise: boolean },
): ResultatBloc {
  for (const p of POINTS_VERIFICATION) {
    if (typeof bloc[p] !== "boolean") return { ok: false, raison: "point_manquant" };
  }
  // Strictement AVANT le début : à l'instant du début, la session a commencé.
  if (contexte.maintenant.getTime() >= contexte.debut.getTime()) {
    return { ok: false, raison: "apres_debut" };
  }
  if (contexte.chezEntreprise) {
    const fourni = (bloc.fourniParEntreprise ?? []).filter((x) => x.trim() !== "");
    if (fourni.length === 0) return { ok: false, raison: "fourniture_entreprise_manquante" };
    const c = bloc.confirmationEntreprise;
    if (!c || !(c.par ?? "").trim() || !(c.le ?? "").trim()) {
      return { ok: false, raison: "confirmation_entreprise_manquante" };
    }
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// J-1 (heure de Paris)
// ─────────────────────────────────────────────────────────────────────────────

const FORMAT_JOUR_PARIS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `AAAA-MM-JJ` du jour civil à Paris. */
export function jourParisDe(d: Date): string {
  return FORMAT_JOUR_PARIS.format(d);
}

function jourPrecedent(jour: string): string {
  const [a, m, j] = jour.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(a, m - 1, j - 1));
  return d.toISOString().slice(0, 10);
}

/** Vrai le jour civil (Paris) qui précède celui du début de la session. */
export function testLienDuAujourdhui(dateDebut: Date, maintenant: Date): boolean {
  return jourParisDe(maintenant) === jourPrecedent(jourParisDe(dateDebut));
}
