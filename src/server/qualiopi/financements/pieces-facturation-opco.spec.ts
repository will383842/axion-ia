/**
 * Lot A8c — les pièces qui accompagnent une facture de formation financée par
 * un OPCO, dans chacun des deux circuits :
 *
 *   · SUBROGATION : l'organisme dépose chez l'OPCO la facture + le certificat
 *     de réalisation + les feuilles d'émargement (ou relevés de connexion) ;
 *   · REMBOURSEMENT : l'entreprise présente à son OPCO la facture acquittée +
 *     le certificat de réalisation (+ les feuilles de présence).
 *
 * Une pièce absente n'est jamais simulée : elle est NOMMÉE.
 */
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  selectionnerJustificatifs,
  construirePaquetFacturation,
  libellesPiecesTransmises,
  type DocumentJustificatif,
} from "./pieces-facturation-opco";

const doc = (o: Partial<DocumentJustificatif> & Pick<DocumentJustificatif, "type" | "numero">) =>
  ({
    id: o.numero,
    createdAt: new Date("2026-10-14T10:00:00Z"),
    annuleeAt: null,
    traineeId: null,
    ...o,
  }) as DocumentJustificatif;

describe("selectionnerJustificatifs", () => {
  it("garde le DERNIER certificat non annulé de chaque stagiaire", () => {
    const r = selectionnerJustificatifs([
      doc({
        type: "certificat_realisation",
        numero: "C-1",
        traineeId: "t1",
        createdAt: new Date("2026-10-14"),
      }),
      doc({
        type: "certificat_realisation",
        numero: "C-2",
        traineeId: "t1",
        createdAt: new Date("2026-10-15"),
      }),
      doc({ type: "certificat_realisation", numero: "C-3", traineeId: "t2" }),
      doc({
        type: "certificat_realisation",
        numero: "C-4",
        traineeId: "t3",
        annuleeAt: new Date(),
      }),
    ]);
    expect(r.certificats.map((d) => d.numero).sort()).toEqual(["C-2", "C-3"]);
  });

  it("relevés de connexion non annulés ; aucun certificat → nommé manquant", () => {
    const r = selectionnerJustificatifs([doc({ type: "releve_connexion", numero: "R-1" })]);
    expect(r.releves.map((d) => d.numero)).toEqual(["R-1"]);
    expect(r.manquantes).toContain("Certificat de réalisation");
  });
});

describe("libellesPiecesTransmises", () => {
  it("nomme ce qui est joint, rien d'autre", () => {
    expect(
      libellesPiecesTransmises({
        factureNumero: "AXI-FACT-2026-210",
        certificats: 2,
        releves: 0,
      }),
    ).toEqual(["Facture AXI-FACT-2026-210 (acquittée)", "Certificats de réalisation (2)"]);
  });
});

describe("construirePaquetFacturation", () => {
  const pdf = (nom: string) => Buffer.from(`%PDF-${nom}`);

  it("subrogation : facture + certificat + émargement à jour + LISEZMOI", async () => {
    const lus: string[] = [];
    const paquet = await construirePaquetFacturation(
      {
        circuit: "subrogation",
        facture: {
          numero: "AXI-FACT-2026-210",
          document: {
            type: "facture",
            numero: "AXI-FACT-2026-210",
            createdAt: new Date("2026-10-14"),
          },
          destinataireNom: "Atlas",
          numeroDossierOpco: "ATL-77",
        },
        numeroSession: "AXI-SESS-2026-901",
        contexte: "Acme",
        justificatifs: selectionnerJustificatifs([
          doc({ type: "certificat_realisation", numero: "AXI-DOC-2026-300", traineeId: "t1" }),
        ]),
        emargement: { buffer: pdf("emargement"), mention: "Tirage à jour du 14/10/2026" },
      },
      async (cle) => {
        lus.push(cle);
        return pdf(cle);
      },
    );
    const zip = await JSZip.loadAsync(Buffer.from(paquet.base64, "base64"));
    const noms = Object.keys(zip.files);
    expect(noms.some((n) => n.includes("AXI-FACT-2026-210"))).toBe(true);
    expect(noms.some((n) => n.includes("AXI-DOC-2026-300"))).toBe(true);
    expect(noms.some((n) => n.toLowerCase().includes("emargement"))).toBe(true);
    const lisezmoi = await zip.file("LISEZMOI.txt")!.async("string");
    expect(lisezmoi).toContain("subrogation");
    expect(lisezmoi).toContain("ATL-77");
    expect(paquet.manquantes).toEqual([]);
  });

  it("une pièce introuvable au stockage est NOMMÉE manquante, jamais simulée", async () => {
    const paquet = await construirePaquetFacturation(
      {
        circuit: "remboursement",
        facture: {
          numero: "AXI-FACT-2026-211",
          document: {
            type: "facture",
            numero: "AXI-FACT-2026-211",
            createdAt: new Date("2026-10-14"),
          },
          destinataireNom: "Acme",
          numeroDossierOpco: null,
        },
        numeroSession: "AXI-SESS-2026-902",
        contexte: "Acme",
        justificatifs: selectionnerJustificatifs([
          doc({ type: "certificat_realisation", numero: "AXI-DOC-2026-301", traineeId: "t1" }),
        ]),
        emargement: null,
      },
      async (cle) => (cle.includes("AXI-DOC-2026-301") ? null : pdf(cle)),
    );
    expect(paquet.manquantes).toEqual(
      expect.arrayContaining([expect.stringContaining("AXI-DOC-2026-301"), "Feuille d'émargement"]),
    );
    const zip = await JSZip.loadAsync(Buffer.from(paquet.base64, "base64"));
    const lisezmoi = await zip.file("LISEZMOI.txt")!.async("string");
    expect(lisezmoi).toContain("[MANQUANTE]");
    expect(lisezmoi).toContain("remboursement");
  });

  it("le PDF de la facture introuvable → erreur (le paquet n'a pas de sens sans elle)", async () => {
    await expect(
      construirePaquetFacturation(
        {
          circuit: "subrogation",
          facture: {
            numero: "X",
            document: { type: "facture", numero: "X", createdAt: new Date() },
            destinataireNom: "Atlas",
            numeroDossierOpco: null,
          },
          numeroSession: "S",
          contexte: "Acme",
          justificatifs: selectionnerJustificatifs([]),
          emargement: null,
        },
        async () => null,
      ),
    ).rejects.toThrow();
  });
});
