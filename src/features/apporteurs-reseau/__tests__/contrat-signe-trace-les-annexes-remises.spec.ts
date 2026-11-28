/**
 * CE QUI A ÉTÉ REMIS À L'APPORTEUR EST TRACÉ (point 11, PR C) : une ligne par annexe réellement jointe, avec son
 * empreinte, SEULEMENT si l'e-mail est en file. Ajout seul ; double clic = pas de doublon.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ createMany: vi.fn(), absente: false }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurDocumentRemis: {
      createMany: async (a: unknown) => {
        if (h.absente) throw Object.assign(new Error("absente"), { code: "P2021" });
        return h.createMany(a);
      },
    },
  },
}));

import { noterDocumentsRemis } from "../annexes-versions";
import { type PieceJointe } from "../documents-joints";

const SHA_F = "f".repeat(64);
const SHA_L = "1".repeat(64);
const piece = (doc: string, sha: string): PieceJointe => ({
  filename: `${doc}.pdf`,
  r2Key: `documents-apporteurs/${doc}/${sha}.pdf`,
  contentType: "application/pdf",
  facultative: true,
});
const APPORTEUR = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  h.createMany.mockReset();
  h.absente = false;
});

describe("noterDocumentsRemis", () => {
  it("écrit une ligne par annexe jointe, avec la bonne empreinte", async () => {
    const contrat: PieceJointe = {
      filename: "c.pdf",
      r2Key: "contrats/x.pdf",
      contentType: "application/pdf",
    };
    await noterDocumentsRemis(
      APPORTEUR,
      [contrat, piece("fiche-commissions", SHA_F), piece("livret", SHA_L)],
      "contrat_signe",
      "job-1",
    );
    const arg = h.createMany.mock.calls[0]?.[0] as {
      data: Record<string, unknown>[];
      skipDuplicates: boolean;
    };
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data).toHaveLength(2);
    expect(arg.data[0]).toMatchObject({
      apporteurId: APPORTEUR,
      documentId: "fiche-commissions",
      versionSha256: SHA_F,
      contexte: "contrat_signe",
      emailJobId: "job-1",
    });
    expect(arg.data[1]).toMatchObject({ documentId: "livret", versionSha256: SHA_L });
  });

  it("annexe absente (le contrat seul) : aucune ligne", async () => {
    await noterDocumentsRemis(
      APPORTEUR,
      [{ filename: "c.pdf", r2Key: "contrats/x.pdf", contentType: "application/pdf" }],
      "contrat_signe",
      "job-1",
    );
    expect(h.createMany).not.toHaveBeenCalled();
  });

  it("annexe jointe par l'ancienne clé fixe (aucune version) : rien à tracer, pas d'erreur", async () => {
    await expect(
      noterDocumentsRemis(
        APPORTEUR,
        [
          {
            filename: "l.pdf",
            r2Key: "documents-apporteurs/livret-apporteur.pdf",
            contentType: "application/pdf",
          },
        ],
        "lien_dossier",
        "job-1",
      ),
    ).resolves.toBeUndefined();
    expect(h.createMany).not.toHaveBeenCalled();
  });

  it("double clic ou renvoi du même job : la base dédoublonne (skipDuplicates), jamais de doublon écrit", async () => {
    for (let i = 0; i < 2; i += 1)
      await noterDocumentsRemis(APPORTEUR, [piece("livret", SHA_L)], "renvoi_contrat", "job-r");
    for (const c of h.createMany.mock.calls)
      expect((c[0] as { skipDuplicates: boolean }).skipDuplicates).toBe(true);
  });

  it("table absente : silence", async () => {
    h.absente = true;
    await expect(
      noterDocumentsRemis(APPORTEUR, [piece("livret", SHA_L)], "contrat_signe", "j"),
    ).resolves.toBeUndefined();
  });
});
