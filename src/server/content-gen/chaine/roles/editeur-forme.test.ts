import { describe, expect, it } from "vitest";
import { CompteurCout, type AppelModele } from "./commun";
import type { FaitSource } from "./collecteur-faits";
import { editerForme, type EntreeEdition } from "./editeur-forme";
import type { ArticleRedige } from "./redacteur";
import type { StructureBrief } from "./strateg-brief";

const mots = (n: number, b = "m") => Array.from({ length: n }, (_, i) => `${b}${i}`).join(" ");
const planHn = [
  {
    type: "informatif",
    intitule: "Quels frais peut-on automatiser en premier ?",
    question: null,
    blocAttendu: null,
  },
  {
    type: "informatif",
    intitule: "Quels justificatifs faut-il conserver ?",
    question: null,
    blocAttendu: null,
  },
  {
    type: "informatif",
    intitule: "Combien de temps faut-il pour déployer ?",
    question: null,
    blocAttendu: null,
  },
  {
    type: "informatif",
    intitule: "Comment former deux référents internes ?",
    question: null,
    blocAttendu: null,
  },
] as const;
const structure = {
  versionStructure: 1,
  gabaritCible: "analyse",
  h1: "Comment automatiser les notes de frais dans une PME ?",
  planHn,
  fourchetteMots: {
    min: 300,
    max: 1500,
    methode: "repli-gabarit",
    mediane: null,
    pagesRetenues: 0,
  },
  liensInternes: ["/fr/contact"],
} as unknown as StructureBrief;
const faits: FaitSource[] = [
  {
    enonce: "14 % des PME ont utilisé l'IA en 2025.",
    valeur: "14 %",
    extrait: "14 % des PME de 10 salariés ou plus ont utilisé l'IA",
    url: "https://www.insee.fr/fr/statistiques/1",
    editeur: "Insee",
    datePublication: "2026-03-10",
    confiance: "haute",
    texteReference: false,
  },
];
const section = (t: string, corps: string) =>
  `<h2>${t}</h2><p data-aeo="answer">${mots(45, "r")}</p><p>${corps}</p>`;
const LIEN = `<a href="https://www.insee.fr/fr/statistiques/1">Insee</a>`;
const corps = () =>
  planHn
    .map((p, i) =>
      section(
        p.intitule,
        i === 1 ? `En 2025, 14 % des PME ont utilisé l'IA (${LIEN}, 2026). ${mots(60)}` : mots(110),
      ),
    )
    .join("");

const article = (): ArticleRedige => ({
  directAnswer: `En 2025, 14 % des PME ont utilisé l'IA selon l'Insee. ${mots(36, "d")}`,
  bodyHtml: corps(),
  faq: [],
  h1DansSortieBrute: false,
});
const entree = (o: Partial<EntreeEdition> = {}): EntreeEdition => ({
  brief: { questions: [] } as unknown as EntreeEdition["brief"],
  structure,
  faits,
  maintenant: new Date("2026-11-27T10:00:00Z"),
  article: article(),
  ...o,
});
const rend =
  (a: Partial<ArticleRedige>): AppelModele =>
  async () => ({
    texte: JSON.stringify({
      directAnswer: article().directAnswer,
      bodyHtml: article().bodyHtml,
      faq: [],
      ...a,
    }),
    coutUsd: 0.1,
  });

