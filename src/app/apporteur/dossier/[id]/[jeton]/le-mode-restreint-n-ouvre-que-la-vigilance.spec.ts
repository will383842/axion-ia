import { beforeEach, describe, expect, it, vi } from "vitest";

// MODE RESTREINT (2026-10-07) : un apporteur retiré du réseau avec de l'argent en jeu
// ne peut plus que déposer ses attestations de vigilance. Activité, autres pièces et
// signature sont refusées CÔTÉ SERVEUR, quel que soit l'état de son dossier.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  lireDossierParLien: vi.fn(),
  deposerPiece: vi.fn(),
  enregistrerActivite: vi.fn(),
}));

vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  TAILLE_MAX_PIECE: 10 * 1024 * 1024,
  deposerPiece: (...a: unknown[]) => h.deposerPiece(...a),
  enregistrerActivite: (...a: unknown[]) => h.enregistrerActivite(...a),
  lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
}));
vi.mock("@/features/apporteurs-reseau/annuaire", () => ({ lireEntrepriseParSiren: vi.fn() }));
vi.mock("@/features/apporteurs-reseau/signature", async () => {
  const regles = await import("@/features/apporteurs-reseau/signature-regles");
  return { ...regles, signerContrat: vi.fn() };
});
vi.mock("@/lib/client-ip", () => ({
  getClientIp: async () => "203.0.113.9",
  getClientUserAgent: async () => null,
}));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { deposerPieceAction, enregistrerActiviteAction } from "./actions";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JETON = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";

function depot(type: string): FormData {
  const fichier = new File([new Uint8Array([37, 80, 68, 70])], "piece.pdf", {
    type: "application/pdf",
  });
  // L'environnement de test ne donne pas `arrayBuffer` à un fichier passé par FormData.
  Object.defineProperty(fichier, "arrayBuffer", {
    value: async () => new Uint8Array([37, 80, 68, 70]).buffer,
  });
  const champs: Record<string, unknown> = { id: ID, jeton: JETON, type, fichier };
  return { get: (k: string) => champs[k] ?? null, getAll: () => [] } as unknown as FormData;
}

const RESTREINT = { id: ID, statut: "signe", restreint: true, pieces: [] };

beforeEach(() => {
  vi.clearAllMocks();
  h.deposerPiece.mockResolvedValue({ ok: true });
});

describe("mode restreint", () => {
  it("dépose une attestation d'immatriculation (vigilance) : accepté", async () => {
    h.lireDossierParLien.mockResolvedValue(RESTREINT);
    expect((await deposerPieceAction(depot("immatriculation"))).ok).toBe(true);
    expect(h.deposerPiece).toHaveBeenCalledTimes(1);
  });

  it.each(["rib", "identite", "rc_pro"])("dépose « %s » : refusé, rien n'est écrit", async (t) => {
    h.lireDossierParLien.mockResolvedValue(RESTREINT);
    expect((await deposerPieceAction(depot(t))).ok).toBe(false);
    expect(h.deposerPiece).not.toHaveBeenCalled();
  });

  it("même un dossier « modifiable » ne l'est plus : l'activité est refusée", async () => {
    h.lireDossierParLien.mockResolvedValue({ ...RESTREINT, statut: "dossier_en_cours" });
    const fd = new FormData();
    fd.set("id", ID);
    fd.set("jeton", JETON);
    expect((await enregistrerActiviteAction(fd)).ok).toBe(false);
    expect(h.enregistrerActivite).not.toHaveBeenCalled();
  });

  it("contre-témoin : sans restriction, un RIB se dépose sur un dossier en cours", async () => {
    h.lireDossierParLien.mockResolvedValue({ id: ID, statut: "dossier_en_cours", pieces: [] });
    expect((await deposerPieceAction(depot("rib"))).ok).toBe(true);
  });
});
