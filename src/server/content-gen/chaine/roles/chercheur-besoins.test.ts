import { describe, expect, it } from "vitest";
import { CompteurCout, type AppelModele } from "./commun";
import {
  contientDonneePersonnelle,
  proposerIntention,
  selectionnerBesoins,
  chercherBesoins,
  type BesoinPropose,
  type EntreeChercheur,
} from "./chercheur-besoins";

const entree = (o: Partial<EntreeChercheur> = {}): EntreeChercheur => ({
  questionsDirigeants: [
    { question: "Comment automatiser les notes de frais dans une PME ?", reference: "liste Will" },
    {
      question: "Par où commencer avec l'IA quand on est seul dirigeant ?",
      reference: "liste Will",
    },
  ],
  themesAgreges: [{ theme: "formation des équipes à l'IA", nombre: 7, sur: 20 }],
  searchConsole: null,
  pagesLues: [
    {
      url: "https://forum.fr/t/1",
      titre: "Forum",
      texte: "Quelqu'un sait si une facture électronique est obligatoire pour une TPE ?",
    },
  ],
  urlCouvrante: () => null,
  ...o,
});

const brut = (o: Record<string, unknown>) => ({
  question: "Comment automatiser les notes de frais dans une PME ?",
  source: "dirigeant-pme",
  sourceRef: "liste Will",
  intention: "information",
  profil: "pme",
  force: 4,
  ...o,
});
const appelant =
  (besoins: unknown[]): AppelModele =>
  async () => ({ texte: JSON.stringify({ besoins }), coutUsd: 0.05 });

describe("chercherBesoins (R1)", () => {
  it("classe les besoins fournis, avec source, intention et profil", async () => {
    const r = await chercherBesoins(
      entree(),
      appelant([
        brut({}),
        brut({
          question: "Par où commencer avec l'IA quand on est seul dirigeant ?",
          profil: "tpe",
          force: 3,
        }),
      ]),
      new CompteurCout(),
    );
    expect(r.besoins).toHaveLength(2);
    expect(r.besoins[0]).toMatchObject({
      source: "dirigeant-pme",
      statut: "nouveau",
      profil: "pme",
    });
  });

  it("affiche la Search Console « indisponible » tant qu'elle est nulle (null n'est pas 0)", async () => {
    const r = await chercherBesoins(entree(), appelant([]), new CompteurCout());
    expect(r.sourcesIndisponibles).toContain("search-console");
    const avec = await chercherBesoins(
      entree({ searchConsole: [] }),
      appelant([]),
      new CompteurCout(),
    );
    expect(avec.sourcesIndisponibles).not.toContain("search-console");
  });

  it("n'invente aucune question : une question absente des sources est rejetée", async () => {
    const r = await chercherBesoins(
      entree(),
      appelant([brut({ question: "Une question sortie de nulle part ?" })]),
      new CompteurCout(),
    );
    expect(r.besoins).toEqual([]);
    expect(r.rejetes).toEqual([
      { question: "Une question sortie de nulle part ?", raison: "source_introuvable" },
    ]);
  });

  it("accepte une question d'une page réellement lue, avec son URL ; refuse si absente du texte", async () => {
    const ok = brut({
      question: "une facture électronique est obligatoire pour une TPE ?",
      source: "page-lue",
      sourceRef: "https://forum.fr/t/1",
      profil: "tpe",
    });
    const r = await chercherBesoins(
      entree(),
      appelant([ok, { ...ok, question: "Question absente du texte ?" }]),
      new CompteurCout(),
    );
    expect(r.besoins.map((b) => b.question)).toEqual([
      "une facture électronique est obligatoire pour une TPE ?",
    ]);
  });

  it("marque couvert une requête déjà servie par une URL (une requête = une URL)", async () => {
    const r = await chercherBesoins(
      entree({ urlCouvrante: () => "https://axion-ia.com/fr/blog/x" }),
      appelant([brut({})]),
      new CompteurCout(),
    );
    expect(r.besoins[0]).toMatchObject({
      statut: "couvert",
      urlCouverte: "https://axion-ia.com/fr/blog/x",
    });
  });

  it("dédoublonne les questions identiques", async () => {
    const r = await chercherBesoins(
      entree(),
      appelant([
        brut({}),
        brut({ question: "comment automatiser les notes de frais dans une pme ?" }),
      ]),
      new CompteurCout(),
    );
    expect(r.besoins).toHaveLength(1);
  });

  it("écarte toute donnée personnelle (RGPD) : e-mail, téléphone, civilité + nom", async () => {
    expect(contientDonneePersonnelle("écrivez à jean@exemple.fr")).toBe(true);
    expect(contientDonneePersonnelle("appelez le 06 12 34 56 78")).toBe(true);
    expect(contientDonneePersonnelle("Mme Durand demande une facture")).toBe(true);
    expect(contientDonneePersonnelle("7 demandes sur 20 parlent de formation")).toBe(false);
    const r = await chercherBesoins(
      entree({
        themesAgreges: [{ theme: "Mme Durand, société X, demande un devis", nombre: 1, sur: 20 }],
      }),
      appelant([]),
      new CompteurCout(),
    );
    expect(r.rejetes.map((x) => x.raison)).toContain("donnee_personnelle");
  });

  it("propose (sans écarter) une intention hors article : prix, devis, ville", () => {
    expect(proposerIntention("Quel est le prix d'un audit IA ?")).toBe("transactional");
    expect(proposerIntention("Formation IA entreprise à Lyon")).toBe("local");
    expect(proposerIntention("axion ia contact")).toBe("navigational");
    expect(proposerIntention("Comment fixer ses prix avec l'IA ?")).toBeNull();
    expect(proposerIntention("Comment faire une veille tarifaire ?")).toBeNull();
  });

  it("emploie Sonnet, sans outil web, et rejette une sortie illisible sans lever", async () => {
    let vu: { modele: string; outils?: unknown; user: string } | null = null;
    const appel: AppelModele = async (req) => {
      vu = req;
      return { texte: "pas de json", coutUsd: 0.01 };
    };
    const r = await chercherBesoins(entree(), appel, new CompteurCout());
    expect(vu!.modele).toBe("claude-sonnet-5-5");
    expect(vu!.outils).toBeUndefined();
    expect(vu!.user).toContain("<donnees_non_fiables");
    expect(r.besoins).toEqual([]);
    expect(r.erreur).toMatch(/illisible/);
  });
});

