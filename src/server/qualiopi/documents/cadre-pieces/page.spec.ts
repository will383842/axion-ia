import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(process.cwd(), "src/server/qualiopi/documents/cadre-pieces/page.tsx"),
  "utf8",
);

describe("cadre-pieces/page", () => {
  it("enregistre les polices au chargement du module (sinon Fraunces est perdue)", () => {
    expect(src).toMatch(/import \{ registerQualiopiPdfFonts \} from/);
    expect(src).toMatch(/^registerQualiopiPdfFonts\(\);$/m);
  });

  it("n'importe ni base-layout ni brandColor : couleurs via pdfStylesPieces", () => {
    expect(src).not.toMatch(/from "[^"]*base-layout"|brandColor\(/);
    expect(src).toMatch(/pdfStylesPieces/);
  });

  it("exporte QualiopiPage", async () => {
    const m = await import("@/server/qualiopi/documents/cadre-pieces/page");
    expect(typeof m.QualiopiPage).toBe("function");
  });
});
