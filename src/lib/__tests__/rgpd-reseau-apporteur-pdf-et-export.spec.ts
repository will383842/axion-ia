import { beforeEach, describe, expect, it, vi } from "vitest";

// RGPD du réseau d'apporteurs : l'effacement supprime aussi les PDF signés de R2 (hors
// conservation légale) ; l'export art. 15 restitue e-mail, IBAN, commissions et la preuve
// de signature (sans le texte du contrat).
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  appFindUnique: vi.fn(),
  appUpdate: vi.fn(),
  presUpdateMany: vi.fn(),
  presFindMany: vi.fn(),
  contenuDeleteMany: vi.fn(),
  pieceUpdateMany: vi.fn(),
  pieceFindMany: vi.fn(),
  commissionFindMany: vi.fn(),
  deleteFromR2: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      findUnique: (...a: unknown[]) => h.appFindUnique(...a),
      update: (...a: unknown[]) => h.appUpdate(...a),
    },
    presentationEntreprise: {
      updateMany: (...a: unknown[]) => h.presUpdateMany(...a),
      findMany: (...a: unknown[]) => h.presFindMany(...a),
    },
    pieceApporteurContenu: { deleteMany: (...a: unknown[]) => h.contenuDeleteMany(...a) },
    pieceApporteur: {
      updateMany: (...a: unknown[]) => h.pieceUpdateMany(...a),
      findMany: (...a: unknown[]) => h.pieceFindMany(...a),
    },
    commissionApporteur: { findMany: (...a: unknown[]) => h.commissionFindMany(...a) },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "empreinte" }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => (v ? v.replace(/^enc:/, "") : null),
}));
vi.mock("@/lib/r2-storage", () => ({
  deleteFromR2: (...a: unknown[]) => h.deleteFromR2(...a),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => h.captureException(...a),
}));
vi.mock("@/server/partners-sync/producteurs/client", () => ({
  chargeClientAvant: vi.fn(),
  emettreFaitClient: vi.fn(),
}));

import { eraseReseauApporteurForEmail } from "../rgpd-erase";
import { exporterReseauApporteurPour } from "../rgpd-reseau-apporteur";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

beforeEach(() => {
  vi.clearAllMocks();
  h.presUpdateMany.mockResolvedValue({ count: 0 });
  h.presFindMany.mockResolvedValue([]);
  h.pieceFindMany.mockResolvedValue([]);
  h.commissionFindMany.mockResolvedValue([]);
});

