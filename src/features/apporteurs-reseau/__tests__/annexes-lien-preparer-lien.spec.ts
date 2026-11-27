// Relecture de la PR #2392 (🟡 2) : `preparerLien` joint la fiche, le livret et le guide au lien du
// contrat à SIGNER (dossier en cours), pas à l'e-mail « Retrouver mon espace » (dossier signé).
// R2 en panne : le lien part quand même, sans pièce ni phrase.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  lireDossier: vi.fn(),
  entete: vi.fn(),
  dernierLog: vi.fn(),
}));

vi.mock("../annuaire", () => ({ lireEntrepriseParSiren: vi.fn(), lireRegistre: vi.fn() }));
vi.mock("../apercu-envoi", () => ({ apercu: vi.fn() }));
vi.mock("../envois", () => ({
  envoyer: vi.fn(),
  avecTexteLibre: (payload: Record<string, unknown>, texte?: string) =>
    texte ? { ...payload, texteLibre: texte } : payload,
}));
vi.mock("../donnees", () => ({
  lireDossier: (...a: unknown[]) => h.lireDossier(...a),
  purgerContenuPieces: vi.fn(),
}));
vi.mock("../retrait", () => ({ retraitDe: async () => null }));
vi.mock("../jeton", () => ({
  urlDossier: (id: string) => `https://axion-ia.com/apporteur/dossier/${id}/jeton`,
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("../contrat-pdf", () => ({
  texteDuContrat: vi.fn(),
  empreinte: vi.fn(),
  rendreContratPdf: vi.fn(),
}));
vi.mock("@/lib/r2-storage", () => ({
  deleteFromR2: vi.fn(),
  enteteObjetR2: (...a: unknown[]) => h.entete(...a),
  getObjectBufferR2: vi.fn(),
  isR2Configured: () => true,
  uploadToR2: vi.fn(),
}));
vi.mock("../guide-demarrage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../guide-demarrage")>()),
  lireGuideDemarrage: async () => null,
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: { findUnique: async () => ({ submissionId: null }) },
    emailLog: { findFirst: (...a: unknown[]) => h.dernierLog(...a) },
  },
}));

import { DOCUMENTS_ANNEXES } from "../documents-joints";
import { preparerLien } from "../verification";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const dossier = (statut: string) => ({
  id: ID,
  statut,
  versionLien: 1,
  prenom: "Claire",
  email: "claire@exemple.fr",
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.entete.mockResolvedValue({ taille: 1000, etag: "e" });
  h.dernierLog.mockResolvedValue(null);
});

describe("preparerLien : pièces jointes du lien du contrat à signer", () => {
  it("dossier en cours : le lien porte les trois annexes facultatives et leur liste", async () => {
    h.lireDossier.mockResolvedValue(dossier("dossier_en_cours"));
    const r = await preparerLien(ID, "Bonjour", undefined);
    if (!r.ok) throw new Error("préparation refusée");
    expect(r.envoi.gabarit).toBe("apporteur-dossier-lien");
    expect(r.envoi.attachments?.map((a) => a.r2Key)).toEqual(DOCUMENTS_ANNEXES.map((d) => d.cleR2));
    expect(r.envoi.attachments?.every((a) => a.facultative === true)).toBe(true);
    expect(r.envoi.payload).toMatchObject({
      dossierUrl: expect.stringContaining(ID),
      motPersonnel: "Bonjour",
      annexesJointes: ["fiche-commissions", "livret", "guide-demarrage"],
    });
  });

  it("🔴 R2 en panne : le lien est prêt quand même, sans pièce et sans champ annexesJointes", async () => {
    h.entete.mockRejectedValue(new Error("R2 en panne"));
    h.lireDossier.mockResolvedValue(dossier("dossier_en_cours"));
    const r = await preparerLien(ID, null, undefined);
    if (!r.ok) throw new Error("préparation refusée");
    expect(r.envoi.gabarit).toBe("apporteur-dossier-lien");
    expect(r.envoi).not.toHaveProperty("attachments");
    expect(r.envoi.payload).not.toHaveProperty("annexesJointes");
    expect(r.envoi.payload).toMatchObject({ dossierUrl: expect.stringContaining(ID) });
  });

  it.each(["a_verifier", "signe"])(
    "dossier %s : e-mail « Retrouver mon espace », aucune pièce, aucune lecture de R2",
    async (statut) => {
      h.lireDossier.mockResolvedValue(dossier(statut));
      const r = await preparerLien(ID, null, undefined);
      if (!r.ok) throw new Error("préparation refusée");
      expect(r.envoi.gabarit).toBe("apporteur-lien-espace");
      expect(r.envoi).not.toHaveProperty("attachments");
      expect(r.envoi.payload).not.toHaveProperty("annexesJointes");
      expect(h.entete).not.toHaveBeenCalled();
    },
  );
});
