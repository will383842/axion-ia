/**
 * Contrat du `details` JSON écrit par le simulateur de gains.
 *
 * ── Pourquoi ce fichier existe ────────────────────────────────────────────
 * `Submission.details` est un JSON libre : Prisma ne le type pas et Postgres
 * ne le contraint pas. L'écriture (`src/features/roi-report/actions.ts`) et la
 * lecture (export CSV de la console) désignaient donc les mêmes clés par deux
 * chaînes de caractères indépendantes. Renommer `savedEurPerYear` côté
 * écriture aurait vidé la colonne « gain estimé » de l'export SANS erreur, ni
 * au build, ni à l'exécution — la colonne serait simplement restée blanche.
 *
 * C'est exactement la forme de panne qui a rendu l'export RGPD muet pendant
 * des mois (cf. `src/lib/security/email-hash.ts`). On ne la reproduit pas :
 * les deux côtés partagent désormais ce type, et tout renommage devient une
 * erreur de `pnpm typecheck`.
 */

import type { DigitalMaturity } from "@/content/roi/model/types";

/** Ce que le simulateur dépose dans `Submission.details`. */
export type RoiSubmissionDetails = {
  /**
   * Discriminant lu par la console pour distinguer ce lead d'un message de
   * contact ordinaire — `Submission.type` ne connaît que 5 valeurs d'enum.
   */
  unifiedType: "simulateur_roi";
  consentVersion: string;
  /**
   * Diagnostic encodé : permet de rejouer EXACTEMENT le rapport vu par le
   * prospect, sans lui redemander ce qu'il vient de saisir.
   */
  diagnostic: string;
  reportUrl: string;
  maturity: DigitalMaturity;
  /**
   * Agrégats dupliqués depuis le rapport pour rester exploitables (tri,
   * export, priorisation des rappels) sans re-décoder le diagnostic.
   */
  savedHoursPerYear: number;
  savedEurPerYear: number;
  fteRecovered: number;
  topTaskIds: readonly string[];
  /** Posé uniquement en cas d'échec Turnstile — absent sinon. */
  turnstilePassed?: false;
  /** Attribution publicitaire (UTM + ville du référent), absente si vide. */
  funnel?: object;
};

/**
 * Clés lues par l'export CSV de la console.
 *
 * 🔴 `satisfies Record<string, keyof RoiSubmissionDetails>` est le verrou :
 * une clé renommée dans le type ci-dessus rend ce bloc invalide, donc le
 * typecheck rouge. Ne pas remplacer par des littéraux en ligne.
 */
export const ROI_DETAILS_KEYS = {
  gain: "savedEurPerYear",
  heures: "savedHoursPerYear",
  maturite: "maturity",
  rapport: "reportUrl",
  categorie: "unifiedType",
  funnel: "funnel",
} as const satisfies Record<string, keyof RoiSubmissionDetails>;
