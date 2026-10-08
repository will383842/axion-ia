// Contrat 2.3, art. 3.2 et 3.4 (relecture de a1, 2026-10-07) : une déclaration ne vaut que par
// le formulaire, et sa durée court de l'HORODATAGE PAR LE SERVEUR. La saisie console (rattrapage
// d'une déclaration faite par le formulaire et non enregistrée) ne peut donc pas être antidatée :
// la date est celle de l'enregistrement, quelle que soit la date transmise.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ create: vi.fn(), apporteur: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => v, decryptPii: (v: string) => v }));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "h" }));
vi.mock("../annuaire", () => ({ lireEntrepriseParSiren: vi.fn() }));
vi.mock("../rebonds", () => ({ idsPriseDeContactRebondie: vi.fn(async () => new Set()) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: { findUnique: (...a: unknown[]) => h.apporteur(...a) },
    presentationEntreprise: { create: (...a: unknown[]) => h.create(...a) },
  },
}));

import { creerPresentation } from "../presentations";

const MAINTENANT = new Date("2026-10-08T09:00:00Z");
const SAISIE = {
  apporteurId: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  siren: "732829320",
  denomination: "Danone",
  personneNom: "Claire Durand",
  personneFonction: "DG",
  personneEmail: "claire@exemple.fr",
  personneTelephone: null,
  besoin: null,
  dateEchange: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.apporteur.mockResolvedValue({ statut: "signe" });
  h.create.mockResolvedValue({ id: "p1" });
});

describe("saisie console d'une déclaration", () => {
  it("🔴 une date ANTÉRIEURE transmise est ignorée : la déclaration est horodatée par le serveur", async () => {
    const r = await creerPresentation(
      { ...SAISIE, recueAt: new Date("2026-09-01T08:00:00Z") },
      MAINTENANT,
    );
    expect(r).toMatchObject({ ok: true });
    expect(h.create.mock.calls[0]![0].data.recueAt).toEqual(MAINTENANT);
  });

  it("sans date transmise : l'heure du serveur aussi", async () => {
    await creerPresentation({ ...SAISIE } as never, MAINTENANT);
    expect(h.create.mock.calls[0]![0].data.recueAt).toEqual(MAINTENANT);
  });
});
