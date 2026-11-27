// Réseau d'apporteurs : alertes Telegram dans le salon DÉDIÉ « Apporteurs »
// (`TELEGRAM_CHAT_ID_APPORTEURS`, repli Messages puis salon général).
//
// 🔑 FAIL-SOFT : ces fonctions ne lèvent JAMAIS. Une signature ou une contresignature déjà
// actée ne doit pas échouer parce que Telegram est muet.
//
// 🔴 Aucun nom complet ne part : prénom + initiale du nom (règle du dépôt pour Telegram,
// verrouillée par `telegram-sans-donnees-personnelles.spec.ts`), jamais d'e-mail ni de téléphone.
//
// Idempotence : une clé Redis par fait (même horodatage que l'alerte e-mail pour la signature,
// une seule fois par apporteur pour la contresignature), libérée si l'envoi échoue.

import "server-only";

import * as Sentry from "@sentry/nextjs";

import { sendTelegramRaw } from "@/server/notifications/channels/telegram";
import { isDuplicate, libererDedup } from "@/server/notifications/dedup";
import { prenomEtInitiale } from "@/server/notifications/personne";
import { resolveTelegramTarget } from "@/server/notifications/routing";

const CATEGORIE_DEDUP = "apporteurs-telegram";
const TTL_DEDUP_SEC = 7 * 86400;

type Statut = "envoye" | "deja_envoye" | "non_configure" | "echec";

async function alerter(cle: string, texte: string, etape: string): Promise<Statut> {
  let dedupPose = false;
  try {
    const cible = resolveTelegramTarget("apporteurs");
    if (!cible) return "non_configure";
    if (await isDuplicate(CATEGORIE_DEDUP, cle, TTL_DEDUP_SEC)) return "deja_envoye";
    dedupPose = true;
    const ok = await sendTelegramRaw({
      text: texte,
      brut: true,
      silent: false,
      sansApercuLien: true,
      chatId: cible.chatId,
      botToken: cible.botToken,
    });
    if (!ok) {
      await libererDedup(CATEGORIE_DEDUP, cle);
      return signaler(etape, "echec");
    }
    return "envoye";
  } catch {
    if (dedupPose) {
      try {
        await libererDedup(CATEGORIE_DEDUP, cle);
      } catch {
        // La clé expirera d'elle-même.
      }
    }
    return signaler(etape, "echec");
  }
}

/** Journal et Sentry SANS donnée personnelle : l'étape et le résultat seulement. */
function signaler(etape: string, resultat: Statut): Statut {
  console.warn(`[apporteur-dossier] alerte Telegram « ${etape} » non partie`);
  try {
    Sentry.captureMessage("apporteur-dossier : alerte Telegram non envoyée", {
      level: "warning",
      tags: { service: "apporteur-dossier", etape, resultat },
    });
  } catch {
    // Sentry muet : rien d'autre à faire.
  }
  return resultat;
}

/** Signature de l'apporteur. `cleSignature` = la clé d'idempotence de l'alerte e-mail. */
export function alerterSignatureApporteur(e: {
  cleSignature: string;
  prenom: string;
  nom: string;
  lienConsole: string;
}): Promise<Statut> {
  const qui = prenomEtInitiale(e.prenom, e.nom);
  return alerter(
    e.cleSignature,
    `✍️ Un apporteur a signé son contrat : ${qui}. À vérifier puis contresigner : ${e.lienConsole}`,
    "signature",
  );
}

/** Contresignature par Axion réussie. Une seule alerte par apporteur. */
export function alerterContresignature(e: {
  apporteurId: string;
  prenom: string;
  nom: string;
  /** Résultat de l'envoi de l'e-mail au contrat (« envoye » si parti). */
  envoi: string;
}): Promise<Statut> {
  const qui = prenomEtInitiale(e.prenom, e.nom);
  return alerter(
    `contresignature-${e.apporteurId}`,
    e.envoi === "envoye"
      ? `✅ Contrat contresigné : ${qui}, e-mail et pièces jointes envoyés.`
      : `⚠️ Contrat contresigné : ${qui}, mais l'e-mail n'est PAS parti (${e.envoi}). À relancer depuis la console.`,
    "contresignature",
  );
}
