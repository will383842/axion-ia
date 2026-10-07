import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const lireDossierParLien = vi.fn();
const declarerEntreprise = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: (...a: unknown[]) => lireDossierParLien(...a),
}));
vi.mock("@/features/apporteurs-reseau/declaration-entreprise", () => ({
  declarerEntreprise: (...a: unknown[]) => declarerEntreprise(...a),
  MESSAGE_NEUTRE: "neutre",
}));
vi.mock("@/features/apporteurs-reseau/annuaire", () => ({ lireEntrepriseParSiren: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { declarerEntrepriseAction } from "./actions-declaration";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JETON = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd";

function formulaire(): FormData {
  const fd = new FormData();
  fd.set("id", ID);
  fd.set("jeton", JETON);
  fd.set("siren", "732829320");
  fd.set("personneNom", "Claire Durand");
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ allowed: true });
  lireDossierParLien.mockResolvedValue({ id: ID, statut: "signe" });
  declarerEntreprise.mockResolvedValue({ ok: true });
});

describe("declarerEntrepriseAction", () => {
  it("jeton invalide : réponse neutre, rien n'est déclaré", async () => {
    lireDossierParLien.mockResolvedValue(null);
    expect(await declarerEntrepriseAction(formulaire())).toEqual({ ok: false, message: "neutre" });
    expect(declarerEntreprise).not.toHaveBeenCalled();
  });

  it("statut autre que signé : même réponse neutre", async () => {
    lireDossierParLien.mockResolvedValue({ id: ID, statut: "a_verifier" });
    expect((await declarerEntrepriseAction(formulaire())).ok).toBe(false);
    expect(declarerEntreprise).not.toHaveBeenCalled();
  });

  it("débit dépassé : refus avant toute lecture", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await declarerEntrepriseAction(formulaire())).ok).toBe(false);
    expect(lireDossierParLien).not.toHaveBeenCalled();
  });

  it("succès : déclare pour l'apporteur du LIEN, jamais pour un identifiant du formulaire", async () => {
    expect(await declarerEntrepriseAction(formulaire())).toEqual({ ok: true });
    expect(declarerEntreprise.mock.calls[0]![0]).toBe(ID);
  });
});
