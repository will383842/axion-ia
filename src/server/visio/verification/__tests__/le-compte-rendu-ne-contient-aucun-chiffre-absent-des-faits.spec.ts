/**
 * ⛔ G9 — LE COMPTE RENDU NE CONTIENT AUCUN CHIFFRE ABSENT DES FAITS (V2).
 *
 * Chaque paragraphe cite au moins un fait vérifié ; chaque nombre, date et
 * nom propre qu'il écrit figure dans ses faits ; aucun « € » hors des
 * rubriques d'argent. Un paragraphe fautif est RETIRÉ ; au-delà de 20 %
 * retirés, le compte rendu est rejeté (réécrit une fois). Et le statut de
 * chaque rubrique est celui de la couverture VÉRIFIÉE (G6).
 *
 * Mutation qui rougit : dans `paragrapheFautif`, ne plus contrôler les
 * nombres → « 15 personnes » passe. Contre-témoin : un paragraphe fidèle
 * reste. Angle mort : un nombre écrit en lettres dans la rédaction (« quinze »)
 * est lu par la même table fermée ; un nom propre en minuscules passe.
 */

import { describe, expect, it } from "vitest";

import type { CompteRenduV1 } from "../../schemas/autres";
import { RUBRIQUES_COUVERTURE } from "../../schemas/communs";
import { couvertureDesFaits } from "../g06-couverture";
import { verifierCompteRendu, type FaitPourRedaction } from "../g09-redaction";

const FAITS = new Map<string, FaitPourRedaction>([
  [
    "F01",
    {
      ref: "F01",
      enonce: "La gérante veut former 12 commerciaux.",
      citation: "On serait douze commerciaux à former",
      valeurs: ["12 personnes"],
    },
  ],
  [
    "F02",
    {
      ref: "F02",
      enonce: "Le budget prévu est d'environ 3 000 € HT.",
      citation: "trois mille euros hors taxes",
      valeurs: ["3 000 €", "3000"],
    },
  ],
]);
const COUVERTURE = couvertureDesFaits(
  new Map([
    ["F01", "nb_participants"],
    ["F02", "budget"],
  ]),
);

function cr(
  paragraphes: Partial<
    Record<(typeof RUBRIQUES_COUVERTURE)[number], Array<{ texte: string; faits_refs: string[] }>>
  >,
): CompteRenduV1 {
  return {
    en_bref: [{ texte: "Former 12 commerciaux.", faits_refs: ["F01"] }],
    ce_qui_a_change: [],
    rubriques: Object.fromEntries(
      RUBRIQUES_COUVERTURE.map((r) => [r, { statut: "aborde", paragraphes: paragraphes[r] ?? [] }]),
    ) as CompteRenduV1["rubriques"],
    besoins_detectes: [],
    prochaine_etape_texte: { texte: "Non abordé.", faits_refs: ["F01"] },
  };
}

describe("le compte rendu ne contient aucun chiffre absent des faits", () => {
  it("« 15 personnes » (les faits disent 12) → paragraphe retiré", () => {
    const b = verifierCompteRendu(
      cr({ perimetre: [{ texte: "Il faut former 15 personnes.", faits_refs: ["F01"] }] }),
      COUVERTURE,
      FAITS,
    );
    expect(b.compteRendu.rubriques.perimetre.paragraphes).toEqual([]);
    expect(b.motifs.join()).toMatch(/nombre absent/);
  });

  it("un paragraphe sans fait, un montant hors rubrique d'argent → retirés ; > 20 % → rejeté", () => {
    const b = verifierCompteRendu(
      cr({
        perimetre: [
          { texte: "Il faut aller vite.", faits_refs: [] },
          { texte: "Pour 3 000 € de budget.", faits_refs: ["F02"] },
        ],
      }),
      COUVERTURE,
      FAITS,
    );
    expect(b.retires).toBeGreaterThanOrEqual(2);
    expect(b.rejete).toBe(true);
  });

  it("G6 : le statut rédigé est celui de la couverture vérifiée", () => {
    const b = verifierCompteRendu(
      cr({ entreprise: [{ texte: "Une menuiserie.", faits_refs: ["F01"] }] }),
      COUVERTURE,
      FAITS,
    );
    expect(b.compteRendu.rubriques.entreprise).toEqual({ statut: "non_aborde", paragraphes: [] });
  });

  it("contre-témoin : un paragraphe fidèle reste, le montant est admis au budget", () => {
    const b = verifierCompteRendu(
      cr({
        perimetre: [{ texte: "La gérante veut former 12 commerciaux.", faits_refs: ["F01"] }],
        budget_financement: [{ texte: "Budget annoncé : 3 000 € HT.", faits_refs: ["F02"] }],
      }),
      COUVERTURE,
      FAITS,
    );
    expect(b.retires).toBe(0);
    expect(b.rejete).toBe(false);
    expect(b.compteRendu.rubriques.budget_financement.paragraphes).toHaveLength(1);
  });
});
