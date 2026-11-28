/**
 * Point 11, PR C — LES LECTEURS SERVENT LA VERSION COURANTE. Ce qui part en pièce jointe et ce que servent les routes
 * de l'espace (fiche, livret, guide) est la clé versionnée quand il y en a une, la clé fixe sinon.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  version: vi.fn(),
  entete: vi.fn(),
  lire: vi.fn(),
}));

vi.mock("@/lib/r2-storage", () => ({
  enteteObjetR2: (...a: unknown[]) => h.entete(...a),
  getObjectBufferR2: (...a: unknown[]) => h.lire(...a),
  isR2Configured: () => true,
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("../annexes-versions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../annexes-versions")>()),
  versionCourante: (...a: unknown[]) => h.version(...a),
}));

import { cleVersionnee } from "../annexes-versions";
import {
  DOCUMENTS_ANNEXES,
  bilanDesPieces,
  documentsAnnexesAJoindre,
  idsAnnexesJointes,
} from "../documents-joints";
import {
  CLE_R2_FICHE_COMMISSIONS,
  CLE_R2_GUIDE,
  CLE_R2_LIVRET,
  lireFicheCommissions,
  lireLivret,
} from "../documents-prives";
import { lireGuideDemarrage } from "../guide-demarrage";

const SHA = "a".repeat(64);
const [FICHE, LIVRET, GUIDE] = DOCUMENTS_ANNEXES;
const pdf = Buffer.from("%PDF-1.4 x");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.entete.mockResolvedValue({ taille: 1000, etag: "e" });
  h.lire.mockResolvedValue(pdf);
});

describe("pièces jointes : la clé versionnée", () => {
  it("version courante connue : r2Key vaut la clé VERSIONNÉE, jamais la clé fixe", async () => {
    h.version.mockImplementation(async (id: string) => ({
      cleR2: cleVersionnee(id, SHA),
      sha256: SHA,
    }));
    const pieces = await documentsAnnexesAJoindre();
    expect(pieces.map((p) => p.r2Key)).toEqual(
      DOCUMENTS_ANNEXES.map((d) => cleVersionnee(d.id, SHA)),
    );
    // la taille est lue sur la clé versionnée, pas sur l'ancienne
    expect(h.entete).toHaveBeenCalledWith(cleVersionnee(FICHE.id, SHA));
    expect(h.entete).not.toHaveBeenCalledWith(FICHE.cleR2);
  });

  it("aucune version : r2Key vaut la clé fixe du document", async () => {
    h.version.mockResolvedValue(null);
    expect((await documentsAnnexesAJoindre()).map((p) => p.r2Key)).toEqual(
      DOCUMENTS_ANNEXES.map((d) => d.cleR2),
    );
  });

  it("idsAnnexesJointes et bilanDesPieces reconnaissent une clé versionnée", () => {
    const pieces = [
      { filename: "f.pdf", r2Key: cleVersionnee(FICHE.id, SHA), contentType: "application/pdf" },
      { filename: "g.pdf", r2Key: GUIDE.cleR2, contentType: "application/pdf" },
    ];
    expect(idsAnnexesJointes(pieces)).toEqual([FICHE.id, GUIDE.id]);
    const bilan = bilanDesPieces(pieces);
    expect(bilan).not.toMatch(/le contrat seul/);
    expect(bilan).toContain(FICHE.libelleConsole);
    expect(bilan).toContain(GUIDE.libelleConsole);
    // une clé versionnée d'un AUTRE document ne vaut pas pour celui-ci
    expect(idsAnnexesJointes([{ ...pieces[0]!, r2Key: cleVersionnee(LIVRET.id, SHA) }])).toEqual([
      LIVRET.id,
    ]);
  });
});

describe("routes de l'espace : la version courante est lue", () => {
  const lecteurs = [
    ["lireFicheCommissions", lireFicheCommissions, "fiche-commissions", CLE_R2_FICHE_COMMISSIONS],
    ["lireLivret", lireLivret, "livret", CLE_R2_LIVRET],
    ["lireGuideDemarrage", lireGuideDemarrage, "guide-demarrage", CLE_R2_GUIDE],
  ] as const;

  for (const [nom, lecteur, documentId, cleFixe] of lecteurs) {
    it(`${nom} : lit la clé de la version courante de « ${documentId} »`, async () => {
      h.version.mockResolvedValue({ cleR2: cleVersionnee(documentId, SHA), sha256: SHA });
      expect(await lecteur()).toEqual(pdf);
      expect(h.version).toHaveBeenCalledWith(documentId);
      expect(h.lire).toHaveBeenCalledWith(cleVersionnee(documentId, SHA));
    });

    it(`${nom} : sans version, lit la clé fixe`, async () => {
      h.version.mockResolvedValue(null);
      await lecteur();
      expect(h.lire).toHaveBeenCalledWith(cleFixe);
    });
  }
});
