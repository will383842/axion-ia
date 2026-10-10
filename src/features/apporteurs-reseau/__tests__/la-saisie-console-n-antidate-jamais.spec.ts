// Contrat 2.3, art. 3.2 et 3.4 (relecture de a1, 2026-10-07) : une déclaration ne vaut que par
// le formulaire, et sa durée court de l'HORODATAGE PAR LE SERVEUR. La saisie console (rattrapage
// d'une déclaration faite par le formulaire et non enregistrée) ne peut donc pas être antidatée :
// la date est celle de l'enregistrement, quelle que soit la date transmise.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ create: vi.fn(), apporteur: vi.fn(), siennes: vi.fn() }));
// Contrat 2.6 : présentations existantes d'avant la 2.6 (toute l'entreprise) ; écriture du SIRET simulée.
vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, vrai.AVANT_2_6] as const)),
    lireSiretsDevis: async () => new Map(),
    lireDecisionsAAttribuer: async () => new Map(),
    lireAAttribuerEnAttente: async () => [],
    ouvrirAAttribuer: vi.fn(async () => true),
    enregistrerEtablissement: vi.fn(async () => undefined),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => v, decryptPii: (v: string) => v }));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "h" }));
vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: vi.fn(),
  lireEtablissementParSiret: vi.fn(),
}));
vi.mock("../rebonds", () => ({ idsPriseDeContactRebondie: vi.fn(async () => new Set()) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: { findUnique: (...a: unknown[]) => h.apporteur(...a) },
    presentationEntreprise: {
      create: (...a: unknown[]) => h.create(...a),
      findMany: (...a: unknown[]) => h.siennes(...a),
    },
    $transaction: async (f: (t: unknown) => unknown) =>
      f({ presentationEntreprise: { create: (...a: unknown[]) => h.create(...a) } }),
  },
}));

import { creerPresentation } from "../presentations";

const MAINTENANT = new Date("2026-10-08T09:00:00Z");
const SAISIE = {
  apporteurId: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  siret: "73282932000074",
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
  h.siennes.mockResolvedValue([]);
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

describe("saisie console — doublon (même contrôle que le formulaire)", () => {
  it("🔴 une présentation encore RÉSERVÉE du même apporteur pour ce SIREN : refusée, rien créé", async () => {
    h.siennes.mockResolvedValue([{ statut: "reservee", protegeeJusquAt: null }]);
    const r = await creerPresentation({ ...SAISIE } as never, MAINTENANT);
    expect(r.ok).toBe(false);
    expect(h.create).not.toHaveBeenCalled();
    expect(h.siennes.mock.calls[0]![0].where).toMatchObject({
      apporteurId: SAISIE.apporteurId,
      siren: SAISIE.siret.slice(0, 9),
    });
  });

  it("protégée et NON échue : refusée", async () => {
    h.siennes.mockResolvedValue([
      { statut: "confirmee", protegeeJusquAt: new Date("2027-01-01T00:00:00Z") },
    ]);
    expect((await creerPresentation({ ...SAISIE } as never, MAINTENANT)).ok).toBe(false);
  });

  it("protection ÉCHUE : la nouvelle présentation est enregistrée", async () => {
    h.siennes.mockResolvedValue([
      { statut: "confirmee", protegeeJusquAt: new Date("2026-09-01T00:00:00Z") },
    ]);
    expect((await creerPresentation({ ...SAISIE } as never, MAINTENANT)).ok).toBe(true);
    expect(h.create).toHaveBeenCalledOnce();
  });
});
