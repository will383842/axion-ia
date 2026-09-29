// @vitest-environment node

/**
 * Verrou — les interrupteurs publics de l'enregistrement des visios n'ont
 * qu'UNE source : `src/server/visio/visio-annonce.ts` (LOTS-EXECUTION,
 * correction anti-doublon D2 ; PR 4, 5, 8).
 *
 * ## Ce qu'il ferme
 *
 * Trois PR parallèles déclaraient chacune leur interrupteur :
 * `ENREGISTREMENT_ANNONCE_AUX_CLIENTS = false` (PR 4, `creer-rencontre.ts`),
 * `DICTEE_ANNONCEE = false` et `PREAVIS_SOUS_TRAITANTS` (PR 5, `drapeau.ts`),
 * `ANNONCE_VISIO_ACTIVE` (PR 8). Le jour de la bascule, il aurait fallu penser
 * à trois lignes ; en oublier une fait dire au site une chose et faire au code
 * une autre. Au rebase des PR 4 et 5, leurs déclarations locales rougissent ici.
 *
 * ## Contre-témoin et angle mort
 *
 * Contre-témoin : le détecteur reconnaît une déclaration écrite à la main
 * (dernier test) — la garde n'est pas verte parce que son motif ne voit rien.
 * Angle mort : elle lit les DÉCLARATIONS exportées ; un littéral `false` écrit
 * en dur à l'endroit de l'usage, sans constante, lui échappe.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ANNONCE_VISIO_ACTIVE,
  DICTEE_ANNONCEE,
  ENREGISTREMENT_ANNONCE_AUX_CLIENTS,
} from "../visio-annonce";

const RACINE = process.cwd();
const SOURCE = "src/server/visio/visio-annonce.ts";
const INTERRUPTEURS = [
  "ETAT_COMPTES_RENDUS_VISIO",
  "ANNONCE_VISIO_ACTIVE",
  "ENREGISTREMENT_ANNONCE_AUX_CLIENTS",
  "DICTEE_ANNONCEE",
  "DISCUTONS_MEET_SEUL",
  "PREAVIS_SOUS_TRAITANTS",
] as const;

function fichiersSource(dir: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (nom === "node_modules" || nom === "__tests__" || nom === "generated") continue;
    if (statSync(chemin).isDirectory()) fichiersSource(chemin, acc);
    else if (/\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) acc.push(chemin);
  }
  return acc;
}

const declare = (nom: string) => new RegExp(String.raw`export\s+(?:const|let|var)\s+${nom}\b`);

const SOURCES = fichiersSource(join(RACINE, "src")).map(
  (f) => [relative(RACINE, f).split(sep).join("/"), readFileSync(f, "utf8")] as const,
);

describe("les interrupteurs publics de la visio ont une seule source (D2)", () => {
  it.each(INTERRUPTEURS)(
    "🔴 %s n'est déclaré que dans src/server/visio/visio-annonce.ts",
    (nom) => {
      const ou = SOURCES.filter(([, texte]) => declare(nom).test(texte)).map(([chemin]) => chemin);
      expect(ou).toEqual([SOURCE]);
    },
  );

  it("🔴 l'annonce aux clients et la dictée DÉRIVENT de l'annonce publique", () => {
    expect(ENREGISTREMENT_ANNONCE_AUX_CLIENTS).toBe(ANNONCE_VISIO_ACTIVE);
    expect(DICTEE_ANNONCEE).toBe(ANNONCE_VISIO_ACTIVE);
    const texte = readFileSync(join(RACINE, SOURCE), "utf8");
    expect(texte).toMatch(
      /export const ENREGISTREMENT_ANNONCE_AUX_CLIENTS: boolean = ANNONCE_VISIO_ACTIVE;/,
    );
    expect(texte).toMatch(/export const DICTEE_ANNONCEE: boolean = ANNONCE_VISIO_ACTIVE;/);
  });

  it("🔑 CONTRE-TÉMOIN : le détecteur voit une déclaration locale écrite à la main", () => {
    expect(
      declare("ENREGISTREMENT_ANNONCE_AUX_CLIENTS").test(
        "export const ENREGISTREMENT_ANNONCE_AUX_CLIENTS = false;",
      ),
    ).toBe(true);
    expect(declare("DICTEE_ANNONCEE").test("export const DICTEE_ANNONCEE_BIS = false;")).toBe(
      false,
    );
  });
});
