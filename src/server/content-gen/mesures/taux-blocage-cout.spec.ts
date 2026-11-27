import { describe, expect, it } from "vitest";
import {
  blocagesDuJob,
  calculerRapportBlocageCout,
  controleDepuisCause,
  formaterRapportBlocageCout,
  type LigneJobMesure,
} from "./taux-blocage-cout";

function job(p: Partial<LigneJobMesure> & { id: string }): LigneJobMesure {
  return {
    contentType: "blog_from_title",
    status: "needs_review",
    costUsd: null,
    outputJsonRaw: null,
    causes: [],
    blocageJournalise: false,
    ...p,
  };
}

const equipe = (cout: number, entrees: Array<[string, number]>, issue = "a_relire") => ({
  equipe: {
    issue,
    coutTotalUsd: cout,
    entrees: entrees.map(([role, c]) => ({
      role,
      coutUsd: c,
      dureeMs: 1000,
      decision: "ok",
      passe: 0,
    })),
  },
});

describe("controleDepuisCause", () => {
  it("reconnaît les libellés du worker", () => {
    expect(controleDepuisCause("Plagiat lexical (texte trop proche d'un existant)").code).toBe(
      "plagiat",
    );
    expect(controleDepuisCause("Structure trop proche (plan H2/H3 d'un existant)").code).toBe(
      "plan-trop-proche",
    );
    expect(controleDepuisCause("Intention de recherche non respectée").code).toBe("intention");
    expect(controleDepuisCause("Doctrine (mots interdits : Qualiopi…)").code).toBe("doctrine");
    expect(controleDepuisCause("Dedup sémantique Voyage (même sujet…)").code).toBe(
      "doublon-semantique",
    );
    expect(controleDepuisCause("Bénéfice concret insuffisant").code).toBe("benefice");
    expect(controleDepuisCause("Chiffre sans source").code).toBe("barriere");
  });
});

describe("blocagesDuJob", () => {
  it("dédoublonne journal et outputJsonRaw", () => {
    const b = blocagesDuJob(
      job({
        id: "a",
        causes: ["Intention de recherche non respectée"],
        outputJsonRaw: { intentAligned: false, doctrineHardFaults: [{ pattern: "x" }] },
      }),
    );
    expect(b.map((x) => x.code).sort()).toEqual(["doctrine", "intention"]);
  });
  it("rattache une barrière à son code stable sans la compter deux fois", () => {
    const b = blocagesDuJob(
      job({
        id: "a",
        causes: ["Fait non sourcé"],
        outputJsonRaw: { barrieresRelecture: [{ code: "B07", libelle: "Fait non sourcé" }] },
      }),
    );
    expect(b).toHaveLength(1);
    expect(b[0]?.cle).toBe("barriere:B07");
  });
  it("le plan dupliqué des actualités RSS ne bloque pas", () => {
    expect(
      blocagesDuJob(
        job({
          id: "a",
          contentType: "blog_from_rss",
          outputJsonRaw: { outlineDedupVerdict: "duplicate_template" },
        }),
      ),
    ).toHaveLength(0);
  });
  it("tolère un outputJsonRaw de forme inattendue", () => {
    expect(blocagesDuJob(job({ id: "a", outputJsonRaw: "texte" }))).toEqual([]);
    expect(blocagesDuJob(job({ id: "a", outputJsonRaw: { barrieresRelecture: "x" } }))).toEqual([]);
  });
});

describe("calculerRapportBlocageCout", () => {
  it("rapport vide : zéros, pas de NaN", () => {
    const r = calculerRapportBlocageCout([]);
    expect(r.tauxBlocageGlobal).toBe(0);
    expect(r.coutArticle.moyenneUsd).toBeNull();
    expect(r.controles).toEqual([]);
  });

  it("calcule taux par contrôle et blocage global", () => {
    const r = calculerRapportBlocageCout([
      job({ id: "1", causes: ["Plagiat lexical (x)"], blocageJournalise: true }),
      job({
        id: "2",
        causes: ["Plagiat lexical (x)", "Intention de recherche non respectée"],
        blocageJournalise: true,
      }),
      job({ id: "3" }),
      job({ id: "4" }),
    ]);
    expect(r.totalJobs).toBe(4);
    expect(r.jobsBloques).toBe(2);
    expect(r.tauxBlocageGlobal).toBe(0.5);
    const plagiat = r.controles.find((c) => c.code === "plagiat");
    expect(plagiat?.bloques).toBe(2);
    expect(plagiat?.taux).toBe(0.5);
    expect(r.controles.find((c) => c.code === "intention")?.taux).toBe(0.25);
    expect(r.bloquesSansCause).toBe(0);
  });

  it("un tier 3 de générateur sans journal de blocage n'est pas un blocage", () => {
    const r = calculerRapportBlocageCout([
      job({ id: "1", outputJsonRaw: { finalIndexationTier: "tier_3_noindex_nofollow" } }),
    ]);
    expect(r.jobsBloques).toBe(0);
  });

  it("un blocage sans cause journalisée est compté à part, jamais perdu", () => {
    const r = calculerRapportBlocageCout([job({ id: "1", blocageJournalise: true })]);
    expect(r.jobsBloques).toBe(1);
    expect(r.bloquesSansCause).toBe(1);
    expect(r.controles[0]?.code).toBe("cause-inconnue");
  });

  it("coût par article et par rôle", () => {
    const r = calculerRapportBlocageCout([
      job({
        id: "1",
        costUsd: 1,
        outputJsonRaw: equipe(
          0.5,
          [
            ["strateg", 0.1],
            ["redacteur-en-chef", 0.4],
          ],
          "publier",
        ),
      }),
      job({
        id: "2",
        costUsd: 2,
        outputJsonRaw: equipe(1.5, [
          ["strateg", 0.3],
          ["redacteur-en-chef", 0.6],
          ["redacteur-en-chef", 0.6],
        ]),
      }),
      job({ id: "3", costUsd: 0.5 }), // équipe éteinte : exclu du coût par rôle
    ]);
    expect(r.coutArticle.articlesAvecEquipe).toBe(2);
    expect(r.coutArticle.moyenneUsd).toBe(1);
    expect(r.coutArticle.maxUsd).toBe(1.5);
    expect(r.coutArticle.medianeUsd).toBe(0.5);
    expect(r.coutColonneTotalUsd).toBe(3.5);
    const rec = r.roles.find((x) => x.role === "redacteur-en-chef");
    expect(rec?.articles).toBe(2);
    expect(rec?.passes).toBe(3);
    expect(rec?.coutTotalUsd).toBe(1.6);
    expect(rec?.coutMoyenParArticleUsd).toBe(0.8);
    expect(r.roles[0]?.role).toBe("redacteur-en-chef"); // trié par coût décroissant
    expect(r.issuesEquipe).toEqual({ publier: 1, a_relire: 1 });
  });

  it("ignore les entrées de journal invalides", () => {
    const r = calculerRapportBlocageCout([
      job({
        id: "1",
        outputJsonRaw: {
          equipe: { entrees: [null, { role: 3 }, { role: "gardien", coutUsd: "x" }] },
        },
      }),
    ]);
    expect(r.roles).toHaveLength(1);
    expect(r.roles[0]?.coutTotalUsd).toBe(0);
    expect(r.entreesSansCout).toBe(1);
  });

  it("le texte contient les sections", () => {
    const txt = formaterRapportBlocageCout(calculerRapportBlocageCout([]), 30);
    expect(txt).toContain("30 derniers jours");
    expect(txt).toContain("Blocage par contrôle");
    expect(txt).toContain("Coût par rôle");
  });
});
