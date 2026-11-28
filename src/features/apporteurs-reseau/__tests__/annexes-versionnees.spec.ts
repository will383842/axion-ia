/**
 * LES ANNEXES JOINTES SONT FIGÉES (point 11, PR C) : chaque version d'une annexe est déposée UNE fois, à une clé
 * dérivée de son empreinte, et ne bouge plus. Ce qui part avec un e-mail est exactement la version notée.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  lignes: [] as {
    documentId: string;
    sha256: string;
    cleR2: string;
    taille: number;
    deposeAt: Date;
    retireeAt: Date | null;
  }[],
  objets: new Map<string, number>(),
  upload: vi.fn(),
  tableAbsente: false,
  panne: false,
  signaler: vi.fn(),
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: (...a: unknown[]) => h.signaler(...a) }));

const p2021 = () => Object.assign(new Error("table absente"), { code: "P2021" });

vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: () => true,
  enteteObjetR2: async (cle: string) =>
    h.objets.has(cle) ? { taille: h.objets.get(cle) as number, etag: "e" } : null,
  uploadToR2: async (cle: string, buf: Buffer, ...r: unknown[]) => {
    h.upload(cle, buf, ...r);
    h.objets.set(cle, buf.byteLength);
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentAnnexeVersion: {
      findFirst: async (a: { where: { documentId: string; retireeAt?: null } }) => {
        if (h.tableAbsente) throw p2021();
        if (h.panne) throw new Error("base en panne");
        // Le `where` est appliqué TEL QUEL : sans `retireeAt: null` dans la requête, une version retirée sort.
        return (
          [...h.lignes]
            .filter(
              (l) =>
                l.documentId === a.where.documentId &&
                (!("retireeAt" in a.where) || l.retireeAt === a.where.retireeAt),
            )
            .sort((x, y) => y.deposeAt.getTime() - x.deposeAt.getTime())[0] ?? null
        );
      },
      findUnique: async (a: {
        where: { documentId_sha256: { documentId: string; sha256: string } };
      }) => {
        const { documentId, sha256 } = a.where.documentId_sha256;
        return h.lignes.find((l) => l.documentId === documentId && l.sha256 === sha256) ?? null;
      },
      upsert: async (a: {
        where: { documentId_sha256: { documentId: string; sha256: string } };
        create: (typeof h.lignes)[number];
      }) => {
        const { documentId, sha256 } = a.where.documentId_sha256;
        if (!h.lignes.some((l) => l.documentId === documentId && l.sha256 === sha256))
          h.lignes.push({
            ...a.create,
            deposeAt: new Date(2026, 10, 27, 12, h.lignes.length),
            retireeAt: null,
          });
        return {};
      },
    },
  },
}));

import { CLE_R2_LIVRET, PREFIXE_DOCUMENTS_APPORTEURS } from "../documents-prives";
import { cleVersionnee, deposerVersionAnnexe, versionCourante } from "../annexes-versions";

const pdf = (texte: string) => Buffer.from(`%PDF-1.4 ${texte}`);
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

beforeEach(() => {
  h.lignes.length = 0;
  h.objets.clear();
  h.upload.mockReset();
  h.tableAbsente = false;
  h.panne = false;
  h.signaler.mockReset();
});

describe("annexes versionnées", () => {
  it("la clé est dérivée de l'empreinte, jamais d'une date ni d'un nom libre", () => {
    const e = "a".repeat(64);
    expect(cleVersionnee("livret", e)).toBe(`documents-apporteurs/livret/${e}.pdf`);
    expect(cleVersionnee("livret", e).startsWith(PREFIXE_DOCUMENTS_APPORTEURS)).toBe(true);
  });

  it("dépose une version : objet à la clé immuable, ligne en base, ancienne clé fixe aussi écrite", async () => {
    const f = pdf("v1");
    const r = await deposerVersionAnnexe({ id: "livret", cleR2: CLE_R2_LIVRET }, f, {
      deposePar: "script",
    });
    expect(r.sha256).toBe(sha(f));
    expect(r.cleR2).toBe(cleVersionnee("livret", sha(f)));
    expect(h.objets.has(r.cleR2)).toBe(true);
    expect(h.objets.has(CLE_R2_LIVRET)).toBe(true);
    expect(h.lignes).toHaveLength(1);
  });

  it("même fichier déposé deux fois : une seule version, un seul dépôt", async () => {
    const f = pdf("v1");
    const doc = { id: "livret", cleR2: CLE_R2_LIVRET } as const;
    await deposerVersionAnnexe(doc, f, { deposePar: "script" });
    const envois = h.upload.mock.calls.length;
    const r2 = await deposerVersionAnnexe(doc, f, { deposePar: "script" });
    expect(r2.dejaDeposee).toBe(true);
    expect(h.lignes).toHaveLength(1);
    expect(h.upload.mock.calls.length).toBe(envois);
  });

  it("objet déjà présent sur R2 (HEAD) : il n'est pas déposé une seconde fois, la ligne est posée", async () => {
    const f = pdf("v1");
    h.objets.set(cleVersionnee("livret", sha(f)), f.byteLength);
    await deposerVersionAnnexe({ id: "livret", cleR2: CLE_R2_LIVRET }, f, { deposePar: null });
    expect(h.upload.mock.calls.some((c) => c[0] === cleVersionnee("livret", sha(f)))).toBe(false);
    expect(h.lignes).toHaveLength(1);
  });

  it("nouveau fichier : nouvelle clé, l'ancienne reste lisible", async () => {
    const doc = { id: "livret", cleR2: CLE_R2_LIVRET } as const;
    const a = await deposerVersionAnnexe(doc, pdf("v1"), { deposePar: null });
    const b = await deposerVersionAnnexe(doc, pdf("v2"), { deposePar: null });
    expect(b.cleR2).not.toBe(a.cleR2);
    expect(h.objets.has(a.cleR2)).toBe(true);
    expect((await versionCourante("livret"))?.cleR2).toBe(b.cleR2);
  });

  it("refuse un fichier qui n'est pas un PDF", async () => {
    await expect(
      deposerVersionAnnexe({ id: "livret", cleR2: CLE_R2_LIVRET }, Buffer.from("texte"), {
        deposePar: null,
      }),
    ).rejects.toThrow(/PDF/);
  });

  it("versionCourante ignore les versions retirées", async () => {
    h.lignes.push(
      {
        documentId: "livret",
        sha256: "1".repeat(64),
        cleR2: "k1",
        taille: 1,
        deposeAt: new Date(2026, 1, 1),
        retireeAt: null,
      },
      {
        documentId: "livret",
        sha256: "2".repeat(64),
        cleR2: "k2",
        taille: 1,
        deposeAt: new Date(2026, 2, 1),
        retireeAt: new Date(2026, 3, 1),
      },
    );
    expect(await versionCourante("livret")).toEqual({ cleR2: "k1", sha256: "1".repeat(64) });
  });

  it("table vide ou absente : null (repli sur la clé fixe)", async () => {
    expect(await versionCourante("livret")).toBeNull();
    h.tableAbsente = true;
    expect(await versionCourante("livret")).toBeNull();
  });

  it("🔴 base en panne : repli sur la clé fixe ET signalé ; table absente : repli silencieux", async () => {
    h.panne = true;
    expect(await versionCourante("livret")).toBeNull();
    expect(h.signaler).toHaveBeenCalledTimes(1);
    h.signaler.mockReset();
    h.panne = false;
    h.tableAbsente = true;
    expect(await versionCourante("livret")).toBeNull();
    expect(h.signaler).not.toHaveBeenCalled();
  });
});