describe("effacement : les PDF signés quittent R2 si le dossier n'est pas conservé", () => {
  it("dossier sans contresignature ni commission : PDF supprimés, clés retirées de la base", async () => {
    h.appFindUnique.mockResolvedValue({
      id: ID,
      signeParSocieteAt: null,
      contratCle: `apporteurs/${ID}/contrat-v2-apporteur-abcdef01.pdf`,
      contratSigneCle: null,
      _count: { commissions: 0 },
    });
    const r = await eraseReseauApporteurForEmail("claire@exemple.fr");
    expect(r.apporteur).toBe("efface");
    expect(h.deleteFromR2).toHaveBeenCalledTimes(1);
    expect(h.deleteFromR2).toHaveBeenCalledWith(
      `apporteurs/${ID}/contrat-v2-apporteur-abcdef01.pdf`,
    );
    const data = h.appUpdate.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      contratCle: null,
      contratSha256: null,
      contratSigneCle: null,
      contratSigneSha256: null,
    });
  });

  it("dossier conservé par obligation légale (contresigné) : AUCUN PDF supprimé", async () => {
    h.appFindUnique.mockResolvedValue({
      id: ID,
      signeParSocieteAt: new Date(),
      contratCle: "k1",
      contratSigneCle: "k2",
      _count: { commissions: 0 },
    });
    const r = await eraseReseauApporteurForEmail("claire@exemple.fr");
    expect(r.apporteur).toBe("conserve_obligation_legale");
    expect(h.deleteFromR2).not.toHaveBeenCalled();
    expect(h.appUpdate.mock.calls[0]![0].data).not.toHaveProperty("contratCle");
  });

  it("dossier avec commissions : conservé, PDF gardés", async () => {
    h.appFindUnique.mockResolvedValue({
      id: ID,
      signeParSocieteAt: null,
      contratCle: "k1",
      contratSigneCle: null,
      _count: { commissions: 2 },
    });
    expect((await eraseReseauApporteurForEmail("c@e.fr")).apporteur).toBe(
      "conserve_obligation_legale",
    );
    expect(h.deleteFromR2).not.toHaveBeenCalled();
  });

  it("panne de R2 : l'effacement n'est pas bloqué, l'erreur est signalée sans donnée personnelle", async () => {
    h.appFindUnique.mockResolvedValue({
      id: ID,
      signeParSocieteAt: null,
      contratCle: "k1",
      contratSigneCle: null,
      _count: { commissions: 0 },
    });
    h.deleteFromR2.mockRejectedValue(new Error("R2 indisponible"));
    const r = await eraseReseauApporteurForEmail("claire@exemple.fr");
    expect(r.apporteur).toBe("efface");
    expect(h.captureException).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.captureException.mock.calls[0]![1])).not.toContain("claire");
    expect(h.appUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("export art. 15 : l'apporteur retrouve tout ce qui le concerne", () => {
  const signature = {
    nomTape: "Claire Durand",
    signeAt: "2026-10-05T12:34:00.000Z",
    ipHash: "hash-ip",
    navigateur: "Chrome sur Android",
    acceptations: ["a1", "a2"],
    declarations: ["d1"],
    texteSha256: "f".repeat(64),
    valeurs: { identite: "Claire DURAND", siren: "732829320" },
  };

  beforeEach(() => {
    h.appFindUnique.mockResolvedValue({
      id: ID,
      prenom: "enc:Claire",
      nom: "enc:Durand",
      email: "enc:claire@exemple.fr",
      telephone: "enc:0612345678",
      iban: "enc:FR7630006000011234567890189",
      signatureApporteur: signature,
      siren: "732829320",
      denomination: "Durand Conseil",
      adresse: "1 rue des Alpes",
      statut: "signe",
      regimeTva: "franchise_293b",
      signeParApporteurAt: new Date("2026-10-05T12:34:00Z"),
      signeParSocieteAt: new Date("2026-10-06T09:00:00Z"),
    });
    h.commissionFindMany.mockResolvedValue([
      {
        activite: "audit",
        parrainage: false,
        factureHtCents: 200_000,
        montantCents: 60_000,
        statut: "versee",
        creeAt: new Date("2026-10-10T00:00:00Z"),
        verseeAt: new Date("2026-11-03T00:00:00Z"),
        autofactureNumero: "AXI-APP-2026-0001",
      },
    ]);
  });

  it("inclut e-mail et IBAN déchiffrés, les commissions et la preuve de signature", async () => {
    const r = await exporterReseauApporteurPour("claire@exemple.fr");
    const a = r.apporteur!;
    expect(a.email).toBe("claire@exemple.fr");
    expect(a.iban).toBe("FR7630006000011234567890189");
    expect(a.commissions).toEqual([
      {
        activite: "audit",
        parrainage: false,
        factureHtCents: 200_000,
        montantCents: 60_000,
        statut: "versee",
        creeLe: new Date("2026-10-10T00:00:00Z"),
        verseeLe: new Date("2026-11-03T00:00:00Z"),
        autofacture: "AXI-APP-2026-0001",
      },
    ]);
    expect(a.preuveSignature).toEqual({
      nomTape: "Claire Durand",
      signeLe: "2026-10-05T12:34:00.000Z",
      navigateur: "Chrome sur Android",
      empreinteTexte: "f".repeat(64),
      acceptations: ["a1", "a2"],
      declarations: ["d1"],
    });
  });

  it("la preuve de signature ne contient NI le texte du contrat NI l'empreinte d'IP", async () => {
    const r = await exporterReseauApporteurPour("claire@exemple.fr");
    const json = JSON.stringify(r.apporteur!.preuveSignature);
    expect(json).not.toContain("valeurs");
    expect(json).not.toContain("hash-ip");
    expect(json).not.toContain("732829320");
  });

  it("sans signature enregistrée, la preuve est nulle", async () => {
    h.appFindUnique.mockResolvedValue({
      id: ID,
      prenom: "enc:Claire",
      nom: "enc:Durand",
      email: "enc:claire@exemple.fr",
      telephone: null,
      iban: null,
      signatureApporteur: null,
      siren: null,
      denomination: null,
      adresse: null,
      statut: "dossier_en_cours",
      regimeTva: null,
      signeParApporteurAt: null,
      signeParSocieteAt: null,
    });
    const r = await exporterReseauApporteurPour("claire@exemple.fr");
    expect(r.apporteur!.preuveSignature).toBeNull();
    expect(r.apporteur!.iban).toBeNull();
  });
});
