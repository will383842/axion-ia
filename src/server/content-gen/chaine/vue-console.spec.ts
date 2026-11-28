import { describe, expect, it } from "vitest";
import { construireVueChaine, type EntreesVueChaine } from "./vue-console";

const MAINTENANT = new Date("2026-11-28T10:00:00Z");
const ok = <T>(valeur: T) => ({ etat: "ok", valeur }) as const;
const ko = (raison: string) => ({ etat: "indisponible", raison }) as const;

function entrees(sur: Partial<EntreesVueChaine> = {}): EntreesVueChaine {
  return {
    maintenant: MAINTENANT,
    periodeJours: 30,
    besoins: ok({ nouveau: 4, en_brief: 2 }),
    briefs: ok({ valide: 3, brouillon: 1, pas_d_angle: 1, abandonne: 1 }),
    briefsAvecFaits: ok(2),
    jobsLies: ok({ published: 1, needs_review: 1, failed: 1 }),
    refus: ok([]),
    couts: ok([]),
    nbResultats: ok(0),
    nbPropositions: ok(0),
    ...sur,
  };
}

describe("vue console chaîne (C14)", () => {
  it("entonnoir : chaque étape vient d'un compte, les abandons sont comptés", () => {
    const v = construireVueChaine(entrees());
    if (v.entonnoir.etat !== "ok") throw new Error("attendu ok");
    const e = v.entonnoir.valeur;
    expect(e.etapes.map((x) => [x.cle, x.nombre])).toEqual([
      ["besoins", 6],
      ["briefs", 6],
      ["briefs_valides", 3],
      ["dossiers_faits", 2],
      ["en_relecture", 1],
      ["publies", 1],
    ]);
    expect(e.abandonnes).toBe(3);
    expect(e.tauxGlobal).toBeCloseTo(1 / 6);
  });

  it("source indisponible : « indisponible », jamais 0", () => {
    const v = construireVueChaine(entrees({ besoins: ko("table absente") }));
    expect(v.entonnoir.etat).toBe("indisponible");
  });

  it("aucun besoin : taux global null, pas 0", () => {
    const v = construireVueChaine(entrees({ besoins: ok({}), briefs: ok({}) }));
    if (v.entonnoir.etat !== "ok") throw new Error("attendu ok");
    expect(v.entonnoir.valeur.tauxGlobal).toBeNull();
  });

  it("refus : classement par code, par rôle et tendance sur 8 semaines", () => {
    const d = (j: number) => new Date(MAINTENANT.getTime() - j * 86_400_000);
    const v = construireVueChaine(
      entrees({
        refus: ok([
          { role: "R5", code: "generique", createdAt: d(1), briefId: "b1", jobId: "j1" },
          { role: "R5", code: "generique", createdAt: d(9), briefId: "b2", jobId: null },
          { role: "R6", code: "fait_non_source", createdAt: d(2), briefId: "b1", jobId: "j1" },
          { role: "R6", code: "fait_non_source", createdAt: d(200), briefId: "b3", jobId: null },
        ]),
      }),
    );
    if (v.refus.etat !== "ok") throw new Error("attendu ok");
    const r = v.refus.valeur;
    expect(r.parCode[0]).toEqual({ code: "generique", nombre: 2 });
    expect(r.parRole.find((x) => x.role === "R6")?.nombre).toBe(1);
    expect(r.tendance).toHaveLength(8);
    expect(r.tendance.reduce((s, x) => s + x.nombre, 0)).toBe(3);
    expect(r.total).toBe(3);
  });

  it("coût : par rôle, par publié, par abandonné ; ligne sans rôle regroupée", () => {
    const v = construireVueChaine(
      entrees({
        couts: ok([
          { jobId: "j1", role: "R4", costUsd: 1.5 },
          { jobId: "j1", role: "R5", costUsd: 0.5 },
          { jobId: "j3", role: "R4", costUsd: 1 },
        ]),
        jobsLies: ok({ published: 1, failed: 1 }),
        statutParJob: { j1: "published", j3: "failed" },
      }),
    );
    if (v.cout.etat !== "ok") throw new Error("attendu ok");
    const c = v.cout.valeur;
    expect(c.totalUsd).toBe(3);
    expect(c.parRole.find((x) => x.role === "R4")?.usd).toBe(2.5);
    expect(c.parPublieUsd).toBe(2);
    expect(c.parAbandonneUsd).toBe(1);
  });

  it("coût : aucun publié → null, pas 0", () => {
    const v = construireVueChaine(
      entrees({ couts: ok([{ jobId: null, role: "R1", costUsd: 1 }]) }),
    );
    if (v.cout.etat !== "ok") throw new Error("attendu ok");
    expect(v.cout.valeur.parPublieUsd).toBeNull();
    expect(v.cout.valeur.parAbandonneUsd).toBeNull();
  });

  it("résultats et propositions : indisponibles tant que les tables sont vides", () => {
    const v = construireVueChaine(entrees());
    expect(v.resultats.etat).toBe("indisponible");
    expect(v.propositions.etat).toBe("indisponible");
    const v2 = construireVueChaine(entrees({ nbResultats: ok(3), nbPropositions: ok(2) }));
    expect(v2.resultats.etat).toBe("ok");
    expect(v2.propositions.etat).toBe("ok");
  });
});
