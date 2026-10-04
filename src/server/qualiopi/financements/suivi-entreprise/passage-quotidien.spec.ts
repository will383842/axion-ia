/**
 * Lot OPCO A8 — le passage quotidien. Témoins : 08:30 Paris en été comme en
 * hiver, jamais le week-end ; interrupteur coupé → rien ne part ; tables
 * absentes (fenêtre app/worker) → abstention sans requête ; dossier dont le
 * dépôt n'est pas constaté chez l'entreprise → écarté sans kit.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ dossierFinancement: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
const m = vi.hoisted(() => ({ envoi: vi.fn(), relance: vi.fn(), tables: vi.fn() }));
vi.mock("./envoi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./envoi")>()),
  envoyerDossierEntreprise: (...a: unknown[]) => m.envoi(...a),
  envoyerRelance: (...a: unknown[]) => m.relance(...a),
}));
vi.mock("./tables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./tables")>()),
  tablesSuiviDisponibles: () => m.tables(),
}));
// `envoi.ts` (importé réellement ci-dessus) tire ces deux modules, qui chargent
// `next-auth` : mocks étroits, aucune de leurs fonctions n'est appelée ici.
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/qualiopi/documents/production/producteurs", () => ({ produireKitOpco: vi.fn() }));

import { estLHeureDuPassage, passerSuiviEntreprise } from "./passage-quotidien";

const LUNDI_ETE = new Date("2026-10-05T06:30:00.000Z"); // 08:30 Paris (UTC+2)

beforeEach(() => {
  vi.stubEnv("OPCO_SUIVI_ENTREPRISE_ENABLED", "true");
  db.dossierFinancement.findMany.mockReset();
  for (const fn of Object.values(m)) fn.mockReset();
  m.tables.mockResolvedValue(true);
  m.envoi.mockResolvedValue({ ok: true, messageId: "m1", garePourValidation: false });
  db.dossierFinancement.findMany.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe("horaire", () => {
  it("08:30 à Paris : 06:30 UTC en été, 07:30 UTC en hiver ; jamais le week-end", () => {
    expect(estLHeureDuPassage(LUNDI_ETE)).toBe(true);
    expect(estLHeureDuPassage(new Date("2026-10-05T07:30:00.000Z"))).toBe(false); // 09:30 Paris
    expect(estLHeureDuPassage(new Date("2026-11-02T07:30:00.000Z"))).toBe(true); // hiver
    expect(estLHeureDuPassage(new Date("2026-11-02T06:30:00.000Z"))).toBe(false); // 07:30 Paris
    expect(estLHeureDuPassage(new Date("2026-10-03T06:30:00.000Z"))).toBe(false); // samedi
  });
});

describe("passage quotidien", () => {
  it("🔴 interrupteur coupé → aucune lecture, rien ne part", async () => {
    vi.stubEnv("OPCO_SUIVI_ENTREPRISE_ENABLED", "false");
    const b = await passerSuiviEntreprise(LUNDI_ETE);
    expect(b.actif).toBe(false);
    expect(db.dossierFinancement.findMany).not.toHaveBeenCalled();
    expect(m.envoi).not.toHaveBeenCalled();
  });

  it("🔴 tables absentes (worker en avance sur la migration) → abstention", async () => {
    m.tables.mockResolvedValue(false);
    const b = await passerSuiviEntreprise(LUNDI_ETE);
    expect(b.abstenu).toBe(true);
    expect(db.dossierFinancement.findMany).not.toHaveBeenCalled();
  });

  it("dépôt constaté chez l'entreprise (Atlas) → envoi ; non constaté (Afdas) → écarté sans kit", async () => {
    db.dossierFinancement.findMany
      .mockResolvedValueOnce([
        {
          id: "d1",
          client: { opco: "atlas", opcoIdentifie: null, contactEmail: "a@b.fr" },
          trainingSession: null,
        },
        {
          id: "d2",
          client: { opco: "afdas", opcoIdentifie: null, contactEmail: "a@b.fr" },
          trainingSession: null,
        },
        {
          id: "d3",
          client: { opco: null, opcoIdentifie: "atlas", contactEmail: null },
          trainingSession: null,
        },
      ])
      .mockResolvedValueOnce([]);
    const b = await passerSuiviEntreprise(LUNDI_ETE);
    expect(m.envoi).toHaveBeenCalledTimes(1);
    expect(m.envoi).toHaveBeenCalledWith({ dossierId: "d1", mode: "auto", now: LUNDI_ETE });
    expect(b).toMatchObject({ envoisAuto: 1, ecartes: { depot_non_constate: 1, contact: 1 } });
  });

  it("week-end : rien", async () => {
    const b = await passerSuiviEntreprise(new Date("2026-10-03T06:30:00.000Z"));
    expect(db.dossierFinancement.findMany).not.toHaveBeenCalled();
    expect(b.envoisAuto + b.relances).toBe(0);
  });
});
