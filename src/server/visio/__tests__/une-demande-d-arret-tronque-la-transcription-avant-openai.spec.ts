/**
 * ⛔ G0c — UNE DEMANDE D'ARRÊT TRONQUE LA TRANSCRIPTION AVANT OPENAI.
 *
 * « Je préfère pas qu'on enregistre » sur la piste client : tout ce qui suit
 * (ce segment compris) est marqué « après refus » et effacé AVANT que P1 ne
 * soit appelée ; le dialogue envoyé s'arrête juste avant ; une alerte
 * propose d'enregistrer le retrait.
 *
 * Mutation qui rougit : retirer l'appel à `marquerApresRefus` dans
 * `precontroler` (ou le filtre `apresRefus` dans `entrelacer`) → la parole
 * d'après le refus part chez OpenAI. Contre-témoin : sans formule de refus,
 * rien n'est coupé. Angle mort : une formule hors de la liste fermée — le
 * champ `demande_arret_enregistrement` de P1 la signale ensuite.
 */

import { describe, expect, it } from "vitest";

import { entrelacer } from "../dialogue";
import { executerEtape } from "../etapes";
import { planDePrecontrole, precontroler } from "../precontroles";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { conversation, precontrole, seg } from "./outils-pipeline";

const AVEC_REFUS = [
  ...conversation(),
  seg({
    piste: "client",
    debutMs: 205_000,
    ordre: 999_001,
    texte: "Attendez, je préfère pas qu'on enregistre la suite.",
  }),
  seg({
    piste: "client",
    debutMs: 215_000,
    ordre: 999_002,
    texte: "Notre budget réel est de cinquante mille euros.",
  }),
].sort((a, b) => a.debutMs - b.debutMs);

describe("une demande d'arrêt tronque la transcription avant OpenAI", () => {
  it("les segments à partir du refus sont marqués et effacés, une alerte part", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "precontroler" });
    const marques: number[] = [];
    const deps = depsDeTest({
      depot,
      gestionnaires: { precontroler },
      donnees: {
        pourPrecontrole: async () => [precontrole({ segments: AVEC_REFUS })],
        marquerApresRefus: async (_tx, _id, ordres) => {
          marques.push(...ordres);
        },
        ecrirePreuvesAccord: async () => undefined,
        noterAuJournal: async () => undefined,
      },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(marques).toEqual(expect.arrayContaining([999_001, 999_002]));
    expect(marques.every((o) => AVEC_REFUS.find((s) => s.ordre === o)!.debutMs >= 205_000)).toBe(
      true,
    );
    expect(deps.alertes.map((a) => a.code)).toEqual(["visio.demande_d_arret"]);
  });

  it("le dialogue envoyé à P1 ne contient rien d'après le refus", () => {
    const plan = planDePrecontrole(precontrole({ segments: AVEC_REFUS }));
    const marques = new Set(plan.ordresApresRefus);
    const d = entrelacer(
      AVEC_REFUS.map((s) => (marques.has(s.ordre) ? { ...s, apresRefus: true, texte: "" } : s)),
    );
    expect(d.texte).not.toMatch(/cinquante mille|préfère pas/);
  });

  it("contre-témoin : sans refus, rien n'est coupé", () => {
    expect(planDePrecontrole(precontrole()).ordresApresRefus).toEqual([]);
  });
});
