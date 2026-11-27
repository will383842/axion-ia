import { describe, expect, it } from "vitest";
import { CompteurCout, type AppelModele, type SourceLue } from "./commun";
import type { FaitSource } from "./collecteur-faits";
import { verifierFaits, type EntreeVerification } from "./verificateur-faits";

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

const PHRASE = "En 2025, 14 % des PME ont utilisé l'IA.";
const entree = (o: Partial<EntreeVerification> = {}): EntreeVerification => ({
  directAnswer: "Beaucoup de PME utilisent déjà l'IA aujourd'hui, sans bruit.",
  bodyHtml: `<h2>Combien de PME ?</h2><p>${PHRASE} Le reste attend.</p>`,
  faq: [],
  faits,
  testerLien: async () => ({ statut: 200, urlFinale: "https://www.insee.fr/fr/statistiques/1" }),
  ...o,
});

const ligne = (o: Record<string, unknown> = {}) => ({
  affirmation: PHRASE,
  section: 0,
  verdict: "confirme",
  sourceUrl: "https://www.insee.fr/fr/statistiques/1",
  extrait: "En 2025, 14 % des PME de 10 salariés ou plus ont utilisé l'IA",
  ...o,
});

const sources: SourceLue[] = [
  {
    url: "https://www.insee.fr/fr/statistiques/1",
    titre: "Insee",
    texte: "En 2025, 14 % des PME de 10 salariés ou plus ont utilisé l'IA",
  },
];
const appelant =
  (affirmations: unknown[], src: SourceLue[] = sources): AppelModele =>
  async () => ({
    texte: JSON.stringify({ affirmations }),
    coutUsd: 0.3,
    sources: src,
  });

