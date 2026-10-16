// @vitest-environment node

/**
 * Pièces jointes du formulaire de contact — le contrôle des fichiers.
 *
 * Mutations qui rougissent : se fier à l'extension seule (le `.pdf` qui est un
 * exécutable passe), oublier les macros (le `.docm`, ou un `.docx` dont le
 * RÉPERTOIRE CENTRAL porte un `vbaProject.bin`), relever une limite sans
 * l'autre, ne chercher le balisage que dans les 2 premiers Ko.
 */

import { describe, expect, it } from "vitest";

import {
  ACCEPT_PIECES_JOINTES,
  NOMBRE_MAX_PIECES,
  TAILLE_MAX_PIECE_OCTETS,
  TAILLE_MAX_TOTALE_OCTETS,
  assainirNomPieceJointe,
  controlerListePiecesJointes,
} from "../pieces-jointes";
import {
  ScruteurPieceJointe,
  TAILLE_ENTETE_ANALYSEE,
  analyserOctetsPieceJointe,
  localiserRepertoireZip,
  nomsRepertoireZip,
  ressembleABalisage,
} from "@/server/contact/octets-pieces-jointes";
import { fabriquerZip } from "./zip-de-test";

const octets = (...parts: Array<number[] | string>): Uint8Array =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? Array.from(Buffer.from(p)) : p)));

