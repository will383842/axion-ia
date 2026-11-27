import { describe, it, expect, vi } from "vitest";
import {
  PLAFOND_COUT_ARTICLE_USD,
  decider,
  defautsStructure,
  evaluerGrille,
  jugerPourCircuit,
  redacteurEnChef,
  reponseDirecteConforme,
  type EntreeEnChef,
  type EntreeGrille,
  type ResultatCritere,
  type CodeCritere,
} from "./redacteur-en-chef";
import type { JudgeResult } from "../reviewer/llm-judge";
import { ProviderError } from "../providers/IProvider";

const ACTIF = { CONTENT_EQUIPE_EDITORIALE: "true" };
const mots = (n: number, base = "mot") =>
  Array.from(
    { length: n },
    (_, i) => `${base}${i}${(i + 1) % 12 === 0 && i < n - 1 ? "." : ""}`,
  ).join(" ");
const reponse = `Automatiser sa facturation fait gagner du temps. ${mots(44, "reponse")}.`;
const para = (n: number) => `<p>${mots(n, "texte")}.</p>`;
const corps = (extra = "") =>
  `<p>${reponse}</p><h2>Pourquoi automatiser la facturation ?</h2>${para(60).repeat(8)}<h2>Comment démarrer ?</h2>${para(60).repeat(8)}${extra}`;

const entreeOk = (o: Partial<EntreeGrille> = {}): EntreeGrille => ({
  html: corps(),
  h1: "Automatiser sa facturation",
  brief: {
    motCle: "automatiser sa facturation",
    entites: [],
    questions: [],
  },
  conformite: { actif: true, decision: "publier", constats: [], coutUsd: 0 },
  chiffresHorsDossier: [],
  gardien: { decision: "feu_vert", raison: "ok" },
  liens: [],
  kbEntryIds: ["kb1"],
  contentType: "blog_article",
  noteUtilite: 9,
  ...o,
});

const r = (
  code: CodeCritere,
  ok: boolean,
  passages: string[] = [],
  nature?: string,
): ResultatCritere =>
  ({
    code,
    nature:
      nature ??
      (["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"].includes(code)
        ? "bloquant"
        : ["Q7", "Q13"].includes(code)
          ? "relecture"
          : "renvoi"),
    ok,
    evalue: true,
    libelle: `lib ${code}`,
    passages,
  }) as ResultatCritere;
const vert = (): ResultatCritere[] =>
  (
    [
      "Q1",
      "Q2",
      "Q3",
      "Q4",
      "Q5",
      "Q6",
      "Q7",
      "Q8",
      "Q9",
      "Q10",
      "Q11",
      "Q12",
      "Q13",
    ] as CodeCritere[]
  ).map((c) => r(c, true));
const avec = (...ko: ResultatCritere[]) =>
  vert().map((x) => ko.find((k) => k.code === x.code) ?? x);
const ctx = { renvoisFaits: 0, coutDepenseUsd: 0.5, sujetJourneeIA: false, noteGlobale: 9 };

