/**
 * Lot L11e — une lettre PÉRIMÉE (dates, lieu ou honoraires changés) est
 * remplacée (non signée) ou rectifiée (signée), F29 part, Will est prévenu.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const MISSION = "00000000-0000-4000-8000-000000000021";
const TRAINER = "00000000-0000-4000-8000-000000000011";
const ANCIENNE = "00000000-0000-4000-8000-000000000031";
const NOUVELLE = "00000000-0000-4000-8000-000000000032";

const h = vi.hoisted(() => {
  const etat = { mission: null as Record<string, unknown> | null, signees: 0 };
  const prisma = {
    setting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        ["formateurs.lettre_auto", "formateurs.lettre_v2"].includes(where.key)
          ? { value: { actif: true } }
          : null,
      ),
    },
    missionFormateur: {
      findUnique: vi.fn(async () => structuredClone(h.etat.mission)),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => []),
    },
    documentGenere: {
      count: vi.fn(async (a: { where: Record<string, unknown> }) =>
        "conditionSuspensiveOpco" in a.where
          ? 0
          : a.where.type === "lettre_mission"
            ? h.etat.signees
            : 1,
      ),
      findUnique: vi.fn(async () => ({ metadata: {} })),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    sessionFormateur: { findUnique: vi.fn(async () => null) },
    // Forme « tableau » (écritures groupées, correctif #1502) : résolue telle quelle.
    $transaction: vi.fn(async (f: ((tx: unknown) => unknown) | Promise<unknown>[]) =>
      Array.isArray(f) ? Promise.all(f) : f({ $executeRaw: vi.fn() }),
    ),
  };
  return {
    etat,
    prisma,
    // Le générateur lie la nouvelle lettre à la mission traitée (correctif #1502).
    generer: vi.fn(async () => {
      (etat.mission as Record<string, unknown>).lettreMissionId = NOUVELLE;
      return {
        ok: true as const,
        documentId: NOUVELLE,
        numero: "AXI-LM-2",
        lettreAnnuleeId: null,
      };
    }),
    envoyer: vi.fn(async () => "envoye"),
    telegram: vi.fn(async () => true),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: h.telegram }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: vi.fn(async () => true) }));
vi.mock("@/server/qualiopi/documents/lettre-mission-v2-generation", () => ({
  genererLettreMissionV2: h.generer,
}));
vi.mock("../envois", () => ({ envoyer: h.envoyer }));
vi.mock("../garde-mission-portes", () => ({
  controlerGardeMission: vi.fn(async () => ({ mode: "coupee", refus: [], avertissements: [] })),
}));
vi.mock("../contrat-cadre-en-vigueur", () => ({
  lireContratCadreSigne: vi.fn(async () => ({ version: 3, signeLe: new Date("2026-10-01") })),
}));

import {
  MOTIF_DATES_MODIFIEES,
  MOTIF_RECTIFICATION,
  ceQuiChange,
  reevaluerMission,
} from "../moteur-mission";

const MAINTENANT = new Date("2026-10-12T09:00:00Z");

function mission(signee: boolean, dateDebut = "2026-11-04T08:00:00Z") {
  h.etat.signees = signee ? 1 : 0;
  return {
    id: MISSION,
    statut: "acceptee",
    role: "principal",
    trainerId: TRAINER,
    sessionId: "s-1",
    lettreMissionId: ANCIENNE,
    lettreBlocageMotif: null,
    tarifHtCents: 35_000,
    forfaitDeplacementParJourHtCents: 0,
    regimeTvaFige: "franchise_293b",
    trainer: {
      statut: "sous_traitant",
      organismeSousTraitantId: null,
      regimeTvaHonoraires: "franchise_293b",
      prenom: "Marie",
      nom: "Dupont",
      email: "marie@example.test",
    },
    session: {
      numero: "AXI-SESS-TEST",
      titreSession: "IA pour managers",
      statut: "planifiee",
      dateDebut: new Date(dateDebut),
      dateFin: new Date("2026-11-05T16:00:00Z"),
      formateurPrincipalId: TRAINER,
      lieuType: "sur_site",
      lieuAdresse: "12 rue Exemple",
      lieuCodePostal: "69003",
      lieuVille: "Lyon",
      jours: [{ date: new Date("2026-11-06T00:00:00Z"), heureDebut: "09:00", heureFin: "17:00" }],
    },
    // L'ancienne lettre portait d'autres dates : empreinte et résumé différents.
    lettreMission: {
      annuleeAt: null,
      metadata: {
        empreinteMission: "0".repeat(64),
        resumeMission: {
          dates: ["2026-11-04 09:00-17:00"],
          lieu: "12 rue Exemple 69003 Lyon",
          honoraires: "35000/0",
        },
      },
      signatures: signee ? [{ partie: "formateur" }] : [],
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("L11e — lettre périmée", () => {
  it("non signée : remplacée sans motif de rectification, F29 dit ce qui change", async () => {
    h.etat.mission = mission(false);
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe(
      "lettre_rectifiee",
    );
    expect(h.generer).toHaveBeenCalledWith(
      expect.not.objectContaining({ rectificationMotif: expect.anything() }),
    );
    const envoi = (
      h.envoyer.mock.calls[0] as unknown as [
        { gabarit: string; payload: { valeurs: Record<string, string> } },
      ]
    )[0];
    expect(envoi.gabarit).toBe("formateur-lettre-rectifiee");
    expect(envoi.payload.valeurs["ce qui change"]).toBe("les dates");
    expect(JSON.stringify(h.telegram.mock.calls)).not.toMatch(/Marie|IA pour managers/);
  });

  it("correctif : l'ancienne lettre non signée est annulée au motif fermé « dates_modifiees »", async () => {
    h.etat.mission = mission(false);
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.generer).toHaveBeenCalledWith(
      expect.objectContaining({ missionId: MISSION, motifAnnulation: MOTIF_DATES_MODIFIEES }),
    );
  });

  it("correctif : F29 qui ne part pas est journalisé et signalé", async () => {
    h.etat.mission = mission(false);
    h.envoyer.mockResolvedValueOnce("indisponible" as never);
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(JSON.stringify(h.telegram.mock.calls)).toContain("formateur-lettre-rectifiee");
  });

  it("signée : lettre RECTIFICATIVE, avec son motif", async () => {
    h.etat.mission = mission(true);
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.generer).toHaveBeenCalledWith(
      expect.objectContaining({ rectificationMotif: MOTIF_RECTIFICATION }),
    );
  });

  it("rectificative non signée mais lettre d'origine signée : le motif est donné", async () => {
    h.etat.mission = mission(false);
    h.etat.signees = 1;
    await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(h.generer).toHaveBeenCalledWith(
      expect.objectContaining({ rectificationMotif: MOTIF_RECTIFICATION }),
    );
  });

  it("session commencée : rien (la console la montre « à rectifier »)", async () => {
    h.etat.mission = mission(false, "2026-10-01T08:00:00Z");
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("rien");
    expect(h.generer).not.toHaveBeenCalled();
  });

  it("ce qui change, en clair", () => {
    const a = { dates: ["x"], lieu: "L", honoraires: "1/0" };
    expect(ceQuiChange(null, a)).toBe("les dates, le lieu ou les honoraires");
    expect(ceQuiChange(a, { ...a, lieu: "M", honoraires: "2/0" })).toBe(
      "le lieu et les honoraires",
    );
  });
});