const PDF = octets("%PDF-1.7\n1 0 obj\n");
const PNG = octets([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "IHDR");
const JPG = octets([0xff, 0xd8, 0xff, 0xe0], "JFIF");
const CT = ["[Content_Types].xml", "<Types/>"] as const;
const DOCX = fabriquerZip([CT, ["word/document.xml", "<w:document/>"]]);
const DOCX_MACROS = fabriquerZip([
  CT,
  ["word/document.xml", "<w:document/>"],
  ["word/vbaProject.bin", "VBA"],
]);
const XLSX = fabriquerZip([CT, ["xl/workbook.xml", "<workbook/>"]]);
const PPTX = fabriquerZip([CT, ["ppt/presentation.xml", "<p/>"]]);
const ODT = fabriquerZip([
  ["mimetype", "application/vnd.oasis.opendocument.text"],
  ["content.xml", "<office:document-content/>"],
]);
const ODT_MACROS = fabriquerZip([
  ["mimetype", "application/vnd.oasis.opendocument.text"],
  ["Basic/Standard/Module1.xml", "Sub Main"],
]);
const ZIP_PLANS = fabriquerZip([
  ["plans/rdc.pdf", "%PDF-1.7"],
  ["photos/facade.jpg", "JFIF"],
]);
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
    ["plans-et-photos.zip", ZIP_PLANS, "zip"],
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
    expect(analyserOctetsPieceJointe("faux.docx", ZIP_PLANS)).toMatchObject({
      ok: false,
      motif: "contenu",
    });
  });

  it("un ODT qui porte des macros (Basic/) est refusé", () => {
    expect(analyserOctetsPieceJointe("note.odt", ODT_MACROS)).toMatchObject({ motif: "macros" });
  });

  it("le nom « vbaProject.bin » cité DANS le contenu d'une entrée ne compte pas : seul le répertoire fait foi", () => {
    const docx = fabriquerZip([CT, ["word/document.xml", "voir vbaProject.bin"]]);
    expect(analyserOctetsPieceJointe("cdc.docx", docx)).toMatchObject({ ok: true });
  });

  it("un .docx sans répertoire central lisible est refusé", () => {
    expect(analyserOctetsPieceJointe("cdc.docx", DOCX.subarray(0, DOCX.length - 22))).toMatchObject(
      { ok: false, motif: "contenu" },
    );
  });

  it("un .zip qui n'est pas une archive est refusé ; un .zip n'est jamais ouvert", () => {
    expect(analyserOctetsPieceJointe("plans.zip", PDF)).toMatchObject({ ok: false });
    // Une archive dont le contenu contiendrait un exécutable reste acceptée :
    // le serveur ne lit que la signature (et l'antivirus le flux).
    const avecExe = fabriquerZip([["setup.exe", "MZ"]]);
    expect(analyserOctetsPieceJointe("outils.zip", avecExe)).toMatchObject({ ok: true });
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

  it("le balisage est cherché dans les 8 premiers Ko, pas seulement les 2 premiers", () => {
    const loin = octets("a".repeat(6000), "<script>alert(1)</script>");
    expect(ressembleABalisage(loin)).toBe(true);
    expect(analyserOctetsPieceJointe("notes.txt", loin)).toMatchObject({ ok: false });
    expect(TAILLE_ENTETE_ANALYSEE).toBeGreaterThanOrEqual(8 * 1024);
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

  it("25 Mo par fichier : 25 Mo passe, un octet de plus non, avec la marche à suivre", () => {
    expect(TAILLE_MAX_PIECE_OCTETS).toBe(25 * 1024 * 1024);
    expect(controlerListePiecesJointes([f("a.pdf", TAILLE_MAX_PIECE_OCTETS)])).toBeNull();
    expect(controlerListePiecesJointes([f("a.pdf", TAILLE_MAX_PIECE_OCTETS + 1)])).toBe(
      "« a.pdf » dépasse 25 Mo. Fichier trop lourd : envoyez-le par e-mail à " +
        "contact@axion-ia.com ou avec un lien de partage (WeTransfer, Drive) dans votre message.",
    );
  });

  it("50 Mo au total", () => {
    const vingt = 20 * 1024 * 1024;
    expect(TAILLE_MAX_TOTALE_OCTETS).toBe(50 * 1024 * 1024);
    expect(controlerListePiecesJointes([f("a.pdf", vingt), f("b.pdf", vingt)])).toBeNull();
    expect(
      controlerListePiecesJointes([f("a.pdf", vingt), f("b.pdf", vingt), f("c.pdf", vingt)]),
    ).toMatch(/50 Mo au total/);
  });

  it("un .zip est accepté à l'annonce", () => {
    expect(controlerListePiecesJointes([f("plans.zip", 10)])).toBeNull();
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
    expect(ACCEPT_PIECES_JOINTES).toContain(".zip");
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

describe("répertoire central d'une archive — lu sans rien décompresser", () => {
  it("localise le répertoire depuis la seule FIN du fichier, commentaire compris", () => {
    const zip = fabriquerZip([CT, ["word/document.xml", "x".repeat(5000)]], {
      commentaire: "généré par un outil",
    });
    const fin = zip.subarray(zip.length - 200);
    const plage = localiserRepertoireZip(fin, zip.length);
    expect(plage).not.toBeNull();
    const noms = nomsRepertoireZip(zip.subarray(plage!.debut, plage!.debut + plage!.taille));
    expect(noms).toEqual(["[Content_Types].xml", "word/document.xml"]);
  });

  it("rend null sur une fin sans enregistrement, ou un répertoire mal formé", () => {
    expect(localiserRepertoireZip(octets("pas une archive"), 15)).toBeNull();
    expect(nomsRepertoireZip(octets("PK\u0001\u0002 tronqué"))).toBeNull();
  });
});

describe("lecture en flux — un motif coupé entre deux morceaux est vu", () => {
  it("_VBA_PROJECT à cheval sur deux morceaux d'un .doc", () => {
    const s = new ScruteurPieceJointe("doc");
    s.pousser(DOC_MACROS.subarray(0, 14));
    s.pousser(DOC_MACROS.subarray(14));
    expect(s.verdict("ancien.doc")).toMatchObject({ ok: false, motif: "macros" });
  });

  it("un octet nul au milieu d'un long .txt", () => {
    const s = new ScruteurPieceJointe("txt");
    s.pousser(octets("a".repeat(20_000)));
    s.pousser(octets("b", [0], "c"));
    expect(s.verdict("notes.txt")).toMatchObject({ ok: false, motif: "contenu" });
  });
});
