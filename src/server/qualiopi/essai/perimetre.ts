/**
 * 🔴 CHANTIER QNC, LOT L02 — LE MODE ESSAI : CE QUI EST RÉEL, CE QUI NE L'EST PAS.
 *
 * Une session d'ESSAI (`TrainingSession.estTestInterne`, ADR 0061, colonne du
 * socle L00) se joue dans la vraie console, de bout en bout, pour vérifier une
 * chaîne avant de la confier à un vrai stagiaire. Elle ne doit JAMAIS :
 *   - compter : BPF, pilotage, voyants de conformité, taux publics, chiffre
 *     d'affaires, marges, prévisionnel ;
 *   - sortir : facture électronique, facture automatique, commission
 *     d'apporteur, autofacture, Axion Partners, alertes, e-mails hors liste
 *     blanche (cf. `sorties.ts`, `liste-blanche.ts`).
 *
 * Ce module est la SEULE définition de « réel ». Les filtres se posent par
 * étalement (`where: { ...SESSION_REELLE, … }`), jamais le littéral retapé :
 * deux formulations de la même règle divergent au premier amendement.
 *
 * Une inscription est d'essai si ELLE porte le drapeau OU si sa session le
 * porte : une inscription réelle sur une session d'essai reste un essai.
 *
 * ⚠️ Ces filtres ne dépendent PAS de l'interrupteur `qualiopi.essai.actif`.
 * L'interrupteur décide si l'on peut CRÉER un essai ; une fois créé, un essai
 * reste écarté des chiffres et des sorties quel que soit l'interrupteur. Tant
 * qu'aucune ligne ne porte le drapeau (défaut `false`), ils ne retirent rien.
 *
 * L'essai reste VISIBLE : listes de sessions, fiche, mode auditeur (marqué).
 * Aucune purge.
 *
 * Module neutre (aucun client Prisma) : le worker et les pages l'importent.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import { HORS_RENCONTRES_DE_TEST } from "@/features/dossier-client/client-test";
import { SEGMENT_ESSAI, estNumeroEssai } from "./numerotation";

/** Le lot du chantier : interrupteur `qualiopi.essai.actif`. */
export const LOT_ESSAI = "essai" as const;

/**
 * Le drapeau « hors test interne ». Son littéral a UNE source dans le dépôt
 * (`client-test.ts`, ADR 0061 ; garde
 * `une-rencontre-de-test-n-apparait-dans-aucune-synthese.spec.ts`) : sessions,
 * inscriptions et rencontres portent la même colonne, avec le même sens.
 */
export const HORS_ESSAI = HORS_RENCONTRES_DE_TEST;

/** Filtre `TrainingSession` : les seules sessions réelles. */
export const SESSION_REELLE = HORS_ESSAI;

/**
 * Filtre `Enrollment` : les seules inscriptions réelles, session comprise.
 *
 * ⚠️ Il porte la clé `session` : l'étaler À CÔTÉ d'un autre filtre `session`
 * écraserait l'un ou l'autre. Dans ce cas, étaler `HORS_ESSAI` sur l'inscription
 * et `SESSION_REELLE` DANS le filtre de session existant.
 */
export const INSCRIPTION_REELLE = {
  ...HORS_ESSAI,
  session: SESSION_REELLE,
} as const;

/**
 * Filtre `FactureFormation` : écarte les factures d'une session ou d'une
 * inscription d'essai, et toute pièce numérotée hors suite (`-ESSAI-`) — ce
 * qui couvre l'AVOIR d'une facture d'essai, qui ne porte pas de session. Une
 * facture sans session (coaching, facture libre) reste réelle. `NOT` + `is` :
 * une relation absente ne correspond pas, donc elle n'est pas écartée.
 *
 * ⚠️ Il porte la clé `NOT` : ne pas l'étaler à côté d'un autre `NOT`.
 */
export const FACTURE_HORS_ESSAI: Prisma.FactureFormationWhereInput = {
  NOT: [
    { session: { is: { estTestInterne: true } } },
    { enrollment: { is: { estTestInterne: true } } },
    { numero: { contains: SEGMENT_ESSAI } },
  ],
};

/**
 * Filtre d'un modèle qui porte une relation FACULTATIVE `session`
 * (`DocumentGenere`, `Incident`…) : écarte ce qui est rattaché à une session
 * d'essai, garde ce qui n'est rattaché à aucune session.
 *
 * ⚠️ Il porte la clé `NOT` : ne pas l'étaler à côté d'un autre `NOT`.
 */
export const HORS_SESSION_D_ESSAI = {
  NOT: { session: { is: { estTestInterne: true } } },
} as const;

/** Drapeaux lus pour juger une session. */
export interface SessionDrapeau {
  readonly estTestInterne?: boolean;
}

/** Drapeaux lus pour juger une inscription (session facultative). */
export interface InscriptionDrapeau {
  readonly estTestInterne?: boolean;
  readonly session?: SessionDrapeau | null;
}

/** Drapeaux lus pour juger une facture. */
export interface FactureDrapeau {
  readonly numero?: string | null;
  readonly session?: SessionDrapeau | null;
  readonly enrollment?: InscriptionDrapeau | null;
}

/** PURE — la session compte-t-elle et peut-elle sortir ? */
export function estSessionReelle(s: SessionDrapeau | null | undefined): boolean {
  return s?.estTestInterne !== true;
}

/** PURE — l'inscription est-elle réelle (elle ET sa session) ? */
export function estInscriptionReelle(e: InscriptionDrapeau | null | undefined): boolean {
  if (e == null) return true;
  return e.estTestInterne !== true && estSessionReelle(e.session);
}

/** PURE — la facture est-elle réelle (ni sa session ni son inscription ne sont d'essai) ? */
export function estFactureReelle(f: FactureDrapeau | null | undefined): boolean {
  if (f == null) return true;
  return (
    !estNumeroEssai(f.numero) && estSessionReelle(f.session) && estInscriptionReelle(f.enrollment)
  );
}

/** Sélection Prisma minimale d'une facture pour `estFactureReelle`. */
export const SELECTION_DRAPEAU_FACTURE = {
  numero: true,
  session: { select: { estTestInterne: true } },
  enrollment: {
    select: { estTestInterne: true, session: { select: { estTestInterne: true } } },
  },
} as const;
