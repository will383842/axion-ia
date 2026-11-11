import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Charte 2027 (V9-S3) : plus d'ombre bleue sur les boutons des pages commerciales,
// plus de dégradé dans l'image OG des villes.
const lire = (f: string): string => readFileSync(join(process.cwd(), f), "utf8");

describe("pages : charte 2027", () => {
  it.each([
    "src/app/[locale]/formations/page.tsx",
    "src/app/[locale]/un-a-un/page.tsx",
    "src/app/[locale]/stack-ia/page.tsx",
  ])("%s : aucune ombre bleue rgba(26,77,217", (f) => {
    expect(lire(f)).not.toMatch(/rgba\(\s*26\s*,\s*77\s*,\s*217/);
  });

  it("l'image OG des villes n'utilise aucun dégradé", () => {
    const src = lire("src/app/[locale]/implantations/[region]/[ville]/opengraph-image.tsx");
    expect(src).not.toMatch(/(?:linear|radial|conic)-gradient\(/);
  });
});
