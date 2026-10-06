import { beforeEach, describe, expect, it, vi } from "vitest";

// Dossier public, côté données : lien mal formé, antivirus obligatoire, pièces purgées,
// registre muet, réouverture d'un dossier refusé. Prisma et ClamAV sont remplacés.
vi.mock("server-only", () => ({}));

const { analyserOctets } = vi.hoisted(() => ({ analyserOctets: vi.fn() }));
vi.mock("@/server/careers/clamav", () => ({
  analyserOctets: (...a: unknown[]) => analyserOctets(...a),
}));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string | null) => (v === null ? null : `enc:${v}`),
  decryptPii: (v: string | null) => (v ? v.replace(/^enc:/, "") : null),
}));
const { signaler } = vi.hoisted(() => ({ signaler: vi.fn() }));
vi.mock("../signaler", () => ({ signalerErreurReseau: (...a: unknown[]) => signaler(...a) }));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "empreinte" }));

const { p, tx } = vi.hoisted(() => {
  const p = {
    apporteurFindUnique: vi.fn(),
    apporteurUpdate: vi.fn(),
    apporteurCreate: vi.fn(),
    pieceFindMany: vi.fn(),
    pieceUpdateMany: vi.fn(),
    pieceCreate: vi.fn(),
    contenuDeleteMany: vi.fn(),
    contenuCreate: vi.fn(),
    submissionFindUnique: vi.fn(),
  };
  const tx = {
    pieceApporteur: {
      findMany: p.pieceFindMany,
      updateMany: p.pieceUpdateMany,
      create: p.pieceCreate,
    },
    pieceApporteurContenu: { deleteMany: p.contenuDeleteMany, create: p.contenuCreate },
    apporteurReseau: { update: p.apporteurUpdate },
  };
  return { p, tx };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...tx,
    apporteurReseau: {
      findUnique: (...a: unknown[]) => p.apporteurFindUnique(...a),
      update: (...a: unknown[]) => p.apporteurUpdate(...a),
      create: (...a: unknown[]) => p.apporteurCreate(...a),
    },
    submission: { findUnique: (...a: unknown[]) => p.submissionFindUnique(...a) },
    $transaction: async (f: (t: typeof tx) => unknown) => f(tx),
  },
}));

import {
  alerterAntivirusIndisponible,
  deposerPiece,
  reinitialiserAlerteAntivirus,
  enregistrerActivite,
  enregistrerDeclarations,
  lireDossierParLien,
  ouvrirDossierDepuisCandidature,
} from "../donnees";
import { jetonDossierValide, lienDossierBienForme, urlDossierExemple } from "../jeton";
import { CLE_REGISTRE_INDISPONIBLE } from "../signature-regles";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JETON = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE"; // 43 caractères
const PDF = new TextEncoder().encode("%PDF-1.4\n...");

beforeEach(() => {
  vi.clearAllMocks();
  p.pieceFindMany.mockResolvedValue([]);
  p.pieceCreate.mockResolvedValue({ id: "piece-neuve" });
  analyserOctets.mockResolvedValue({ issue: "sain" });
});

describe("D7 : lien tronqué ou mal formé", () => {
  it("n'interroge JAMAIS la base avant d'avoir validé l'UUID et le jeton", async () => {
    for (const [id, jeton] of [
      ["6f1c2a3b-4d5e-4f60", JETON],
      [ID, "trop-court"],
      ["n importe quoi", JETON],
      [ID, `${JETON}x`],
      ["", ""],
    ] as const) {
      expect(await lireDossierParLien(id, jeton)).toBeNull();
    }
    expect(p.apporteurFindUnique).not.toHaveBeenCalled();
  });

  it("un lien bien formé passe, la validation sert de pré-filtre", () => {
    expect(lienDossierBienForme(ID, JETON)).toBe(true);
    expect(lienDossierBienForme(ID.toUpperCase(), JETON)).toBe(true);
    expect(lienDossierBienForme(ID.slice(0, 30), JETON)).toBe(false);
    expect(lienDossierBienForme(ID, JETON.slice(1))).toBe(false);
  });

  it("D6 : le lien d'exemple de l'aperçu a la forme d'un lien mais n'est pas valide", () => {
    const url = urlDossierExemple();
    expect(url).toMatch(/\/apporteur\/dossier\/[0-9a-f-]{36}\/x{43}$/);
    const [, id, jeton] = /dossier\/([^/]+)\/([^/]+)$/.exec(url)!;
    expect(lienDossierBienForme(id!, jeton!)).toBe(true);
    expect(jetonDossierValide(id!, 1, jeton!)).toBe(false);
  });
});

