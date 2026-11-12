// Les clés SYNCHRO_CRM_V3* citées par la doc des interrupteurs doivent pouvoir être posées par
// `coolify-drapeau.yml`, avec l'obligation « les-deux » (site ET worker).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const doc = readFileSync("docs/guides-reseau-interrupteurs.md", "utf8");
const workflow = readFileSync(".github/workflows/coolify-drapeau.yml", "utf8");

const clesDoc = [...new Set(doc.match(/\bSYNCHRO_CRM_V3[A-Z_]*/g) ?? [])];
const clesListe = [...workflow.matchAll(/^\s+- "(SYNCHRO_CRM_V3[A-Z_]*)"/gm)].map((m) => m[1]!);

describe("interrupteurs SYNCHRO_CRM_V3* : doc et workflow concordent", () => {
  it("la doc cite des clés", () => {
    expect(clesDoc.length).toBeGreaterThanOrEqual(3);
  });
  it.each(clesDoc)("%s est dans la liste du workflow", (cle) => {
    expect(clesListe).toContain(cle);
  });
  it.each(clesListe)("%s est exigée sur « les-deux »", (cle) => {
    const suffixe = cle.replace("SYNCHRO_CRM_V3", "");
    const motif = /SYNCHRO_CRM_V3\(([^)]*)\)\?\$/.exec(workflow)?.[1] ?? "";
    if (suffixe === "") return;
    expect(motif.split("|")).toContain(suffixe);
  });
});
