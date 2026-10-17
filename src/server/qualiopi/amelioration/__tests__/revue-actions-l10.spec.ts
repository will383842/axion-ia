/**
 * Chantier QNC, lot L10 — la revue de direction selon `qualiopi.amelioration.actif`.
 *
 *   - ÉTEINT = INCHANGÉ : une revue validée se met encore à jour, le plan
 *     d'actions s'écrit dans `planActions`, un constat va à `reporterConstatRevue` ;
 *   - ALLUMÉ : une revue VALIDÉE est verrouillée (mise à jour ET constat
 *     reporté) ; le plan ne s'écrit plus dans la revue ; un constat ouvre une
 *     action AXI-AMC, à décider par une personne.
 *
 * Mutation qui fait rougir : retirer le refus `REFUS_REVUE_VALIDEE` →
 * « allumé : une revue validée refuse toute écriture » rougit.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/registres/revue-direction-service", () => ({
  creerRevue: vi.fn(),
  updateRevue: vi.fn().mockResolvedValue({}),
  reporterConstatRevue: vi.fn().mockResolvedValue({ id: "r", annee: 2026, creee: false }),
  getRevueParId: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/socle/interrupteurs", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/socle/interrupteurs")>()),
  lireInterrupteurQualiopi: vi.fn(),
}));

vi.mock("@/server/qualiopi/amelioration/registre-amc", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/amelioration/registre-amc")>()),
  ouvrirActionAmelioration: vi.fn().mockResolvedValue({ id: "amc-1", numero: "AXI-AMC-2026-001" }),
}));

vi.mock("@/server/qualiopi/journal/contexte-requete", () => ({ contexteRequeteQualiopi: vi.fn() }));
vi.mock("@/server/qualiopi/journal/nom-administrateur", () => ({
  nomAdministrateur: vi.fn().mockResolvedValue("Will"),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";
import * as service from "@/server/qualiopi/registres/revue-direction-service";
import { ouvrirActionAmelioration } from "@/server/qualiopi/amelioration/registre-amc";
import {
  reporterEnRevueDirectionAction,
  updateRevueDirectionAction,
} from "@/server/actions/qualiopi/revue-direction";

const ID = "550e8400-e29b-41d4-a716-446655440050";
const interrupteur = lireInterrupteurQualiopi as ReturnType<typeof vi.fn>;
const getRevueParId = service.getRevueParId as ReturnType<typeof vi.fn>;

const PLAN = [{ action: "Revoir le livret", responsable: "Will", echeance: "2026-12-01" }];
const VALIDEE = {
  id: ID,
  annee: 2026,
  statut: "validee",
  participants: ["Will"],
  decisions: ["Suivre le décret"],
  planActions: PLAN,
  risques: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  getRevueParId.mockResolvedValue(VALIDEE);
});

describe("interrupteur éteint : rien ne change", () => {
  beforeEach(() => interrupteur.mockResolvedValue("eteint"));

  it("une revue validée se met encore à jour, plan compris", async () => {
    const r = await updateRevueDirectionAction({
      id: ID,
      planActions: [...PLAN, "Nouvelle action"],
    });
    expect(r).toEqual({ data: { id: ID } });
    expect(service.updateRevue).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({
        planActions: expect.arrayContaining([
          expect.objectContaining({ action: "Nouvelle action" }),
        ]),
      }),
    );
  });

  it("un constat va au plan de la revue, comme avant", async () => {
    await reporterEnRevueDirectionAction({ texte: "Trop de théorie", source: "Verbatim" });
    expect(service.reporterConstatRevue).toHaveBeenCalledWith(expect.any(Number), {
      texte: "Trop de théorie",
      source: "Verbatim",
    });
    expect(ouvrirActionAmelioration).not.toHaveBeenCalled();
  });
});

describe("interrupteur allumé", () => {
  beforeEach(() => interrupteur.mockResolvedValue("actif"));

  it("une revue validée refuse toute écriture", async () => {
    for (const champs of [
      { dateRevue: new Date("2026-06-01") },
      { statut: "brouillon" },
      { decisions: ["Autre"] },
    ]) {
      const r = await updateRevueDirectionAction({ id: ID, ...champs });
      expect(r).toMatchObject({ error: expect.stringMatching(/validée : elle est verrouillée/) });
    }
    expect(service.updateRevue).not.toHaveBeenCalled();
  });

  it("brouillon : le plan renvoyé tel quel n'est pas une écriture, un plan modifié est refusé", async () => {
    getRevueParId.mockResolvedValue({ ...VALIDEE, statut: "brouillon" });
    expect(
      await updateRevueDirectionAction({ id: ID, planActions: PLAN, decisions: ["D"] }),
    ).toEqual({ data: { id: ID } });
    expect(service.updateRevue).toHaveBeenCalledWith(ID, { decisions: ["D"] });
    const r = await updateRevueDirectionAction({ id: ID, planActions: [...PLAN, "Ajout"] });
    expect(r).toMatchObject({ error: expect.stringMatching(/registre AXI-AMC/) });
    expect(service.updateRevue).toHaveBeenCalledTimes(1);
  });

  it("un constat ouvre une action AXI-AMC et ne touche pas la revue, même validée", async () => {
    const r = await reporterEnRevueDirectionAction({
      texte: "Trop de théorie",
      source: "Verbatim — S1",
    });
    expect(r).toMatchObject({ data: { id: "amc-1" } });
    expect(service.reporterConstatRevue).not.toHaveBeenCalled();
    expect(service.updateRevue).not.toHaveBeenCalled();
    expect(ouvrirActionAmelioration).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origine: "appreciation",
        constat: "Trop de théorie\n\nSource : Verbatim — S1",
        auteurId: "admin-uuid",
        auteurNom: "Will",
      }),
      expect.anything(),
    );
  });
});
