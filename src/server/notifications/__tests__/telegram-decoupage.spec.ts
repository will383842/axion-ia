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
 * ## Deux corrections successives, guidées par l'usage réel
 *
 * 1. **Découper** le message en morceaux : il arrivait enfin — mais en trois
 *    notifications. Rejeté après essai en conditions réelles : « inutile de
 *    recevoir un message si long dans Telegram, je ne vais pas le lire ».
 * 2. **Tronquer** à un écran, en annonçant le nombre de lignes écartées.
 *
 * 🔑 La contrainte qui compte n'est PAS le plafond de l'API, c'est la LECTURE.
 * Une notification dit **qu'il se passe quelque chose** et **où regarder** ;
 * elle ne transporte pas le rapport. Une alerte non lue ne vaut pas mieux qu'une
 * alerte perdue.
 */

import { describe, expect, it } from "vitest";

import { PLAFOND_TELEGRAM, preparerPourTelegram } from "@/server/notifications/channels/telegram";

/** Caractères que MarkdownV2 réserve : un seul non échappé fait refuser le message. */
const SPECIAUX_MARKDOWN_V2 = /[_*[\]()~`>#+\-=|{}.!]/;

/** Ce qui tient sur un écran de téléphone sans faire défiler. */
const LONGUEUR_LISIBLE = 900;
const LIGNES_LISIBLES = 11;

function messageDe(nbLignes: number, prefixe = "Item"): string {
  return Array.from({ length: nbLignes }, (_, i) => `${prefixe} ${i}`).join("\n");
}

describe("préparation Telegram — le message arrive (GEO-137)", () => {
  it("un message court n'est pas touché", () => {
    const court = "Alerte : 3 sessions a convoquer";
    expect(preparerPourTelegram(court)).toBe(court);
  });

  it("un message normal multi-lignes n'est pas mutilé", () => {
    // La borne ne doit pas abîmer les alertes ordinaires, qui sont l'immense
    // majorité : un événement unique tient en quelques lignes.
    const normal = ["ALERTE", "", "Nouvelle candidature recue", "Voir la console"].join("\n");
    expect(preparerPourTelegram(normal)).toBe(normal);
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

describe("préparation Telegram — le message se lit d'un coup d'œil", () => {
  const LONG = messageDe(600);

  it("🔴 le message tient sur un ÉCRAN, pas seulement sous le plafond de l'API", () => {
    // Le plafond technique est à 4096 ; ce n'est pas la contrainte qui compte.
    // Une alerte se lit sur un téléphone, souvent en marchant.
    expect(preparerPourTelegram(LONG).length).toBeLessThanOrEqual(LONGUEUR_LISIBLE);
  });

  it("🔴 le nombre de LIGNES est borné, pas seulement les caractères", () => {
    // Un humain scanne des lignes, pas des caractères : quinze lignes courtes
    // tiennent sous la limite de taille et forment quand même un mur illisible.
    expect(preparerPourTelegram(LONG).split("\n").length).toBeLessThanOrEqual(LIGNES_LISIBLES);
  });

  it("un seul message est produit, jamais une rafale", () => {
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
