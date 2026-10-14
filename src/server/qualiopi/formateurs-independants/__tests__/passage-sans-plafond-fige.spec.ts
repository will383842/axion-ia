/**
 * Correctif L11e (EXACTITUDE « passage figé à 30 ») — le passage horaire lit
 * toutes les missions acceptées à venir, ne réévalue que celles qui ont quelque
 * chose à faire, et ne plafonne que les ÉMISSIONS. Au-delà de 30 missions en
 * ordre, une mission à traiter n'est jamais oubliée.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  missions: [] as Array<Record<string, unknown>>,
  reevaluees: [] as string[],
  action: "rien" as string,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: {
      findUnique: vi.fn(async () => ({ value: { actif: true } })),
    },
    // Première lecture : les missions acceptées à venir ; seconde : les
    // missions à FERMER (aucune ici).
    missionFormateur: {
      findMany: vi.fn(async (a: { select?: Record<string, unknown> }) =>
        a.select?.lettreMission !== undefined ? h.missions : [],
      ),
    },
    // La réévaluation d'UNE mission passe par sa transaction : on la compte.
    $transaction: vi.fn(async (f: (tx: unknown) => Promise<unknown>) => {
      let cle = "";
      await f({
        $executeRaw: vi.fn(async (_s: TemplateStringsArray, k: string) => {
          cle = k;
          throw new Error("arrêt après le verrou");
        }),
      }).catch(() => undefined);
      h.reevaluees.push(cle.replace("mission-formateur:", ""));
      return { etape: null, action: h.action };
    }),
  },
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: vi.fn() }));
vi.mock("@/server/qualiopi/documents/lettre-mission-v2-generation", () => ({
  MOTIF_CHANGEMENT_FORMATEUR: "Formateur remplacé sur cette session",
  genererLettreMissionV2: vi.fn(),
}));

import { empreinteMission } from "../empreinte-mission";
import { aQuelqueChoseAFaire, empreinteDeLaMission, passerMoteurMissions } from "../moteur-mission";

const MAINTENANT = new Date("2026-10-12T09:00:00Z"); // 11 h à Paris

function mission(n: number, lettre: "aucune" | "a_jour" | "perimee" | "sans_empreinte") {
  const m = {
    id: `m-${String(n).padStart(3, "0")}`,
    role: "principal",
    trainerId: "t-1",
    tarifHtCents: 35_000,
    forfaitDeplacementParJourHtCents: 0,
    regimeTvaFige: "franchise_293b",
    trainer: { regimeTvaHonoraires: "franchise_293b" },
    session: {
      titreSession: `Session ${n}`,
      lieuType: "distanciel",
      lieuAdresse: null,
      lieuCodePostal: null,
      lieuVille: null,
      sessionFormateurs: [{ trainerId: "t-1" }],
      jours: [
        {
          date: new Date("2026-11-04T00:00:00Z"),
          heureDebut: "09:00",
          heureFin: "17:00",
          trainerId: null,
        },
      ],
    },
  };
  const actuelle = empreinteDeLaMission(m as never).empreinte;
  const lettreMission =
    lettre === "aucune"
      ? null
      : {
          annuleeAt: null,
          metadata:
            lettre === "sans_empreinte"
              ? {}
              : { empreinteMission: lettre === "a_jour" ? actuelle : "f".repeat(64) },
        };
  return { ...m, lettreMission };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.reevaluees = [];
  h.action = "rien";
});

describe("passage horaire : rien n'est figé par une borne", () => {
  it("40 missions en ordre puis 3 à traiter : les 3 sont revues, les 40 jamais", async () => {
    h.missions = [
      ...Array.from({ length: 40 }, (_, i) => mission(i, "a_jour")),
      mission(40, "aucune"),
      mission(41, "perimee"),
      mission(42, "aucune"),
    ];
    const r = await passerMoteurMissions(MAINTENANT);
    expect(r.reevaluees).toBe(3);
    expect(h.reevaluees).toEqual(["m-040", "m-041", "m-042"]);
  });

  it("le plafond ne borne que les émissions : 35 lettres dues, 30 partent, les 5 autres au passage suivant", async () => {
    h.action = "lettre_emise";
    h.missions = Array.from({ length: 35 }, (_, i) => mission(i, "aucune"));
    const r = await passerMoteurMissions(MAINTENANT);
    expect(r.lettres).toBe(30);
    // Au passage suivant, les 30 émises ont une lettre à jour : les 5 restantes passent.
    h.reevaluees = [];
    h.missions = [
      ...Array.from({ length: 30 }, (_, i) => mission(i, "a_jour")),
      ...Array.from({ length: 5 }, (_, i) => mission(30 + i, "aucune")),
    ];
    const r2 = await passerMoteurMissions(MAINTENANT);
    expect(r2.lettres).toBe(5);
    expect(h.reevaluees).toEqual(["m-030", "m-031", "m-032", "m-033", "m-034"]);
  });

  it("une lettre sans empreinte (v1, manuelle) n'est jamais jugée à traiter", () => {
    expect(aQuelqueChoseAFaire({ annuleeAt: null, metadata: {} }, "a".repeat(64))).toBe(false);
    expect(aQuelqueChoseAFaire({ annuleeAt: new Date(), metadata: {} }, "a".repeat(64))).toBe(true);
    expect(aQuelqueChoseAFaire(null, "a".repeat(64))).toBe(true);
  });
});

describe("empreinte : une version de contrat ou de gabarit changée ne périme pas", () => {
  it("même mission, contrat-cadre v3 puis v4, gabarit 2 puis 3 : même empreinte", () => {
    const base = {
      intitule: "IA pour managers",
      jours: [{ date: "2026-11-04", heureDebut: "09:00", heureFin: "17:00" }],
      distanciel: false,
      adresse: "12 rue Exemple",
      codePostal: "69003",
      ville: "Lyon",
      tarifHtCents: 35_000,
      forfaitDeplacementParJourHtCents: 8_000,
      regimeTva: "franchise_293b",
      role: "principal",
    };
    expect(empreinteMission({ ...base, versionContratCadre: 3, gabaritVersion: 2 })).toBe(
      empreinteMission({ ...base, versionContratCadre: 4, gabaritVersion: 3 }),
    );
  });
});

describe("étape 4 — l'empreinte suit les journées de la LETTRE (celles du formateur)", () => {
  const avec = (jours: Array<Record<string, unknown>>) =>
    empreinteDeLaMission({
      ...mission(1, "aucune"),
      session: {
        ...(mission(1, "aucune").session as Record<string, unknown>),
        sessionFormateurs: [{ trainerId: "t-1" }, { trainerId: "t-2" }],
        jours,
      },
    } as never).empreinte;
  const jour = (d: string, trainerId: string | null) => ({
    date: new Date(`${d}T00:00:00Z`),
    heureDebut: "09:00",
    heureFin: "17:00",
    trainerId,
  });

  it("une journée ajoutée au co-formateur ne périme pas la lettre", () => {
    expect(avec([jour("2026-11-04", null), jour("2026-11-05", "t-2")])).toBe(
      avec([jour("2026-11-04", null)]),
    );
  });

  it("une journée retirée au formateur (passée au co-formateur) la périme", () => {
    expect(avec([jour("2026-11-04", null), jour("2026-11-05", "t-2")])).not.toBe(
      avec([jour("2026-11-04", null), jour("2026-11-05", "t-1")]),
    );
  });
});