describe("editerForme (R7)", () => {
  it("accepte une correction de forme qui ne bouge aucun chiffre", async () => {
    const edite = corps().replace(
      "Quels frais peut-on automatiser en premier ?",
      "Quels frais automatiser en premier ?",
    );
    const r = await editerForme(entree(), rend({ bodyHtml: edite }), new CompteurCout());
    expect(r).toMatchObject({ verdict: "edite", motifRejet: null });
    if (r.verdict === "edite") expect(r.article.bodyHtml).toBe(edite);
  });

  it("rejette l'édition qui change un chiffre et garde le texte d'origine", async () => {
    const r = await editerForme(
      entree(),
      rend({ bodyHtml: corps().replace("14 %", "41 %") }),
      new CompteurCout(),
    );
    expect(r).toMatchObject({ verdict: "inchange", motifRejet: "chiffres_modifies" });
    if (r.verdict === "inchange") expect(r.article.bodyHtml).toBe(corps());
  });

  it("rejette un chiffre déplacé d'une section à une autre", async () => {
    const deplace = corps()
      .replace("En 2025, 14 % des PME ont utilisé l'IA", "Des PME ont utilisé l'IA")
      .replace(
        'Quels frais peut-on automatiser en premier ?</h2><p data-aeo="answer">',
        'Quels frais peut-on automatiser en premier ?</h2><p data-aeo="answer">14 % ',
      );
    const r = await editerForme(entree(), rend({ bodyHtml: deplace }), new CompteurCout());
    expect(r).toMatchObject({ verdict: "inchange", motifRejet: "chiffres_modifies" });
  });

  it("rejette la suppression d'un lien source, ou l'ajout de /appel ; permet un lien interne prévu au brief", async () => {
    const sansLien = corps().replace(LIEN, "Insee");
    expect(
      await editerForme(entree(), rend({ bodyHtml: sansLien }), new CompteurCout()),
    ).toMatchObject({ verdict: "inchange", motifRejet: "liens_modifies" });
    const appel = corps().replace("</p></p>", "") + `<p>Réservez <a href="/fr/appel">ici</a>.</p>`;
    expect(
      await editerForme(entree(), rend({ bodyHtml: appel }), new CompteurCout()),
    ).toMatchObject({ verdict: "inchange" });
    const interne =
      corps() + `<p>Parlons-en lors d'un <a href="/fr/contact">Diagnostic IA gratuit</a>.</p>`;
    expect(
      await editerForme(entree(), rend({ bodyHtml: interne }), new CompteurCout()),
    ).toMatchObject({ verdict: "edite" });
  });

  it("rejette l'édition qui casse l'appariement avec le plan (H2 retiré)", async () => {
    const trois = planHn
      .slice(0, 3)
      .map((p) => section(p.intitule, mots(110)))
      .join("");
    const r = await editerForme(entree(), rend({ bodyHtml: trois }), new CompteurCout());
    expect(r).toMatchObject({ verdict: "inchange" });
  });

  it("rejette une règle de marque violée par l'édition ; « partout en France » reste permis", async () => {
    const mal = corps() + "<p>Notre équipe de Grenoble vient chez vous.</p>";
    expect(await editerForme(entree(), rend({ bodyHtml: mal }), new CompteurCout())).toMatchObject({
      verdict: "inchange",
      motifRejet: "regle_de_marque",
    });
    const ok = corps() + "<p>Nous venons dans vos locaux, partout en France.</p>";
    expect(await editerForme(entree(), rend({ bodyHtml: ok }), new CompteurCout())).toMatchObject({
      verdict: "edite",
    });
  });

  it("retire un <h1> et lève le drapeau", async () => {
    const r = await editerForme(
      entree(),
      rend({ bodyHtml: `<h1>Titre</h1>${corps()}` }),
      new CompteurCout(),
    );
    if (r.verdict === "illisible") throw new Error();
    expect(r.article.bodyHtml).not.toMatch(/<h1/i);
    expect(r.article.h1DansSortieBrute).toBe(true);
  });

  it("renvoie à R4 ce qui relève du fond : section trop courte, hors fourchette", async () => {
    const court = [
      section(planHn[0].intitule, mots(5)),
      section(planHn[1].intitule, mots(110)),
      section(planHn[2].intitule, mots(110)),
      section(planHn[3].intitule, mots(110)),
    ].join("");
    const r = await editerForme(
      entree({ article: { ...article(), bodyHtml: court } }),
      rend({ bodyHtml: court }),
      new CompteurCout(),
    );
    if (r.verdict === "illisible") throw new Error();
    expect(r.renvoiR4.map((c) => c.probleme)).toContain("section_trop_courte");
  });

  it("signale les faux titres (paragraphe court tout en gras)", async () => {
    const faux = corps().replace(
      "<p>" + mots(110),
      "<p><strong>Un faux titre court</strong></p><p>" + mots(110),
    );
    const r = await editerForme(
      entree({ article: { ...article(), bodyHtml: faux } }),
      rend({ bodyHtml: faux }),
      new CompteurCout(),
    );
    if (r.verdict === "illisible") throw new Error();
    expect(r.avertissements).toContain("faux_titre");
  });

  it("emploie Sonnet sans outil web, et rejette une sortie illisible", async () => {
    let vu: { modele: string; outils?: unknown } | null = null;
    const appel: AppelModele = async (req) => {
      vu = req;
      return {
        texte: JSON.stringify({
          directAnswer: article().directAnswer,
          bodyHtml: article().bodyHtml,
          faq: [],
        }),
        coutUsd: 0.1,
      };
    };
    await editerForme(entree(), appel, new CompteurCout());
    expect(vu!.modele).toBe("claude-sonnet-5-5");
    expect(vu!.outils).toBeUndefined();
    const bad: AppelModele = async () => ({ texte: "voilà", coutUsd: 0.1 });
    expect((await editerForme(entree(), bad, new CompteurCout())).verdict).toBe("illisible");
  });
});
