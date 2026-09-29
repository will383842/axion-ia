// @vitest-environment node

/**
 * Verrou — une restauration de la base ne fait pas REVENIR ce qui avait été
 * effacé (chantier visio, PR 8 ; ADR 0056).
 *
 * Trois pièces, et chacune rougit ici si elle manque :
 *   1. `rejouerEffacements` (`src/lib/rgpd-erase.ts`) traite CHAQUE valeur de
 *      l'énumération `CibleEffacement` du schéma — une cible ajoutée demain
 *      sans rejeu ferait réapparaître des données en silence ;
 *   2. le script `scripts/rgpd-rejouer-effacements.ts` l'appelle, À BLANC par
 *      défaut (`--appliquer` pour écrire) ;
 *   3. la procédure de restauration (`R33`) le cite, avec la sauvegarde du
 *      journal AVANT la restauration (le journal vit dans la même base).
 *
 * Contre-témoin : la liste des cibles est lue dans le schéma (7 valeurs le
 * 2026-09-29) ; si la lecture échouait, le premier test le dirait. Angle mort :
 * le rejeu n'est pas exercé contre une vraie base ici.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const lire = (f: string): string => readFileSync(join(process.cwd(), f), "utf8");

function ciblesDuSchema(): string[] {
  const schema = lire("prisma/schema.prisma");
  const bloc = /enum CibleEffacement \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
  return bloc
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+$/.test(l));
}

function corpsDuRejeu(): string {
  const erase = lire("src/lib/rgpd-erase.ts");
  const debut = erase.indexOf("export async function rejouerEffacements(");
  return debut < 0 ? "" : erase.slice(debut, erase.indexOf("\n}\n", debut));
}

describe("la procédure de restauration rejoue les effacements", () => {
  it("🔑 le schéma déclare bien les cibles d'effacement", () => {
    expect(ciblesDuSchema().length).toBeGreaterThanOrEqual(7);
  });

  for (const cible of ciblesDuSchema()) {
    it(`🔴 le rejeu traite la cible « ${cible} »`, () => {
      expect(corpsDuRejeu(), "rejouerEffacements introuvable").not.toBe("");
      expect(corpsDuRejeu()).toContain(`ids("${cible}")`);
    });
  }

  it("🔴 le script appelle le rejeu, à blanc par défaut", () => {
    const script = lire("scripts/rgpd-rejouer-effacements.ts");
    expect(script).toMatch(/rejouerEffacements\(\{ appliquer \}\)/);
    expect(script).toMatch(/const appliquer = args\.includes\("--appliquer"\)/);
  });

  it("🔴 la procédure de restauration cite le script et la sauvegarde du journal", () => {
    const r33 = lire("docs/runbooks/R33-disaster-recovery-cold-start.md");
    expect(r33).toContain("scripts/rgpd-rejouer-effacements.ts");
    // INSERT idempotents : un COPY échouerait en bloc sur la première ligne déjà restaurée.
    expect(r33).toMatch(
      /pg_dump --data-only --inserts --on-conflict-do-nothing -t effacements_journal/,
    );
  });

  it("🔴 la réinjection du journal s'arrête à la première erreur et compte ses lignes", () => {
    const r33 = lire("docs/runbooks/R33-disaster-recovery-cold-start.md");
    // ON_ERROR_STOP=0 continuait en silence après un COPY rejeté : faux vert à l'étape 4.
    expect(r33).not.toMatch(/ON_ERROR_STOP=0/);
    expect(r33).toMatch(/ON_ERROR_STOP=1 -f \/root\/effacements_journal\.sql/);
    expect(r33).toMatch(/SELECT count\(\*\) FROM effacements_journal/);
    expect(r33).toContain("N_ancien");
  });
});
