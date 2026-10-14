/**
 * C4 — une lettre de mission PÉRIMÉE (conditions changées depuis l'émission)
 * n'est plus signable, ni par le formateur ni en console.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  prisma: { missionFormateur: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));

import { empreinteDeLaMission } from "../empreinte-mission-lecture";
import { MESSAGES_LETTRE_PERIMEE, objectionLettreMissionPerimee } from "../lettre-mission-perimee";

const DOC = "11111111-1111-4111-8111-111111111111";

const mission = (over: Record<string, unknown> = {}) => ({
  role: "principal",
  trainerId: "t-1",
  tarifHtCents: 35_000,
  forfaitDeplacementParJourHtCents: null,
  regimeTvaFige: "franchise",
  trainer: { regimeTvaHonoraires: "franchise" },
  session: {
    titreSession: "IA générative",
    lieuType: "distanciel",
    modalite: "distanciel",
    lieuAdresse: null,
    lieuCodePostal: null,
    lieuVille: null,
    jours: [
      {
        date: new Date("2026-11-02T00:00:00Z"),
        heureDebut: "09:00",
        heureFin: "17:00",
        trainerId: null,
      },
    ],
    sessionFormateurs: [{ trainerId: "t-1" }],
  },
  ...over,
});

const empreinteDe = (m: ReturnType<typeof mission>) => empreinteDeLaMission(m as never).empreinte;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("objectionLettreMissionPerimee", () => {
  it("une autre pièce : rien à objecter, rien n'est lu", async () => {
    const r = await objectionLettreMissionPerimee({
      documentGenereId: DOC,
      type: "convention",
      metadata: {},
      partie: "formateur",
    });
    expect(r).toBeNull();
    expect(h.prisma.missionFormateur.findFirst).not.toHaveBeenCalled();
  });

  it("une lettre sans empreinte (hors moteur) : jamais périmée", async () => {
    const r = await objectionLettreMissionPerimee({
      documentGenereId: DOC,
      type: "lettre_mission",
      metadata: {},
      partie: "formateur",
    });
    expect(r).toBeNull();
  });

  it("une lettre à jour : signable", async () => {
    const m = mission();
    h.prisma.missionFormateur.findFirst.mockResolvedValue(m);
    const r = await objectionLettreMissionPerimee({
      documentGenereId: DOC,
      type: "lettre_mission",
      metadata: { empreinteMission: empreinteDe(m) },
      partie: "formateur",
    });
    expect(r).toBeNull();
    expect(h.prisma.missionFormateur.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { lettreMissionId: DOC } }),
    );
  });

  it("🔴 une lettre PÉRIMÉE : refusée au formateur ET en console, chacun son message", async () => {
    const avant = mission();
    const apres = mission({ tarifHtCents: 30_000 });
    h.prisma.missionFormateur.findFirst.mockResolvedValue(apres);
    const metadata = { empreinteMission: empreinteDe(avant) };
    expect(
      await objectionLettreMissionPerimee({
        documentGenereId: DOC,
        type: "lettre_mission",
        metadata,
        partie: "formateur",
      }),
    ).toEqual({ message: MESSAGES_LETTRE_PERIMEE.formateur });
    expect(
      await objectionLettreMissionPerimee({
        documentGenereId: DOC,
        type: "lettre_mission",
        metadata,
        partie: "axionia",
      }),
    ).toEqual({ message: MESSAGES_LETTRE_PERIMEE.console });
  });

  it("une lettre du moteur qui n'est plus liée à aucune mission : refusée", async () => {
    h.prisma.missionFormateur.findFirst.mockResolvedValue(null);
    const r = await objectionLettreMissionPerimee({
      documentGenereId: DOC,
      type: "lettre_mission",
      metadata: { empreinteMission: "a".repeat(64) },
      partie: "formateur",
    });
    expect(r).toEqual({ message: MESSAGES_LETTRE_PERIMEE.formateur });
  });

  it("lecture en échec : refus (garde fermée)", async () => {
    h.prisma.missionFormateur.findFirst.mockRejectedValue(new Error("panne"));
    const r = await objectionLettreMissionPerimee({
      documentGenereId: DOC,
      type: "lettre_mission",
      metadata: { empreinteMission: "a".repeat(64) },
      partie: "axionia",
    });
    expect(r).toEqual({ message: MESSAGES_LETTRE_PERIMEE.erreur });
  });
});

describe("la garde est branchée sur TOUS les chemins de signature", () => {
  it("`objectionAvantSignature` (jeton, contresignature, lot) l'appelle", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/actions/qualiopi/piece-signature.ts"),
      "utf8",
    );
    const corps = src.slice(src.indexOf("async function objectionAvantSignature("));
    expect(corps.slice(0, corps.indexOf("\n}\n"))).toContain("objectionLettreMissionPerimee(");
  });
});
