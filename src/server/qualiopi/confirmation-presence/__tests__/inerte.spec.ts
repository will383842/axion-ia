/**
 * QNC NC6, lot présence 1/3 — le socle est INERTE : aucun fichier hors de
 * `confirmation-presence/` ne l'importe, et rien n'y lit ni n'y écrit en base.
 * Le lot 2/3 (envois, réponse, page) retirera la première assertion, nommément,
 * en posant ses appelants ; la seconde restera tant qu'aucun écrivain n'a son
 * cliquet.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "src");
const DOSSIER = join("src", "server", "qualiopi", "confirmation-presence");

function fichiers(dossier: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dossier)) {
    const p = join(dossier, e);
    if (statSync(p).isDirectory()) {
      if (e === "node_modules" || e === ".next") continue;
      out.push(...fichiers(p));
    } else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

describe("confirmation de présence : socle inerte", () => {
  const tous = fichiers(RACINE);

  it("lit bien un corpus non vide", () => {
    expect(tous.length).toBeGreaterThan(500);
  });

  it("aucun fichier hors du dossier n'importe le socle (lot 2/3 : à retirer en posant les appelants)", () => {
    const appelants = tous
      .filter((f) => !f.includes(DOSSIER))
      .filter((f) => /qualiopi\/confirmation-presence/.test(readFileSync(f, "utf8")))
      // Ce test lui-même cite le chemin ; les gabarits ne l'importent pas.
      .map((f) => f.replace(/\\/g, "/"));
    expect(appelants).toEqual([]);
  });

  it("aucun écrivain : le dossier n'importe ni Prisma ni la file d'e-mails", () => {
    const sources = tous
      .filter((f) => f.includes(DOSSIER) && !f.includes("__tests__"))
      .map((f) => readFileSync(f, "utf8"));
    expect(sources.length).toBeGreaterThan(0);
    for (const s of sources) {
      expect(s).not.toMatch(/from\s+["']@\/lib\/prisma["']/);
      expect(s).not.toMatch(/enqueueEmail|\.create\(|\.update\(|\.upsert\(/);
    }
  });
});
