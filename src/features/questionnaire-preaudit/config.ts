/**
 * Les interrupteurs et la conservation du questionnaire de pré-audit — module PUR.
 *
 *   · `QUESTIONNAIRE_AVANT_AUDIT_ENABLED` : ABSENT = ÉTEINT. Seule la valeur "true" allume.
 *     Éteint : ni envoi, ni page réelle, ni réponse réelle (déposer et ESSAYER restent possibles :
 *     rien n'est enregistré ni envoyé). Allumé : le réel est permis, rien d'autre n'est exigé.
 *   · CONSERVATION (décision de Will, 25/10/2026) : 5 ANS à compter de la réception, et JAMAIS de
 *     suppression automatique. Réponses, envois et brouillons ne sont supprimés qu'à la main, par
 *     Will (demande de la personne, ou échéance signalée par la console). Aucune purge planifiée,
 *     aucune fonction de purge : la garde `garde-structure.spec.ts` rougit si l'une revient.
 *     Remplace l'ancien verrou de purge (qui refusait tout le réel faute de purge planifiée).
 */

type Env = Readonly<Record<string, string | undefined>>;

/** Durée de conservation des réponses, en années (décision de Will, 25/10/2026). */
export const RETENTION_ANS = 5;

/** Contact RGPD par défaut : celui des mentions légales (`LEGAL_IDENTITY_DEFAULTS.dpoContact`). */
export const CONTACT_RGPD_DEFAUT = "contact@axion-ia.com";

/** La phrase « Combien de temps » de la notice (lue après « Combien de temps : »). */
export const TEXTE_CONSERVATION =
  `${RETENTION_ANS} ans, puis supprimées par notre équipe ; vous pouvez demander leur ` +
  "suppression à tout moment";

/** L'échéance de conservation d'une réponse reçue le `recuLe` (même jour, `RETENTION_ANS` plus tard). */
export function echeanceConservation(recuLe: Date): Date {
  const d = new Date(recuLe.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + RETENTION_ANS);
  return d;
}

/** L'échéance est-elle dépassée ? (rappel à Will, jamais une suppression) */
export function conservationEchue(recuLe: Date, maintenant: Date = new Date()): boolean {
  return echeanceConservation(recuLe).getTime() <= maintenant.getTime();
}

export function preauditActif(env: Env = process.env): boolean {
  return env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] === "true";
}

export interface MentionsRgpd {
  readonly contact: string;
  readonly conservation: string;
}

/** Les deux mentions de la notice : contact (variable ou défaut) et conservation (5 ans). */
export function mentionsRgpd(env: Env = process.env): MentionsRgpd {
  const contact = (env["QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT"] ?? "").trim();
  return {
    contact: contact !== "" ? contact : CONTACT_RGPD_DEFAUT,
    conservation: TEXTE_CONSERVATION,
  };
}

export type RefusEnvoi = "eteint";

/** Pourquoi le réel (envoi, page, réponses) est refusé, ou `null` s'il est permis. */
export function refusReel(env: Env = process.env): RefusEnvoi | null {
  return preauditActif(env) ? null : "eteint";
}

/** Alias historique : l'envoi suit la même règle que la page et les réponses. */
export const refusEnvoiReel = refusReel;

export const MESSAGE_REFUS: Readonly<Record<RefusEnvoi, string>> = {
  eteint: "L'envoi des questionnaires avant audit est suspendu. Rien n'est parti.",
};
