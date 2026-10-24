/**
 * Les interrupteurs du questionnaire de pré-audit (2026-10-24) — module PUR.
 *
 *   · `QUESTIONNAIRE_AVANT_AUDIT_ENABLED` : ABSENT = ÉTEINT. Seule la valeur "true" allume.
 *     Éteint : on ne peut ni déposer, ni envoyer, ni recevoir de réponse réelle.
 *   · L'envoi RÉEL exige en plus les deux mentions de la notice RGPD (contact, conservation) :
 *     tant qu'elles sont vides, le bouton « Envoyer » est refusé. L'ESSAI, lui, reste possible
 *     (il n'enregistre rien et n'écrit à personne).
 */

type Env = Readonly<Record<string, string | undefined>>;

export function preauditActif(env: Env = process.env): boolean {
  return env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] === "true";
}

export interface MentionsRgpd {
  readonly contact: string;
  readonly conservation: string;
}

/** Les deux mentions, ou `null` si l'une manque (envoi réel alors refusé). */
export function mentionsRgpd(env: Env = process.env): MentionsRgpd | null {
  const contact = (env["QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT"] ?? "").trim();
  const conservation = (env["QUESTIONNAIRE_PREAUDIT_RGPD_CONSERVATION"] ?? "").trim();
  return contact !== "" && conservation !== "" ? { contact, conservation } : null;
}

export type RefusEnvoi = "eteint" | "notice_rgpd_vide";

/** Pourquoi l'envoi réel est refusé, ou `null` s'il est permis. */
export function refusEnvoiReel(env: Env = process.env): RefusEnvoi | null {
  if (!preauditActif(env)) return "eteint";
  if (mentionsRgpd(env) === null) return "notice_rgpd_vide";
  return null;
}

export const MESSAGE_REFUS: Readonly<Record<RefusEnvoi, string>> = {
  eteint:
    "Le questionnaire de pré-audit est éteint (QUESTIONNAIRE_AVANT_AUDIT_ENABLED). Rien ne peut partir.",
  notice_rgpd_vide:
    "L'envoi est refusé tant que le contact RGPD et la durée de conservation ne sont pas renseignés " +
    "(QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT et QUESTIONNAIRE_PREAUDIT_RGPD_CONSERVATION).",
};
