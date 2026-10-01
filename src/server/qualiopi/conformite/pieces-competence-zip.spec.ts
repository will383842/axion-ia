/**
 * Indicateur 21 ⭐ — les FICHIERS des pièces de compétence dans le ZIP global,
 * et jamais d'échec silencieux.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

vi.mock("@/lib/prisma", () => ({
  prisma: { documentGenere: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/r2-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/r2-storage")>()),
  getObjectBufferR2: vi.fn(),
}));
vi.mock("@/lib/ssrf-safe-fetch", () => ({ ssrfSafeFetch: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getObjectBufferR2 } from "@/lib/r2-storage";
import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";
import {
  dossierIntervenant,
  joindreFichiersPiecesCompetence,
  recupererFichierPiece,
  type PieceFormateurZip,
} from "./pieces-competence-zip";

const mockFindFirst = prisma.documentGenere.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockR2 = vi.mocked(getObjectBufferR2);
const mockFetch = vi.mocked(ssrfSafeFetch);

const PDF = Buffer.from("%PDF-1.7 pièce");
const ID = "0b9c4a2e-6a51-4c3e-9a3e-1f2d3c4b5a69";

function reponse(corps: Buffer | string, typeMime: string, statut = 200): Response {
  return new Response(typeof corps === "string" ? corps : new Uint8Array(corps), {
    status: statut,
    headers: { "content-type": typeMime },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recupererFichierPiece", () => {
  it("adresse interne vers une pièce du registre → lue dans R2, avec le prédicat d'admissibilité", async () => {
    mockFindFirst.mockResolvedValue({
      type: "cv_formateur",
      numero: "AXI-DOC-2026-001",
      createdAt: new Date("2026-09-01T10:00:00Z"),
    });
    mockR2.mockResolvedValue(PDF);
    const r = await recupererFichierPiece(`/api/qualiopi/documents/${ID}`);
    expect(r).toEqual({ ok: true, buffer: PDF, extension: "pdf" });
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: ID, annuleeAt: null }) }),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("pièce du registre absente de R2 → motif, jamais un fichier vide", async () => {
    mockFindFirst.mockResolvedValue({
      type: "cv_formateur",
      numero: "AXI-DOC-2026-001",
      createdAt: new Date("2026-09-01T10:00:00Z"),
    });
    mockR2.mockResolvedValue(null);
    expect(await recupererFichierPiece(`/api/qualiopi/documents/${ID}`)).toEqual({
      ok: false,
      motif: "PDF absent du stockage R2",
    });
  });

  it("adresse externe qui rend un PDF → jointe", async () => {
    mockFetch.mockResolvedValue(reponse(PDF, "application/octet-stream"));
    const r = await recupererFichierPiece("https://exemple.fr/diplome.pdf");
    expect(r).toEqual({ ok: true, buffer: PDF, extension: "pdf" });
  });

  it("lien de partage qui rend une PAGE WEB → refusé, et dit pourquoi", async () => {
    mockFetch.mockResolvedValue(reponse("<html></html>", "text/html; charset=utf-8"));
    const r = await recupererFichierPiece("https://drive.google.com/file/d/xyz/view");
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.motif).toMatch(/page web, pas au fichier/);
  });

  it("lien en erreur ou refusé par la garde SSRF → motif", async () => {
    mockFetch.mockResolvedValueOnce(reponse("", "text/plain", 404));
    expect(await recupererFichierPiece("https://exemple.fr/x.pdf")).toEqual({
      ok: false,
      motif: "le lien répond 404",
    });
    mockFetch.mockRejectedValueOnce(
      new Error(
        'ssrf-safe-fetch: hostname "interne.exemple" resolves to private/reserved IP "10.0.0.5" — refused.',
      ),
    );
    const r = await recupererFichierPiece("https://interne.exemple/x.pdf");
    // Motif GÉNÉRIQUE : ni l'IP résolue, ni le nom d'hôte, ni le message brut.
    expect(r).toEqual({ ok: false, motif: "adresse refusée" });
  });

  it("délai dépassé → motif générique", async () => {
    mockFetch.mockRejectedValueOnce(
      Object.assign(new Error("The operation was aborted due to timeout"), {
        name: "TimeoutError",
      }),
    );
    expect(await recupererFichierPiece("https://lent.exemple/x.pdf")).toEqual({
      ok: false,
      motif: "délai dépassé",
    });
  });

  it("🔴 une pièce du registre d'un type EXCLU (facture, contrat de travail…) n'est jamais jointe", async () => {
    // Le devis reste JOINT par la règle partagée (trace de cadrage, ind. 4/6) :
    // ce test suit `hors-dossier-audit.ts`, il ne la redéfinit pas.
    for (const type of ["contrat_travail", "autofacture_honoraires", "facture", "avoir"]) {
      mockFindFirst.mockResolvedValueOnce({
        type,
        numero: "AXI-DOC-2026-009",
        createdAt: new Date("2026-09-01T10:00:00Z"),
      });
      mockR2.mockResolvedValue(PDF);
      expect(await recupererFichierPiece(`/api/qualiopi/documents/${ID}`)).toEqual({
        ok: false,
        motif: "non joint (type exclu du dossier d'audit)",
      });
    }
    expect(mockR2).not.toHaveBeenCalled();
  });

  it("🔴 le plafond de 20 Mo tient EN FLUX, sans Content-Length, et la lecture est annulée", async () => {
    const morceau = new Uint8Array(1024 * 1024); // 1 Mo
    let envoyes = 0;
    let annule = false;
    const flux = new ReadableStream<Uint8Array>({
      pull(controleur) {
        envoyes += 1;
        if (envoyes > 100) {
          controleur.close();
          return;
        }
        controleur.enqueue(morceau);
      },
      cancel() {
        annule = true;
      },
    });
    // Aucune taille annoncée : seul le comptage en flux peut arrêter la lecture.
    mockFetch.mockResolvedValueOnce(
      new Response(flux, { status: 200, headers: { "content-type": "application/pdf" } }),
    );
    const r = await recupererFichierPiece("https://gros.exemple/x.pdf");
    expect(r).toEqual({ ok: false, motif: "trop volumineux (plus de 20 Mo)" });
    expect(annule).toBe(true);
    // Arrêté juste après le plafond, pas au bout des 100 Mo.
    expect(envoyes).toBeLessThan(25);
  });
});

describe("joindreFichiersPiecesCompetence", () => {
  const maintenant = new Date("2026-10-01T10:00:00Z");
  const base: Omit<PieceFormateurZip, "type" | "fichierUrl"> = {
    trainerId: "11111111-aaaa-4bbb-8ccc-000000000001",
    formateur: "Hélène Durand",
    statutValidation: "valide",
    dateExpiration: null,
  };

  it("joint les pièces PROBANTES sous formateurs/<intervenant>/, et seulement elles", async () => {
    mockFetch.mockImplementation(async () => reponse(PDF, "application/pdf"));
    const zip = new JSZip();
    const index: string[] = [];
    const avertissements: string[] = [];
    const r = await joindreFichiersPiecesCompetence(
      zip,
      index,
      avertissements,
      [
        { ...base, type: "cv", fichierUrl: "https://exemple.fr/cv.pdf" },
        { ...base, type: "diplome", fichierUrl: "https://exemple.fr/diplome.pdf" },
        // Non validée : pas une preuve.
        {
          ...base,
          type: "certification",
          fichierUrl: "https://x.fr/c.pdf",
          statutValidation: "en_attente",
        },
        // Pièce d'un autre type : hors compétence.
        { ...base, type: "rc_pro", fichierUrl: "https://x.fr/rc.pdf" },
      ],
      maintenant,
    );
    expect(r.nbInclus).toBe(2);
    expect(r.nbOmis).toBe(0);
    expect(Object.keys(zip.files).sort()).toEqual([
      "formateurs/",
      "formateurs/helene-durand/",
      "formateurs/helene-durand/cv.pdf",
      "formateurs/helene-durand/diplome.pdf",
    ]);
    expect(avertissements).toEqual([]);
    expect(r.lignesManifeste[0]).toMatch(/^2\/2 pièces de compétence validées jointes/);
  });

  it("🔴 un fichier inaccessible est écrit dans l'index, les avertissements ET le manifeste", async () => {
    mockFetch.mockResolvedValue(reponse("<html></html>", "text/html"));
    const index: string[] = [];
    const avertissements: string[] = [];
    const r = await joindreFichiersPiecesCompetence(
      new JSZip(),
      index,
      avertissements,
      [{ ...base, type: "cv", fichierUrl: "https://drive.google.com/view" }],
      maintenant,
    );
    expect(r.nbOmis).toBe(1);
    expect(index.join("\n")).toMatch(
      /\[OMIS\] formateurs — Hélène Durand — CV : le lien mène à une page web/,
    );
    expect(avertissements).toHaveLength(1);
    expect(r.lignesManifeste.join("\n")).toMatch(
      /Pièce non jointe — fichier inaccessible : Hélène Durand — CV/,
    );
  });

  it("deux homonymes ne partagent pas un dossier", async () => {
    mockFetch.mockImplementation(async () => reponse(PDF, "application/pdf"));
    const zip = new JSZip();
    await joindreFichiersPiecesCompetence(
      zip,
      [],
      [],
      [
        { ...base, type: "cv", fichierUrl: "https://exemple.fr/a.pdf" },
        {
          ...base,
          trainerId: "22222222-aaaa-4bbb-8ccc-000000000002",
          type: "cv",
          fichierUrl: "https://exemple.fr/b.pdf",
        },
      ],
      maintenant,
    );
    expect(Object.keys(zip.files)).toContain("formateurs/helene-durand/cv.pdf");
    expect(Object.keys(zip.files)).toContain("formateurs/helene-durand-22222222/cv.pdf");
  });

  it("dossierIntervenant : sans accents ni séparateurs", () => {
    expect(dossierIntervenant("Élodie D'Arc-Marie")).toBe("elodie-d-arc-marie");
    expect(dossierIntervenant("  ")).toBe("intervenant");
  });
});
