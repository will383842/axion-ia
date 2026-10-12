/**
 * Lot D (M6) — SIREN actif au paiement d'une mission : même règle qu'à la
 * signature du contrat-cadre. Un contrôle récent qui confirme suffit ; sinon le
 * registre est relu ; un rouge, un registre muet ou un SIRET absent refusent.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const trainerFindUnique = vi.fn();
const findMany = vi.fn();
const controler = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { findUnique: (...a: unknown[]) => trainerFindUnique(...a) },
    verificationRegistreSousTraitance: { findMany: (...a: unknown[]) => findMany(...a) },
  },
}));
vi.mock("@/server/qualiopi/formateurs-independants/controle", () => ({
  SOURCE_REGISTRE: "registre_entreprises+liste_of",
  controlerRegistreFormateur: (...a: unknown[]) => controler(...a),
}));

import { entrepriseActiveAuPaiement } from "./contrat-cadre-signature";

const T = "22222222-2222-4222-8222-222222222222";
const SIRET = "98765432100017";
const MAINTENANT = new Date("2026-10-12T09:00:00Z");
const PREUVE_ACTIVE = {
  entreprise: { etatAdministratif: "A", etablissement: { siret: SIRET, ouvert: true } },
};

function ligne(over: Record<string, unknown> = {}) {
  return {
    verdict: "vert",
    source: "registre_entreprises+liste_of",
    verifieAt: new Date("2026-10-01T09:00:00Z"),
    createdAt: new Date("2026-10-01T09:00:00Z"),
    motif: null,
    siret: SIRET,
    reponseSource: PREUVE_ACTIVE,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  trainerFindUnique.mockResolvedValue({ siret: "987 654 321 00017" });
  findMany.mockResolvedValue([]);
  controler.mockResolvedValue({ ok: true, siret: SIRET, verdict: "vert", motifs: [] });
});

describe("entrepriseActiveAuPaiement", () => {
  it("contrôle de moins de 30 jours qui confirme : vrai, sans relire le registre", async () => {
    findMany.mockResolvedValue([ligne()]);
    expect(await entrepriseActiveAuPaiement(T, MAINTENANT, null)).toBe(true);
    expect(controler).not.toHaveBeenCalled();
  });

  it("aucun contrôle récent : le registre est relu, l'administrateur est l'auteur", async () => {
    expect(await entrepriseActiveAuPaiement(T, MAINTENANT, "admin-1")).toBe(true);
    expect(controler).toHaveBeenCalledTimes(1);
    expect(controler.mock.calls[0]![2]).toMatchObject({ trainerId: T, verifieParId: "admin-1" });
  });

  it("registre relu : entreprise fermée → faux", async () => {
    controler.mockResolvedValue({
      ok: true,
      siret: SIRET,
      verdict: "rouge",
      motifs: ["siren_inactif"],
    });
    expect(await entrepriseActiveAuPaiement(T, MAINTENANT, null)).toBe(false);
  });

  it("registre muet ou fiche hors périmètre → faux", async () => {
    controler.mockRejectedValue(new Error("délai"));
    expect(await entrepriseActiveAuPaiement(T, MAINTENANT, null)).toBe(false);
    controler.mockResolvedValue({ ok: false, raison: "hors_perimetre" });
    expect(await entrepriseActiveAuPaiement(T, MAINTENANT, null)).toBe(false);
  });

  it("SIRET relu différent de celui de la fiche → faux", async () => {
    controler.mockResolvedValue({ ok: true, siret: "11111111100011", verdict: "vert", motifs: [] });
    expect(await entrepriseActiveAuPaiement(T, MAINTENANT, null)).toBe(false);
  });

  it("dernier contrôle rouge sur le même SIRET → faux, sans relire", async () => {
    findMany.mockResolvedValue([ligne({ verdict: "rouge", motif: "siren_inactif" })]);
    expect(await entrepriseActiveAuPaiement(T, MAINTENANT, null)).toBe(false);
    expect(controler).not.toHaveBeenCalled();
  });

  it("fiche sans SIRET valide → faux, rien n'est lu", async () => {
    trainerFindUnique.mockResolvedValue({ siret: null });
    expect(await entrepriseActiveAuPaiement(T, MAINTENANT, null)).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });
});
