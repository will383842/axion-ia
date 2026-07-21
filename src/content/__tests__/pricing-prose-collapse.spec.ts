/**
 * Régression AUDIT 2026-07-21 — « commence à À partir de 1 900 € HT ».
 *
 * Le mode `range` rend « À partir de X », mais la prose rédigée autour du token
 * porte déjà son amorce (« le coût commence à … », « débute à … »). Une fois le
 * token résolu, la collision s'affichait en clair sur le site — défaut listé
 * comme interdit dans l'inventaire de purge.
 *
 * Les formulations testées sont celles RÉELLEMENT présentes en base prod
 * (relevées sur les 12 contextes distincts de tokens `|range`).
 */

import { describe, expect, it } from "vitest";
import { collapsePriceProseDuplicates } from "../pricing-tokens";

const PRIX = "À partir de 1 900 € HT";

describe("collapsePriceProseDuplicates", () => {
  it.each([
    ["Un audit standard PME commence à", "Un audit standard PME commence à 1 900 € HT"],
    ["Pour une PME, le coût commence à", "Pour une PME, le coût commence à 1 900 € HT"],
    ["Les tarifs à Grigny commencent à", "Les tarifs à Grigny commencent à 1 900 € HT"],
    ["Un audit (5 jours) démarre à", "Un audit (5 jours) démarre à 1 900 € HT"],
    ["L'audit IA standard pour PME débute à", "L'audit IA standard pour PME débute à 1 900 € HT"],
  ])("recolle « %s »", (prefixe, attendu) => {
    expect(collapsePriceProseDuplicates(`${prefixe} ${PRIX}`)).toBe(attendu);
  });

  it("« à partir de À partir de » → une seule amorce", () => {
    expect(collapsePriceProseDuplicates(`Nous proposons à partir de ${PRIX}.`)).toBe(
      "Nous proposons à partir de 1 900 € HT.",
    );
  });

  it("« compris entre » ne peut pas encadrer une borne unique", () => {
    // « entre » attend deux valeurs, or le tier n'en expose qu'une : la
    // formulation correcte est « à partir de ».
    expect(collapsePriceProseDuplicates(`avec un tarif compris entre ${PRIX}, et inclut`)).toBe(
      "avec un tarif à partir de 1 900 € HT, et inclut",
    );
  });

  it("laisse intacte une amorce isolée et légitime", () => {
    // Sans préposition en amont, « À partir de X » est correct : on n'y touche pas.
    expect(collapsePriceProseDuplicates(`L'audit ciblé (${PRIX}) inclut un atelier.`)).toBe(
      "L'audit ciblé (À partir de 1 900 € HT) inclut un atelier.",
    );
  });

  it("laisse intact un texte sans prix", () => {
    const t = "Un audit IA dure cinq jours ouvrés.";
    expect(collapsePriceProseDuplicates(t)).toBe(t);
  });

  it("ne touche pas au mot « à » suivi d'autre chose", () => {
    const t = "Formation à Grenoble à partir du 3 mars.";
    expect(collapsePriceProseDuplicates(t)).toBe(t);
  });

  it("tolère les entrées non-string sans lever", () => {
    expect(collapsePriceProseDuplicates(undefined as unknown as string)).toBe(undefined);
  });
});
