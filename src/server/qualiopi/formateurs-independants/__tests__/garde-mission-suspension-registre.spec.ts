/**
 * Qualiopi ind. 27 — un sous-traitant SUSPENDU au registre (écart majeur d'un contrôle,
 * non levé) ne reçoit AUCUNE nouvelle mission : la garde de mission refuse, motif dit.
 *
 *   · interrupteur du registre coupé : la suspension n'est pas même lue (tout éteint) ;
 *   · allumé : refus, que les portes de la garde soient allumées ou non, et jamais en
 *     simple avertissement (une suspension est une décision, pas un manque du stock) ;
 *   · lecture en échec, allumé : refus (la garde échoue fermée).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const etat = {
    settings: new Map<string, unknown>(),
    suspension: null as Record<string, unknown> | null,
    panne: false,
  };
  const prisma = {
    setting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        etat.settings.has(where.key) ? { value: etat.settings.get(where.key) } : null,
      ),
    },
    suspensionSousTraitant: {
      findFirst: vi.fn(async () => {
        if (etat.panne) throw new Error("panne");
        return etat.suspension;
      }),
    },
    trainer: {
      findUnique: vi.fn(async () => ({
        statut: "sous_traitant",
        actif: true,
        siret: "12345678900011",
        sousTraitantVerifieAt: new Date("2026-10-10T10:00:00Z"),
        sousTraitantNda: "84380000000",
        sousTraitantContratSigneAt: new Date("2026-09-01T10:00:00Z"),
        finCollaborationAt: null,
        activationValideeSource: "anterieure_au_controle",
        documents: [],
      })),
    },
    documentGenere: {
      findFirst: vi.fn(async () => ({
        metadata: {
          renderData: { gabaritVersion: 99, data: { sousTraitant: { siret: "12345678900011" } } },
        },
        signatures: [{ signeAt: new Date("2026-09-01T10:00:00Z") }],
      })),
    },
    trainerStatement: { findMany: vi.fn(async () => []) },
  };
  return { etat, prisma };
});
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));

import { MANQUES_MISSION } from "../garde-mission";
import { controlerGardeMission } from "../garde-mission-portes";

const MAINTENANT = new Date("2026-10-17T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.settings.clear();
  h.etat.settings.set("formateurs.registre_sous_traitants", { actif: true });
  h.etat.suspension = { suspenduAt: new Date("2026-10-16T10:00:00Z") };
  h.etat.panne = false;
});

describe("garde de mission : suspension au registre des sous-traitants", () => {
  it("🔴 suspendu : nouvelle mission refusée, même portes de la garde coupées", async () => {
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r.mode).toBe("refuser");
    expect(r.refus).toEqual([MANQUES_MISSION.suspenduRegistre]);
    expect(h.prisma.suspensionSousTraitant.findFirst).toHaveBeenCalledWith({
      where: { leveeAt: null, registre: { trainerId: "t-1" } },
      select: { suspenduAt: true },
    });
  });

  it("portes allumées en « avertir » (ancien stock) : la suspension refuse quand même", async () => {
    h.etat.settings.set("formateurs.garde_mission_portes", { actif: true });
    h.etat.settings.set("formateurs.garde_mission", { valeur: "avertir" });
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r.mode).toBe("refuser");
    expect(r.refus).toContain(MANQUES_MISSION.suspenduRegistre);
  });

  it("suspension levée (aucune en cours) : rien ne change", async () => {
    h.etat.suspension = null;
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r).toEqual({ mode: "coupee", refus: [], avertissements: [] });
  });

  it("interrupteur du registre coupé : la suspension n'est pas lue", async () => {
    h.etat.settings.clear();
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r.refus).toEqual([]);
    expect(h.prisma.suspensionSousTraitant.findFirst).not.toHaveBeenCalled();
  });

  it("allumé, lecture en échec : refus (échoue fermée)", async () => {
    h.etat.panne = true;
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r.mode).toBe("refuser");
    expect(r.refus).toEqual([MANQUES_MISSION.erreur]);
  });
});
