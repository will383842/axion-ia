import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COULEURS_PIECES } from "@/lib/brand/couleurs-pieces";
import {
  BulletList,
  DocSection,
  FieldRow,
  NdaFieldRow,
} from "@/server/qualiopi/documents/cadre-pieces/blocs";
import { pdfStylesPieces } from "@/server/qualiopi/documents/cadre-pieces/styles-blocs";

describe("cadre-pieces/blocs", () => {
  it("exporte les quatre blocs", () => {
    for (const c of [DocSection, FieldRow, NdaFieldRow, BulletList]) {
      expect(typeof c).toBe("function");
    }
  });

  it("NdaFieldRow est omise sans numéro, rendue avec", () => {
    expect(NdaFieldRow({ nda: "  " })).toBeNull();
    expect(NdaFieldRow({ nda: "84 38 12345 38" })).not.toBeNull();
  });

  it("n'importe ni base-layout ni brandColor", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/server/qualiopi/documents/cadre-pieces/blocs.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/from "[^"]*base-layout"|brandColor\(/);
  });

  it("les styles de blocs n'utilisent que la palette des pièces", () => {
    const valeurs = new Set<string>(Object.values(COULEURS_PIECES));
    expect(valeurs.has(String(pdfStylesPieces.sectionTitle?.color))).toBe(true);
  });
});
