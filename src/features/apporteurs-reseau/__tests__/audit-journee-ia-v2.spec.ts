import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  auditerJourneeIaGrilleV2,
  type CommissionAuditee,
  formaterAudit,
} from "../audit-journee-ia-v2";

const c = (id: string, version: string | null, o: Partial<CommissionAuditee> = {}) => ({
  id,
  statut: "due",
  montantCents: 50_000,
  autofactureNumero: "AF-2026-001",
  palier: "journee-ia",
  parrainage: false,
  creeAt: new Date("2026-11-01T00:00:00Z"),
  presentation: { recueAt: new Date("2026-10-01T00:00:00Z") },
  apporteur: { signatureApporteur: version === null ? null : { version } },
  ...o,
});

describe("audit Journée IA en grille v2 (lecture seule)", () => {
  it("ne garde que les lignes journee-ia, hors parrainage, d'un apporteur 2.6", () => {
    const r = auditerJourneeIaGrilleV2([
      c("v2", "2.6"),
      c("v3", "2.8"),
      c("inconnue", null),
      c("parrain", "2.6", { parrainage: true }),
      c("autre", "2.6", { palier: "hors-grille" }),
    ]);
    expect(r).toEqual([
      { id: "v2", statut: "due", montantCents: 50_000, autofactureNumero: "AF-2026-001" },
    ]);
  });
  it("la sortie ne contient que identifiant, statut, montant, autofacture", () => {
    const r = auditerJourneeIaGrilleV2([c("v2", "2.6")]);
    expect(Object.keys(r[0]!).sort()).toEqual([
      "autofactureNumero",
      "id",
      "montantCents",
      "statut",
    ]);
    expect(formaterAudit(r)).toContain("v2\tdue\t50000\tAF-2026-001");
    expect(formaterAudit([])).toContain("Aucune");
  });
  it("le script n'écrit rien", () => {
    const src = readFileSync("src/features/apporteurs-reseau/audit-journee-ia-v2-cli.ts", "utf8");
    expect(src).not.toMatch(/\.(create|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw/);
    expect(src).toContain("findMany");
  });
});
