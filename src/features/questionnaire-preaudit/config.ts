/**
 * Les interrupteurs du questionnaire de pré-audit (2026-10-24) — module PUR.
 *
 *   · `QUESTIONNAIRE_AVANT_AUDIT_ENABLED` : ABSENT = ÉTEINT. Seule la valeur "true" allume.
 *     Éteint : ni envoi, ni page réelle, ni réponse réelle (déposer et ESSAYER restent possibles :
 *     rien n'est enregistré ni envoyé).
 *   · Le réel (envoi, page, réponses) exige en plus les deux mentions de la notice RGPD (contact,
 *     conservation) : tant qu'elles sont vides, tout est refusé, y compris côté prospect.
 *   · Et il exige qu'une PURGE de rétention soit planifiée (`PURGE_PLANIFIEE`) : sans elle, on
 *     collecterait des réponses qu'aucune tâche ne supprime à l'échéance annoncée.
 */

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Passe à `true` dans la PR qui branche `purgerReponsesAnciennes` (`serveur.ts`) sur une tâche
 * planifiée du worker. Le test `la-purge-est-planifiee.spec.ts` le vérifie : `true` sans tâche
 * qui appelle la fonction rougit.
 */
export const PURGE_PLANIFIEE = false;

export function preauditActif(env: Env = process.env): boolean {
  return env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] === "true";
}

export interface MentionsRgpd {
  readonly contact: string;
  readonly conservation: string;
}

/** Les deux mentions, ou `null` si l'une manque (le réel est alors refusé). */
export function mentionsRgpd(env: Env = process.env): MentionsRgpd | null {
  const contact = (env["QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT"] ?? "").trim();
  const conservation = (env["QUESTIONNAIRE_PREAUDIT_RGPD_CONSERVATION"] ?? "").trim();
  return contact !== "" && conservation !== "" ? { contact, conservation } : null;
}

export type RefusEnvoi = "eteint" | "notice_rgpd_vide" | "purge_non_planifiee";

/** Pourquoi le réel (envoi, page, réponses) est refusé, ou `null` s'il est permis. */
export function refusReel(
  env: Env = process.env,
  purgePlanifiee: boolean = PURGE_PLANIFIEE,
): RefusEnvoi | null {
  if (!preauditActif(env)) return "eteint";
  if (mentionsRgpd(env) === null) return "notice_rgpd_vide";
  if (!purgePlanifiee) return "purge_non_planifiee";
  return null;
}

/** Alias historique : l'envoi suit la même règle que la page et les réponses. */
export const refusEnvoiReel = refusReel;

export const MESSAGE_REFUS: Readonly<Record<RefusEnvoi, string>> = {
  eteint:
    "Le questionnaire de pré-audit est éteint (QUESTIONNAIRE_AVANT_AUDIT_ENABLED). Rien ne peut partir.",
  notice_rgpd_vide:
    "L'envoi est refusé tant que le contact RGPD et la durée de conservation ne sont pas renseignés " +
    "(QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT et QUESTIONNAIRE_PREAUDIT_RGPD_CONSERVATION).",
  purge_non_planifiee:
    "L'envoi est refusé tant que la purge de conservation des réponses n'est pas planifiée " +
    "(sans elle, les réponses resteraient au-delà de la durée annoncée).",
};
