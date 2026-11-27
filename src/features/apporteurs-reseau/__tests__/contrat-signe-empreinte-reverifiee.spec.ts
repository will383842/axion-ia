import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Point 12 (#2464, PR B) : l'empreinte du contrat est REVÉRIFIÉE à la lecture. Un fichier altéré
// n'est jamais servi ; l'alerte part une seule fois ; aucune clé R2 dans le message.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  lireR2: vi.fn(),
  enqueue: vi.fn(async (..._a: unknown[]) => ({ enqueued: true })),
  vus: new Set<string>(),
}));

vi.mock("@/lib/r2-storage", () => ({
  deleteFromR2: vi.fn(),
  getObjectBufferR2: (...a: unknown[]) => h.lireR2(...a),
  isR2Configured: () => true,
  uploadToR2: vi.fn(),
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: { apporteurReseau: { findUnique: (...a: unknown[]) => h.findUnique(...a) } },
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => h.enqueue(...a) }));
vi.mock("@/lib/destinataires-internes", () => ({ destinataireAlertesInternes: () => "w@x.fr" }));
vi.mock("../commissions", () => ({
  dejaEnvoye: async (id: string) => {
    const deja = h.vus.has(id);
    h.vus.add(id);
    return deja;
  },
}));
vi.mock("../annuaire", () => ({ lireEntrepriseParSiren: vi.fn(), lireRegistre: vi.fn() }));
vi.mock("../alerte-telegram", () => ({ alerterContresignature: vi.fn() }));
vi.mock("../apercu-envoi", () => ({ apercu: vi.fn() }));
vi.mock("../envois", () => ({ envoyer: vi.fn(), avecTexteLibre: (p: unknown) => p }));
vi.mock("../donnees", () => ({ lireDossier: vi.fn(), purgerContenuPieces: vi.fn() }));
vi.mock("../contrat-pdf", () => ({
  texteDuContrat: vi.fn(),
  empreinte: vi.fn(),
  rendreContratPdf: vi.fn(),
}));

import { lireContratPdf } from "../verification";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const PDF = Buffer.from("%PDF-1.7 contrat");
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

function dossier(sha256: string | null) {
  h.findUnique.mockResolvedValue({
    contratCle: "k/apporteur.pdf",
    contratSigneCle: `contrats-signes/apporteurs/${ID}/c.pdf`,
    contratSha256: sha256,
    contratSigneSha256: sha256,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.vus.clear();
});

describe("lireContratPdf : empreinte revérifiée", () => {
  it("fichier intact → servi, aucune alerte", async () => {
    dossier(sha(PDF));
    h.lireR2.mockResolvedValue(PDF);
    expect(await lireContratPdf(ID, "signe")).toEqual(PDF);
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it("un octet changé → null et une alerte critique sans clé R2", async () => {
    dossier(sha(PDF));
    const abime = Buffer.from(PDF);
    abime[3] = (abime[3] ?? 0) ^ 1;
    h.lireR2.mockResolvedValue(abime);
    expect(await lireContratPdf(ID, "signe")).toBeNull();
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    const payload = h.enqueue.mock.calls[0]![3] as Record<string, string>;
    expect(payload.niveau).toBe("critique");
    expect(payload.code).toBe("apporteur_contrat_altere");
    expect(JSON.stringify(h.enqueue.mock.calls[0]!)).not.toContain("contrats-signes/");
  });

  it("le même appel deux fois → une seule alerte", async () => {
    dossier(sha(PDF));
    h.lireR2.mockResolvedValue(Buffer.from("autre"));
    expect(await lireContratPdf(ID, "signe")).toBeNull();
    expect(await lireContratPdf(ID, "signe")).toBeNull();
    expect(h.enqueue).toHaveBeenCalledTimes(1);
  });

  it("empreinte absente en base → servi", async () => {
    dossier(null);
    h.lireR2.mockResolvedValue(PDF);
    expect(await lireContratPdf(ID, "apporteur")).toEqual(PDF);
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it("R2 rend null → null, sans alerte « altéré »", async () => {
    dossier(sha(PDF));
    h.lireR2.mockResolvedValue(null);
    expect(await lireContratPdf(ID, "signe")).toBeNull();
    expect(h.enqueue).not.toHaveBeenCalled();
  });
});
