// @vitest-environment node

/**
 * Pièces jointes du formulaire de contact — le contrôle des fichiers.
 *
 * Mutations qui rougissent : se fier à l'extension seule (le `.pdf` qui est un
 * exécutable passe), oublier les macros (le `.docm`, ou un `.docx` qui porte
 * un `vbaProject.bin`), relever une limite sans l'autre.
 */

import { describe, expect, it } from "vitest";

import {
  ACCEPT_PIECES_JOINTES,
  NOMBRE_MAX_PIECES,
  TAILLE_MAX_PIECE_OCTETS,
  TAILLE_MAX_TOTALE_OCTETS,
  analyserOctetsPieceJointe,
  assainirNomPieceJointe,
  controlerListePiecesJointes,
} from "../pieces-jointes";

const octets = (...parts: Array<number[] | string>): Uint8Array =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? Array.from(Buffer.from(p)) : p)));

const PDF = octets("%PDF-1.7\n1 0 obj\n");
const PNG = octets([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "IHDR");
const JPG = octets([0xff, 0xd8, 0xff, 0xe0], "JFIF");
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const DOCX = octets(ZIP, "....[Content_Types].xml....word/document.xml....");
const DOCX_MACROS = octets(ZIP, "....[Content_Types].xml....word/vbaProject.bin....");
const XLSX = octets(ZIP, "....[Content_Types].xml....xl/workbook.xml....");
const PPTX = octets(ZIP, "....[Content_Types].xml....ppt/presentation.xml....");
const ODT = octets(ZIP, "........mimetypeapplication/vnd.oasis.opendocument.text....");
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const DOC = octets(OLE, "....WordDocument....");
const DOC_MACROS = octets(
  OLE,
  Array.from("_VBA_PROJECT").flatMap((c) => [c.charCodeAt(0), 0]),
);
const EXE = octets([0x4d, 0x5a, 0x90, 0x00], "This program cannot be run in DOS mode");
const ELF = octets([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);

describe("contrôle des octets — le type réel, pas l'extension", () => {
  it.each([
    ["cahier-des-charges.pdf", PDF, "pdf"],
    ["plan.png", PNG, "png"],
    ["photo.JPEG", JPG, "jpg"],
    ["cdc.docx", DOCX, "docx"],
    ["budget.xlsx", XLSX, "xlsx"],
    ["support.pptx", PPTX, "pptx"],
    ["note.odt", ODT, "odt"],
    ["ancien.doc", DOC, "doc"],
    ["ancien.xls", DOC, "xls"],
    ["notes.txt", octets("Bonjour,\nvoici le besoin.\n"), "txt"],
    ["export.csv", octets("nom;quantité\nposte;12\r\n"), "csv"],
    // Un CSV exporté par Excel en Windows-1252 (« é » = 0xE9) reste accepté.
    ["excel.csv", octets("libell", [0xe9], ";12\r\n"), "csv"],
  ])("%s est accepté", (nom, o, format) => {
    const r = analyserOctetsPieceJointe(nom, o);
    expect(r).toMatchObject({ ok: true, format });
  });

  it("un exécutable déguisé en .pdf est refusé", () => {
    expect(analyserOctetsPieceJointe("cahier-des-charges.pdf", EXE)).toMatchObject({
      ok: false,
      motif: "contenu",
    });
    expect(analyserOctetsPieceJointe("devis.pdf", ELF)).toMatchObject({ ok: false });
    expect(analyserOctetsPieceJointe("notes.txt", octets("#!/bin/sh\nrm -rf /\n"))).toMatchObject({
      ok: false,
    });
  });

  it("un PNG renommé en .pdf est refusé (signature ≠ extension)", () => {
    expect(analyserOctetsPieceJointe("faux.pdf", PNG)).toMatchObject({
      ok: false,
      motif: "contenu",
    });
  });

  it("un .docm est refusé, même si son contenu est un document valide", () => {
    const r = analyserOctetsPieceJointe("cahier.docm", DOCX);
    expect(r).toMatchObject({ ok: false, motif: "macros" });
    expect(analyserOctetsPieceJointe("tableau.xlsm", XLSX)).toMatchObject({ motif: "macros" });
  });

  it("un .docx qui porte des macros (vbaProject.bin) est refusé", () => {
    expect(analyserOctetsPieceJointe("cahier.docx", DOCX_MACROS)).toMatchObject({
      ok: false,
      motif: "macros",
    });
  });

  it("un .doc ancien qui porte un projet VBA est refusé", () => {
    expect(analyserOctetsPieceJointe("ancien.doc", DOC_MACROS)).toMatchObject({ motif: "macros" });
  });

  it("un ZIP quelconque renommé en .docx est refusé", () => {
    expect(analyserOctetsPieceJointe("faux.docx", octets(ZIP, "archive.zip"))).toMatchObject({
      ok: false,
    });
  });

  it.each([
    ["page.html", octets("<!doctype html><html></html>")],
    ["image.svg", octets("<svg xmlns='http://www.w3.org/2000/svg'/>")],
    ["programme.exe", EXE],
    ["script.js", octets("alert(1)")],
  ])("%s est refusé (format hors liste)", (nom, o) => {
    expect(analyserOctetsPieceJointe(nom, o)).toMatchObject({ ok: false, motif: "format" });
  });

  it("du HTML ou du SVG déguisé en .txt ou .csv est refusé", () => {
    expect(analyserOctetsPieceJointe("a.txt", octets("<html><script>x</script>"))).toMatchObject({
      ok: false,
    });
    expect(analyserOctetsPieceJointe("a.csv", octets("\uFEFF  <svg onload=x>"))).toMatchObject({
      ok: false,
    });
  });

  it("un .txt binaire (octet nul) est refusé", () => {
    expect(analyserOctetsPieceJointe("a.txt", octets("abc", [0], "def"))).toMatchObject({
      ok: false,
    });
  });
});

describe("contrôle de la liste — nombre, taille, total", () => {
  const f = (name: string, size: number) => ({ name, size });

  it("aucun fichier : rien à redire", () => {
    expect(controlerListePiecesJointes([])).toBeNull();
  });

  it("3 fichiers passent, 4 non", () => {
    expect(NOMBRE_MAX_PIECES).toBe(3);
    const trois = [f("a.pdf", 10), f("b.pdf", 10), f("c.pdf", 10)];
    expect(controlerListePiecesJointes(trois)).toBeNull();
    expect(controlerListePiecesJointes([...trois, f("d.pdf", 10)])).toMatch(
      /3 fichiers au maximum/,
    );
  });

  it("10 Mo par fichier : 10 Mo passe, un octet de plus non", () => {
    expect(controlerListePiecesJointes([f("a.pdf", TAILLE_MAX_PIECE_OCTETS)])).toBeNull();
    expect(controlerListePiecesJointes([f("a.pdf", TAILLE_MAX_PIECE_OCTETS + 1)])).toMatch(
      /dépasse 10 Mo/,
    );
  });

  it("20 Mo au total", () => {
    const neuf = 9 * 1024 * 1024;
    expect(TAILLE_MAX_TOTALE_OCTETS).toBe(20 * 1024 * 1024);
    expect(controlerListePiecesJointes([f("a.pdf", neuf), f("b.pdf", neuf)])).toBeNull();
    expect(
      controlerListePiecesJointes([f("a.pdf", neuf), f("b.pdf", neuf), f("c.pdf", neuf)]),
    ).toMatch(/20 Mo au total/);
  });

  it("un fichier vide est refusé", () => {
    expect(controlerListePiecesJointes([f("a.pdf", 0)])).toMatch(/vide/);
  });

  it("un .docm est annoncé comme fichier à macros, dès le navigateur", () => {
    expect(controlerListePiecesJointes([f("cdc.docm", 10)])).toMatch(/macros/);
  });

  it("l'attribut accept ne propose ni HTML, ni SVG, ni macros", () => {
    expect(ACCEPT_PIECES_JOINTES).toContain(".pdf");
    expect(ACCEPT_PIECES_JOINTES).toContain(".docx");
    expect(ACCEPT_PIECES_JOINTES).not.toMatch(/\.(html?|svg|docm|xlsm|exe)\b/);
  });
});

describe("nom de fichier assaini", () => {
  it.each([
    ["../../etc/passwd.pdf", "passwd.pdf"],
    ["C:\\Users\\x\\Cahier des charges.PDF", "Cahier des charges.pdf"],
    ['a"b<c>.pdf', "a_b_c.pdf"],
    ["\u0000\u001f.pdf", "piece-jointe.pdf"],
    ["Cahier des charges — v2 (final).docx", "Cahier des charges _ v2 (final).docx"],
    ["Été 2026.pdf", "Été 2026.pdf"],
  ])("%s → %s", (brut, attendu) => {
    expect(assainirNomPieceJointe(brut)).toBe(attendu);
  });

  it("borne la longueur et garde l'extension", () => {
    const nom = assainirNomPieceJointe(`${"x".repeat(500)}.pdf`);
    expect(nom.length).toBeLessThanOrEqual(120);
    expect(nom.endsWith(".pdf")).toBe(true);
  });
});
