/**
 * R4 — AUCUN DOCUMENT DE PROJET NE SE SUPPRIME (ADR 0063, D5 ; ordre permanent
 * de Will du 29/09 : « ne jamais purger quoi que ce soit »).
 *
 * Trois verrous, prouvés ici sans base :
 *   1. aucun `delete` / `deleteMany` sur les trois modèles, dans `src/` ni
 *      `scripts/` — SAUF l'effacement RGPD (`src/lib/rgpd-erase.ts`, seul module
 *      qui pose le drapeau d'effacement) : la purge des données du pilote et
 *      son rejeu suppriment, sous le drapeau, les documents des projets de
 *      test (`projets` est RESTRICT envers eux). Jamais les ouvertures ;
 *   2. la migration crée bien les triggers qui refusent DELETE et TRUNCATE
 *      (leur comportement est prouvé sur Postgres réel en Gate D) ;
 *   3. aucun bouton « Supprimer » dans la rubrique : on archive, on réaffiche.
 *
 * Contre-témoin : le détecteur voit un `deleteMany` fabriqué.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION = "prisma/migrations/20261001120000_documents_projet/migration.sql";
const COMPOSANTS = [
  "src/components/admin/dossier-client/DocumentsDuProjet.tsx",
  "src/components/admin/dossier-client/AjouterDocument.tsx",
  "src/components/admin/dossier-client/DocumentsInteractifs.tsx",
];

/** La seule exception : l'effacement RGPD, sous le drapeau (Gate D prouve le refus sans lui). */
const EFFACEMENT_RGPD = "src/lib/rgpd-erase.ts";

/** Fin d'une fonction de premier niveau dans `rgpd-erase.ts`. */
const FIN_DE_FONCTION = "\n}\n";

const SUPPRESSION =
  /\b(documentProjet|documentProjetContenu|documentProjetOuverture)\s*\.\s*(delete|deleteMany)\b|DELETE\s+FROM\s+"?documents_projet/i;

function fichiers(): string[] {
  return execFileSync("git", ["ls-files", "src", "scripts"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .trim()
    .split(/\r?\n/)
    .filter(
      (f) => /\.(ts|tsx|mjs|js|sql)$/.test(f) && !/(\.(spec|test)\.tsx?$|__tests__\/)/.test(f),
    );
}

describe("aucun document de projet ne se supprime", () => {
  it("aucun code ne supprime un document, son contenu ou une ouverture", () => {
    const liste = fichiers();
    expect(liste.length).toBeGreaterThan(500);
    const fautifs = liste.filter(
      (f) => f !== EFFACEMENT_RGPD && SUPPRESSION.test(readFileSync(f, "utf8")),
    );
    expect(fautifs).toEqual([]);
  });

  it("l'effacement RGPD supprime documents et octets du pilote sous le drapeau, jamais une ouverture", () => {
    const erase = readFileSync(EFFACEMENT_RGPD, "utf8");
    expect(erase).toContain("SET LOCAL axion.effacement_rgpd = 'on'");
    const debut = erase.indexOf("async function supprimerDonneesPilote(");
    const corps = erase.slice(debut, erase.indexOf(FIN_DE_FONCTION, debut));
    const octets = corps.indexOf("documentProjetContenu.deleteMany");
    const lignes = corps.indexOf("documentProjet.deleteMany");
    const projets = corps.indexOf("projet.deleteMany");
    expect(octets).toBeGreaterThan(-1);
    expect(octets).toBeLessThan(lignes);
    expect(lignes).toBeLessThan(projets);
    expect(erase).not.toMatch(/documentProjetOuverture\s*\.\s*delete/);
    // Les deux appelants passent par le drapeau.
    for (const appelant of [
      "export async function purgerPilote(",
      "export async function rejouerEffacements(",
    ]) {
      const d = erase.indexOf(appelant);
      const c = erase.slice(d, erase.indexOf(FIN_DE_FONCTION, d));
      expect(c, appelant).toContain("executerSousDrapeauEffacement(prisma");
      expect(c, appelant).toContain("supprimerDonneesPilote(tx");
    }
  });

  it("la migration pose les triggers qui refusent DELETE et TRUNCATE sur les trois tables", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).toMatch(
      /CREATE TRIGGER "documents_projet_immuable" BEFORE UPDATE OR DELETE ON "documents_projet"/,
    );
    expect(sql).toMatch(
      /CREATE TRIGGER "documents_projet_contenus_immuable" BEFORE UPDATE OR DELETE ON "documents_projet_contenus"/,
    );
    expect(sql).toMatch(
      /CREATE TRIGGER "documents_projet_ouvertures_ajout_seul" BEFORE UPDATE OR DELETE ON "documents_projet_ouvertures"/,
    );
    for (const t of [
      "documents_projet",
      "documents_projet_contenus",
      "documents_projet_ouvertures",
    ]) {
      expect(sql).toContain(`BEFORE TRUNCATE ON "${t}"`);
    }
    // Aucun DROP hors du bloc de réversion commenté.
    const code = sql.replace(/^--.*$/gm, "");
    expect(code).not.toMatch(/\bDROP\b/i);
  });

  it("la rubrique n'a aucun bouton « Supprimer » ni « Modifier »", () => {
    for (const f of COMPOSANTS) {
      const source = readFileSync(f, "utf8");
      expect(source, f).not.toMatch(/>\s*(Supprimer|Modifier)\b/);
      expect(source, f).not.toMatch(/supprimerDocument|deleteDocument/);
    }
  });

  it("contre-témoin : le détecteur voit une suppression fabriquée", () => {
    expect(SUPPRESSION.test("await prisma.documentProjet.deleteMany({})")).toBe(true);
    expect(SUPPRESSION.test('DELETE FROM "documents_projet_contenus"')).toBe(true);
    expect(SUPPRESSION.test("await prisma.documentProjet.updateMany({})")).toBe(false);
  });
});
