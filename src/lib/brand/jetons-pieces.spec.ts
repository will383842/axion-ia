import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COULEURS_PIECES } from "@/lib/brand/couleurs-pieces";
import { COULEURS_MARQUE_GELEES_2026_11 } from "@/lib/brand/couleurs-marque-gelees-2026-11";
import { couleurPiece, JETONS_PIECES } from "@/lib/brand/jetons-pieces";

const JETONS = Object.keys(COULEURS_MARQUE_GELEES_2026_11);
const VALEURS = new Set<string>(Object.values(COULEURS_PIECES));

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

describe("jetons-pieces", () => {
  it("traduit les 21 jetons, tous vers la palette des pièces", () => {
    expect(JETONS).toHaveLength(21);
    for (const j of JETONS) {
      expect(VALEURS.has(couleurPiece(j as never)), j).toBe(true);
    }
    expect(Object.keys(JETONS_PIECES).sort()).toEqual([...JETONS].sort());
  });

  it("est figé", () => {
    expect(Object.isFrozen(JETONS_PIECES)).toBe(true);
  });

  it("ne produit aucun bleu", () => {
    for (const j of JETONS) {
      const h = couleurPiece(j as never);
      const [r, , b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      expect(b! > r! + 16, `${j} ${h}`).toBe(false);
    }
  });

  it("garde un contraste de texte >= 4,5 sur ses fonds", () => {
    const textes = ["fg", "fg-soft", "fg-muted", "mocha", "terracotta", "terracotta-deep"] as const;
    const fonds = ["bg", "paper", "sand", "terracotta-soft"] as const;
    for (const t of textes) {
      for (const f of fonds) {
        expect(contraste(couleurPiece(t), couleurPiece(f)), `${t}/${f}`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    }
    // sage (#5E7050) : 4,29 sur gris chaud → texte autorisé sur ivoire/blanc seulement (journal).
    for (const f of ["bg", "paper"] as const) {
      expect(contraste(couleurPiece("sage"), couleurPiece(f))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contraste(couleurPiece("mocha-fg"), couleurPiece("mocha"))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(couleurPiece("primary-fg"), couleurPiece("primary"))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("laisse intacts les fichiers signables et gelés (empreintes relevées avant modification)", () => {
    const attendu: Record<string, string> = {
      "src/server/qualiopi/documents/base-layout.tsx":
        "a634adb8dbca4aa5bedf01bf89e27c58439071bf917041bf6b70c842dbebed21",
      "src/server/qualiopi/documents/apercu-filigrane.tsx":
        "1db66e8bb85723995aa3c1e1671793befec195d296f13416dcde38f9fafbd61d",
      "src/server/qualiopi/brand/brand-tokens.ts":
        "80ebdde8143e55e48f18ccebcc511cc90a0d1ad8cc1dacc4d0c50d1a40aa5775",
      "src/lib/brand/couleurs-marque-gelees-2026-11.ts":
        "8fafff2d609cebc462cb30e5d97b50a5ff5b56d5871403ab2023e1f067346f8e",
      "src/server/qualiopi/documents/templates/emargement.tsx":
        "ea7deacb974c59936aa0c178ef42851a0cdad9277378575c2382b7e401446289",
      "src/server/qualiopi/documents/templates/procedure-sous-traitance.tsx":
        "90f0fb1362a335db633e8625949ecbcd074d2355b686d8bd65b8e43e6a51c5c7",
      "src/server/qualiopi/documents/templates/facture.tsx":
        "175800ea8f36710f0842bd449fe5ba61973a3224bc1bd14880935be8ee2fe28e",
      "src/server/qualiopi/documents/templates/autofacture-honoraires.tsx":
        "6cfa63cc40a0351b91cd5fa49889fd309d67fbcf980d01307e9ecb1fdf4ea4f4",
    };
    for (const [chemin, sha] of Object.entries(attendu)) {
      const octets = readFileSync(resolve(process.cwd(), chemin));
      expect(createHash("sha256").update(octets).digest("hex"), chemin).toBe(sha);
    }
  });
});