describe("antivirus : le verdict « sain » est obligatoire", () => {
  it("antivirus muet : la pièce est REFUSÉE, rien n'est écrit", async () => {
    analyserOctets.mockResolvedValue({ issue: "indisponible", raison: "délai dépassé" });
    const r = await deposerPiece(ID, "rib", "rib.pdf", PDF);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain("Réessayez dans un instant");
    expect(p.pieceCreate).not.toHaveBeenCalled();
    expect(p.contenuCreate).not.toHaveBeenCalled();
  });

  it("antivirus muet : Williams est prévenu UNE fois par 15 minutes, sans donnée personnelle", async () => {
    reinitialiserAlerteAntivirus();
    signaler.mockClear();
    analyserOctets.mockResolvedValue({ issue: "indisponible", raison: "délai dépassé" });
    await deposerPiece(ID, "rib", "rib.pdf", PDF);
    await deposerPiece(ID, "rib", "rib.pdf", PDF);
    expect(signaler).toHaveBeenCalledTimes(1);
    expect(signaler.mock.calls[0]![0]).toBe("antivirus indisponible");
    expect(JSON.stringify(signaler.mock.calls[0])).not.toContain(ID);
    expect(alerterAntivirusIndisponible(Date.now() + 16 * 60 * 1000)).toBe(true);
    expect(signaler).toHaveBeenCalledTimes(2);
  });

  it("antivirus qui lève : même refus", async () => {
    analyserOctets.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await deposerPiece(ID, "rib", "rib.pdf", PDF)).toMatchObject({ ok: false });
    expect(p.pieceCreate).not.toHaveBeenCalled();
  });

  it("fichier infecté : refusé avec son propre message", async () => {
    analyserOctets.mockResolvedValue({ issue: "infecte", signature: "Eicar" });
    const r = await deposerPiece(ID, "rib", "rib.pdf", PDF);
    expect((r as { message: string }).message).toContain("antivirus");
    expect(p.pieceCreate).not.toHaveBeenCalled();
  });

  it("verdict sain : la pièce est enregistrée avec son contenu", async () => {
    expect(await deposerPiece(ID, "rib", "rib.pdf", PDF)).toEqual({ ok: true });
    expect(p.contenuCreate).toHaveBeenCalledTimes(1);
  });
});

describe("RGPD : pièce d'identité remplacée", () => {
  it("le contenu de l'ancienne pièce d'identité est purgé au remplacement", async () => {
    p.pieceFindMany.mockResolvedValue([{ id: "ancienne" }]);
    expect(await deposerPiece(ID, "identite", "cni.pdf", PDF)).toEqual({ ok: true });
    expect(p.contenuDeleteMany).toHaveBeenCalledWith({ where: { pieceId: { in: ["ancienne"] } } });
    expect(p.pieceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["ancienne"] }, purgeeAt: null },
        data: { purgeeAt: expect.any(Date) },
      }),
    );
    // Le filtre ne vise que l'identité courante de CET apporteur.
    expect(p.pieceFindMany.mock.calls[0]![0].where).toMatchObject({
      apporteurId: ID,
      type: { in: ["identite"] },
      remplaceeAt: null,
    });
  });

  it("un autre type de pièce remplacé n'est pas purgé par ce chemin", async () => {
    await deposerPiece(ID, "rib", "rib.pdf", PDF);
    expect(p.contenuDeleteMany).not.toHaveBeenCalled();
  });
});

