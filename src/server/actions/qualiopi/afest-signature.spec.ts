/**
 * Tests — afest-signature.ts (canal « poste du formateur »)
 *
 * Les invariants qui comptent ici sont ceux de la COUCHE ACTION, pas ceux du
 * service (couverts par `signature-afest-service.spec.ts`) :
 *
 *  1. **Un formateur ne fait signer que les séances d'un parcours qu'il anime**,
 *     et la séance doit appartenir au parcours annoncé.
 *  2. **Le porteur est TOUJOURS `poste_formateur`, avec le `trainerId` du
 *     SERVEUR** — jamais celui que le client aurait pu glisser dans l'entrée.
 *  3. **Aucun canal par lien** : `tokenId` ne doit jamais partir d'ici, faute de
 *     registre de jetons AFEST et donc de binding e-mail réel.
 *  4. **`role` et `methode` sont validés avant d'atteindre le service** : les
 *     deux entrent dans le tuple HACHÉ, sur une table append-only.
 *  5. **Une panne de stockage REFUSE la signature**, elle ne la simule pas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { compteRenduSeance: { findUnique: vi.fn() } },
}));
vi.mock("@/server/formateur/guard", () => ({ requireFormateurAction: vi.fn() }));
vi.mock("@/server/qualiopi/coaching-afest/signature/signature-afest-service", () => ({
  signerSeanceAfest: vi.fn(),
}));
// ⚠️ Un `Map` NE convient PAS : `Map.get` rend `undefined` là où `Headers.get`
// rend `null`. Le mock doit être fidèle, sinon il fait échouer du code correct.
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requireFormateurAction } from "@/server/formateur/guard";
import { signerSeanceAfest } from "@/server/qualiopi/coaching-afest/signature/signature-afest-service";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";
import { signerSeanceAfestFormateurAction } from "./afest-signature";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as { compteRenduSeance: { findUnique: Mock } };
const mockFormateur = requireFormateurAction as unknown as Mock;
const mockSigner = signerSeanceAfest as unknown as Mock;

const COACHING = "11111111-1111-4111-8111-111111111111";
const SEANCE = "22222222-2222-4222-8222-222222222222";
const TRAINER = "33333333-3333-4333-8333-333333333333";
const AUTRE = "99999999-9999-4999-8999-999999999999";
const IMAGE = "data:image/png;base64,AAAA";

const ENTREE = {
  coachingSessionId: COACHING,
  compteRenduSeanceId: SEANCE,
  role: "beneficiaire" as const,
  methode: "trace" as const,
  imageDataUrl: IMAGE,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFormateur.mockResolvedValue({
    trainerId: TRAINER,
    nom: "Jullin",
    prenom: "Williams",
    email: "w@axion.test",
  });
  mockPrisma.compteRenduSeance.findUnique.mockResolvedValue({
    coachingSessionId: COACHING,
    coachingSession: { trainerId: TRAINER },
  });
  mockSigner.mockResolvedValue({ ok: true, signatureId: "sig-1", selfHash: "a".repeat(64) });
});

/** Entrée réellement passée au service, pour inspecter ce qui a été demandé. */
function appelService(): Record<string, unknown> {
  return mockSigner.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe("🔴 garde d'appartenance", () => {
  it("refuse une séance introuvable sans jamais atteindre le service", async () => {
    mockPrisma.compteRenduSeance.findUnique.mockResolvedValue(null);
    const res = await signerSeanceAfestFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "seance_introuvable" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("refuse un parcours que le formateur n'anime PAS", async () => {
    mockPrisma.compteRenduSeance.findUnique.mockResolvedValue({
      coachingSessionId: COACHING,
      coachingSession: { trainerId: AUTRE },
    });
    const res = await signerSeanceAfestFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "non_membre" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 refuse une séance qui n'appartient PAS au parcours annoncé", async () => {
    // Sans ce recoupement, un identifiant de séance deviné suffirait à faire
    // signer la séance d'un AUTRE parcours du même formateur — avec les mentions
    // du parcours affiché à l'écran, et l'empreinte scellée sur l'autre.
    mockPrisma.compteRenduSeance.findUnique.mockResolvedValue({
      coachingSessionId: AUTRE,
      coachingSession: { trainerId: TRAINER },
    });
    const res = await signerSeanceAfestFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "non_membre" });
    expect(mockSigner).not.toHaveBeenCalled();
  });
});

describe("🔴 validation de ce qui sera HACHÉ", () => {
  it("refuse une méthode hors énumération", async () => {
    const res = await signerSeanceAfestFormateurAction({
      ...ENTREE,
      methode: "canvas" as unknown as "trace",
    });
    expect(res).toMatchObject({ ok: false, raison: "requete_invalide" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("refuse un rôle hors énumération", async () => {
    // `role` détermine la CHAÎNE (parcours × rôle) : une valeur inventée
    // fonderait une chaîne fantôme, scellée définitivement.
    const res = await signerSeanceAfestFormateurAction({
      ...ENTREE,
      role: "admin" as unknown as "beneficiaire",
    });
    expect(res).toMatchObject({ ok: false, raison: "requete_invalide" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("refuse un identifiant qui n'est pas un UUID", async () => {
    const res = await signerSeanceAfestFormateurAction({
      ...ENTREE,
      compteRenduSeanceId: "pas-un-uuid",
    });
    expect(res).toMatchObject({ ok: false, raison: "requete_invalide" });
    expect(mockSigner).not.toHaveBeenCalled();
  });
});

describe("🔴 le porteur", () => {
  it("est TOUJOURS `poste_formateur`, avec le trainerId du SERVEUR", async () => {
    const res = await signerSeanceAfestFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: true, signatureId: "sig-1" });
    expect(appelService()["porteur"]).toStrictEqual({
      type: "poste_formateur",
      trainerId: TRAINER,
      role: "beneficiaire",
    });
  });

  it("🔴 ne porte JAMAIS de jeton — le canal par lien n'est pas implémenté", async () => {
    // Un jeton sans registre ni binding e-mail réel serait transférable : c'est
    // exactement le trou que `signerSeanceAfest` refuse en dur.
    await signerSeanceAfestFormateurAction(ENTREE);
    const porteur = appelService()["porteur"] as Record<string, unknown>;
    expect(porteur["tokenId"]).toBeUndefined();
    expect(porteur["destinataireEmailSha256"]).toBeUndefined();
    expect(porteur["type"]).not.toBe("lien");
  });

  it("relaie les trois rôles — le canal poste du formateur les admet tous", async () => {
    for (const role of ["beneficiaire", "formateur", "tuteur"] as const) {
      mockSigner.mockClear();
      await signerSeanceAfestFormateurAction({ ...ENTREE, role });
      expect((mockSigner.mock.calls[0]?.[0] as Record<string, unknown>)["porteur"]).toMatchObject({
        role,
      });
    }
  });

  it("transmet le nom confirmé de la modalité accessible, sans image", async () => {
    await signerSeanceAfestFormateurAction({
      coachingSessionId: COACHING,
      compteRenduSeanceId: SEANCE,
      role: "tuteur",
      methode: "confirmation_accessible",
      nomConfirme: "Claire Martin",
    });
    expect(appelService()["nomConfirme"]).toBe("Claire Martin");
    expect(appelService()["imageDataUrl"]).toBeUndefined();
  });
});

describe("🔴 pannes et refus", () => {
  it("une panne de stockage REFUSE la signature, elle ne la simule pas", async () => {
    // Une signature dont l'image n'a pas été écrite est une preuve qui n'existe
    // pas : le formateur aurait vu « signé », le contrôle ne trouverait rien.
    mockSigner.mockRejectedValue(
      new SignatureStockageError("r2_absent", "Stockage R2 non configuré."),
    );
    const res = await signerSeanceAfestFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "stockage" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/papier/);
  });

  it("laisse remonter une erreur qui n'est PAS une panne de stockage", async () => {
    // L'avaler transformerait une panne de base en « signature refusée », et on
    // chercherait le problème du mauvais côté.
    mockSigner.mockRejectedValue(new Error("base indisponible"));
    await expect(signerSeanceAfestFormateurAction(ENTREE)).rejects.toThrow("base indisponible");
  });

  it("relaie tel quel un refus typé du service", async () => {
    mockSigner.mockResolvedValue({
      ok: false,
      raison: "seance_trop_ancienne",
      message: "Le délai de signature de cette séance est dépassé.",
    });
    const res = await signerSeanceAfestFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "seance_trop_ancienne" });
  });
});