describe("grille — critères", () => {
  it("un article correct est vert partout", () => {
    expect(evaluerGrille(entreeOk()).filter((c) => !c.ok)).toEqual([]);
  });
  it("Q1 : un constat de conformité échoue avec les passages exacts, un rapport absent aussi", () => {
    const g = evaluerGrille(
      entreeOk({
        conformite: {
          actif: true,
          decision: "relecture-humaine",
          coutUsd: 0,
          constats: [{ code: "x", libelle: "passage fautif" }],
        },
      }),
    );
    expect(g.find((c) => c.code === "Q1")).toMatchObject({
      ok: false,
      passages: ["passage fautif"],
    });
    expect(
      evaluerGrille(entreeOk({ conformite: undefined })).find((c) => c.code === "Q1")!.ok,
    ).toBe(false);
  });
  it("Q2 : un chiffre hors dossier échoue", () => {
    expect(
      evaluerGrille(entreeOk({ chiffresHorsDossier: ["37 % des PME."] })).find(
        (c) => c.code === "Q2",
      )!.ok,
    ).toBe(false);
  });
  it("Q3 : le gardien qui écarte ou renvoie en mise à jour = doublon", () => {
    for (const gardien of [
      { decision: "ecarter", raison: "x" },
      { decision: "mettre_a_jour", raison: "x", article: { id: "1", url: "/a" } },
    ] as never[]) {
      expect(evaluerGrille(entreeOk({ gardien })).find((c) => c.code === "Q3")!.ok).toBe(false);
    }
  });
  it("Q4 : un seul lien invalide échoue", () => {
    const g = evaluerGrille(
      entreeOk({
        liens: [
          { url: "/a", verdict: { ok: true } },
          { url: "/b", verdict: { ok: false } },
        ],
      }),
    );
    expect(g.find((c) => c.code === "Q4")).toMatchObject({ ok: false, passages: ["/b"] });
  });
  it("Q5 : saut de niveau, double h1, aucun h2, h2 en double", () => {
    expect(defautsStructure(corps(), "T")).toEqual([]);
    expect(defautsStructure("<h3>x</h3><p>a</p>", "T").length).toBeGreaterThan(0);
    expect(defautsStructure("<h2>a</h2><h4>b</h4>", "T").join()).toContain("saut");
    expect(defautsStructure("<h1>z</h1><h2>a</h2>", "T").join()).toContain("niveau 1");
    expect(defautsStructure("<p>a</p>", "T").join()).toContain("aucun titre de niveau 2");
    expect(defautsStructure("<h2>A</h2><h2>a</h2>", "T").join()).toContain("double");
  });
  it("Q6 : 40-60 mots, mot-clé, dans les 100 premiers mots", () => {
    const mc = "automatiser sa facturation";
    expect(reponseDirecteConforme(corps(), mc)).toBe(true);
    expect(reponseDirecteConforme(`<p>${mots(30)} ${mc}.</p>`, mc)).toBe(false);
    expect(reponseDirecteConforme(`<p>${mots(70)} ${mc}.</p>`, mc)).toBe(false);
    expect(reponseDirecteConforme(`<p>${mots(45)}.</p>`, mc)).toBe(false);
    expect(reponseDirecteConforme(`<p>${mots(70, "a")}</p><p>${reponse}</p>`, mc)).toBe(false);
  });
  it("Q7 : sans fait de la base, échec (sauf types sans base)", () => {
    expect(evaluerGrille(entreeOk({ kbEntryIds: [] })).find((c) => c.code === "Q7")!.ok).toBe(
      false,
    );
    expect(
      evaluerGrille(entreeOk({ kbEntryIds: [], contentType: "blog_from_rss" })).find(
        (c) => c.code === "Q7",
      )!.ok,
    ).toBe(true);
  });
  it("Q8 : une question du brief absente des titres et de la FAQ échoue", () => {
    const brief = {
      motCle: "automatiser sa facturation",
      entites: [],
      questions: [
        {
          question: "Quel logiciel choisir pour facturer ?",
          origine: "autre-source" as const,
          reference: "x",
        },
      ],
    };
    expect(evaluerGrille(entreeOk({ brief })).find((c) => c.code === "Q8")!.ok).toBe(false);
    expect(
      evaluerGrille(
        entreeOk({ brief, faq: [{ q: "Quel logiciel choisir pour facturer ?" }] }),
      ).find((c) => c.code === "Q8")!.ok,
    ).toBe(true);
  });
  it("Q9 : tutoiement et phrases trop longues", () => {
    expect(
      evaluerGrille(
        entreeOk({ html: corps("<p>Tu peux le faire. Ton choix. Tes données. Toi aussi.</p>") }),
      ).find((c) => c.code === "Q9")!.ok,
    ).toBe(false);
    expect(
      evaluerGrille(
        entreeOk({
          html: corps(`<p>${Array.from({ length: 900 }, (_, i) => `m${i}`).join(" ")}.</p>`),
        }),
      ).find((c) => c.code === "Q9")!.ok,
    ).toBe(false);
  });
  it("Q10 : moins de 3 passages citables échoue", () => {
    expect(
      evaluerGrille(entreeOk({ html: `<p>${reponse}</p><h2>A ?</h2><p>court.</p>` })).find(
        (c) => c.code === "Q10",
      )!.ok,
    ).toBe(false);
  });
  it("Q11 : entité absente échoue", () => {
    expect(
      evaluerGrille(
        entreeOk({
          brief: { motCle: "automatiser sa facturation", entites: ["Factur-X"], questions: [] },
        }),
      ).find((c) => c.code === "Q11")!.ok,
    ).toBe(false);
  });
  it("Q12 : note sous 8,5 échoue ; non évaluée = non comptée", () => {
    expect(evaluerGrille(entreeOk({ noteUtilite: 8.4 })).find((c) => c.code === "Q12")!.ok).toBe(
      false,
    );
    expect(
      evaluerGrille(entreeOk({ noteUtilite: undefined })).find((c) => c.code === "Q12"),
    ).toMatchObject({ ok: true, evalue: false });
  });
  it("Q13 : moins de 850 mots échoue ; type hors plancher exempté", () => {
    expect(
      evaluerGrille(entreeOk({ html: `<p>${reponse}</p><h2>A ?</h2>${para(60)}` })).find(
        (c) => c.code === "Q13",
      )!.ok,
    ).toBe(false);
    expect(
      evaluerGrille(
        entreeOk({
          html: `<p>${reponse}</p><h2>A ?</h2>${para(60)}`,
          contentType: "blog_from_rss",
        }),
      ).find((c) => c.code === "Q13")!.ok,
    ).toBe(true);
  });
});

