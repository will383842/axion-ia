/**
 * Poids JS de /contact (relecture 2026-10-16) : le formulaire importe
 * `@/lib/contact/pieces-jointes`. Tout ce qui lit des OCTETS (signatures,
 * VBA_OLE, répertoire ZIP, scruteur) vit côté serveur, dans
 * `server/contact/octets-pieces-jointes` — sinon chaque octet part dans le
 * bundle du navigateur.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const lire = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("l'analyse d'octets reste hors du JS du formulaire", () => {
  const lib = lire("src/lib/contact/pieces-jointes.ts");

  it.each(["VBA_OLE", "ScruteurPieceJointe", "localiserRepertoireZip", "estExecutable", "0x4b"])(
    "le module partagé ne contient pas %s",
    (motif) => {
      expect(lib).not.toContain(motif);
    },
  );

  it("le formulaire n'importe pas le module d'analyse", () => {
    const form = lire("src/components/forms/UnifiedContactForm.tsx");
    expect(form).not.toContain("octets-pieces-jointes");
    expect(form).not.toContain("@/server/");
  });
});
