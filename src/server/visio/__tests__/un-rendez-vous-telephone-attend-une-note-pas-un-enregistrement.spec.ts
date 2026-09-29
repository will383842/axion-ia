// @vitest-environment node
/**
 * Un rendez-vous TÉLÉPHONE attend une NOTE, pas un enregistrement : un appel
 * téléphonique n'est jamais enregistré (seules les visios Meet le seront),
 * donc le rappel dit « écrire la note ». Une visio attend « compte rendu ou
 * note ».
 *
 * Contre-témoins : absent, reporté, annulé, en personne, de test, repris de
 * l'historique, déjà pourvu d'un compte rendu, antérieur à la borne —
 * n'attendent rien.
 */

import { describe, expect, it, vi } from "vitest";

import { attenduF1, passerBalayage, type RencontrePourF1 } from "../balayage";
import { BORNE, MAINTENANT, rencontreF1, sceneF1 } from "./_scene-f1";

describe("un rendez-vous téléphone attend une note, pas un enregistrement", () => {
  it("téléphone : une note ; visio : compte rendu ou note", () => {
    expect(attenduF1(rencontreF1({ type: "telephone" }), BORNE, MAINTENANT)).toBe("note");
    expect(attenduF1(rencontreF1(), BORNE, MAINTENANT)).toBe("compte_rendu_ou_note");
  });

  it.each<[string, Partial<RencontrePourF1>]>([
    ["absent", { issue: "absent" }],
    ["reporté", { issue: "reporte" }],
    ["annulé chez Calendly", { annuleCalendly: true }],
    ["en personne", { type: "presentiel" }],
    ["de test", { estTestInterne: true }],
    ["repris de l'historique", { repriseHistorique: true }],
    ["avec un compte rendu", { aUnCompteRendu: true }],
    ["antérieur à la borne", { debutPrevu: new Date("2026-09-20T08:00:00Z"), finPrevue: null }],
  ])("contre-témoin : %s n'attend rien", (_n, p) => {
    expect(attenduF1(rencontreF1(p), BORNE, MAINTENANT)).toBeNull();
  });

  it("dans le balayage, un appel téléphonique tenu est bien rappelé", async () => {
    const { base } = sceneF1("telephone");
    const r = await passerBalayage(base.client as never, {
      maintenant: MAINTENANT,
      notifier: vi.fn() as never,
    });
    expect(r.f1).toBe(1);
  });
});
