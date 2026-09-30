/**
 * ⛔ UN EFFACEMENT CIBLÉ PROGRAMME UNE RÉÉCRITURE SANS LA PERSONNE (ADR 0056 §6).
 *
 * `effacerCibleParAdresses` vide les comptes rendus des rencontres où la
 * personne a parlé (`a_regenerer`) ; le circuit doit alors PROGRAMMER leur
 * réécriture (`rediger`), faite depuis les faits RESTANTS — jamais depuis la
 * transcription (P5 ne la voit pas), et ses faits à elle sont vidés.
 *
 * Mutation qui rougit : retirer `programmerReecritures(tx, crVides)` de
 * `effacerCibleParAdresses` → aucune étape `rediger` n'est programmée.
 * Contre-témoin : une personne introuvable ne programme rien. Angle mort :
 * les segments non attribués d'une rencontre partagée restent (voir l'en-tête
 * de `effacerCibleParAdresses`) — P5 ne lit pas les segments.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { baseEspion } from "../../../../../tests/outils/base-espion";

const espion = vi.hoisted(() => ({
  courant: null as null | ReturnType<
    typeof import("../../../../../tests/outils/base-espion").baseEspion
  >,
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return espion.courant!.base;
  },
}));

beforeEach(() => {
  espion.courant = null;
});

describe("un effacement ciblé programme une réécriture sans la personne", () => {
  it("les comptes rendus vidés reçoivent une étape `rediger`", async () => {
    espion.courant = baseEspion({
      "clientContactAdresse.findMany": (a) =>
        (a["select"] as Record<string, unknown>)["contactId"]
          ? [{ contactId: "c1" }]
          : [{ emailHash: "h" }],
      "rencontreParticipant.findMany": () => [{ id: "p1", rencontreId: "r1" }],
      "fait.findMany": () => [],
      "compteRendu.findMany": (a) =>
        (a["where"] as { statut?: unknown }).statut ? [{ id: "cr-r1", rencontreId: "r1" }] : [],
      "questionnaireCadrage.findMany": () => [],
      "emailSuivi.findMany": () => [],
      "enregistrement.findMany": () => [],
      "transcription.findMany": () => [],
      "transcriptionSegment.findMany": () => [],
    });
    const { effacerCibleParAdresses } = await import("@/lib/rgpd-erase");
    await effacerCibleParAdresses(["personne@exemple.invalid"]);
    const rediger = espion.courant.sqls.filter(
      (s) => s.sql.includes("traitements_visio") && s.valeurs.includes("rediger"),
    );
    expect(rediger.length).toBeGreaterThan(0);
    expect(rediger[0]!.valeurs).toContain("cr-r1");
  });

  it("contre-témoin : personne introuvable → rien n'est programmé", async () => {
    espion.courant = baseEspion();
    const { effacerCibleParAdresses } = await import("@/lib/rgpd-erase");
    await effacerCibleParAdresses(["inconnu@exemple.invalid"]);
    expect(espion.courant.sqls.filter((s) => s.valeurs.includes("rediger"))).toEqual([]);
  });
});
