/**
 * Vérification n° 2 (rouge sécurité), contrôles SANS ÉCRAN — lecture du code.
 *
 *  · V2-S11 bis — toute clé de `settings` que le chantier LIT est une clé
 *    protégée de l'éditeur de réglages général (`estCleProtegee`) : sinon un
 *    `admin` pourrait l'écrire par l'éditeur général, hors des préalables et du
 *    journal de l'écran Interrupteurs.
 *  · V2-S01 bis — chaque route d'API de l'espace formateur lit la session de
 *    l'espace (jamais un identifiant de formateur venu de la requête) et répond
 *    « introuvable » par un 404 neutre.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CLES_INTERRUPTEURS,
  CLES_INTERRUPTEURS_ENTREE,
  CLES_INTERRUPTEURS_SIGNATURE,
  cleSetting,
  cleSettingEntree,
  cleSettingSignature,
  estCleProtegee,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";

const RACINE = path.resolve(__dirname, "../../../..");

function fichiers(dossier: string): string[] {
  const abs = path.join(RACINE, dossier);
  const sortie: string[] = [];
  for (const nom of readdirSync(abs)) {
    const rel = path.join(dossier, nom);
    if (statSync(path.join(RACINE, rel)).isDirectory()) sortie.push(...fichiers(rel));
    else if (/\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom) && !rel.includes("__tests__"))
      sortie.push(rel);
  }
  return sortie;
}

describe("V2-S11 bis — les clés lues par le chantier sont protégées de l'éditeur général", () => {
  it("chaque clé des trois registres d'interrupteurs", () => {
    const cles = [
      ...CLES_INTERRUPTEURS.map(cleSetting),
      ...CLES_INTERRUPTEURS_ENTREE.map(cleSettingEntree),
      ...CLES_INTERRUPTEURS_SIGNATURE.map(cleSettingSignature),
    ];
    expect(cles.length).toBeGreaterThan(30);
    for (const k of cles) {
      expect(estCleProtegee(k), k).toBe(true);
      expect(estCleProtegee(k.toUpperCase()), k).toBe(true);
    }
  });

  it("chaque clé littérale lue en base par le code du chantier", () => {
    const zones = [
      "src/server/qualiopi/formateurs-independants",
      "src/server/qualiopi/documents/signature",
      "src/server/calendly",
    ];
    const lues = new Set<string>();
    for (const z of zones) {
      for (const f of fichiers(z)) {
        const texte = readFileSync(path.join(RACINE, f), "utf8");
        for (const m of texte.matchAll(
          /setting\.find(?:Unique|First)\(\{\s*where:\s*\{\s*key:\s*"([^"]+)"/g,
        )) {
          lues.add(m[1]!);
        }
      }
    }
    for (const k of lues) expect(estCleProtegee(k), k).toBe(true);
  });
});

describe("V2-S01 bis — routes d'API de l'espace formateur", () => {
  const routes = [
    ...fichiers("src/app/api/espace-formateur"),
    ...fichiers("src/app/api/formateur"),
  ].filter((f) => f.endsWith("route.ts"));

  it("il y en a (sinon ce contrôle ne regarde rien)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(4);
  });

  it.each(routes)(
    "%s — session de l'espace, 404 neutre, aucun identifiant de formateur lu",
    (f) => {
      const texte = readFileSync(path.join(RACINE, f), "utf8");
      expect(texte).toMatch(/getFormateurSession(?:Lecture)?\(\)/);
      expect(texte).toMatch(/status:\s*404/);
      // L'identifiant du formateur vient de la session, jamais de la requête.
      expect(texte).not.toMatch(/searchParams\.get\(\s*["']trainerId["']/);
      expect(texte).not.toMatch(/params[^;\n]*trainerId/);
    },
  );
});
