#!/usr/bin/env tsx
/**
 * Envoi d'un message de test Telegram — `pnpm notif:test-telegram`
 *
 * ## Pourquoi ce script existe
 *
 * L'audit GEO/AEO du 2026-08-14 (GEO-137) a montré qu'un message de plus de
 * 4096 caractères était refusé par l'API Telegram et n'arrivait donc jamais
 * chez son destinataire. Le correctif découpe désormais les messages longs.
 *
 * Mais au moment de le vérifier, on s'est aperçu qu'il n'existait **aucun
 * moyen de tester la chaîne de notification** : ni écran dans la console, ni
 * script. On ne pouvait donc pas répondre à la question « est-ce que Telegram
 * marche ? » autrement qu'en attendant une vraie alerte — c'est-à-dire trop
 * tard.
 *
 * Ce script comble ce trou. Il passe par `sendTelegramRaw`, le VRAI point
 * d'entrée : ce qu'il valide est exactement ce que la production exécute.
 *
 * ## Utilisation
 *
 *   pnpm notif:test-telegram          → message court seulement
 *   pnpm notif:test-telegram --long   → court PUIS long (vérifie le découpage)
 *
 * Les variables `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` doivent être
 * disponibles. En production elles viennent de Coolify ; en local, de
 * `.env.local`.
 *
 * ⚠️ Aucun secret n'est affiché : le script dit seulement si la variable est
 * présente et sa longueur.
 */

import { sendTelegramRaw } from "../../src/server/notifications/channels/telegram";

/**
 * MarkdownV2 réserve `_ * [ ] ( ) ~ ` > # + - = | { } . !`.
 * Les messages de ce script n'en contiennent AUCUN : un seul caractère non
 * échappé ferait refuser l'envoi, et on conclurait à tort que la chaîne est
 * cassée alors que c'est le message de test qui l'était.
 */
const HORODATAGE = new Date()
  .toISOString()
  .replace(/[:.TZ-]/g, " ")
  .trim();

const MESSAGE_COURT = [
  "TEST AXION IA",
  "",
  "Ceci est un message de test de la chaine de notification",
  `Envoye le ${HORODATAGE} UTC`,
  "",
  "Si vous lisez ceci, le couple bot et salon fonctionne",
].join("\n");

/** ~6 000 caractères : au-dessus du plafond de 4096, donc découpé en 2 morceaux. */
const MESSAGE_LONG = [
  "TEST AXION IA MESSAGE LONG",
  "",
  "Ce message depasse volontairement le plafond de 4096 caracteres impose par",
  "l API Telegram Avant le correctif GEO 137 il aurait ete refuse et vous",
  "n auriez rien recu du tout Si vous le lisez en plusieurs parties le",
  "decoupage fonctionne",
  "",
  ...Array.from(
    { length: 120 },
    (_, i) => `Ligne de remplissage numero ${i + 1} pour atteindre la taille voulue`,
  ),
].join("\n");

function etatVariable(nom: string): string {
  const v = process.env[nom];
  if (!v || v.trim().length === 0) return `${nom} : ABSENTE`;
  return `${nom} : presente (${v.trim().length} caracteres)`;
}

async function main(): Promise<void> {
  const avecLong = process.argv.includes("--long");

  console.log("[test-telegram] configuration :");
  console.log("  " + etatVariable("TELEGRAM_BOT_TOKEN"));
  console.log("  " + etatVariable("TELEGRAM_CHAT_ID"));

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.error(
      "\n[test-telegram] ARRET : jeton ou salon absent.\n" +
        "  En production, ces valeurs viennent de Coolify.\n" +
        "  En local, renseignez-les dans .env.local puis relancez.\n" +
        "  Ce n est PAS un echec d envoi : c est une absence de configuration.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n[test-telegram] envoi du message court (${MESSAGE_COURT.length} caracteres)...`);
  const okCourt = await sendTelegramRaw({ text: MESSAGE_COURT, timeoutMs: 8000 });
  console.log(okCourt ? "  RECU PAR TELEGRAM : oui" : "  RECU PAR TELEGRAM : NON");

  let okLong = true;
  if (avecLong) {
    console.log(`\n[test-telegram] envoi du message long (${MESSAGE_LONG.length} caracteres)...`);
    console.log("  au-dessus du plafond de 4096 : il doit arriver en plusieurs parties");
    okLong = await sendTelegramRaw({ text: MESSAGE_LONG, timeoutMs: 15000 });
    console.log(okLong ? "  RECU PAR TELEGRAM : oui" : "  RECU PAR TELEGRAM : NON");
  }

  if (okCourt && okLong) {
    console.log("\n[test-telegram] OK — verifiez maintenant votre salon Telegram.");
    console.log("  Le script dit que l API a accepte ; seul votre ecran prouve la livraison.");
  } else {
    console.error(
      "\n[test-telegram] ECHEC — l API Telegram a refuse au moins un envoi.\n" +
        "  Le detail (code HTTP et description) est journalise juste au-dessus par\n" +
        "  le canal lui-meme, prefixe [notif:telegram].\n" +
        "  Causes frequentes : jeton revoque, salon dont le bot n est pas membre.",
    );
    process.exitCode = 1;
  }
}

void main();
