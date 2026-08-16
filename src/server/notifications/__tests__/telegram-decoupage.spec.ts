/**
 * Verrou GEO-137 — une alerte trop longue n'arrivait jamais chez son
 * destinataire (audit GEO/AEO end-to-end du 2026-08-14, lot 8).
 *
 * ## Le défaut
 *
 * `sendTelegramRaw` postait `text` tel quel. L'API Telegram plafonne
 * `sendMessage.text` à **4096 caractères** : au-delà elle répond 400 et la
 * fonction rend `false`. Le contrat fail-soft du canal (« ne throw jamais »)
 * fait que l'appelant continue comme si de rien n'était.
 *
 * ⚠️ PRÉCISION IMPORTANTE, vérifiée dans le code : l'échec **est** journalisé
 * (`console.warn("[notif:telegram] 400: …")`). Ce n'était donc pas un silence
 * total, contrairement à ce que laissait entendre une première lecture — c'était
 * une perte visible seulement dans les journaux serveur, jamais chez le
 * destinataire, et jamais remontée comme incident. `notify()` rend bien
 * `{ ok, channels }`, mais **aucun appelant de production ne lit ce retour** :
 * seuls les tests le consultent.
 *
 * Le défaut a été trouvé sur les alertes Qualiopi ; il porte sur **toutes** les
 * catégories, car c'est ce point d'entrée qui leur est commun.
 *
 * ## Pourquoi on découpe sur les sauts de ligne
 *
 * Une coupe arbitraire tombe un jour au milieu d'une entité MarkdownV2
 * (`*gras*`, `[lien](url)`) : Telegram refuse alors le morceau, et on aurait
 * remplacé une perte par une autre. Les gabarits produisent une ligne par item —
 * la frontière de ligne est donc une frontière sûre.
 */

import { describe, expect, it } from "vitest";

import { decouperPourTelegram } from "@/server/notifications/channels/telegram";

/** Plafond dur de l'API Telegram. Aucun morceau ne doit jamais le dépasser. */
const PLAFOND_API = 4096;

/** Caractères que MarkdownV2 réserve : un seul non échappé fait refuser le morceau. */
const SPECIAUX_MARKDOWN_V2 = /[_*[\]()~`>#+\-=|{}.!]/;

function messageDe(nbLignes: number, prefixe = "Item"): string {
  return Array.from({ length: nbLignes }, (_, i) => `${prefixe} ${i}`).join("\n");
}

describe("découpage Telegram — le plafond de l'API (GEO-137)", () => {
  it("un message court n'est pas touché", () => {
    const court = "Alerte : 3 sessions à convoquer.";
    expect(decouperPourTelegram(court)).toEqual([court]);
  });

  it("🔴 un message long est découpé — il n'est plus refusé par l'API", () => {
    const long = messageDe(600, "Ligne de rapport");
    // On vérifie l'hypothèse du test avant de tester : un échantillon qui
    // resterait sous le plafond ne prouverait rien.
    expect(long.length).toBeGreaterThan(PLAFOND_API);

    const morceaux = decouperPourTelegram(long);
    expect(
      morceaux.length,
      "un message de plus de 4096 caractères n'est pas découpé : l'API le refuse " +
        "et il n'arrive jamais chez le destinataire.",
    ).toBeGreaterThan(1);
    for (const m of morceaux) expect(m.length).toBeLessThanOrEqual(PLAFOND_API);
  });

  it("aucun caractère n'est perdu ni dupliqué tant qu'on est sous la borne", () => {
    const long = messageDe(300);
    expect(decouperPourTelegram(long).join("\n")).toBe(long);
  });

  it("les coupes tombent sur des frontières de LIGNE, pas au milieu", () => {
    // C'est la propriété qui protège les entités MarkdownV2.
    const long = Array.from({ length: 200 }, (_, i) => `*Item ${i}* voici du texte`).join("\n");
    for (const m of decouperPourTelegram(long)) {
      for (const ligne of m.split("\n")) {
        expect(
          ligne === "" || /^\*Item \d+\* voici du texte$/.test(ligne),
          `ligne coupée en deux : « ${ligne} » — une entité MarkdownV2 peut être ` +
            `tranchée, et Telegram refusera le morceau.`,
        ).toBe(true);
      }
    }
  });

  it("une ligne unique trop longue est coupée net — limite assumée", () => {
    // Il n'existe pas de frontière sûre dans ce cas. Le test fige le
    // comportement plutôt que de laisser croire qu'il est résolu : si ce cas
    // apparaît en vrai, c'est le gabarit qu'il faut corriger.
    const uneLigne = "x".repeat(9000);
    const morceaux = decouperPourTelegram(uneLigne);
    expect(morceaux.length).toBeGreaterThan(1);
    for (const m of morceaux) expect(m.length).toBeLessThanOrEqual(PLAFOND_API);
    expect(morceaux.join("")).toBe(uneLigne);
  });

  it("le seuil retenu laisse une marge sous le plafond de l'API", () => {
    // L'échappement MarkdownV2 peut encore allonger le texte en aval : viser
    // exactement 4096 reviendrait à repasser au-dessus.
    for (const m of decouperPourTelegram(messageDe(500, "0123456789"))) {
      expect(m.length).toBeLessThan(PLAFOND_API);
    }
  });
});

describe("découpage Telegram — découper ne doit pas devenir du bruit", () => {
  const ENORME = messageDe(5000);

  it("🔴 le nombre de morceaux est BORNÉ", () => {
    // Sans cette borne, une alerte de 40 000 caractères partirait en dix
    // notifications illisibles : on aurait remplacé une perte par du bruit, ce
    // qui fait désapprendre à lire les alertes. C'est l'équivalent, à ce niveau,
    // du « plafonner à 15 items » que l'audit prescrivait côté constructeur
    // d'alerte — ce point d'entrée ne voit qu'une chaîne, il ne sait pas ce
    // qu'est un item.
    expect(decouperPourTelegram(ENORME).length).toBeLessThanOrEqual(3);
  });

  it("un message tronqué le DIT", () => {
    // Sans mention, le lecteur croit avoir tout vu — c'est pire qu'une coupure
    // visible.
    expect(decouperPourTelegram(ENORME).at(-1)).toContain("MESSAGE TRONQUE");
  });

  it("la mention de troncature ne contient aucun caractère spécial MarkdownV2", () => {
    // Un seul suffirait à faire refuser le morceau entier par Telegram : on
    // perdrait le message qu'on essaie justement de sauver.
    const mention = (decouperPourTelegram(ENORME).at(-1) ?? "").split("\n").at(-1) ?? "";
    expect(mention).toBe("MESSAGE TRONQUE voir les journaux serveur");
    expect(SPECIAUX_MARKDOWN_V2.test(mention)).toBe(false);
  });

  it("les morceaux conservés restent sous le plafond, mention comprise", () => {
    for (const m of decouperPourTelegram(ENORME)) {
      expect(m.length).toBeLessThanOrEqual(PLAFOND_API);
    }
  });
});
