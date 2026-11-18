import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const yml = fs.readFileSync(
  path.join(process.cwd(), ".github/workflows/retrait-mentions-financement.yml"),
  "utf8",
);
const script = fs.readFileSync(
  path.join(process.cwd(), "scripts/content-gen/retrait-mentions-financement.ts"),
  "utf8",
);

describe("workflow retrait-mentions-financement : garde-fous", () => {
  it("se déclenche UNIQUEMENT par workflow_dispatch", () => {
    const on = yml.slice(yml.indexOf("\non:"), yml.indexOf("\npermissions:"));
    expect(on).toContain("workflow_dispatch:");
    for (const t of ["push:", "pull_request", "schedule:", "workflow_run", "repository_dispatch"])
      expect(on).not.toContain(t);
  });
  it("le mode par défaut est « copie » (aucun accès à la production)", () => {
    expect(yml).toMatch(/mode:[\s\S]*?default: "copie"/);
  });
  it("apply exige plan_sha et une sauvegarde de moins de 24 h", () => {
    expect(yml).toContain("apply exige plan_sha");
    expect(yml).toContain("backupRun.findFirst");
    expect(yml).toContain("24*3600*1000");
  });
  it("purge par lots de 30 puis IndexNow", () => {
    expect(yml).toContain("split -l 30");
    expect(yml).toContain("api.indexnow.org");
  });
  it("aucune entrée n'est interpolée dans un script shell (variables d'environnement)", () => {
    const runs = yml
      .split("run: |")
      .slice(1)
      .map((x) => x.split(/\n\s+- (?:name|uses):/)[0])
      .join("\n");
    expect(runs).not.toMatch(/\$\{\{\s*inputs\./);
  });
});

describe("script retrait-mentions-financement : garde-fous", () => {
  it("essai à blanc par défaut, apply refusé sans empreinte", () => {
    expect(script).toContain('"dry-run"');
    expect(script).toContain("--apply exige --plan-sha");
  });
  it("sauvegarde dans ContentGenAuditLog, sans suppression", () => {
    expect(script).toContain("contentGenAuditLog.create");
    expect(script).not.toMatch(/\.delete(Many)?\(/);
    expect(script).not.toMatch(/\$executeRaw|\$queryRaw/);
  });
});
