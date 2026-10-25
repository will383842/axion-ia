/**
 * Les trois interrupteurs du suivi du questionnaire avant audit (2026-10-26) — module PUR.
 * Lus par le WORKER (balayage `visio-balayage`, section « questionnaires »).
 *
 *   · `QUESTIONNAIRE_RELANCES_ENABLED`      : les 3 relances (J+2, J+5, J+10) ;
 *   · `QUESTIONNAIRE_CONFIRMATIONS_ENABLED` : la confirmation à chaque personne qui répond ;
 *   · `QUESTIONNAIRE_TELEGRAM_ENABLED`      : les messages du salon « Questionnaire audit ».
 *
 * ABSENT = ÉTEINT. Seule la valeur exacte "true" allume ; "essai" calcule et journalise des
 * NOMBRES sans rien écrire ni envoyer ; tout le reste ("false", vide, "TRUE"…) éteint. Tous restent
 * soumis en plus à `refusReel()` (`QUESTIONNAIRE_AVANT_AUDIT_ENABLED`).
 */

type Env = Readonly<Record<string, string | undefined>>;

export type ModeSuivi = "actif" | "essai" | "eteint";

function mode(valeur: string | undefined): ModeSuivi {
  if (valeur === "true") return "actif";
  if (valeur === "essai") return "essai";
  return "eteint";
}

export const modeRelances = (env: Env = process.env): ModeSuivi =>
  mode(env["QUESTIONNAIRE_RELANCES_ENABLED"]);

export const modeConfirmations = (env: Env = process.env): ModeSuivi =>
  mode(env["QUESTIONNAIRE_CONFIRMATIONS_ENABLED"]);

export const modeTelegram = (env: Env = process.env): ModeSuivi =>
  mode(env["QUESTIONNAIRE_TELEGRAM_ENABLED"]);

/** Ce que Will lit sur l'état des relances : jamais un nom de variable. PUR. */
export const ETAT_RELANCES_LISIBLE: Readonly<Record<ModeSuivi, string>> = {
  actif: "Rappels actifs : ils partiront aux dates prévues.",
  essai: "Rappels en test : ils sont comptés, mais aucun ne part.",
  eteint: "Rappels suspendus pour le moment : aucun ne partira tant qu'ils ne sont pas réactivés.",
};

/** L'adresse qui reçoit les essais (« M'envoyer un essai »), jamais une adresse du code. */
export function adresseEssai(env: Env = process.env): string | null {
  const v = (env["QUESTIONNAIRE_PREAUDIT_ADRESSE_ESSAI"] ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}
