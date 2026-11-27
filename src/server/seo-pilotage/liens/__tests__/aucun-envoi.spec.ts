import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Verrou S10 (§ 5) : le module « liens » n'importe aucun moyen d'envoi ni de requête vers un tiers. */
const DOSSIER = join(__dirname, "..");
const INTERDITS = [
  /@\/lib\/email/,
  /server\/email/,
  /\/email\//,
  /["'](?:node:)?(?:http|https|http2|net|tls|child_process)["']/,
  /\bundici\b/,
  /server\/queue/,
  /bullmq/i,
  /\bimport\s*\(/,
  /\brequire\s*\(/,
  /\bfetch\b/,
  /XMLHttpRequest|WebSocket/,
  /zoho/i,
  /zepto/i,
  /nodemailer/,
  /resend/i,
  /sendgrid/i,
  /\baxios\b/,
  /mailto:/,
];

function fichiers(dossier = DOSSIER): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : fichiers(chemin);
    return /\.tsx?$/.test(e.name) ? [chemin] : [];
  });
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

describe("le verrou attrape les chemins d'envoi du dépôt", () => {
  it("file d'e-mails et imports dynamiques", () => {
    const code = 'import { enqueueEmail } from "@/server/queue/queues";';
    expect(INTERDITS.some((m) => m.test(code))).toBe(true);
    expect(INTERDITS.some((m) => m.test('await import("x")'))).toBe(true);
  });
});
