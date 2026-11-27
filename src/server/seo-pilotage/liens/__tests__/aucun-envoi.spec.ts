import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Verrou S10 (§ 5) : le module « liens » n'importe aucun moyen d'envoi ni de requête vers un tiers. */
const DOSSIER = join(__dirname, "..");
const INTERDITS = [
  /@\/lib\/email/,
  /server\/email/,
  /zoho/i,
  /zepto/i,
  /nodemailer/,
  /resend/i,
  /sendgrid/i,
  /["']node:(?:http|https|net)["']/,
  /\baxios\b/,
  /\bfetch\s*\(/,
  /mailto:/,
];

function fichiers(): string[] {
  return readdirSync(DOSSIER)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(DOSSIER, f));
}

describe("module liens : aucun envoi", () => {
  it("trouve des fichiers à vérifier", () => {
    expect(fichiers().length).toBeGreaterThanOrEqual(6);
  });
  it.each(fichiers().map((f) => [f.slice(DOSSIER.length + 1), f]))("%s", (_nom, f) => {
    const code = readFileSync(f as string, "utf8")
      // Les commentaires peuvent nommer ce qui est interdit : seul le code compte.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const motif of INTERDITS) expect(code).not.toMatch(motif);
  });
});