describe("décision", () => {
  it("tout vert → publier", () => expect(decider(vert(), ctx)).toEqual({ type: "publier" }));
  it("tout vert + Journée IA → à relire", () => {
    const d = decider(vert(), { ...ctx, sujetJourneeIA: true });
    expect(d.type).toBe("a_relire");
  });
  it("Q1 → renvoi au rédacteur avec les passages exacts", () => {
    expect(decider(avec(r("Q1", false, ["phrase fautive"])), ctx)).toMatchObject({
      type: "renvoi",
      renvois: [{ role: "redacteur", passages: ["phrase fautive"] }],
    });
  });
  it("Q2 → vérificateur puis rédacteur", () => {
    expect(decider(avec(r("Q2", false, ["37 %"])), ctx)).toMatchObject({
      renvois: [{ role: "verificateur", suite: ["redacteur"] }],
    });
  });
  it("Q3 → arrêt", () => expect(decider(avec(r("Q3", false)), ctx).type).toBe("arret"));
  it("Q4 → mailleur ; Q5 → architecte ; Q6 → éditeur", () => {
    expect(decider(avec(r("Q4", false)), ctx)).toMatchObject({ renvois: [{ role: "mailleur" }] });
    expect(decider(avec(r("Q5", false)), ctx)).toMatchObject({ renvois: [{ role: "architecte" }] });
    expect(decider(avec(r("Q6", false)), ctx)).toMatchObject({
      renvois: [{ role: "editeur-seo" }],
    });
  });
  it("plusieurs bloquants : un renvoi par rôle", () => {
    const d = decider(avec(r("Q4", false), r("Q5", false)), ctx);
    expect(d.type === "renvoi" && d.renvois.map((x) => x.role)).toEqual(["mailleur", "architecte"]);
  });
  it("seulement non bloquants → un renvoi groupé", () => {
    const d = decider(avec(r("Q8", false), r("Q12", false)), { ...ctx, noteGlobale: 7 });
    expect(d.type).toBe("renvoi");
  });
  it("écarts mineurs avec note ≥ 8,5 → publier ; note insuffisante → renvoi", () => {
    expect(decider(avec(r("Q10", false)), ctx)).toEqual({ type: "publier" });
    expect(decider(avec(r("Q10", false)), { ...ctx, noteGlobale: 8.4 }).type).toBe("renvoi");
  });
  it("écarts mineurs + Journée IA → à relire", () => {
    expect(decider(avec(r("Q9", false)), { ...ctx, sujetJourneeIA: true }).type).toBe("a_relire");
  });
  it("Q7 ou Q13 → relecture humaine directe avec blockCauses", () => {
    const d = decider(avec(r("Q13", false)), ctx);
    expect(d.type === "relecture_humaine" && d.blockCauses[0]).toContain("Q13");
    expect(decider(avec(r("Q7", false)), ctx).type).toBe("relecture_humaine");
  });
  it("plafond de renvois : 2 renvois faits → relecture humaine", () => {
    expect(decider(avec(r("Q1", false)), { ...ctx, renvoisFaits: 1 }).type).toBe("renvoi");
    expect(decider(avec(r("Q1", false)), { ...ctx, renvoisFaits: 2 }).type).toBe(
      "relecture_humaine",
    );
    expect(decider(avec(r("Q8", false)), { ...ctx, renvoisFaits: 2, noteGlobale: 7 }).type).toBe(
      "relecture_humaine",
    );
  });
  it("plafond de coût atteint → relecture humaine, même tout vert", () => {
    const d = decider(vert(), { ...ctx, coutDepenseUsd: PLAFOND_COUT_ARTICLE_USD });
    expect(d.type === "relecture_humaine" && d.blockCauses[0]).toContain("Plafond de coût");
    expect(decider(vert(), { ...ctx, coutDepenseUsd: 2.99 }).type).toBe("publier");
  });
  it("erreur du modèle → relecture humaine", () => {
    expect(decider(vert(), { ...ctx, erreurModele: true }).type).toBe("relecture_humaine");
  });
});

