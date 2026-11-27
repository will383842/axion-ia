// Relecture de la PR #2392 (🟡 2) : les rappels du dossier (J+3, J+7) portent aussi la fiche, le
// livret et le guide, SANS changer leur identifiant de job (idempotence). R2 en panne : le
// rappel part quand même, sans pièce.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  envoyer: vi.fn(),
  entete: vi.fn(),
  apporteurs: vi.fn(),
  logsLien: vi.fn(),
}));

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
  };
});
vi.mock("../avoir-client", () => ({ reprendreApresAvoirsClients: vi.fn(async () => ({})) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../jeton", () => ({
  urlDossier: (id: string) => `https://axion-ia.com/apporteur/dossier/${id}/jeton`,
}));
vi.mock("../envois", () => ({ envoyer: (...a: unknown[]) => h.envoyer(...a) }));
vi.mock("../alerte-vigilance", () => ({ alerterPiecesVigilanceDeposees: vi.fn(async () => 0) }));
vi.mock("../facturation", () => ({
  facturerCommissionsDues: async () => ({
    autofactures: 0,
    commissions: 0,
    ecartees: 0,
    erreurs: 0,
  }),
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("../commissions", async (orig) => ({
  ...(await orig<typeof import("../commissions")>()),
  dejaEnvoye: async () => false,
}));
vi.mock("@/lib/r2-storage", async (orig) => ({
  ...(await orig<typeof import("@/lib/r2-storage")>()),
  enteteObjetR2: (...a: unknown[]) => h.entete(...a),
  isR2Configured: () => true,
}));
vi.mock("../guide-demarrage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../guide-demarrage")>()),
  lireGuideDemarrage: async () => null,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: { findMany: vi.fn(async () => []) },
    presentationReservation: { findMany: vi.fn(async () => []) },
    commissionApporteur: { groupBy: vi.fn(async () => []), findMany: vi.fn(async () => []) },
    pieceApporteur: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    devis: { findMany: vi.fn(async () => []) },
    apporteurReseau: { findMany: (...a: unknown[]) => h.apporteurs(...a) },
    emailLog: {
      count: vi.fn(async () => 0),
      findMany: (...a: unknown[]) => h.logsLien(...a),
    },
  },
}));

import { DOCUMENTS_ANNEXES } from "../documents-joints";
import { passerReseauApporteurs } from "../passage-quotidien";

const MAINTENANT = new Date("2026-10-10T07:00:00Z");
// Lien envoyé il y a 4 jours : premier rappel (J+3).
const LIEN_ENVOYE = new Date("2026-10-06T07:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  h.envoyer.mockResolvedValue("envoye");
  h.entete.mockResolvedValue({ taille: 1000, etag: "e" });
  // Seule l'étape des rappels lit les apporteurs « dossier_en_cours ».
  h.apporteurs.mockImplementation(async (a: { where?: { statut?: string } }) =>
    a?.where?.statut === "dossier_en_cours"
      ? [{ id: "A1", prenom: "Claire", email: "c@x.fr", versionLien: 1, submissionId: null }]
      : [],
  );
  h.logsLien.mockImplementation(async (a: { where?: { template?: string } }) =>
    a?.where?.template === "apporteur-dossier-lien"
      ? [{ id: "L1", sentAt: LIEN_ENVOYE, jobId: "apporteur-dossier-lien-A1-1", bounceType: null }]
      : [],
  );
});

function rappelEnvoye(): Record<string, unknown> | undefined {
  return h.envoyer.mock.calls
    .map((c) => c[0] as Record<string, unknown>)
    .find((e) => e["gabarit"] === "apporteur-dossier-lien");
}

describe("rappel du dossier : pièces jointes du lien du contrat", () => {
  it("le rappel porte les trois annexes facultatives ; le jobId de rappel est INCHANGÉ", async () => {
    const bilan = await passerReseauApporteurs(MAINTENANT);
    const e = rappelEnvoye();
    expect(e).toBeDefined();
    expect(e?.["jobId"]).toBe("apporteur-dossier-rappel-A1-L1-j3");
    expect((e?.["attachments"] as { r2Key: string }[]).map((a) => a.r2Key)).toEqual(
      DOCUMENTS_ANNEXES.map((d) => d.cleR2),
    );
    expect((e?.["attachments"] as { facultative?: boolean }[]).every((a) => a.facultative)).toBe(
      true,
    );
    expect(e?.["payload"]).toMatchObject({
      rappel: 1,
      annexesJointes: ["fiche-commissions", "livret", "guide-demarrage"],
    });
    expect(bilan.rappelsDossier).toBe(1);
  });

  it("🔴 R2 en panne : le rappel part quand même, sans pièce ni champ annexesJointes", async () => {
    h.entete.mockRejectedValue(new Error("R2 en panne"));
    const bilan = await passerReseauApporteurs(MAINTENANT);
    const e = rappelEnvoye();
    expect(e).toBeDefined();
    expect(e?.["jobId"]).toBe("apporteur-dossier-rappel-A1-L1-j3");
    expect(e).not.toHaveProperty("attachments");
    expect(e?.["payload"]).not.toHaveProperty("annexesJointes");
    expect(e?.["payload"]).toMatchObject({ rappel: 1 });
    expect(bilan.rappelsDossier).toBe(1);
  });
});
