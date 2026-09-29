// @vitest-environment node
/**
 * Le balayage ne remonte pas l'historique (plan V-07, vérification C24) :
 * il ne crée de rencontre QUE pour les rendez-vous postérieurs à sa borne
 * (la date de son premier passage, écrite une fois). Les ~40 « Discutons »
 * d'avant la mise en service ne deviennent pas 40 lignes « à classer » :
 * ils passent par le script de reprise.
 *
 * Contre-témoin : un rendez-vous postérieur à la borne a sa rencontre.
 */

import { describe, expect, it, vi } from "vitest";

import {
  dossierEnMemoire,
  rendezVousCalendly,
} from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import { passerBalayage } from "../balayage";

const PREMIER_PASSAGE = new Date("2026-10-03T10:00:00Z");

describe("le balayage ne remonte pas l'historique", () => {
  it("avant la borne : rien ; après : la rencontre", async () => {
    const ancien = rendezVousCalendly({
      startTime: new Date("2026-09-15T08:00:00Z"),
      endTime: new Date("2026-09-15T08:45:00Z"),
    });
    const recent = rendezVousCalendly({
      startTime: new Date("2026-10-06T08:00:00Z"),
      endTime: new Date("2026-10-06T08:45:00Z"),
    });
    const base = dossierEnMemoire({ calendlyEvent: [ancien, recent] });
    const r = await passerBalayage(base.client as never, {
      maintenant: PREMIER_PASSAGE,
      notifier: vi.fn() as never,
    });
    expect(r.rencontresAssurees).toBe(1);
    expect(base.tables["rencontre"]?.map((x) => x["calendlyEventId"])).toEqual([recent["id"]]);
    expect(base.tables["rencontre"]?.[0]?.["repriseHistorique"]).toBe(false);
  });

  it("au passage suivant, la borne ne bouge pas : l'ancien reste dehors", async () => {
    const ancien = rendezVousCalendly({ startTime: new Date("2026-10-02T08:00:00Z") });
    const base = dossierEnMemoire({ calendlyEvent: [ancien] });
    await passerBalayage(base.client as never, {
      maintenant: PREMIER_PASSAGE,
      notifier: vi.fn() as never,
    });
    await passerBalayage(base.client as never, {
      maintenant: new Date("2026-10-20T10:00:00Z"),
      notifier: vi.fn() as never,
    });
    expect(base.tables["rencontre"] ?? []).toHaveLength(0);
  });
});