describe("verifierFaits (R6)", () => {
  it("vérifié quand chaque affirmation chiffrée est confirmée par une source du dossier", async () => {
    const r = await verifierFaits(entree(), appelant([ligne()]), new CompteurCout());
    expect(r).toMatchObject({ verdict: "verifie", corrections: [], codeRefus: null });
  });

  it("fail-closed : une phrase chiffrée absente du tableau du modèle est à retirer", async () => {
    const r = await verifierFaits(entree(), appelant([]), new CompteurCout());
    if (r.verdict === "illisible") throw new Error();
    expect(r.verdict).toBe("a_corriger");
    expect(r.tableau[0]).toMatchObject({ verdict: "a_retirer", motif: "non_examinee" });
    expect(r.codeRefus).toBe("chiffre_retire");
  });

  it("« confirme » sans source du dossier ou lue par l'outil est rétrogradé en a_retirer", async () => {
    const r = await verifierFaits(
      entree(),
      appelant([ligne({ sourceUrl: "https://inventee.fr/x" })]),
      new CompteurCout(),
    );
    if (r.verdict === "illisible") throw new Error();
    expect(r.tableau[0]).toMatchObject({ verdict: "a_retirer", motif: "source_non_reconnue" });
  });

  it("« confirme » dont l'extrait est introuvable dans la source est rétrogradé", async () => {
    const r = await verifierFaits(
      entree(),
      appelant([ligne({ extrait: "une phrase qui n'est nulle part dans la source lue" })]),
      new CompteurCout(),
    );
    if (r.verdict === "illisible") throw new Error();
    expect(r.tableau[0]).toMatchObject({ verdict: "a_retirer", motif: "extrait_introuvable" });
  });

  it("a_retirer et a_nuancer deviennent des corrections localisées ; un chiffre sans source retourne en réécriture", async () => {
    const r = await verifierFaits(
      entree(),
      appelant([ligne({ verdict: "a_nuancer", sourceUrl: null, extrait: null })]),
      new CompteurCout(),
    );
    if (r.verdict === "illisible") throw new Error();
    expect(r.verdict).toBe("a_corriger");
    expect(r.corrections[0]).toMatchObject({ section: 0 });
  });

  it("une affirmation non chiffrée peut être absente du tableau sans bloquer", async () => {
    const r = await verifierFaits(
      entree({
        bodyHtml:
          "<h2>Pourquoi ?</h2><p>Les équipes gagnent du temps sur les tâches répétitives.</p>",
      }),
      appelant([]),
      new CompteurCout(),
    );
    expect(r.verdict).toBe("verifie");
  });

  it("teste les liens sortants : 404, redirection vers un autre domaine ou erreur = lien_mort", async () => {
    const lien = (u: string) => `<h2>Combien ?</h2><p>${PHRASE} <a href="${u}">source</a></p>`;
    const mort = await verifierFaits(
      entree({
        bodyHtml: lien("https://www.insee.fr/mort"),
        testerLien: async () => ({ statut: 404, urlFinale: "https://www.insee.fr/mort" }),
      }),
      appelant([ligne()]),
      new CompteurCout(),
    );
    expect(mort).toMatchObject({ verdict: "a_corriger", codeRefus: "lien_mort" });
    const redir = await verifierFaits(
      entree({
        bodyHtml: lien("https://www.insee.fr/x"),
        testerLien: async () => ({ statut: 200, urlFinale: "https://autre-site.com/promo" }),
      }),
      appelant([ligne()]),
      new CompteurCout(),
    );
    expect(redir).toMatchObject({ verdict: "a_corriger", codeRefus: "lien_mort" });
    const err = await verifierFaits(
      entree({
        bodyHtml: lien("https://www.insee.fr/x"),
        testerLien: async () => {
          throw new Error("réseau");
        },
      }),
      appelant([ligne()]),
      new CompteurCout(),
    );
    expect(err).toMatchObject({ verdict: "a_corriger", codeRefus: "lien_mort" });
  });

  it("ne teste pas les liens internes", async () => {
    let appels = 0;
    const r = await verifierFaits(
      entree({
        bodyHtml: `<h2>Combien ?</h2><p>${PHRASE} <a href="/fr/contact">Diagnostic</a></p>`,
        testerLien: async () => {
          appels++;
          return { statut: 200, urlFinale: "" };
        },
      }),
      appelant([ligne()]),
      new CompteurCout(),
    );
    expect(appels).toBe(0);
    expect(r.verdict).toBe("verifie");
  });

  it("utilise Sonnet avec les outils web, et traite l'article comme une donnée", async () => {
    let vu: { modele: string; outils?: readonly string[]; user: string } | null = null;
    const appel: AppelModele = async (req) => {
      vu = req;
      return { texte: JSON.stringify({ affirmations: [ligne()] }), coutUsd: 0.3, sources };
    };
    await verifierFaits(entree(), appel, new CompteurCout());
    expect(vu!.modele).toBe("claude-sonnet-5-5");
    expect(vu!.outils).toEqual(["web_search", "web_fetch"]);
    expect(vu!.user).toContain("<donnees_non_fiables");
  });

  it("rejette une sortie illisible", async () => {
    const bad: AppelModele = async () => ({ texte: "ok je pense", coutUsd: 0.1 });
    expect((await verifierFaits(entree(), bad, new CompteurCout())).verdict).toBe("illisible");
  });
  it("une affirmation géante qui couvre tout l'article ne vérifie pas les phrases chiffrées", async () => {
    const e = entree({
      bodyHtml: `<h2>Combien ?</h2><p>${PHRASE} Le décret 2025-12 impose 42 % de plus.</p>`,
    });
    const geante = ligne({
      affirmation: `${PHRASE} Le décret 2025-12 impose 42 % de plus.`,
      extrait: "En 2025, 14 % des PME de 10 salariés ou plus ont utilisé l'IA",
    });
    const r = await verifierFaits(e, appelant([geante]), new CompteurCout());
    if (r.verdict === "illisible") throw new Error();
    expect(r.verdict).toBe("a_corriger");
  });

  it("un « confirme » dont un chiffre est absent de l'extrait est rétrogradé", async () => {
    const r = await verifierFaits(
      entree(),
      appelant([ligne({ affirmation: "En 2025, 87 % des PME ont utilisé l'IA." })]),
      new CompteurCout(),
    );
    if (r.verdict === "illisible") throw new Error();
    expect(r.verdict).toBe("a_corriger");
  });

  it("ne teste jamais un hôte interne (SSRF) et lit les liens entre apostrophes", async () => {
    let appels = 0;
    const r = await verifierFaits(
      entree({
        bodyHtml: `<h2>Combien ?</h2><p>${PHRASE} <a href='http://localhost:8080/x'>a</a> <a href="http://10.0.0.1/y">b</a></p>`,
        testerLien: async () => {
          appels++;
          return { statut: 200, urlFinale: "" };
        },
      }),
      appelant([ligne()]),
      new CompteurCout(),
    );
    expect(appels).toBe(0);
    if (r.verdict === "illisible") throw new Error();
    expect(r.liensMorts).toHaveLength(2);
  });

  it("une affirmation partielle qui omet le chiffre de la phrase ne la confirme pas", async () => {
    const phrase = "Selon l'Insee, 45 % des PME utilisent l'IA générative au quotidien en 2025.";
    const r = await verifierFaits(
      entree({ bodyHtml: `<h2>Combien ?</h2><p>${phrase}</p>` }),
      appelant([
        ligne({
          affirmation: "des PME utilisent l'IA générative au quotidien en 2025.",
          extrait: "En 2025, 14 % des PME de 10 salariés ou plus ont utilisé l'IA",
        }),
      ]),
      new CompteurCout(),
    );
    if (r.verdict === "illisible") throw new Error();
    expect(r.verdict).toBe("a_corriger");
  });

  it("une statistique écrite en lettres est une phrase vérifiable", async () => {
    const r = await verifierFaits(
      entree({ bodyHtml: "<h2>Combien ?</h2><p>Huit PME sur dix gagnent du temps.</p>" }),
      appelant([]),
      new CompteurCout(),
    );
    if (r.verdict === "illisible") throw new Error();
    expect(r.tableau[0]).toMatchObject({ verdict: "a_retirer", motif: "non_examinee" });
  });

  it("un extrait trop court ne confirme rien ; un lien mort est localisé à sa section", async () => {
    const court = await verifierFaits(
      entree(),
      appelant([ligne({ extrait: "PME" })]),
      new CompteurCout(),
    );
    if (court.verdict === "illisible") throw new Error();
    expect(court.tableau[0]).toMatchObject({ verdict: "a_retirer" });
    const lien = await verifierFaits(
      entree({
        bodyHtml: `<h2>Combien ?</h2><p>${PHRASE} <a href="https://www.insee.fr/mort">s</a></p>`,
        testerLien: async () => ({ statut: 404, urlFinale: "https://www.insee.fr/mort" }),
      }),
      appelant([ligne()]),
      new CompteurCout(),
    );
    if (lien.verdict === "illisible") throw new Error();
    expect(lien.corrections.find((c) => c.probleme.includes("lien mort"))?.section).toBe(0);
  });

  it("refuse les noms résolvant vers une adresse interne (nip.io)", async () => {
    const { hotePublic } = await import("./verificateur-faits");
    expect(hotePublic("http://127.0.0.1.nip.io/x")).toBe(false);
    expect(hotePublic("https://www.insee.fr/x")).toBe(true);
  });
});
