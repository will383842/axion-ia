import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { metadataConsole, TITRE_CONSOLE, TITRE_INTROUVABLE } from "../titre-console";

const LAYOUT = join(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]/layout.tsx");

function titreDefaut(authentifie: boolean): unknown {
  const t = metadataConsole(authentifie).title as { default: string };
  return t.default;
}

describe("V1-16 titre du layout de la console", () => {
  it("sans session : « Page introuvable », jamais « Console admin »", () => {
    expect(titreDefaut(false)).toBe(TITRE_INTROUVABLE);
    expect(titreDefaut(false)).not.toMatch(/console|admin/i);
  });

  it("session admin authentifiée : la console garde son titre", () => {
    expect(titreDefaut(true)).toBe(TITRE_CONSOLE);
  });

  it("reste noindex dans les deux cas", () => {
    expect(metadataConsole(false).robots).toEqual({ index: false, follow: false });
    expect(metadataConsole(true).robots).toEqual({ index: false, follow: false });
  });

  it("le layout n'exporte plus de `metadata` statique (titre figé « Console admin »)", () => {
    const src = readFileSync(LAYOUT, "utf8");
    expect(src).not.toMatch(/export const metadata\b/);
    expect(src).toMatch(/export async function generateMetadata\(/);
  });

  it("generateMetadata ne lit ni le préfixe d'URL ni le préfixe secret (oracle)", () => {
    const src = readFileSync(LAYOUT, "utf8");
    const debut = src.indexOf("export async function generateMetadata(");
    expect(debut).toBeGreaterThan(-1);
    const fin = src.indexOf("\n}\n", debut);
    const corps = src.slice(debut, fin);
    expect(corps).not.toMatch(/adminPrefix|ADMIN_URL_PREFIX|prefixe|params/i);
  });
});
