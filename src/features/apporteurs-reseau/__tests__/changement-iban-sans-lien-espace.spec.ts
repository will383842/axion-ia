/**
 * Plan §6.1 : les cinq e-mails de sécurité du compte bancaire ne portent JAMAIS le lien personnel
 * de l'espace ; le lien « Bloquer » (signé, sans `versionLien`) survit au renouvellement du lien.
 * Ici `avecLienEspace` est le VRAI ; seule la base est simulée. Fixtures fictives.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const APPORTEUR = "33333333-3333-4333-8333-333333333333";
const ID = "11111111-1111-4111-8111-111111111111";

vi.hoisted(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-auth";
});

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  retraitDe: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { apporteurReseau: { findUnique: m.findUnique } } }));
vi.mock("../retrait", async (orig) => ({
  ...(await orig<typeof import("../retrait")>()),
  retraitDe: m.retraitDe,
}));

import { avecLienEspace } from "../envois";
import { lienBloquerDemande, signatureBloquerValide } from "../jeton-changement-iban";

const GABARITS = [
  "apporteur-compte-a-confirmer",
  "apporteur-compte-demande-bloquee",
  "apporteur-compte-change",
  "apporteur-compte-refuse",
  "apporteur-compte-expire",
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  m.retraitDe.mockResolvedValue(null);
  m.findUnique.mockResolvedValue({
    versionLien: 1,
    statut: "signe",
    refuseAt: null,
    resilieAt: null,
  });
});

describe("e-mails de sécurité du compte bancaire", () => {
  it.each(GABARITS)(
    "%s : aucun lien d'espace, même si le payload en apporte un",
    async (gabarit) => {
      const payload = await avecLienEspace({
        gabarit,
        destinataire: "jeanne@exemple.fr",
        payload: { prenom: "Jeanne", lienEspace: "https://exemple.fr/apporteur/dossier/x/y" },
        entityType: "ApporteurReseau",
        entityId: APPORTEUR,
      } as Parameters<typeof avecLienEspace>[0]);
      expect(payload).not.toHaveProperty("lienEspace");
      expect(JSON.stringify(payload)).not.toMatch(/apporteur\/dossier/);
      expect(m.findUnique).not.toHaveBeenCalled();
    },
  );

  it("le lien « Bloquer » reste valable après un renouvellement du lien (versionLien + 1)", () => {
    const lien = lienBloquerDemande(ID, APPORTEUR)!;
    m.findUnique.mockResolvedValue({ versionLien: 2 });
    expect(signatureBloquerValide(ID, APPORTEUR, lien.split("/").pop()!)).toBe(true);
  });
});
