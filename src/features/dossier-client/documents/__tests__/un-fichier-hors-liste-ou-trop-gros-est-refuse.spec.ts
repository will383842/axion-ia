// @vitest-environment node

/**
 * R6 — UN FICHIER HORS LISTE, DÉGUISÉ OU TROP GROS EST REFUSÉ (ADR 0063, D4).
 *
 * Onze formats, liste fermée ; l'extension ET la signature des premiers octets
 * doivent concorder. La taille se vérifie AVANT de lire le fichier (la taille
 * annoncée par le navigateur), puis sur les octets lus.
 *
 * Mutations qui rougissent : ajouter `.svg` ou `.js` à la liste ; ne regarder
 * que l'extension (le PDF renommé `.png` passe) ; borner à `>` au lieu de `>=`
 * (15 Mo pile refusé, ou 15 Mo + 1 accepté) ; changer la borne du code sans
 * celle du CHECK.
 * Contre-témoin : les onze formats, chacun avec sa vraie signature, passent.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { FORMATS, TAILLE_MAX_FICHIER_OCTETS, formatDepuisNom, signatureConforme } from "../formats";
import { ajouterFichier, ErreurDocument, verifierTailleAnnoncee } from "../ajouter";
import { baseEnMemoire } from "./_base-en-memoire";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PROJET = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";

const octets = (texte: string): Uint8Array => new TextEncoder().encode(texte);
const pdf = octets("%PDF-1.7\n1 0 obj\n");
const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

/** Un échantillon CONFORME par format (contre-témoin). */
const ECHANTILLONS: Record<keyof typeof FORMATS, [string, Uint8Array]> = {
  pdf: ["proposition.pdf", pdf],
  html: ["programme.html", octets("<!doctype html><p>Programme</p>")],
  eml: ["envoi.eml", octets("From: a@b.fr\r\nSubject: Votre journée\r\n\r\nBonjour")],
  docx: ["compte-rendu.docx", zip],
  xlsx: ["chiffrage.xlsx", zip],
  pptx: ["support.pptx", zip],
  png: ["capture.png", png],
  jpg: ["photo.jpeg", jpg],
  txt: ["notes.txt", octets("Notes de l'appel, 30/09.")],
  md: ["guide.md", octets("# Guide de l'auditeur\n")],
  csv: ["liste.csv", octets("nom;rôle\nDupont;DG\n")],
};

const sain = async () => ({ issue: "sain" as const });

function entree(nom: string, contenu: Uint8Array) {
  return {
    clientId: CLIENT,
    projetId: PROJET,
    cote: "interne" as const,
    nature: null,
    titre: "",
    envoyeLe: null,
    parAdminId: ADMIN,
    nom,
    octets: contenu,
  };
}

async function refus(nom: string, contenu: Uint8Array): Promise<string> {
  const { db, compteurs } = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
  const e = await ajouterFichier(db as never, entree(nom, contenu), sain).catch((x: unknown) => x);
  expect(e).toBeInstanceOf(ErreurDocument);
  expect(compteurs.ecritures).toBe(0);
  return (e as Error).message;
}

describe("un fichier hors liste ou trop gros est refusé", () => {
  it.each([".exe", ".svg", ".js", ".zip"])("refuse l'extension %s, en la nommant", async (ext) => {
    const message = await refus(`piece${ext}`, pdf);
    expect(message).toContain(`Les fichiers « ${ext} » ne sont pas acceptés.`);
    expect(message).toContain("Choisissez à nouveau un fichier.");
  });

  it("un fichier sans extension dit qu'il n'a pas de type reconnu", async () => {
    expect(await refus("piece", pdf)).toMatch(/^Ce fichier n'a pas de type reconnu\./);
  });

  it("un PDF renommé .png est refusé (signature)", async () => {
    expect(await refus("capture.png", pdf)).toMatch(/ne correspond pas/);
  });

  it("un .docx sans signature PK est refusé", async () => {
    expect(await refus("cr.docx", octets("pas une archive"))).toMatch(/ne correspond pas/);
  });

  it("un HTML qui porte un octet nul est refusé", async () => {
    expect(await refus("page.html", new Uint8Array([0x3c, 0x70, 0x3e, 0x00, 0x3c]))).toMatch(
      /ne correspond pas/,
    );
  });

  it("un texte qui n'est pas de l'UTF-8 valide est refusé", async () => {
    expect(await refus("notes.txt", new Uint8Array([0x41, 0xff, 0xfe, 0x42]))).toMatch(
      /ne correspond pas/,
    );
  });

  it("la taille annoncée est vérifiée AVANT de lire : 15 Mo + 1 octet refusé, 15 Mo pile accepté", () => {
    expect(() => verifierTailleAnnoncee(TAILLE_MAX_FICHIER_OCTETS + 1)).toThrow(
      /^Ce fichier pèse 16 Mo : la limite est de 15 Mo\./,
    );
    expect(() => verifierTailleAnnoncee(23 * 1024 * 1024)).toThrow(/pèse 23 Mo/);
    expect(() => verifierTailleAnnoncee(TAILLE_MAX_FICHIER_OCTETS)).not.toThrow();
    expect(() => verifierTailleAnnoncee(0)).toThrow(/^Ce fichier est vide\./);
  });

  it("les octets lus sont revérifiés : 15 Mo + 1 refusé sans écrire, 15 Mo pile enregistré", async () => {
    const trop = new Uint8Array(TAILLE_MAX_FICHIER_OCTETS + 1);
    trop.set(pdf);
    expect(await refus("gros.pdf", trop)).toMatch(/la limite est de 15 Mo/);

    const pile = new Uint8Array(TAILLE_MAX_FICHIER_OCTETS);
    pile.set(pdf);
    const { db, etat } = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
    await ajouterFichier(db as never, entree("pile.pdf", pile), sain);
    expect(etat.documents[0]?.fichierTailleOctets).toBe(TAILLE_MAX_FICHIER_OCTETS);
  });

  it("contre-témoin : les onze formats passent avec leur vraie signature", async () => {
    expect(Object.keys(FORMATS)).toHaveLength(11);
    for (const [format, [nom, contenu]] of Object.entries(ECHANTILLONS)) {
      expect(formatDepuisNom(nom), nom).toBe(format);
      expect(signatureConforme(format as keyof typeof FORMATS, contenu), nom).toBe(true);
      const { db, etat } = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
      await ajouterFichier(db as never, entree(nom, contenu), sain);
      expect(etat.documents[0]?.fichierFormat, nom).toBe(format);
    }
  });

  it("la borne du code est celle du CHECK de la base (15 728 640 octets, deux fois)", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "prisma/migrations/20261001120000_documents_projet/migration.sql"),
      "utf8",
    );
    expect(TAILLE_MAX_FICHIER_OCTETS).toBe(15_728_640);
    expect(sql).toContain(`"fichier_taille_octets" BETWEEN 1 AND ${TAILLE_MAX_FICHIER_OCTETS}`);
    expect(sql).toContain(`octet_length("octets") BETWEEN 1 AND ${TAILLE_MAX_FICHIER_OCTETS}`);
  });
});
