/**
 * Périmètre « national » d'une campagne de couverture.
 *
 * Régression : le formulaire (zod) acceptait « national » alors que l'énumération
 * Prisma `CoverageScope` ne le connaissait pas — `coverageCampaign.create`
 * échouait, aucune campagne « partout en France » n'était possible.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { perimetreCampagneLabelFr } from "../campaign-labels";

const RACINE = join(__dirname, "../../../../..");

function valeursEnumPrisma(nom: string): string[] {
  const schema = readFileSync(join(RACINE, "prisma/schema.prisma"), "utf8");
  const m = new RegExp(`enum ${nom} \\{([^}]*)\\}`).exec(schema);
  if (!m) throw new Error(`enum ${nom} introuvable`);
  return m[1]!
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"));
}

describe("CoverageScope — national", () => {
  it("chaque valeur du zod de createCampaign existe dans l'enum Prisma", () => {
    const src = readFileSync(join(RACINE, "src/server/actions/content-gen/coverage.ts"), "utf8");
    const m = /const CoverageScopeSchema = z\.enum\(\[([^\]]*)\]\)/.exec(src);
    const zod = m![1]!.match(/"([a-z]+)"/g)!.map((v) => v.replaceAll('"', ""));
    const prisma = valeursEnumPrisma("CoverageScope");
    for (const v of zod) expect(prisma).toContain(v);
  });

  it("libellé FR « France entière »", () => {
    expect(perimetreCampagneLabelFr("national")).toBe("France entière");
  });

  it("une migration additive ajoute 'national' à l'énumération", () => {
    const dir = join(RACINE, "prisma/migrations");
    const sql = readdirSync(dir)
      .filter((d) => d.endsWith("_coverage_scope_national"))
      .map((d) => readFileSync(join(dir, d, "migration.sql"), "utf8"))
      .join("\n");
    expect(sql).toContain(`ALTER TYPE "CoverageScope" ADD VALUE IF NOT EXISTS 'national'`);
    expect(sql).not.toMatch(/DROP|RENAME|DELETE|UPDATE/i);
  });
});
