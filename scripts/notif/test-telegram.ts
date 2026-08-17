#!/usr/bin/env tsx
/**
 * Test de la chaîne de notification Telegram — `pnpm notif:test-telegram`
 *
 * ## Pourquoi ce script existe
 *
 * L'audit GEO/AEO du 2026-08-14 (GEO-137) a montré qu'un message de plus de
 * 4096 caractères était refusé par l'API Telegram et n'arrivait donc jamais chez
 * son destinataire. Le correctif découpe désormais les messages longs.
 *
 * Mais au moment de le vérifier, on s'est aperçu qu'il n'existait **aucun moyen
 * de tester la chaîne** : ni écran dans la console, ni script, ni route. On ne
 * pouvait donc répondre à « est-ce que Telegram marche ? » qu'en attendant une
 * vraie alerte — c'est-à-dire trop tard, et sans jamais distinguer une panne
 * d'une absence d'événement.
 *
 * ## Ce qu'il teste vraiment
 *
 * Il passe par `resolveTelegramTarget()` puis `sendTelegramRaw()` — le VRAI
 * chemin de production, routage compris. Il ne simule rien, et il rend visibles
 * les REPLIS : un groupe sans salon dédié reçoit quand même ses alertes, mêlées
 * à un autre salon, et c'est le genre de chose qu'on découvre autrement le jour
 * où on cherche une alerte dans le mauvais fil.
 *
 * ## Utilisation
 *
 *   pnpm notif:test-telegram                     → diagnostic seul, aucun envoi
 *   pnpm notif:test-telegram --groupe=system     → envoie dans un groupe
 *   pnpm notif:test-telegram --groupe=system --long
 *                                                → ajoute un message de ~6 000
 *                                                  caractères (teste le découpage)
 *   pnpm notif:test-telegram --tous              → envoie dans les 11 groupes
 *
 * ⚠️ Aucun secret n'est affiché : le script dit seulement si une variable est
 * présente, et sa longueur.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { sendTelegramRaw } from "../../src/server/notifications/channels/telegram";
import { resolveTelegramTarget } from "../../src/server/notifications/routing";

type TelegramGroup = Parameters<typeof resolveTelegramTarget>[0];

/**
 * Charge `.env.local` dans `process.env`.
 *
 * Convention du dépôt : AUCUNE dépendance `dotenv`, chaque script lit le fichier
 * lui-même (cf. `scripts/curate-sites-web-unsplash.mjs`).
 *
 * 🔴 Indispensable, et voici pourquoi : `tsx` n'applique pas le chargement
 * d'environnement de Next. Sans cet appel, le script annonce « aucune cible »
 * sur une configuration parfaitement valide — et on part chercher une panne là
 * où il n'y en a pas. C'est exactement ce qui s'est produit au premier essai.
 *
 * Les variables déjà présentes dans l'environnement GAGNENT : en production, ce
 * sont celles de Coolify qui doivent primer, jamais un fichier local oublié.
 *
 * L'appel est fait au début de `main()` et non au chargement du module : le
 * routage lit l'environnement à l'APPEL (`envValue()` est dans la fonction), il
 * n'y a donc aucune course avec les imports.
 */
