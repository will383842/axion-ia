/**
 * ⛔ UNE TRANSCRIPTION EN ÉCHEC SE RELANCE SANS REPAYER LES TRANCHES FAITES (V2, M3).
 *
 * Après un échec définitif de `transcrire` (OpenAI en panne plus de 72 h),
 * la page affichait « Vous pouvez relancer » et un bouton « Relancer » qui
 * appelle `reextraireCompteRendu`. Or celui-ci refusait (« La transcription
 * n'existe plus ») : aucune transcription n'est retenue après un tel échec.
 * Le son était encore dans R2 pour 30 jours, et aucun geste ne le reprenait.
 *
 * Désormais « Relancer » choisit : sans transcription retenue, il relance
 * `transcrire` si un enregistrement de la rencontre a encore son son ; les
 * tranches déjà transcrites ne sont pas refaites.
 *
 * Mutation qui rougit : rétablir le refus sans condition (1er cas).
 * Contre-témoins : son déjà purgé, refus clair (2e cas) ; une tranche déjà
 * transcrite ne repart pas chez OpenAI (3e cas).
 */

import { describe, expect, it } from "vitest";

import { executerEtape } from "../etapes";
import { GesteRefuse, reextraireCompteRendu } from "../gestes-compte-rendu";
import { transcrire } from "../recevoir-transcription";
import { baseEspion } from "../../../../tests/outils/base-espion";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { fauxClient } from "../../../../tests/outils/faux-openai-visio";
import { enregistrement, portTranscription } from "./outils-pipeline";

const RENCONTRE = "00000000-0000-4000-8000-0000000000f1";

describe("une transcription en échec se relance sans repayer les tranches faites", () => {
  it("sans transcription retenue mais avec le son : « Relancer » reprogramme transcrire", async () => {
    const b = baseEspion({
      "transcription.count": () => 0,
      "enregistrement.count": () => 1,
    });
    // Le geste dit à Will ce qui repart (« La transcription est relancée. »).
    expect(await reextraireCompteRendu(b.base, RENCONTRE)).toBe("transcription");
    const sql = b.sqls.map((s) => `${s.sql} ${JSON.stringify(s.valeurs)}`).join("\n");
    expect(sql).toContain("transcrire");
    expect(sql).not.toContain('"extraire"');
    const filtre = b.de("enregistrement", "count")[0]?.args["where"] as Record<string, unknown>;
    expect(filtre).toMatchObject({ rencontreId: RENCONTRE, audioSupprimeLe: null });
  });

  it("avec une transcription retenue, c'est l'extraction qui repart", async () => {
    const b = baseEspion({ "transcription.count": () => 1 });
    expect(await reextraireCompteRendu(b.base, RENCONTRE)).toBe("extraction");
  });

  it("contre-témoin : son déjà purgé, refus clair", async () => {
    const b = baseEspion({
      "transcription.count": () => 0,
      "enregistrement.count": () => 0,
    });
    await expect(reextraireCompteRendu(b.base, RENCONTRE)).rejects.toBeInstanceOf(GesteRefuse);
  });

  it("la relance ne repaie pas une tranche déjà transcrite", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "transcrire" });
    const e = enregistrement({ statut: "en_traitement" });
    const { port } = portTranscription({
      ...e,
      tranches: e.tranches.map((x) => (x.id === "tc0" ? { ...x, statut: "transcrite" } : x)),
    });
    const f = fauxClient(undefined, { transcriptions: [{ text: "", segments: [] }] });
    const deps = depsDeTest({
      depot,
      client: f.client,
      donnees: port,
      gestionnaires: { transcrire },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(f.demandesTranscription).toHaveLength(1);
  });
});