const jugement = (note: number, utilite = 9, issues: JudgeResult["issues"] = []): JudgeResult => {
  const d = { score: utilite, comment: "" };
  return {
    verdict: "publish",
    globalScore: note,
    dimensions: {
      factualAccuracy: d,
      depth: d,
      originality: d,
      readability: d,
      seoCompleteness: d,
      valueToReader: { score: utilite, comment: "" },
      toneAxioniaAlignment: d,
    },
    issues,
    reasoning: "",
  };
};
const entreeCircuit = (o: Partial<EntreeEnChef> = {}): EntreeEnChef => ({
  ...(({ noteUtilite: _n, ...reste }) => reste)(entreeOk()),
  article: { jobId: "j1", title: "T", bodyHtml: corps() },
  renvoisFaits: 0,
  coutDepenseUsd: 0.4,
  journeeIA: { output: { title: "T", bodyHtml: corps() } },
  ...o,
});

describe("redacteurEnChef", () => {
  it("interrupteur éteint : rien d'évalué, aucun appel modèle", async () => {
    const juger = vi.fn();
    const s = await redacteurEnChef(entreeCircuit(), { juger }, {});
    expect(s.decision).toEqual({ type: "inchange" });
    expect(juger).not.toHaveBeenCalled();
  });
  it("interrupteur à autre chose que « true » : éteint", async () => {
    const s = await redacteurEnChef(
      entreeCircuit(),
      { juger: vi.fn() },
      { CONTENT_EQUIPE_EDITORIALE: "1" },
    );
    expect(s.decision.type).toBe("inchange");
  });
  it("jugerPourCircuit éteint : le juge actuel, mêmes arguments, résultat tel quel", async () => {
    const res = jugement(7.7);
    const juger = vi.fn().mockResolvedValue(res);
    const e = entreeCircuit({ contentType: "blog_article" });
    const out = await jugerPourCircuit(e, { juger }, {});
    expect(out).toEqual({ mode: "juge-actuel", jugement: res });
    expect(juger).toHaveBeenCalledTimes(1);
    expect(juger).toHaveBeenCalledWith(e.article, expect.objectContaining({ PUBLISH_MIN: 8.5 }), {
      typeBlog: "blog_article",
    });
  });
  it("allumé, tout vert → publier (le juge est appelé une fois)", async () => {
    const juger = vi.fn().mockResolvedValue(jugement(9));
    const s = await redacteurEnChef(entreeCircuit(), { juger }, ACTIF);
    expect(s.decision).toEqual({ type: "publier" });
    expect(juger).toHaveBeenCalledTimes(1);
  });
  it("allumé, sujet Journée IA → à relire", async () => {
    const juger = vi.fn().mockResolvedValue(jugement(9));
    const s = await redacteurEnChef(
      entreeCircuit({ journeeIA: { output: { bodyHtml: "<p>La Journée IA est une offre.</p>" } } }),
      { juger },
      ACTIF,
    );
    expect(s.decision.type).toBe("a_relire");
  });
  it("un bloquant en échec décide sans appeler le modèle", async () => {
    const juger = vi.fn();
    const s = await redacteurEnChef(
      entreeCircuit({ chiffresHorsDossier: ["42 %"] }),
      { juger },
      ACTIF,
    );
    expect(s.decision.type).toBe("renvoi");
    expect(juger).not.toHaveBeenCalled();
  });
  it("plafond de coût : relecture humaine sans appel modèle", async () => {
    const juger = vi.fn();
    const s = await redacteurEnChef(entreeCircuit({ coutDepenseUsd: 3.2 }), { juger }, ACTIF);
    expect(s.decision.type).toBe("relecture_humaine");
    expect(juger).not.toHaveBeenCalled();
  });
  it("erreur du modèle → relecture humaine", async () => {
    const juger = vi.fn().mockRejectedValue(new Error("boom"));
    const s = await redacteurEnChef(entreeCircuit(), { juger }, ACTIF);
    expect(s.decision.type).toBe("relecture_humaine");
    expect(s.decision.type === "relecture_humaine" && s.decision.blockCauses[0]).toContain(
      "Erreur du modèle",
    );
  });
  it("utilité < 8,5 → renvoi groupé ; P0 du modèle → relecture humaine", async () => {
    const s = await redacteurEnChef(
      entreeCircuit(),
      { juger: vi.fn().mockResolvedValue(jugement(8, 7)) },
      ACTIF,
    );
    expect(s.decision.type).toBe("renvoi");
    const p0 = await redacteurEnChef(
      entreeCircuit(),
      {
        juger: vi
          .fn()
          .mockResolvedValue(
            jugement(9, 9, [
              { severity: "P0", section: "corps", issue: "erreur", suggestedFix: "" },
            ]),
          ),
      },
      ACTIF,
    );
    expect(p0.decision.type).toBe("relecture_humaine");
  });
  it("plafond de renvois : 2 renvois faits puis échec → relecture humaine", async () => {
    const s = await redacteurEnChef(
      entreeCircuit({ chiffresHorsDossier: ["42 %"], renvoisFaits: 2 }),
      { juger: vi.fn() },
      ACTIF,
    );
    expect(s.decision.type).toBe("relecture_humaine");
  });
});

