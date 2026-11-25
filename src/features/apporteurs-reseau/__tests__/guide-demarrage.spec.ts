import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FICHIER_PRIVE_GUIDE, NOM_FICHIER_GUIDE, lireGuideDemarrage } from "../guide-demarrage";

// Le guide de démarrage validé par le dirigeant (25/11/2026) : un PDF PRIVÉ, servi seulement
// par la route contrôlée de l'espace de l'apporteur, jamais par `public/`.
const racine = process.cwd();
const INTERDITS = [
  /gr[e]noble/i,
  /aucun\s+gain\s+garanti/i,
  /salari[ée]/i,
  /obj[e]ctif/i,
  /sans\s+discussion/i,
  /5\s+fois/i,
];
const SHA256_GUIDE = "2aa7d0cfab222d0f5903b529634966a95a1a6d70a85193ca47c98c1e4072d21b";

describe("le guide de démarrage", () => {
  const chemin = join(racine, FICHIER_PRIVE_GUIDE);

  it("est un PDF de taille raisonnable, sous private/", () => {
    expect(FICHIER_PRIVE_GUIDE.startsWith("private/apporteurs/")).toBe(true);
    const buf = readFileSync(chemin);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.byteLength).toBeGreaterThan(100_000);
    expect(buf.byteLength).toBeLessThanOrEqual(2 * 1_048_576);
  });

  it("est exactement celui qui a été validé (un remplacement doit être voulu)", () => {
    expect(createHash("sha256").update(readFileSync(chemin)).digest("hex")).toBe(SHA256_GUIDE);
  });

  it("n'est jamais dans public/", () => {
    const sousPublic = readdirSync(join(racine, "public"), { recursive: true, encoding: "utf-8" });
    expect(sousPublic.filter((f) => /guide-demarrage/i.test(f))).toEqual([]);
  });

  it("sa source lisible ne contient aucun mot interdit", () => {
    const html = join(racine, "docs/apporteurs/guide-demarrage-apporteur.html");
    expect(existsSync(html) && statSync(html).size > 1000).toBe(true);
    const t = readFileSync(html, "utf-8");
    for (const re of INTERDITS) expect(t).not.toMatch(re);
  });

  it("lireGuideDemarrage rend le PDF", async () => {
    const buf = await lireGuideDemarrage();
    expect(buf?.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("le nom montré à l'apporteur est sûr", () => {
    expect(NOM_FICHIER_GUIDE).toMatch(/^[A-Za-z0-9-]+\.pdf$/);
  });

  it("le module ne touche ni aux clés R2 des annexes ni à leur déclaration", () => {
    const src = readFileSync(
      join(racine, "src/features/apporteurs-reseau/guide-demarrage.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/documents-apporteurs\/|documents-joints/);
  });
});