describe("selectionnerBesoins : environ 80 % de PME et 20 % de TPE", () => {
  const b = (profil: "pme" | "tpe", force: number, i: number): BesoinPropose => ({
    question: `Question ${profil} ${i} ?`,
    source: "dirigeant-pme",
    sourceRef: "x",
    intention: "information",
    profil,
    force,
    statut: "nouveau",
    urlCouverte: null,
    intentionProposee: null,
  });
  const pool = [
    ...Array.from({ length: 12 }, (_, i) => b("pme", 5 - (i % 5), i)),
    ...Array.from({ length: 6 }, (_, i) => b("tpe", 5 - (i % 5), i)),
  ];
  it("tire 8 PME et 2 TPE sur 10, les plus fortes d'abord", () => {
    const r = selectionnerBesoins(pool, 10);
    expect(r.choisis).toHaveLength(10);
    expect(r.choisis.filter((x) => x.profil === "tpe")).toHaveLength(2);
    expect(r.choisis.filter((x) => x.profil === "pme")).toHaveLength(8);
    expect(r.ecart).toBe(false);
  });
  it("complète avec l'autre profil et signale l'écart quand un profil manque", () => {
    const r = selectionnerBesoins(
      pool.filter((x) => x.profil === "pme"),
      10,
    );
    expect(r.choisis).toHaveLength(10);
    expect(r.ecart).toBe(true);
  });
  it("ne retient que les besoins nouveaux", () => {
    const r = selectionnerBesoins([{ ...b("pme", 5, 1), statut: "couvert" }], 5);
    expect(r.choisis).toEqual([]);
  });
});
