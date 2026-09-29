/**
 * ⛔ CLIQUET — AUCUN ÉCRIVAIN DE `Client` HORS DE LA PORTE UNIQUE (chantier
 * visio, plan §3.17 point 5, décision B18 ; c'est aussi la porte qu'attend
 * Axion Partners, INT-T03).
 *
 * `creerOuRetrouverClient` (`src/server/qualiopi/crm/porte-client.ts`) est la
 * SEULE fonction qui crée une fiche client : verrou par SIREN, recherche des
 * fiches proches, refus du doublon. Un `prisma.client.create` écrit ailleurs
 * rouvrirait exactement le défaut mesuré le 28/09 (deux portes sur trois ne
 * vérifiaient rien).
 *
 * Balayage DÉRIVÉ de `src/`, `scripts/` et `prisma/` (tests exclus) : tout
 * `.client.create(`, `.client.upsert(`, `.client.createMany(` et tout
 * `INSERT INTO clients` en SQL. Les exceptions sont NOMINATIVES, motivées, et
 * vérifiées vivantes (une exception qui ne correspond plus à rien rougit : la
 * liste ne pourrit pas en silence).
 *
 * Contre-témoin : le détecteur, appliqué à un source fictif, trouve les
 * trois formes ; et le balayage trouve bien la porte elle-même.
 * Angle mort : un accès dynamique (`prisma["client"]`, un client Prisma passé
 * sous un autre nom de modèle) n'est pas vu.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const PORTE = "src/server/qualiopi/crm/porte-client.ts";

/** Exceptions nominatives : données de démonstration et de test, jamais le produit. */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  "prisma/seeds/qualiopi/demo.ts": "jeu de démonstration local (upsert idempotent)",
  "prisma/seeds/scenarios-console/index.ts": "scénarios de recette de la console",
  "prisma/seeds/volumetrie/fixture-volumetrique.ts": "fixture de volumétrie, jamais en production",
  "scripts/partners/fixtures.ts": "fixtures générées pour le contrat Axion Partners",
  "scripts/qualiopi/e2e-formations-verif.ts": "vérification de bout en bout sur base jetable",
  "scripts/ci/gate-d-visio.ts": "Gate D : fiche fictive de la vérification sur base neuve",
};

const MOTIFS: ReadonlyArray<RegExp> = [
  /\.client\.(create|upsert|createMany)\s*\(/,
  /INSERT\s+INTO\s+"?clients"?[\s(]/i,
];

function ecritUneFiche(source: string): boolean {
  return MOTIFS.some((m) => m.test(source));
}

function balayer(): string[] {
  const trouves: string[] = [];
  const parcourir = (dossier: string): void => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const complet = join(dossier, e.name);
      if (e.isDirectory()) {
        if (["node_modules", "generated", "__tests__", ".next"].includes(e.name)) continue;
        parcourir(complet);
        continue;
      }
      if (!/\.(ts|tsx|mjs|js)$/.test(e.name)) continue;
      if (/\.(spec|test)\.(ts|tsx|mjs|js)$/.test(e.name)) continue;
      if (ecritUneFiche(readFileSync(complet, "utf8"))) {
        trouves.push(relative(RACINE, complet).split("\\").join("/"));
      }
    }
  };
  for (const racine of ["src", "scripts", "prisma"]) {
    const abs = join(RACINE, racine);
    if (!existsSync(abs)) throw new Error(`balayage inopérant : ${abs} introuvable`);
    parcourir(abs);
  }
  return trouves.sort();
}

describe("⛔ aucun écrivain de Client hors de la porte unique", () => {
  const ecrivains = balayer();

  it("le balayage trouve la porte elle-même — sinon il ne garde rien", () => {
    expect(ecrivains).toContain(PORTE);
  });

  it("aucun autre fichier ne crée une fiche client", () => {
    const fautifs = ecrivains.filter((f) => f !== PORTE && !(f in EXCEPTIONS));
    expect(
      fautifs,
      "ces fichiers créent une fiche client sans passer par creerOuRetrouverClient " +
        "(src/server/qualiopi/crm/porte-client.ts) : le doublon de SIREN n'y est pas refusé",
    ).toEqual([]);
  });

  it("chaque exception nominative existe encore et écrit encore une fiche", () => {
    for (const f of Object.keys(EXCEPTIONS)) {
      expect(ecrivains, `exception périmée : ${f} — retire-la de la liste`).toContain(f);
    }
  });

  it("contre-témoin : le détecteur voit les trois formes", () => {
    expect(ecritUneFiche("await prisma.client.create({ data })")).toBe(true);
    expect(ecritUneFiche("tx.client.upsert ({ where })")).toBe(true);
    expect(ecritUneFiche('await db.$executeRaw`INSERT INTO "clients" (id) VALUES (1)`')).toBe(true);
    expect(ecritUneFiche("prisma.client.findMany({})")).toBe(false);
    expect(ecritUneFiche("prisma.clientContact.create({})")).toBe(false);
  });
});
