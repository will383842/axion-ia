/**
 * R3 — LES OCTETS D'UN DOCUMENT NE SORTENT QUE PAR LE TÉLÉCHARGEMENT (ADR 0063, D2).
 *
 * Les fichiers des projets vivent en base (`documents_projet_contenus`, jusqu'à
 * 15 Mo chacun). Une liste qui les chargerait par mégarde ferait passer une page
 * de 60 Ko à 100 Mo. La table est À PART pour que l'oubli d'un `select` ne
 * charge rien ; ce test interdit la seconde porte : la LECTURE explicite.
 *
 * Seuls `telecharger.ts` (route de la console) et `page-publique.ts` (lien
 * public d'une page) lisent `documentProjetContenu` ; personne n'écrit
 * `contenu: true` ni `include: { contenu`. La liste de la rubrique
 * (`SELECT_DOCUMENT_LISTE`) ne nomme pas `contenu`.
 *
 * Contre-témoin : le détecteur trouve bien un texte fabriqué fautif — sinon un
 * balayage vide serait un vert qui ne regarde rien.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SELECT_DOCUMENT_LISTE } from "@/features/dossier-client/documents/queries";

const AUTORISES = new Set([
  "src/features/dossier-client/documents/telecharger.ts",
  "src/features/dossier-client/documents/page-publique.ts",
]);

function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Les fautes d'un texte de code : lecture des octets, ou chargement par relation. */
function fautesDeLecture(source: string): string[] {
  const code = sansCommentaires(source);
  const fautes: string[] = [];
  if (/\bdocumentProjetContenu\s*\.\s*find/.test(code)) fautes.push("lit documentProjetContenu");
  if (/\bdocumentProjetContenu\s*\.\s*(aggregate|groupBy)/.test(code))
    fautes.push("agrège documentProjetContenu");
  // `contenu` est un nom de champ courant (messages, versions…) : seul compte
  // celui d'un fichier qui interroge le modèle des documents.
  const toucheLesDocuments = /\bdocumentProjet\s*\./.test(code);
  if (toucheLesDocuments && /\bcontenu\s*:\s*(true\b|\{\s*select)/.test(code))
    fautes.push("charge `contenu`");
  if (toucheLesDocuments && /include\s*:\s*\{[^}]*\bcontenu\b/.test(code))
    fautes.push("inclut `contenu`");
  if (/\b(FROM|JOIN)\s+"?documents_projet_contenus\b/i.test(code))
    fautes.push("lit documents_projet_contenus en SQL");
  return fautes;
}

function fichiersSource(): string[] {
  return execFileSync("git", ["ls-files", "src"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .trim()
    .split(/\r?\n/)
    .filter((f) => /\.tsx?$/.test(f) && !/(\.(spec|test)\.tsx?$|__tests__\/)/.test(f));
}

describe("les octets d'un document ne sortent que par le téléchargement", () => {
  it("aucun fichier de src/ hors des deux routes ne lit les octets", () => {
    const fichiers = fichiersSource();
    expect(fichiers.length).toBeGreaterThan(500);
    const fautes = fichiers
      .filter((f) => !AUTORISES.has(f))
      .flatMap((f) => fautesDeLecture(readFileSync(f, "utf8")).map((x) => `${f} : ${x}`));
    expect(fautes).toEqual([]);
  });

  it("les deux lecteurs autorisés existent et lisent bien par documentId", () => {
    for (const f of AUTORISES) {
      expect(readFileSync(f, "utf8"), f).toMatch(
        /documentProjetContenu\.findUnique\(\{\s*where: \{ documentId/,
      );
    }
  });

  it("la sélection de la liste ne nomme pas le contenu", () => {
    expect(Object.keys(SELECT_DOCUMENT_LISTE)).not.toContain("contenu");
    expect(Object.keys(SELECT_DOCUMENT_LISTE)).toContain("titre");
  });

  it("contre-témoin : le détecteur voit une lecture fabriquée", () => {
    expect(fautesDeLecture("await prisma.documentProjetContenu.findMany({})")).not.toEqual([]);
    expect(
      fautesDeLecture("prisma.documentProjet.findMany({ include: { contenu: true } })"),
    ).not.toEqual([]);
    expect(
      fautesDeLecture("db.documentProjet.findFirst({ select: { id: true, contenu: true } })"),
    ).not.toEqual([]);
    // Un autre modèle qui a un champ `contenu` n'est pas visé.
    expect(fautesDeLecture("prisma.message.findMany({ select: { contenu: true } })")).toEqual([]);
    expect(
      fautesDeLecture('$queryRaw`SELECT octets FROM "documents_projet_contenus"`'),
    ).not.toEqual([]);
    expect(fautesDeLecture("// documentProjetContenu.findMany dans un commentaire")).toEqual([]);
  });
});
