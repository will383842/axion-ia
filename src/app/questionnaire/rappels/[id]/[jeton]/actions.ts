/**
 * « Ne plus recevoir de rappel » — le POST de la page publique (2026-10-26).
 *
 * Seul ce POST écrit (le GET n'écrit rien : les antivirus d'entreprise ouvrent les liens) :
 * jeton d'ARRÊT vérifié (domaine HMAC propre, le jeton du questionnaire ne marche pas ici),
 * débit limité par IP hachée, puis `arreterRelances(…, "desinscription")`, idempotent.
 * `essai=1` (lien d'un e-mail d'essai de Will) : la même réponse, RIEN n'est écrit.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { redirect } from "next/navigation";

import { arreterRelances } from "@/features/questionnaire-preaudit/suivi-console";
import { getClientIp } from "@/lib/client-ip";
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { jetonArretRelancesPreauditValide } from "@/server/visio/questionnaire-en-ligne/jeton";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const JETON = /^[A-Za-z0-9_-]{43}$/;

/** 10 clics par quart d'heure et par IP. Panne de Redis : laisser passer (le jeton garde). */
const LIMITE: RateLimitConfig = { limit: 10, windowSec: 900, surPanne: "laisser-passer" };

async function cleDeDebit(): Promise<string> {
  try {
    return `preaudit-arret:${hashIp(await getClientIp()) ?? "sans-ip"}`;
  } catch {
    return "preaudit-arret:sans-sel";
  }
}

export async function arreterRappelsAction(fd: FormData): Promise<never> {
  const id = String(fd.get("questionnaireId") ?? "").toLowerCase();
  const jeton = String(fd.get("jeton") ?? "");
  const essai = fd.get("essai") === "1";
  // Le chemin de retour ne reprend que des valeurs de forme vérifiée (pas de redirection ouverte).
  if (!UUID.test(id) || !JETON.test(jeton)) redirect("/questionnaire/rappels/lien/invalide");
  const chemin = `/questionnaire/rappels/${id}/${jeton}`;
  const suffixeEssai = essai ? "&essai=1" : "";

  const debit = await checkRateLimit(await cleDeDebit(), LIMITE);
  if (!debit.allowed) redirect(`${chemin}?erreur=trop${suffixeEssai}`);
  if (!jetonArretRelancesPreauditValide(id, jeton))
    redirect("/questionnaire/rappels/lien/invalide");

  if (!essai) {
    try {
      await arreterRelances(id, "desinscription");
    } catch {
      redirect(`${chemin}?erreur=panne`);
    }
  }
  redirect(`${chemin}?fait=1${suffixeEssai}`);
}
