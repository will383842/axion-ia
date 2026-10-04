/**
 * Lot OPCO A5 — l'ajout d'un relevé d'état des fonds : sourcé en https,
 * journalisé, et JAMAIS une modification (aucune action de mise à jour ni de
 * suppression n'est exportée).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
const requireAdminWrite = vi.fn();
const logActivity = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { etatFondsOpco: { create: (a: unknown) => create(a) } },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => requireAdminWrite(),
  logQualiopiActivity: (a: unknown) => logActivity(a),
}));

import * as actions from "./etat-fonds-opco";

const SOURCE =
  "https://www.akto.fr/breve/entreprises-moins-50-salaries-suspension-financement-formations-pdc/";
const saisie = {
  opco: "akto",
  idcc: "2149",
  statut: "suspendu",
  perimetre: "Activités du déchet — entreprises de moins de 50 salariés",
  dateLimiteDepot: "",
  sourceUrl: SOURCE,
  releveLe: "2026-10-04",
  note: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminWrite.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111" });
  create.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
});

describe("ajouterReleveEtatFondsAction", () => {
  it("refuse une source non https, sans écrire ni journaliser", async () => {
    const r = await actions.ajouterReleveEtatFondsAction({
      ...saisie,
      sourceUrl: "http://www.akto.fr/",
    });
    expect(r).toEqual({ error: expect.stringContaining("https") });
    expect(create).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("vérifie les droits d'écriture AVANT de lire la saisie", async () => {
    requireAdminWrite.mockRejectedValue(new Error("Forbidden"));
    await expect(actions.ajouterReleveEtatFondsAction(saisie)).rejects.toThrow("Forbidden");
    expect(create).not.toHaveBeenCalled();
  });

  it("ajoute une ligne (jamais un update) et journalise", async () => {
    const r = await actions.ajouterReleveEtatFondsAction(saisie);
    expect(r).toEqual({ data: { id: "22222222-2222-4222-8222-222222222222" } });
    const data = create.mock.calls[0]?.[0]?.data;
    expect(data).toMatchObject({
      opco: "akto",
      idcc: "2149",
      statut: "suspendu",
      sourceUrl: SOURCE,
      dateLimiteDepot: null,
      note: null,
      createdById: "11111111-1111-4111-8111-111111111111",
    });
    expect(data.releveLe.toISOString()).toBe("2026-10-04T00:00:00.000Z");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "qualiopi.etat_fonds_opco.ajout",
        targetType: "EtatFondsOpco",
      }),
    );
  });

  it("n'exporte aucune action de modification ni de suppression", () => {
    expect(Object.keys(actions)).toEqual(["ajouterReleveEtatFondsAction"]);
  });
});