describe("pannes des contrôles et ordre des règles", () => {
  it("Q1 avec une erreur de conformité → panne → relecture humaine, pas de renvoi", () => {
    const g = evaluerGrille(
      entreeOk({
        conformite: {
          actif: true,
          decision: "relecture-humaine",
          coutUsd: 0,
          constats: [{ code: "erreur-conformite", libelle: "texte NON vérifié" }],
        },
      }),
    );
    expect(decider(g, ctx).type).toBe("relecture_humaine");
  });
  it("gardien absent ou en relecture humaine → relecture humaine", () => {
    for (const gardien of [
      undefined,
      { decision: "relecture_humaine", raison: "doute" },
    ] as never[]) {
      expect(decider(evaluerGrille(entreeOk({ gardien })), ctx).type).toBe("relecture_humaine");
    }
  });
  it("doublon + plafond de coût → arrêt", () => {
    expect(decider(avec(r("Q3", false)), { ...ctx, coutDepenseUsd: 5 }).type).toBe("arret");
  });
  it("Q7 en échec : le juge n'est pas appelé", async () => {
    const juger = vi.fn();
    const s = await redacteurEnChef(entreeCircuit({ kbEntryIds: [] }), { juger }, ACTIF);
    expect(s.decision.type).toBe("relecture_humaine");
    expect(juger).not.toHaveBeenCalled();
  });
  it("mineur + non mineur avec bonne note → renvoi", () => {
    expect(decider(avec(r("Q9", false), r("Q8", false)), ctx).type).toBe("renvoi");
  });
  it("jugerPourCircuit allumé → mode en-chef", async () => {
    const out = await jugerPourCircuit(
      entreeCircuit(),
      { juger: vi.fn().mockResolvedValue(jugement(9)) },
      ACTIF,
    );
    expect(out.mode).toBe("en-chef");
  });
});

