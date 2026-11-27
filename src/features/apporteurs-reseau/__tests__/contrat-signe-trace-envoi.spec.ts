import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Vérification d'un dossier signé : refus définitif (pièces purgées), renvoi du contrat
// signé, lien du dossier dans l'e-mail de contresignature. Tout le serveur est remplacé.
vi.mock("server-only", () => ({}));

const trace = vi.hoisted(() => ({ noter: vi.fn(async (..._a: unknown[]) => undefined) }));
vi.mock("../annexes-versions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../annexes-versions")>()),
  versionCourante: async () => null,
  noterDocumentsRemis: (...a: unknown[]) => trace.noter(...a),
}));
vi.mock("../retrait", () => ({ retraitDe: async () => null }));

const h = vi.hoisted(() => ({
  envoyer: vi.fn(),
  lireDossier: vi.fn(),
  purgerContenuPieces: vi.fn(),
  appUpdate: vi.fn(),
  // Contresignature : réservation conditionnelle (07/10). `count` 1 = réservé, 0 = déjà fait.
  appUpdateMany: vi.fn(async (_a?: unknown) => ({ count: 1 })),
  appFindUnique: vi.fn(),
  registre: vi.fn(),
}));

vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: (...a: unknown[]) => h.registre(...a),
}));

vi.mock("../apercu-envoi", () => ({ apercu: vi.fn() }));
vi.mock("../envois", () => ({
  envoyer: (...a: unknown[]) => h.envoyer(...a),
  avecTexteLibre: (payload: Record<string, unknown>, texte?: string) =>
    texte ? { ...payload, texteLibre: texte } : payload,
}));
vi.mock("../donnees", () => ({
  lireDossier: (...a: unknown[]) => h.lireDossier(...a),
  purgerContenuPieces: (...a: unknown[]) => h.purgerContenuPieces(...a),
}));
const pdf = vi.hoisted(() => ({
  texteDuContrat: vi.fn(),
  rendreContratPdf: vi.fn(),
}));
vi.mock("../contrat-pdf", async () => {
  const { createHash } = await import("node:crypto");
  return {
    texteDuContrat: (...a: unknown[]) => pdf.texteDuContrat(...a),
    empreinte: (t: string) => createHash("sha256").update(t).digest("hex"),
    rendreContratPdf: (...a: unknown[]) => pdf.rendreContratPdf(...a),
  };
});
const r2 = vi.hoisted(() => ({
  deleteFromR2: vi.fn(),
  upload: vi.fn(),
  // Documents annexes (fiche des commissions, livret) : présents sur R2 ou non.
  annexesPresentes: false,
}));
vi.mock("@/lib/r2-storage", () => ({
  deleteFromR2: (...a: unknown[]) => r2.deleteFromR2(...a),
  enteteObjetR2: async (cle: string) =>
    cle.startsWith("documents-apporteurs/") && !r2.annexesPresentes
      ? null
      : { taille: 1000, etag: "e" },
  getObjectBufferR2: vi.fn(),
  isR2Configured: () => true,
  uploadToR2: (...a: unknown[]) => r2.upload(...a),
}));
// La copie embarquée du guide n'existe pas ici : l'application ne dépose rien sur R2 (le dépôt
// automatique est couvert par documents-joints.spec.ts) ; les autres décomptes restent ceux d'avant.
vi.mock("../guide-demarrage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../guide-demarrage")>()),
  lireGuideDemarrage: async () => null,
}));
vi.mock("../documents-prives", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../documents-prives")>()),
  lireFicheCommissions: async () => null,
  lireLivret: async () => null,
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => {
  const tx = { apporteurReseau: { update: (...a: unknown[]) => h.appUpdate(...a) } };
  return {
    prisma: {
      apporteurReseau: {
        findUnique: (...a: unknown[]) => h.appFindUnique(...a),
        update: (...a: unknown[]) => h.appUpdate(...a),
        updateMany: (...a: unknown[]) => h.appUpdateMany(...a),
      },
      emailLog: { findFirst: async () => null },
      pieceApporteur: { update: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      $transaction: async (f: (t: typeof tx) => unknown) => f(tx),
    },
  };
});

import { appliquerDecision, envoyerLien, renvoyerContratSigne } from "../verification";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const cle = `apporteurs/${ID}/contrat-v2-signe-abcdef01.pdf`;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const TEXTE = "CONTRAT signé";

beforeEach(() => {
  vi.clearAllMocks();
  r2.annexesPresentes = true;
  h.envoyer.mockResolvedValue("envoye");
  h.registre.mockResolvedValue({ ok: true, entreprise: { siren: "732829320", active: true } });
  pdf.rendreContratPdf.mockResolvedValue(Buffer.from("%PDF"));
  vi.stubEnv("AUTH_SECRET", "secret-de-test");
});

function dossier(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    statut: "a_verifier",
    versionLien: 2,
    prenom: "Claire",
    email: "claire@exemple.fr",
    siren: "732829320",
    pieces: [{ type: "identite", statut: "conforme" }],
    ...over,
  };
}
function pourContresigner() {
  h.lireDossier.mockResolvedValue(dossier());
  h.appFindUnique.mockResolvedValue({
    signatureApporteur: {
      nomTape: "Claire Martin",
      signeAt: "2026-10-05T10:00:00.000Z",
      ipHash: null,
      navigateur: "Chrome",
      acceptations: [],
      declarations: [],
      texteSha256: sha(TEXTE),
      texte: TEXTE,
      valeurs: { identite: "Claire MARTIN" },
    },
    contratSha256: sha(TEXTE),
  });
}

