import { describe, expect, it } from "vitest";
import { CompteurCout, type AppelModele } from "./commun";
import type { FaitSource } from "./collecteur-faits";
import {
  PROMPT_REDACTEUR_SYSTEME,
  decouperSections,
  redigerArticle,
  reecrireSections,
  type EntreeRedaction,
} from "./redacteur";
import type { StructureBrief } from "./strateg-brief";
import type { Brief } from "../../equipe/brief";

const mots = (n: number, base = "terme") =>
  Array.from({ length: n }, (_, i) => `${base}${i % 7}`).join(" ");

const brief: Brief = {
  motCle: "automatiser notes de frais",
  intention: "information",
  requetesSecondaires: [],
  champSemantique: [],
  entites: [],
  questions: [
    {
      question: "Comment automatiser les notes de frais dans une PME ?",
      origine: "plan-editorial",
      reference: "plan n° 12",
    },
    {
      question: "Quels justificatifs faut-il conserver ?",
      origine: "search-console",
      reference: "r1",
    },
    {
      question: "Combien de temps faut-il pour déployer ?",
      origine: "search-console",
      reference: "r2",
    },
    { question: "Quels outils choisir ?", origine: "search-console", reference: "r3" },
    { question: "Faut-il former les équipes ?", origine: "search-console", reference: "r4" },
  ],
  urlCible: "https://axion-ia.com/fr/blog/automatiser-notes-de-frais",
  cluster: "/fr/contact",
  type: "neuf",
};

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
    question: 1,
    blocAttendu: null,
  },
  {
    type: "informatif",
    intitule: "Combien de temps faut-il pour déployer ?",
    question: 2,
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
  intention: "informational",
  gabaritCible: "analyse",
  h1: "Comment automatiser les notes de frais dans une PME ?",
  lecteur: { profil: "pme", metier: "dirigeant" },
  angleUnique: "x",
  lacunesConcurrents: [],
  pagesLues: [],
  formatDominant: "analyse",
  ecartFormat: null,
  questionPrincipale: 0,
  questionsEcartees: [],
  faitsACollecter: [],
  planHn,
  faqPrevue: [1, 2, 3, 4],
  apportsReserves: [
    { type: "B", description: "x" },
    { type: "C", description: "y" },
  ],
  appelAction: "diagnostic",
  liensInternes: [],
  fourchetteMots: {
    min: 400,
    max: 1200,
    methode: "repli-gabarit",
    mediane: null,
    pagesRetenues: 0,
  },
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

const section = (intitule: string, corps = mots(60)) =>
  `<h2>${intitule}</h2><p data-aeo="answer">${mots(45, "reponse")}</p><p>${corps}</p>`;

const corpsValide = () =>
  planHn
    .map((p, i) =>
      i === 1
        ? section(
            p.intitule,
            `En 2025, 14 % des PME ont utilisé l'IA (<a href="https://www.insee.fr/fr/statistiques/1">Insee</a>, 2026). ${mots(30)}`,
          )
        : section(p.intitule),
    )
    .join("\n");

const direct = `En 2025, 14 % des PME ont utilisé l'IA selon l'Insee. ${mots(36, "directe")}`;

const sortie = (o: Record<string, unknown> = {}) => ({
  directAnswer: direct,
  bodyHtml: corpsValide(),
  faq: [
    { question: "Quels outils choisir ?", answer: mots(40, "faq") },
    { question: "Faut-il former les équipes ?", answer: mots(40, "faq") },
    { question: "Quels justificatifs faut-il conserver ?", answer: mots(40, "faq") },
    { question: "Combien de temps faut-il pour déployer ?", answer: mots(40, "faq") },
  ],
  ...o,
});

const entree = (o: Partial<EntreeRedaction> = {}): EntreeRedaction => ({
  brief,
  structure,
  faits,
  maintenant: new Date("2026-11-27T10:00:00Z"),
  ...o,
});

const appelant =
  (o: Record<string, unknown> = {}): AppelModele =>
  async () => ({
    texte: JSON.stringify(sortie(o)),
    coutUsd: 0.2,
  });

describe("redigerArticle (R4)", () => {
  it("rend un article conforme sans problème", async () => {
    const r = await redigerArticle(entree(), appelant(), new CompteurCout());
    expect(r.verdict).toBe("redige");
    if (r.verdict !== "redige") return;
    expect(r.problemes).toEqual([]);
    expect(r.article.h1DansSortieBrute).toBe(false);
    expect(r.article.faq).toHaveLength(4);
  });

  it("retire un <h1>, garde le texte et lève le drapeau h1DansSortieBrute", async () => {
    const r = await redigerArticle(
      entree(),
      appelant({ bodyHtml: `<h1>Titre</h1>${corpsValide()}` }),
      new CompteurCout(),
    );
    if (r.verdict !== "redige") throw new Error("attendu redige");
    expect(r.article.h1DansSortieBrute).toBe(true);
    expect(r.article.bodyHtml).not.toMatch(/<h1/i);
    expect(r.article.bodyHtml).toContain("Titre");
  });

  it("signale un chiffre qui n'est pas dans le dossier de preuves", async () => {
    const r = await redigerArticle(
      entree(),
      appelant({
        bodyHtml: corpsValide() + `<p>Le marché pèse 37 % de croissance. ${mots(20)}</p>`,
      }),
      new CompteurCout(),
    );
    if (r.verdict !== "redige") throw new Error();
    expect(r.problemes.map((p) => p.probleme)).toContain("chiffre_hors_dossier");
  });

  it("signale un chiffre du dossier cité sans son lien source dans le même paragraphe", async () => {
    const sansLien = planHn
      .map((p) =>
        section(
          p.intitule,
          p.intitule.includes("justificatifs") ? `En 2025, 14 % des PME. ${mots(30)}` : mots(60),
        ),
      )
      .join("\n");
    const r = await redigerArticle(entree(), appelant({ bodyHtml: sansLien }), new CompteurCout());
    if (r.verdict !== "redige") throw new Error();
    expect(r.problemes.map((p) => p.probleme)).toContain("chiffre_sans_source");
  });

  it("laisse passer les petits décomptes (« 3 étapes ») et le Diagnostic de 45 minutes", async () => {
    const r = await redigerArticle(
      entree(),
      appelant({
        bodyHtml:
          corpsValide() +
          `<p>Voici 3 étapes, puis un Diagnostic IA gratuit de 45 minutes. ${mots(20)}</p>`,
      }),
      new CompteurCout(),
    );
    if (r.verdict !== "redige") throw new Error();
    expect(r.problemes.map((p) => p.probleme)).not.toContain("chiffre_hors_dossier");
  });

  it("vérifie l'appariement avec le plan : H2 manquant, permuté ou en trop (ordre_plan)", async () => {
    const permute = [...planHn]
      .reverse()
      .map((p) => section(p.intitule))
      .join("\n");
    const r = await redigerArticle(entree(), appelant({ bodyHtml: permute }), new CompteurCout());
    if (r.verdict !== "redige") throw new Error();
    expect(r.problemes.map((p) => p.probleme)).toContain("ordre_plan");
    const manque = planHn
      .slice(0, 3)
      .map((p) => section(p.intitule))
      .join("\n");
    const r2 = await redigerArticle(entree(), appelant({ bodyHtml: manque }), new CompteurCout());
    if (r2.verdict !== "redige") throw new Error();
    expect(r2.problemes.map((p) => p.probleme)).toContain("ordre_plan");
  });

  it("vérifie la réponse directe : 40 à 60 mots", async () => {
    const r = await redigerArticle(
      entree(),
      appelant({ directAnswer: "Trop court." }),
      new CompteurCout(),
    );
    if (r.verdict !== "redige") throw new Error();
    expect(r.problemes.map((p) => p.probleme)).toContain("reponse_directe_longueur");
  });

  it("vérifie les ouvertures de H2 : au moins 70 % de 25 à 80 mots", async () => {
    const sans = planHn.map((p) => `<h2>${p.intitule}</h2><p>${mots(60)}</p>`).join("\n");
    const r = await redigerArticle(entree(), appelant({ bodyHtml: sans }), new CompteurCout());
    if (r.verdict !== "redige") throw new Error();
    expect(r.problemes.map((p) => p.probleme)).toContain("ouverture_absente");
  });

  it("refuse un texte caché, un script, la mention « relu par » sans relecture", async () => {
    const r = await redigerArticle(
      entree(),
      appelant({
        bodyHtml:
          corpsValide() +
          `<details><summary>x</summary><p>${mots(10)}</p></details><script>1</script><p>Article relu par Will.</p>`,
      }),
      new CompteurCout(),
    );
    if (r.verdict !== "redige") throw new Error();
    const p = r.problemes.map((x) => x.probleme);
    expect(p).toEqual(
      expect.arrayContaining(["texte_cache", "html_interdit", "relu_sans_relecture"]),
    );
  });

  it("applique les règles de marque, sans interdire « partout en France »", async () => {
    const mal = await redigerArticle(
      entree(),
      appelant({ bodyHtml: corpsValide() + `<p>Réservez via /appel. ${mots(10)}</p>` }),
      new CompteurCout(),
    );
    if (mal.verdict !== "redige") throw new Error();
    expect(mal.problemes.map((p) => p.probleme)).toContain("regle_de_marque");
    const ok = await redigerArticle(
      entree(),
      appelant({
        bodyHtml:
          corpsValide() + `<p>Nous venons dans vos locaux, partout en France. ${mots(10)}</p>`,
      }),
      new CompteurCout(),
    );
    if (ok.verdict !== "redige") throw new Error();
    expect(ok.problemes.map((p) => p.probleme)).not.toContain("regle_de_marque");
  });

  it("n'accepte en FAQ que des questions du brief ; omise sous 4 questions, jamais comblée", async () => {
    const r = await redigerArticle(
      entree(),
      appelant({
        faq: [
          { question: "Quels outils choisir ?", answer: mots(40) },
          { question: "Une question inventée ?", answer: mots(40) },
        ],
      }),
      new CompteurCout(),
    );
    if (r.verdict !== "redige") throw new Error();
    expect(r.article.faq).toEqual([]);
    expect(r.problemes.map((p) => p.probleme)).toContain("faq_question_inventee");
  });

  it("signale une longueur hors fourchette sans bloquer la lecture", async () => {
    const r = await redigerArticle(
      entree({
        structure: {
          ...structure,
          fourchetteMots: { ...structure.fourchetteMots, min: 3000, max: 3400 },
        },
      }),
      appelant(),
      new CompteurCout(),
    );
    if (r.verdict !== "redige") throw new Error();
    expect(r.problemes.map((p) => p.probleme)).toContain("longueur_hors_fourchette");
  });

  it("rejette une sortie illisible sans lever", async () => {
    const appel: AppelModele = async () => ({ texte: "voici l'article", coutUsd: 0.1 });
    const r = await redigerArticle(entree(), appel, new CompteurCout());
    expect(r.verdict).toBe("illisible");
  });

  it("emploie Opus et un prompt « chaîne » : plus de PAA inventées ni de longueur déterminante", async () => {
    let vu: { modele: string; system: string; user: string } | null = null;
    const appel: AppelModele = async (req) => {
      vu = req;
      return { texte: JSON.stringify(sortie()), coutUsd: 0.2 };
    };
    await redigerArticle(entree(), appel, new CompteurCout());
    expect(vu!.modele).toBe("claude-opus-5-5");
    expect(PROMPT_REDACTEUR_SYSTEME).toContain("aucun chiffre hors du dossier");
    for (const interdit of ["People Also Ask", "PAA", "déterminante", "Par où commencer"]) {
      expect(PROMPT_REDACTEUR_SYSTEME).not.toContain(interdit);
    }
    expect(vu!.user).toContain("<donnees_non_fiables");
  });
});

describe("réécriture ciblée", () => {
  it("découpe le corps en sections H2", () => {
    const d = decouperSections(corpsValide());
    expect(d.sections).toHaveLength(4);
    expect(d.avant).toBe("");
  });

  it("ne réécrit que les sections en cause, les autres restent identiques", async () => {
    const avant = corpsValide();
    const nouvelle = section(planHn[2]!.intitule, mots(80, "neuf"));
    const appel: AppelModele = async () => ({
      texte: JSON.stringify({ sections: [{ index: 2, html: nouvelle }] }),
      coutUsd: 0.1,
    });
    const r = await reecrireSections(
      entree(),
      { directAnswer: direct, bodyHtml: avant, faq: [], h1DansSortieBrute: false },
      [{ section: 2, probleme: "trop court", attendu: "80 mots" }],
      appel,
      new CompteurCout(),
    );
    if (r.verdict !== "redige") throw new Error("attendu redige");
    const d0 = decouperSections(avant).sections;
    const d1 = decouperSections(r.article.bodyHtml).sections;
    expect(d1[0]).toBe(d0[0]);
    expect(d1[1]).toBe(d0[1]);
    expect(d1[3]).toBe(d0[3]);
    expect(d1[2]).toBe(nouvelle);
  });

  it("refuse une section réécrite qui change le titre H2 (ancres stables)", async () => {
    const appel: AppelModele = async () => ({
      texte: JSON.stringify({ sections: [{ index: 2, html: section("Un autre titre ?") }] }),
      coutUsd: 0.1,
    });
    const r = await reecrireSections(
      entree(),
      { directAnswer: direct, bodyHtml: corpsValide(), faq: [], h1DansSortieBrute: false },
      [{ section: 2, probleme: "x", attendu: "y" }],
      appel,
      new CompteurCout(),
    );
    expect(r.verdict).toBe("illisible");
  });
});