describe("correctifs de relecture (PR 11, 2e passe)", () => {
  // 1) coût du juge compté dans le plafond de 3,00 $
  it("coût du juge : rendu à l'appelant, total = dépense + juge", async () => {
    const juger = vi.fn().mockResolvedValue({ ...jugement(9), coutUsd: 0.12 });
    const s = await redacteurEnChef(entreeCircuit({ coutDepenseUsd: 1 }), { juger }, ACTIF);
    expect(s.coutJugeUsd).toBeCloseTo(0.12);
    expect(s.coutTotalUsd).toBeCloseTo(1.12);
    expect(s.decision).toEqual({ type: "publier" });
  });
  it("coût du juge : vérifié avant l'appel (déjà au plafond → pas d'appel, coût juge 0)", async () => {
    const juger = vi.fn();
    const s = await redacteurEnChef(entreeCircuit({ coutDepenseUsd: 3 }), { juger }, ACTIF);
    expect(juger).not.toHaveBeenCalled();
    expect(s.coutJugeUsd).toBe(0);
    expect(s.coutTotalUsd).toBe(3);
  });
  it("coût du juge : ajouté après l'appel — le franchissement du plafond → relecture humaine", async () => {
    const juger = vi.fn().mockResolvedValue({ ...jugement(9), coutUsd: 0.2 });
    const s = await redacteurEnChef(entreeCircuit({ coutDepenseUsd: 2.9 }), { juger }, ACTIF);
    expect(juger).toHaveBeenCalledTimes(1);
    expect(s.coutTotalUsd).toBeCloseTo(3.1);
    expect(s.decision.type).toBe("relecture_humaine");
    expect(s.decision.type === "relecture_humaine" && s.decision.blockCauses[0]).toContain(
      "Plafond de coût",
    );
  });
  it("coût du juge inconnu : compté pour 0, le circuit continue", async () => {
    const s = await redacteurEnChef(
      entreeCircuit({ coutDepenseUsd: 1 }),
      { juger: vi.fn().mockResolvedValue(jugement(9)) },
      ACTIF,
    );
    expect(s.coutJugeUsd).toBe(0);
    expect(s.coutTotalUsd).toBe(1);
  });
  it("coût du juge : un coût invalide (NaN, négatif) n'est jamais retranché", async () => {
    for (const c of [Number.NaN, -5]) {
      const s = await redacteurEnChef(
        entreeCircuit({ coutDepenseUsd: 1 }),
        { juger: vi.fn().mockResolvedValue({ ...jugement(9), coutUsd: c }) },
        ACTIF,
      );
      expect(s.coutTotalUsd).toBe(1);
    }
  });
  it("jugerPourCircuit allumé rend le coût ; éteint, résultat du juge tel quel", async () => {
    const j = { ...jugement(9), coutUsd: 0.3 };
    const on = await jugerPourCircuit(
      entreeCircuit(),
      { juger: vi.fn().mockResolvedValue(j) },
      ACTIF,
    );
    expect(on.mode === "en-chef" && on.coutJugeUsd).toBeCloseTo(0.3);
    const off = await jugerPourCircuit(
      entreeCircuit(),
      { juger: vi.fn().mockResolvedValue(j) },
      {},
    );
    expect(off).toEqual({ mode: "juge-actuel", jugement: j });
  });

  // 2) renvoi pour bloquant + écarts Q8 à Q11
  it("renvoi bloquant : embarque Q8 à Q11 relevés en même temps, un seul renvoi par rôle", () => {
    const d = decider(
      avec(
        r("Q4", false, ["lien-mort"]),
        r("Q8", false, ["question non couverte"]),
        r("Q9", false, ["tutoiement"]),
        r("Q10", false),
        r("Q11", false, ["entité"]),
      ),
      ctx,
    );
    expect(d.type).toBe("renvoi");
    if (d.type !== "renvoi") return;
    expect(d.renvois.map((x) => x.role).sort()).toEqual(
      ["architecte", "editeur-seo", "mailleur", "redacteur"].sort(),
    );
    expect(d.renvois.filter((x) => x.role === "editeur-seo")).toHaveLength(1);
    const ed = d.renvois.find((x) => x.role === "editeur-seo")!;
    expect(ed.criteres).toEqual(["Q10", "Q11"]);
    expect(d.renvois.find((x) => x.role === "architecte")!.criteres).toEqual(["Q8"]);
    expect(d.renvois.find((x) => x.role === "redacteur")!.criteres).toEqual(["Q9"]);
  });
  it("renvoi bloquant : Q12 n'est pas embarqué ; Q13 + Q8 sans bloquant → relecture humaine", () => {
    const d = decider(avec(r("Q4", false), r("Q12", false)), ctx);
    expect(d.type === "renvoi" && d.renvois.flatMap((x) => x.criteres)).toEqual(["Q4"]);
    // Q7/Q13 : ordre des règles inchangé (un bloquant se renvoie d'abord).
    expect(decider(avec(r("Q13", false), r("Q8", false)), ctx).type).toBe("relecture_humaine");
  });
  it("renvoi bloquant : le plafond de renvois reste la règle", () => {
    expect(decider(avec(r("Q4", false), r("Q8", false)), { ...ctx, renvoisFaits: 2 }).type).toBe(
      "relecture_humaine",
    );
  });

  // 3) Q1 + Q2 fusionnés
  it("Q1 + Q2 : UN seul renvoi au rédacteur, passages exacts + chiffres à sourcer", () => {
    const d = decider(
      avec(r("Q1", false, ["phrase fautive"]), r("Q2", false, ["37 % des PME"])),
      ctx,
    );
    expect(d.type).toBe("renvoi");
    if (d.type !== "renvoi") return;
    expect(d.renvois).toHaveLength(1);
    expect(d.renvois[0]).toMatchObject({
      role: "redacteur",
      suite: [],
      criteres: ["Q1", "Q2"],
      passages: ["phrase fautive"],
      chiffresASourcer: ["37 % des PME"],
    });
  });
  it("Q1 + Q2 + Q9 : tout dans le seul renvoi du rédacteur", () => {
    const d = decider(
      avec(r("Q1", false, ["a"]), r("Q2", false, ["b"]), r("Q9", false, ["tutoiement"])),
      ctx,
    );
    expect(d.type === "renvoi" && d.renvois).toHaveLength(1);
    expect(d.type === "renvoi" && d.renvois[0]!.criteres).toEqual(["Q1", "Q2", "Q9"]);
  });
  it("Q2 seul : toujours vérificateur puis rédacteur (inchangé)", () => {
    const d = decider(avec(r("Q2", false, ["37 %"])), ctx);
    expect(d).toMatchObject({ renvois: [{ role: "verificateur", suite: ["redacteur"] }] });
  });

  // 4) note globale minimale quand tout est vert
  it("tout vert mais note sous le minimum du juge actuel → pas de publication", () => {
    const d = decider(vert(), { ...ctx, noteGlobale: 8.4 });
    expect(d.type).toBe("relecture_humaine");
    expect(d.type === "relecture_humaine" && d.blockCauses[0]).toContain("Note globale");
    expect(decider(vert(), { ...ctx, noteGlobale: 8.5 })).toEqual({ type: "publier" });
  });
  it("tout vert sans note du juge → pas de publication", () => {
    expect(decider(vert(), { ...ctx, noteGlobale: undefined }).type).toBe("relecture_humaine");
  });
  it("tout vert + note insuffisante + Journée IA → relecture humaine (pas « à relire » seul)", () => {
    expect(decider(vert(), { ...ctx, noteGlobale: 7, sujetJourneeIA: true }).type).toBe(
      "relecture_humaine",
    );
  });
  it("le seuil est celui du juge actuel (thresholds), jamais moins strict", async () => {
    const th = { PUBLISH_MIN: 9, IMPROVE_MIN: 6 };
    const s = await redacteurEnChef(
      entreeCircuit({ thresholds: th }),
      { juger: vi.fn().mockResolvedValue(jugement(8.8)) },
      ACTIF,
    );
    expect(s.decision.type).toBe("relecture_humaine");
    const ok = await redacteurEnChef(
      entreeCircuit({ thresholds: th }),
      { juger: vi.fn().mockResolvedValue(jugement(9.1)) },
      ACTIF,
    );
    expect(ok.decision).toEqual({ type: "publier" });
    // Seuil réglé plus bas en base : jamais sous 8,5 par défaut du code, mais celui du juge fait foi.
    const bas = await redacteurEnChef(
      entreeCircuit({ thresholds: { PUBLISH_MIN: 7, IMPROVE_MIN: 5 } }),
      { juger: vi.fn().mockResolvedValue(jugement(7.5)) },
      ACTIF,
    );
    expect(bas.decision).toEqual({ type: "publier" });
  });
  it("allumé, tout vert, note globale 8,4 (seuil par défaut) → relecture humaine", async () => {
    const s = await redacteurEnChef(
      entreeCircuit(),
      { juger: vi.fn().mockResolvedValue(jugement(8.4)) },
      ACTIF,
    );
    expect(s.decision.type).toBe("relecture_humaine");
  });

  // Relecture Opus, tour 1
  it("une issue P1 du juge : jamais « publier » (comme le verdict « improve » du juge actuel)", async () => {
    const p1 = [
      { severity: "P1" as const, section: "corps", issue: "voix passive", suggestedFix: "" },
    ];
    const s = await redacteurEnChef(
      entreeCircuit(),
      { juger: vi.fn().mockResolvedValue(jugement(9.5, 9, p1)) },
      ACTIF,
    );
    expect(s.decision.type).toBe("relecture_humaine");
    expect(s.decision.type === "relecture_humaine" && s.decision.blockCauses[0]).toContain("P1");
    expect(decider(vert(), { ...ctx, p1Juge: true }).type).toBe("relecture_humaine");
    expect(decider(vert(), { ...ctx, p1Juge: false })).toEqual({ type: "publier" });
  });
  it("Q2 + Q9 : un seul renvoi (vérificateur, le rédacteur reprend avec Q9)", () => {
    const d = decider(avec(r("Q2", false, ["37 %"]), r("Q9", false, ["tutoiement"])), ctx);
    expect(d.type).toBe("renvoi");
    if (d.type !== "renvoi") return;
    expect(d.renvois).toHaveLength(1);
    expect(d.renvois[0]).toMatchObject({
      role: "verificateur",
      suite: ["redacteur"],
      criteres: ["Q2", "Q9"],
    });
  });
  it("erreur du juge portant un coût déjà facturé : compté dans le total", async () => {
    const err = new ProviderError("x", "invalid_response", "anthropic", false);
    (err as { costUsd?: number }).costUsd = 0.5;
    const s = await redacteurEnChef(
      entreeCircuit({ coutDepenseUsd: 1 }),
      { juger: vi.fn().mockRejectedValue(err) },
      ACTIF,
    );
    expect(s.decision.type).toBe("relecture_humaine");
    expect(s.coutJugeUsd).toBeCloseTo(0.5);
    expect(s.coutTotalUsd).toBeCloseTo(1.5);
  });
});