describe("les annexes remises sont tracées, seulement si l'e-mail est en file", () => {
  it("contresignature en file : une trace « contrat_signe » avec le jobId de l'envoi", async () => {
    pourContresigner();
    await appliquerDecision(ID, "contresigner", null);
    expect(trace.noter).toHaveBeenCalledTimes(1);
    const [apporteur, pieces, contexte, jobId] = trace.noter.mock.calls[0]!;
    expect(apporteur).toBe(ID);
    expect(contexte).toBe("contrat_signe");
    expect(jobId).toBe(h.envoyer.mock.calls[0]![0].jobId);
    expect(pieces).toBe(h.envoyer.mock.calls[0]![0].attachments);
  });

  it("contresignature : la mise en file échoue → aucune trace", async () => {
    pourContresigner();
    h.envoyer.mockResolvedValue("indisponible");
    await appliquerDecision(ID, "contresigner", null);
    expect(trace.noter).not.toHaveBeenCalled();
  });

  it("renvoi en file : trace « renvoi_contrat » ; retenu → aucune trace", async () => {
    h.lireDossier.mockResolvedValue(dossier({ statut: "signe" }));
    h.appFindUnique.mockResolvedValue({ contratSigneCle: cle });
    await renvoyerContratSigne(ID, new Date("2026-10-05T12:00:00Z"));
    expect(trace.noter).toHaveBeenCalledTimes(1);
    expect(trace.noter.mock.calls[0]![2]).toBe("renvoi_contrat");
    trace.noter.mockClear();
    h.envoyer.mockResolvedValue("retenu");
    await renvoyerContratSigne(ID, new Date("2026-10-05T12:00:01Z"));
    expect(trace.noter).not.toHaveBeenCalled();
  });

  it("une trace qui échoue ne fait jamais échouer l'envoi", async () => {
    h.lireDossier.mockResolvedValue(dossier({ statut: "signe" }));
    h.appFindUnique.mockResolvedValue({ contratSigneCle: cle });
    trace.noter.mockRejectedValueOnce(new Error("base indisponible"));
    expect(await renvoyerContratSigne(ID)).toMatchObject({ ok: true });
  });

  it("envoi du lien en file : trace « lien_dossier »", async () => {
    h.lireDossier.mockResolvedValue(dossier({ statut: "dossier_en_cours" }));
    h.appFindUnique.mockResolvedValue({ submissionId: null });
    await envoyerLien(ID, null, undefined, true, "job-lien-1");
    expect(h.envoyer).toHaveBeenCalledTimes(1);
    expect(trace.noter).toHaveBeenCalledTimes(1);
    expect(trace.noter.mock.calls[0]![2]).toBe("lien_dossier");
    expect(trace.noter.mock.calls[0]![3]).toBe("job-lien-1");
  });
});
