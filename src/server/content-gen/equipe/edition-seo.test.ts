import { describe, expect, it, vi } from "vitest";
import {
  appliquerRemplacements,
  commenceParUnRenvoi,
  detecterPassagesCitables,
  editerSeo,
  verifierRegles,
  type ArticleSeo,
  type BriefSeo,
} from "./edition-seo";

const mots = (n: number, debut = "Une") =>
  `${debut} ${Array.from({ length: n - 1 }, (_, i) => `mot${i}`).join(" ")}`;
const caracteres = (n: number, kw = "audit ia") => (kw + " " + "x".repeat(n)).slice(0, n);

const BRIEF: BriefSeo = { motCle: "audit ia", entites: ["Lyon"] };

function bon(): ArticleSeo {
  return {
    metaTitre: caracteres(55),
    metaDescription: caracteres(150),
    h1: "Audit IA : le guide",
    corpsHtml: [
      `<p>L'audit IA à Lyon ${mots(44)}.</p>`,
      "<h2>Pourquoi un audit IA ?</h2>",
      `<p>${mots(50, "Premier")}</p>`,
      `<p>${mots(60, "Second")}</p>`,
      "<h2>Les étapes</h2>",
    ].join(""),
    faq: [
      { q: "Combien coûte une démarche ?" },
      { q: "Quelle durée prévoir ?" },
      { q: "Qui participe ?" },
      { q: "Quels livrables ?" },
    ],
  };
}

const ON = { CONTENT_EQUIPE_EDITORIALE: "true" };

describe("passages citables", () => {
  it("compte un paragraphe autonome de 40 à 80 mots", () => {
    const r = detecterPassagesCitables(`<p>${mots(40)}</p><p>${mots(80)}</p>`);
    expect(r.citables).toHaveLength(2);
  });
  it("refuse 39 et 81 mots", () => {
    expect(detecterPassagesCitables(`<p>${mots(39)}</p><p>${mots(81)}</p>`).citables).toHaveLength(
      0,
    );
  });
  it.each([
    "Comme vu plus haut, la méthode",
    "Ceci permet",
    "Cela dépend",
    "Ce dernier point",
    "Comme indiqué avant",
  ])("refuse un renvoi en tête : %s", (debut) => {
    expect(commenceParUnRenvoi(debut)).toBe(true);
    expect(detecterPassagesCitables(`<p>${debut} ${mots(50)}</p>`).citables).toHaveLength(0);
  });
  it("n'est pas piégé par un mot qui commence comme un renvoi", () => {
    expect(commenceParUnRenvoi("Celapres est un nom propre")).toBe(false);
  });
});

describe("verifierRegles", () => {
  it("un article conforme n'a aucun problème", () => {
    expect(verifierRegles(bon(), BRIEF)).toEqual([]);
  });
  it.each([
    [49, true],
    [50, false],
    [60, false],
    [61, true],
  ])("méta-titre de %i caractères → problème=%s", (n, probleme) => {
    const codes = verifierRegles({ ...bon(), metaTitre: caracteres(n) }, BRIEF).map((p) => p.code);
    expect(codes.includes("meta_titre_longueur")).toBe(probleme);
  });
  it.each([
    [139, true],
    [140, false],
    [160, false],
    [161, true],
  ])("méta-description de %i caractères → problème=%s", (n, probleme) => {
    const codes = verifierRegles({ ...bon(), metaDescription: caracteres(n) }, BRIEF).map(
      (p) => p.code,
    );
    expect(codes.includes("meta_description_longueur")).toBe(probleme);
  });
  it("détecte le mot-clé absent aux cinq endroits", () => {
    const codes = verifierRegles(
      {
        ...bon(),
        h1: "Guide",
        metaTitre: "x".repeat(55),
        metaDescription: "x".repeat(150),
        corpsHtml: `<p>Intro</p><h2>Etapes</h2>`,
      },
      BRIEF,
    ).map((p) => p.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "mot_cle_h1",
        "mot_cle_meta_titre",
        "mot_cle_meta_description",
        "mot_cle_premier_paragraphe",
        "mot_cle_h2",
        "passages_citables",
      ]),
    );
  });
  it("FAQ : 3 et 7 questions hors bornes, 6 acceptées", () => {
    const faq = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        q: `Question distincte ${i} sur un sujet autre${i}`,
      }));
    const c = (n: number) => verifierRegles({ ...bon(), faq: faq(n) }, BRIEF).map((p) => p.code);
    expect(c(3)).toContain("faq_nombre");
    expect(c(7)).toContain("faq_nombre");
    expect(c(6)).not.toContain("faq_nombre");
  });
  it("FAQ redondante avec un H2 ou entre questions", () => {
    const a = bon();
    const r1 = verifierRegles({ ...a, faq: [...a.faq, { q: "Pourquoi un audit IA ?" }] }, BRIEF);
    expect(r1.map((p) => p.code)).toContain("faq_redondante");
    const r2 = verifierRegles({ ...a, faq: [...a.faq, { q: "Quelle durée prévoir ?" }] }, BRIEF);
    expect(r2.map((p) => p.code)).toContain("faq_redondante");
  });
  it("entité du brief absente", () => {
    const r = verifierRegles(bon(), { ...BRIEF, entites: ["Lyon", "Zzzville"] });
    expect(r.find((p) => p.code === "entite_absente")?.message).toContain("Zzzville");
  });
});

