/**
 * Verrou GEO-137 — une alerte trop longue n'arrivait pas, et une alerte trop
 * longue ne se lit pas (audit GEO/AEO end-to-end du 2026-08-14, lot 8).
 *
 * ## Le défaut mesuré
 *
 * `sendTelegramRaw` postait `text` tel quel. L'API Telegram plafonne
 * `sendMessage.text` à **4096 caractères** : au-delà elle répond 400. L'échec
 * **était** journalisé (`console.warn("[notif:telegram] 400: …")`) — ce n'était
 * donc pas un silence total — mais le contrat fail-soft du canal faisait que
 * l'appelant continuait comme si de rien n'était, et le destinataire ne recevait
 * **rien**. `notify()` rend bien `{ ok, channels }`, mais aucun appelant de
 * production ne lit ce retour : seuls les tests le consultent.
 *
 * ## Pourquoi on tronque, et non plus on découpe
 *
 * La première version envoyait le message en plusieurs morceaux. Essayée en
 * conditions réelles, elle a été rejetée par Will : « inutile de recevoir un
 * message si long dans Telegram, je ne vais pas le lire ».
 *
 * 🔑 Une notification n'est pas un rapport : elle sert à dire **qu'il se passe
 * quelque chose** et **où regarder**. Livrer 6 000 caractères en trois messages
 * ne les rend pas lisibles — ça produit trois notifications ignorées au lieu
 * d'une perte, et ça fait désapprendre à lire les alertes.
 *
 * On garde donc le début du message et on annonce combien de lignes ont été
 * écartées.
 */

import { describe, expect, it } from "vitest";

import { PLAFOND_TELEGRAM, preparerPourTelegram } from "@/server/notifications/channels/telegram";

/** Caractères que MarkdownV2 réserve : un seul non échappé fait refuser le message. */
const SPECIAUX_MARKDOWN_V2 = /[_*[\]()~`>#+\-=|{}.!]/;

function messageDe(nbLignes: number, prefixe = "Item"): string {
  return Array.from({ length: nbLignes }, (_, i) => `${prefixe} ${i}`).join("\n");
}

describe("préparation Telegram — le message arrive (GEO-137)", () => {
  it("un message court n'est pas touché", () => {
    const court = "Alerte : 3 sessions a convoquer";
    expect(preparerPourTelegram(court)).toBe(court);
  });

  it("🔴 un message long passe sous le plafond de l'API", () => {
    const long = messageDe(600, "Ligne de rapport");
    // On vérifie l'hypothèse du test avant de tester : un échantillon qui
    // resterait sous le plafond ne prouverait rien.
    expect(long.length).toBeGreaterThan(PLAFOND_TELEGRAM);

    expect(
      preparerPourTelegram(long).length,
      "le message depasse encore le plafond : l'API le refusera et il n'arrivera pas.",
    ).toBeLessThanOrEqual(PLAFOND_TELEGRAM);
  });

  it("la coupe tombe sur une frontière de LIGNE, jamais au milieu", () => {
    // C'est la propriété qui protège les entités MarkdownV2 : une coupe
    // arbitraire tranche un jour un `*gras*` et Telegram refuse tout.
    const long = Array.from({ length: 400 }, (_, i) => `*Item ${i}* voici du texte`).join("\n");
    const lignes = preparerPourTelegram(long).split("\n");
    // La dernière ligne est la mention de troncature ; les autres sont intactes.
    for (const ligne of lignes.slice(0, -1)) {
      expect(
        /^\*Item \d+\* voici du texte$/.test(ligne),
        `ligne coupee en deux : « ${ligne} » — une entite MarkdownV2 peut etre ` +
          `tranchee, et Telegram refusera le message entier.`,
      ).toBe(true);
    }
  });

  it("le début du message est conservé — c'est là qu'est le titre", () => {
    const long = ["ALERTE IMPORTANTE", "", ...messageDe(600).split("\n")].join("\n");
    expect(preparerPourTelegram(long).startsWith("ALERTE IMPORTANTE")).toBe(true);
  });
});

describe("préparation Telegram — le message reste lisible", () => {
  const LONG = messageDe(600);

  it("🔴 un seul message est produit, pas une rafale", () => {
    // Le cœur de la décision : une notification dit qu'il se passe quelque
    // chose, elle ne transporte pas le rapport.
    expect(typeof preparerPourTelegram(LONG)).toBe("string");
  });

  it("la troncature est ANNONCÉE, avec le nombre de lignes écartées", () => {
    // Sans mention, le lecteur croit avoir tout vu — c'est pire qu'une coupure
    // visible. Le compte permet de juger si ça vaut la peine d'aller voir.
    const derniere = preparerPourTelegram(LONG).split("\n").at(-1) ?? "";
    expect(derniere).toMatch(/^TRONQUE \d+ lignes non affichees voir la console$/);
    const compte = Number(/^TRONQUE (\d+)/.exec(derniere)?.[1] ?? 0);
    expect(compte).toBeGreaterThan(0);
    expect(compte).toBeLessThan(600);
  });

  it("la mention ne contient aucun caractère spécial MarkdownV2", () => {
    // Un seul suffirait à faire refuser le message entier : on perdrait celui
    // qu'on essaie justement de sauver.
    const derniere = preparerPourTelegram(LONG).split("\n").at(-1) ?? "";
    expect(SPECIAUX_MARKDOWN_V2.test(derniere)).toBe(false);
  });

  it("une ligne unique trop longue est coupée net — limite assumée", () => {
    // Aucune frontière sûre n'existe dans ce cas. Le test fige le comportement
    // plutôt que de laisser croire qu'il est résolu : si ce cas apparaît en
    // vrai, c'est le gabarit qu'il faut corriger.
    const uneLigne = "x".repeat(9000);
    const prepare = preparerPourTelegram(uneLigne);
    expect(prepare.length).toBeLessThanOrEqual(PLAFOND_TELEGRAM);
    expect(prepare).toContain("TRONQUE");
  });
});