function chargerEnvLocal(): void {
  for (const fichier of [".env.local", ".env"]) {
    let texte: string;
    try {
      texte = readFileSync(path.join(process.cwd(), fichier), "utf8");
    } catch {
      continue; // fichier absent : normal en production
    }
    for (const ligne of texte.split("\n")) {
      const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(ligne.trim());
      const cle = m?.[1];
      if (!cle || process.env[cle]) continue;
      const valeur = (m?.[2] ?? "").trim().replace(/^["']|["']$/g, "");
      if (valeur) process.env[cle] = valeur;
    }
  }
}

/** Les 11 groupes déclarés par le routage. Ordre stable pour un rapport lisible. */
const GROUPES: readonly TelegramGroup[] = [
  "system",
  "messages",
  "avis",
  "calendly",
  "candidatures",
  "monteur-video",
  "commercial-memo",
  "presse",
  "investisseurs",
  "interventions",
  "crm-sync",
];

/**
 * MarkdownV2 réserve `_ * [ ] ( ) ~ ` > # + - = | { } . !`.
 * Les messages ci-dessous n'en contiennent AUCUN : un seul caractère non échappé
 * ferait refuser l'envoi, et on conclurait à tort que la chaîne est cassée alors
 * que c'est le message de test qui l'était.
 */
const HORODATAGE = new Date()
  .toISOString()
  .replace(/[:.TZ-]/g, " ")
  .trim();

function messageCourt(groupe: TelegramGroup): string {
  return [
    "TEST AXION IA",
    "",
    `Groupe cible : ${groupe.replace(/-/g, " ")}`,
    `Envoye le ${HORODATAGE} UTC`,
    "",
    "Si vous lisez ceci, le couple bot et salon fonctionne",
  ].join("\n");
}

/** ~6 000 caractères : au-dessus du plafond de 4096, donc découpé. */
const MESSAGE_LONG = [
  "TEST AXION IA MESSAGE LONG",
  "",
  "Ce message depasse volontairement le plafond de 4096 caracteres impose par",
  "l API Telegram Avant le correctif il aurait ete refuse et vous n auriez rien",
  "recu du tout Si vous le lisez en plusieurs parties le decoupage fonctionne",
  "",
  ...Array.from(
    { length: 120 },
    (_, i) => `Ligne de remplissage numero ${i + 1} pour atteindre la taille voulue`,
  ),
].join("\n");

function argValeur(prefixe: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(prefixe));
  return arg ? arg.slice(prefixe.length) : undefined;
}

/** Rapport de configuration, sans jamais révéler une valeur. */
function diagnostic(): { surRepli: TelegramGroup[]; sansCible: TelegramGroup[] } {
  const jeton = process.env["TELEGRAM_BOT_TOKEN"]?.trim();
  console.log(
    "[test-telegram] jeton principal :",
    jeton ? `present (${jeton.length} caracteres)` : "ABSENT",
  );

  const surRepli: TelegramGroup[] = [];
  const sansCible: TelegramGroup[] = [];
  console.log("\n[test-telegram] routage des 11 groupes :");
  for (const groupe of GROUPES) {
    const cible = resolveTelegramTarget(groupe);
    if (!cible) {
      sansCible.push(groupe);
      console.log(`  ${groupe.padEnd(17)} AUCUNE CIBLE — les alertes sont perdues`);
    } else if (cible.dedicated) {
      console.log(`  ${groupe.padEnd(17)} salon dedie`);
    } else {
      surRepli.push(groupe);
      console.log(`  ${groupe.padEnd(17)} REPLI — pas de salon dedie, melange ailleurs`);
    }
  }
  return { surRepli, sansCible };
}

async function envoyer(groupe: TelegramGroup, avecLong: boolean): Promise<boolean> {
  const cible = resolveTelegramTarget(groupe);
  if (!cible) {
    console.error(`  ${groupe.padEnd(17)} AUCUNE CIBLE, rien envoye`);
    return false;
  }
  const court = await sendTelegramRaw({
    text: messageCourt(groupe),
    chatId: cible.chatId,
    botToken: cible.botToken,
    timeoutMs: 8000,
  });
  console.log(`  ${groupe.padEnd(17)} court : ${court ? "accepte" : "REFUSE"}`);
  if (!avecLong) return court;

  const long = await sendTelegramRaw({
    text: MESSAGE_LONG,
    chatId: cible.chatId,
    botToken: cible.botToken,
    timeoutMs: 15000,
  });
  console.log(`  ${groupe.padEnd(17)} long  : ${long ? "accepte" : "REFUSE"}`);
  return court && long;
}

async function main(): Promise<void> {
  chargerEnvLocal();

  const { surRepli, sansCible } = diagnostic();

  if (surRepli.length > 0) {
    console.log(`\n[test-telegram] sans salon dedie : ${surRepli.join(", ")}`);
    console.log("  Leurs alertes arrivent quand meme, melangees a un autre salon.");
  }
  if (sansCible.length > 0) {
    console.log(`\n[test-telegram] SANS AUCUNE CIBLE : ${sansCible.join(", ")}`);
    console.log("  Ces alertes ne partent nulle part.");
  }

  const groupeDemande = argValeur("--groupe=");
  const tous = process.argv.includes("--tous");
  const avecLong = process.argv.includes("--long");

  if (!groupeDemande && !tous) {
    console.log("\n[test-telegram] diagnostic seul, AUCUN message envoye.");
    console.log("  Ajoutez --groupe=system (ou --tous) pour envoyer reellement.");
    return;
  }

  if (!process.env["TELEGRAM_BOT_TOKEN"]?.trim()) {
    console.error("\n[test-telegram] ARRET : jeton absent, aucun envoi possible.");
    console.error("  Ce n est PAS un echec d envoi, c est une absence de configuration.");
    process.exitCode = 1;
    return;
  }

  const cibles: readonly TelegramGroup[] = tous ? GROUPES : [groupeDemande as TelegramGroup];
  for (const g of cibles) {
    if (!GROUPES.includes(g)) {
      console.error(`\n[test-telegram] groupe inconnu : ${g}`);
      console.error(`  Groupes valides : ${GROUPES.join(", ")}`);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`\n[test-telegram] envoi vers ${cibles.length} groupe(s)...`);
  let toutOk = true;
  for (const g of cibles) {
    if (!(await envoyer(g, avecLong))) toutOk = false;
  }

  if (toutOk) {
    console.log("\n[test-telegram] OK — verifiez maintenant vos salons Telegram.");
    console.log("  Le script dit ce que l API a ACCEPTE ; seul votre ecran prouve la livraison.");
  } else {
    console.error("\n[test-telegram] ECHEC sur au moins un envoi.");
    console.error("  Le detail (code HTTP et description) est journalise ci-dessus,");
    console.error("  prefixe [notif:telegram]. Causes frequentes : jeton revoque,");
    console.error("  ou salon dont le bot n est pas membre.");
    process.exitCode = 1;
  }
}

void main();