describe("appliquerRemplacements", () => {
  it("applique un remplacement unique", () => {
    const r = appliquerRemplacements(bon(), [
      { champ: "h1", ancien: "le guide", nouveau: "le guide complet" },
    ]);
    expect(r.article.h1).toBe("Audit IA : le guide complet");
    expect(r.appliques).toHaveLength(1);
  });
  it("refuse introuvable, ambigu, identique et balise dangereuse", () => {
    const a = { ...bon(), corpsHtml: "<p>aa aa</p>" };
    const r = appliquerRemplacements(a, [
      { champ: "corpsHtml", ancien: "zzz", nouveau: "y" },
      { champ: "corpsHtml", ancien: "aa", nouveau: "b" },
      { champ: "corpsHtml", ancien: "<p>", nouveau: "<p>" },
      { champ: "corpsHtml", ancien: "<p>", nouveau: "<script>x</script>" },
    ]);
    expect(r.appliques).toHaveLength(0);
    expect(r.refuses.map((x) => x.raison)).toEqual([
      "ancien texte introuvable",
      "ancien texte ambigu (plusieurs occurrences)",
      "ancien identique au nouveau",
      "balise ou attribut dangereux",
    ]);
    expect(r.article).toEqual(a);
  });
  it("refuse une réécriture (plus de 25 % du corps)", () => {
    const a = bon();
    const r = appliquerRemplacements(a, [
      {
        champ: "corpsHtml",
        ancien: a.corpsHtml.slice(0, a.corpsHtml.length / 2),
        nouveau: "court",
      },
    ]);
    expect(r.appliques).toHaveLength(0);
    expect(r.refuses[0]?.raison).toContain("réécriture");
  });
  it("plafonne à 12 remplacements", () => {
    const corps = Array.from({ length: 15 }, (_, i) => `<p>u${i}v</p>`).join("");
    const a = { ...bon(), corpsHtml: corps + "x".repeat(2000) };
    const r = appliquerRemplacements(
      a,
      Array.from({ length: 15 }, (_, i) => ({
        champ: "corpsHtml" as const,
        ancien: `u${i}v`,
        nouveau: `w${i}w`,
      })),
    );
    expect(r.appliques).toHaveLength(12);
    expect(r.refuses).toHaveLength(3);
  });
});

describe("editerSeo", () => {
  const reponse = (output: string) => ({
    provider: "anthropic" as const,
    model: "claude-sonnet-5-5",
    output,
    tokensInput: 1,
    tokensOutput: 1,
    costUsd: 0.01,
    durationMs: 1,
  });

  it("interrupteur éteint : article rendu tel quel, aucun appel", async () => {
    const generer = vi.fn();
    const a = { ...bon(), metaTitre: "court" };
    const r = await editerSeo({ jobId: "j", article: a, brief: BRIEF }, { generer, env: {} });
    expect(r.statut).toBe("desactive");
    expect(r.article).toBe(a);
    expect(generer).not.toHaveBeenCalled();
  });
  it("article conforme : aucun appel", async () => {
    const generer = vi.fn();
    const r = await editerSeo({ jobId: "j", article: bon(), brief: BRIEF }, { generer, env: ON });
    expect(r.statut).toBe("conforme");
    expect(generer).not.toHaveBeenCalled();
  });
  it("demande Sonnet par la porte existante et applique les remplacements", async () => {
    const a = { ...bon(), metaTitre: "audit ia court" };
    const nouveau = caracteres(55);
    const generer = vi.fn(async (_req: unknown, _role: string) =>
      reponse(
        JSON.stringify({
          remplacements: [{ champ: "metaTitre", ancien: "audit ia court", nouveau }],
        }),
      ),
    );
    const r = await editerSeo({ jobId: "j", article: a, brief: BRIEF }, { generer, env: ON });
    expect(generer).toHaveBeenCalledTimes(1);
    expect(generer.mock.calls[0]?.[1]).toBe("ecriture");
    expect(r.statut).toBe("corrige");
    if (r.statut === "corrige") {
      expect(r.article.metaTitre).toBe(nouveau);
      expect(r.problemesRestants.map((p) => p.code)).not.toContain("meta_titre_longueur");
      expect(r.coutUsd).toBe(0.01);
    }
  });
  it("réponse invalide ou erreur du modèle : article inchangé", async () => {
    const a = { ...bon(), metaTitre: "court" };
    const r1 = await editerSeo(
      { jobId: "j", article: a, brief: BRIEF },
      { generer: async () => reponse("pas du json"), env: ON },
    );
    expect(r1.statut).toBe("echec");
    expect(r1.article).toBe(a);
    const r2 = await editerSeo(
      { jobId: "j", article: a, brief: BRIEF },
      {
        generer: async () => {
          throw new Error("down");
        },
        env: ON,
      },
    );
    expect(r2.statut).toBe("echec");
    // Une réécriture complète (clé inconnue) est refusée par le schéma strict.
    const r3 = await editerSeo(
      { jobId: "j", article: a, brief: BRIEF },
      { generer: async () => reponse(JSON.stringify({ corpsHtml: "<p>tout</p>" })), env: ON },
    );
    expect(r3.statut).toBe("echec");
  });
});
