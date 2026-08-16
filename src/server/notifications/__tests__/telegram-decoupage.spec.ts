/**
 * Verrou GEO-137 — une alerte trop longue n'arrivait jamais, en silence
 * (audit GEO/AEO end-to-end du 2026-08-14, lot 8).
 *
 * ## Le défaut
 *
 * `sendTelegramRaw` postait `text` tel quel. L'API Telegram plafonne
 * `sendMessage.text` à **4096 caractères** : au-delà elle répond 400, la
 * fonction rendait `false`, et le contrat fail-soft du canal (« ne throw
 * jamais ») transformait ça en **silence complet**. L'alerte n'arrivait pas, et
 * rien ne le signalait.
 *
 * Le défaut a été trouvé sur les alertes Qualiopi, mais il porte sur **toutes**
 * les catégories de notification : c'est ce point d'entrée qui est commun.
 * C'est pour ça que le correctif est ici, et pas dans un appelant.
 *
 * ## Pourquoi on découpe sur les sauts de ligne
 *
 * Une coupe arbitraire tombe un jour au milieu d'une entité MarkdownV2
 * (`*gras*`, `[lien](url)`) : Telegram refuse alors le morceau, et on aurait
 * remplacé une perte silencieuse par une autre. Les gabarits produisent une
 * ligne par item — la frontière de ligne est donc une frontière sûre.
 */

import { describe, expect, it } from "vitest";

import { decouperPourTelegram } from "@/server/notifications/channels/telegram";

/** Plafond dur de l'API Telegram. Aucun morceau ne doit jamais le dépasser. */
const PLAFOND_API = 4096;

describe("découpage Telegram — le plafond de l'API (GEO-137)", () => {
  it("un message court n'est pas touché", () => {
    const court = "Alerte : 3 sessions à convoquer.";
    expect(decouperPourTelegram(court)).toEqual([court]);
  });

  it("🔴 un message long est découpé — il n'est plus perdu", () => {
    // 400 lignes d'une trentaine de caractères : très au-delà du plafond.
    const long = Array.from({ length: 400 }, (_, i) => `Ligne ${i} — item de liste`).join("\n");
    expect(long.length).toBeGreaterThan(PLAFOND_API);

    const morceaux = decouperPourTelegram(long);
    expect(
      morceaux.length,
      "un message de plus de 4096 caractères n'est pas découpé : il recevra un 400 " +
        "et le fail-soft le fera disparaître sans bruit.",
    ).toBeGreaterThan(1);
    for (const m of morceaux) expect(m.length).toBeLessThanOrEqual(PLAFOND_API);
  });

  it("aucun caractère n'est perdu ni dupliqué", () => {
    const long = Array.from({ length: 300 }, (_, i) => `Item ${i}`).join("\n");
    expect(decouperPourTelegram(long).join("\n")).toBe(long);
  });

  it("les coupes tombent sur des frontières de LIGNE, pas au milieu", () => {
    // C'est la propriété qui protège les entités MarkdownV2.
    const long = Array.from({ length: 300 }, (_, i) => `*Item ${i}* voici du texte`).join("\n");
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
    const long = Array.from({ length: 500 }, () => "0123456789").join("\n");
    for (const m of decouperPourTelegram(long)) {
      expect(m.length).toBeLessThan(PLAFOND_API);
    }
  });
});