describe("D10 : registre muet, le dossier est marqué « à contrôler »", () => {
  const saisie = {
    siren: "732829320",
    denomination: "Ma société",
    adresse: "1 rue des Alpes",
    codeNaf: null,
    statutJuridique: "micro_entrepreneur",
    regimeTva: "franchise_293b" as const,
    numeroTva: null,
    iban: null,
  };

  it("pose le marqueur dans `declarations` sans effacer les cases existantes", async () => {
    p.apporteurFindUnique.mockResolvedValue({ declarations: { dec_1: "2026-10-01" } });
    await enregistrerActivite(ID, { ...saisie, registreIndisponible: true });
    const data = p.apporteurUpdate.mock.calls[0]![0].data;
    expect(data.declarations.dec_1).toBe("2026-10-01");
    expect(typeof data.declarations[CLE_REGISTRE_INDISPONIBLE]).toBe("string");
  });

  it("retire le marqueur quand le registre répond ensuite", async () => {
    p.apporteurFindUnique.mockResolvedValue({
      declarations: { dec_1: "x", [CLE_REGISTRE_INDISPONIBLE]: "2026-10-05" },
    });
    await enregistrerActivite(ID, { ...saisie, registreIndisponible: false });
    expect(p.apporteurUpdate.mock.calls[0]![0].data.declarations).toEqual({ dec_1: "x" });
  });

  it("sans information sur le registre, `declarations` n'est pas touché", async () => {
    await enregistrerActivite(ID, saisie);
    expect(p.apporteurUpdate.mock.calls[0]![0].data).not.toHaveProperty("declarations");
  });

  it("le nom complété (nom d'un seul mot) est chiffré et écrit", async () => {
    await enregistrerActivite(ID, { ...saisie, nom: "Ciccone" });
    expect(p.apporteurUpdate.mock.calls[0]![0].data.nom).toBe("enc:Ciccone");
  });

  it("la signature ne fait pas perdre le marqueur", async () => {
    p.apporteurFindUnique.mockResolvedValue({
      declarations: { [CLE_REGISTRE_INDISPONIBLE]: "2026-10-05T08:00:00.000Z" },
    });
    await enregistrerDeclarations(ID, ["dec_1", "dec_2"]);
    const d = p.apporteurUpdate.mock.calls[0]![0].data.declarations;
    expect(Object.keys(d).sort()).toEqual(["_registre_indisponible", "dec_1", "dec_2"]);
    expect(d[CLE_REGISTRE_INDISPONIBLE]).toBe("2026-10-05T08:00:00.000Z");
  });
});

describe("D17 : dossier refusé puis « Retenu » plus tard", () => {
  beforeEach(() => {
    p.submissionFindUnique.mockResolvedValue({
      id: "s1",
      contactName: "enc:Claire Durand",
      contactEmail: "enc:claire@exemple.fr",
      contactPhone: null,
    });
  });

  it("rouvre le dossier avec un NOUVEAU lien et fait redéposer identité et RIB", async () => {
    p.apporteurFindUnique.mockResolvedValue({
      id: ID,
      versionLien: 2,
      prenom: "enc:Claire",
      statut: "refuse",
    });
    p.apporteurUpdate.mockResolvedValue({ versionLien: 3 });
    const r = await ouvrirDossierDepuisCandidature("s1");
    expect(r).toMatchObject({ ok: true, apporteurId: ID, versionLien: 3, prenom: "Claire" });
    const maj = p.apporteurUpdate.mock.calls[0]![0];
    expect(maj.data).toMatchObject({
      statut: "dossier_en_cours",
      refuseAt: null,
      dernierMessage: null,
      versionLien: { increment: 1 },
    });
    expect(p.pieceUpdateMany.mock.calls[0]![0]).toMatchObject({
      where: { apporteurId: ID, type: { in: ["identite", "rib"] }, remplaceeAt: null },
    });
  });

  it("l'aperçu (creer: false) n'écrit rien, même pour un dossier refusé", async () => {
    p.apporteurFindUnique.mockResolvedValue({
      id: ID,
      versionLien: 2,
      prenom: "enc:Claire",
      statut: "refuse",
    });
    const r = await ouvrirDossierDepuisCandidature("s1", { creer: false });
    expect(r.ok).toBe(true);
    expect(p.apporteurUpdate).not.toHaveBeenCalled();
  });

  it("un dossier en cours est rendu tel quel", async () => {
    p.apporteurFindUnique.mockResolvedValue({
      id: ID,
      versionLien: 1,
      prenom: "enc:Claire",
      statut: "dossier_en_cours",
    });
    expect(await ouvrirDossierDepuisCandidature("s1")).toMatchObject({ versionLien: 1 });
    expect(p.apporteurUpdate).not.toHaveBeenCalled();
  });
});
