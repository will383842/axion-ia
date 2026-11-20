/**
 * Point bloquant 1 de `geo/relectures/RELECTURE-CORRECTIFS-ESSAI-2.md` (axion-plans-prive, 20/11/2026) :
 *  - voie 1 : le filet « valeur finale » (porte 2) ne contrôle que les contenus du BLOG, jamais les offres ;
 *  - voie 2 : « conservé sur décision » — un faux positif du blog est gardé tel quel, sur décision écrite
 *    (`admis`), sous quatre conditions.
 * Et remarques non bloquantes 1 (doublons de citation) et 2 (terme budgétaire cité).
 * Chaque test rougit si la correction qu'il vise est retirée.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  type LigneOffre,
  type LigneTraduction,
  type Overrides,
  SLUGS_OFFRES_ARCHIVEES,
  ambigusNonCouverts,
  appliquerOverrides,
  empreinte,
  empreintePlan,
  integrerOverrides,
  proposerArticle,
  proposerFaq,
  proposerOffre,
  proposerTraduction,
  refuserSiAmbigus,
} from "./plan";
import { LEXIQUE_DUR, termesRefuses } from "./porte2";
import { construireRapport } from "./rapport";
import { reecrireTexte } from "./regles";

// ───────────────────────────── voie 1 : les offres d'emploi sortent du filet ─────────────────────────────

const DOSSIER = path.join(process.cwd(), "careers-gen");
const offres = fs
  .readdirSync(DOSSIER)
  .filter((f) => f.endsWith(".json") && f !== "careers-images.json")
  .map((f) => f.replace(/\.json$/, ""))
  .filter((slug) => !SLUGS_OFFRES_ARCHIVEES.includes(slug));

interface Graine {
  titleFr: string;
  summaryFr: string;
  bodyFrHtml: string;
  metaTitle: string;
  metaDescription: string;
}

/** Même correspondance que `scripts/seed-careers-offers.ts` (anglais = français, texte brut dérivé). */
function ligneOffre(slug: string): LigneOffre {
  const c = JSON.parse(fs.readFileSync(path.join(DOSSIER, `${slug}.json`), "utf8")) as Graine;
  const brut = c.bodyFrHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    id: "00000000-0000-4000-8000-0000000000b1",
    slug,
    status: "published",
    titleFr: c.titleFr,
    titleEn: c.titleFr,
    summaryFr: c.summaryFr,
    summaryEn: c.summaryFr,
    bodyFr: c.bodyFrHtml,
    bodyEn: c.bodyFrHtml,
    bodyJsonFr: null,
    bodyJsonEn: null,
    bodyTextFr: brut,
    bodyTextEn: brut,
    metaTitle: c.metaTitle,
    metaDescription: c.metaDescription,
  };
}

describe("voie 1 — le filet « valeur finale » ne contrôle pas les offres d'emploi", () => {
  it("le dossier careers-gen porte bien les offres actives", () =>
    expect(offres.length).toBeGreaterThan(30));

  it.each(offres)("proposerOffre(%s) → null (ni modification, ni ambigu)", (slug) => {
    expect(proposerOffre(ligneOffre(slug))).toBeNull();
  });

  it("les 4 offres signalées à tort par la relecture portent bien un mot que la porte 2 refuse", () => {
    // Sans cela, le test ci-dessus ne prouverait rien : il serait vert avec ou sans le drapeau.
    const c = ligneOffre("comptable-raf");
    expect(termesRefuses(c.titleFr)).toEqual(["financier"]);
  });

  it("le moteur continue de traiter une offre : une phrase visée reste signalée", () => {
    const p = proposerOffre({
      ...ligneOffre("comptable-raf"),
      summaryFr: "Vous pouvez mobiliser votre OPCO pour cet atelier animé par nos experts.",
    });
    expect(p?.ambigus).toHaveLength(1);
    expect(p?.ambigus[0]).toContain("summaryFr : phrase mixte");
  });
});

const PHRASE_FILET =
  "Un organisme non certifié peut proposer une formation de qualité, mais le financement public sera impossible.";

const traduction = (surcharge: Partial<LigneTraduction> = {}): LigneTraduction => ({
  id: "00000000-0000-4000-8000-0000000000c1",
  locale: "fr",
  title: "Formation IA",
  excerpt: null,
  body: "<p>Bonjour.</p>",
  bodyJson: null,
  bodyText: "Bonjour.",
  metaTitle: null,
  metaDescription: null,
  ogImageAlt: null,
  ...surcharge,
});

describe("voie 1 — le filet reste actif sur les trois contenus du blog", () => {
  it("proposerTraduction", () => {
    const p = proposerTraduction(traduction({ excerpt: PHRASE_FILET }));
    expect(p?.ambigus).toHaveLength(1);
    expect(p?.ambigus[0]).toContain("excerpt : mention restante (porte 2 : financement)");
  });

  it("proposerArticle", () => {
    const p = proposerArticle({
      id: "00000000-0000-4000-8000-0000000000c2",
      directAnswer: PHRASE_FILET,
      faqJson: null,
      keyTakeaway: null,
      expertQuoteText: null,
      featuredImageAltFr: null,
      featuredImageAltEn: null,
    });
    expect(p?.ambigus).toHaveLength(1);
    expect(p?.ambigus[0]).toContain("directAnswer : mention restante (porte 2 : financement)");
  });

  it("proposerFaq", () => {
    const p = proposerFaq({
      id: "00000000-0000-4000-8000-0000000000c3",
      questionFr: "Quelle durée ?",
      answerFr: "Deux jours.",
      questionEn: "How long?",
      answerEn: "Two days.",
      metaTitle: null,
      metaDescription: PHRASE_FILET,
    });
    expect(p?.ambigus).toHaveLength(1);
    expect(p?.ambigus[0]).toContain("metaDescription : mention restante (porte 2 : financement)");
  });
});

// ───────────────────────────── voie 2 : « conservé sur décision » ─────────────────────────────

/** Forme refusée par la porte 2 et citée par la relecture (« services financiers »). */
const SERVICES = "Un atelier conçu pour les services financiers et les équipes RH.";
/** Rapport v2, l. 4690 : faux positif repéré par la relecture. */
const EQUIPES =
  "La formation à cette approche est particulièrement pertinente pour les équipes juridiques, RH et financières.";

const CLE = "article_translation:00000000-0000-4000-8000-0000000000c1";

function jouer(ligne: LigneTraduction, overrides: Overrides) {
  const p = proposerTraduction(ligne);
  if (!p) throw new Error("proposition attendue");
  return {
    avant: p,
    ...appliquerOverrides(p, ligne as unknown as Record<string, unknown>, overrides),
  };
}

describe("voie 2 — une entrée { origine, valeur, admis } conserve un faux positif du blog", () => {
  it("« services financiers » conservé avec admis : plus d'ambigu, rien d'écrit, apply possible", () => {
    const ligne = traduction({ excerpt: SERVICES });
    const r = jouer(ligne, {
      [CLE]: { excerpt: { origine: empreinte(SERVICES), valeur: SERVICES, admis: ["financiers"] } },
    });
    expect(r.avant.ambigus).toHaveLength(1);
    expect(r.ignores).toEqual([]);
    expect(r.proposition.ambigus).toEqual([]);
    expect(r.proposition.apres).toEqual({});
    expect(r.proposition.surcharges ?? []).toEqual([]);
    expect(r.proposition.conservesSurDecision).toEqual({ excerpt: ["financiers"] });
    expect(() => refuserSiAmbigus([r.proposition], null)).not.toThrow();
    // Rien n'est écrit : l'empreinte du plan est celle d'un plan sans cette ligne.
    expect(empreintePlan([r.proposition])).toBe(empreintePlan([]));
  });

  it("phrase réelle du rapport v2 (« équipes juridiques, RH et financières ») conservée", () => {
    const ligne = traduction({ excerpt: EQUIPES });
    const r = jouer(ligne, {
      [CLE]: { excerpt: { origine: empreinte(EQUIPES), valeur: EQUIPES, admis: ["financières"] } },
    });
    expect(r.ignores).toEqual([]);
    expect(r.proposition.ambigus).toEqual([]);
  });

  it("le rapport liste le champ dans « Conservés sur décision du dirigeant »", () => {
    const ligne = traduction({ excerpt: SERVICES });
    const r = jouer(ligne, {
      [CLE]: { excerpt: { origine: empreinte(SERVICES), valeur: SERVICES, admis: ["financiers"] } },
    });
    const rapport = construireRapport("dry-run", [r.proposition], r.ignores, "sha");
    expect(rapport).toContain("## Conservés sur décision du dirigeant");
    expect(rapport).toContain(`- \`${CLE}\` · excerpt : termes admis : financiers`);
    expect(rapport).toContain("Aucun ambigu restant");
    // Sans conservation, la section n'existe pas.
    expect(construireRapport("dry-run", [r.avant], [], "sha")).not.toContain(
      "Conservés sur décision",
    );
  });

  it("refus si valeur ≠ origine : `admis` ne sert jamais à faire passer un texte réécrit", () => {
    const ligne = traduction({ excerpt: SERVICES });
    const autre = "Un atelier conçu pour les services financiers.";
    const r = jouer(ligne, {
      [CLE]: { excerpt: { origine: empreinte(SERVICES), valeur: autre, admis: ["financiers"] } },
    });
    expect(r.ignores).toHaveLength(1);
    expect(r.ignores[0]).toContain("valeur différente de l'original");
    expect(r.proposition.ambigus).toHaveLength(1);
    expect(r.proposition.apres).toEqual({});
    expect(r.proposition.conservesSurDecision).toBeUndefined();
    expect(() => refuserSiAmbigus([r.proposition], null)).toThrow(/REFUSÉ/);
  });

  it("refus si l'empreinte d'origine ne correspond pas", () => {
    const ligne = traduction({ excerpt: SERVICES });
    const r = jouer(ligne, {
      [CLE]: { excerpt: { origine: empreinte("autre"), valeur: SERVICES, admis: ["financiers"] } },
    });
    expect(r.ignores[0]).toContain("empreinte");
    expect(r.proposition.ambigus).toHaveLength(1);
  });

  it("refus si un ambigu du moteur reste sur le champ", () => {
    const valeur = `${SERVICES} Vous pouvez mobiliser votre atout pour cet atelier animé par nos experts via France Travail.`;
    const ligne = traduction({ excerpt: valeur });
    const p = proposerTraduction(ligne);
    // Le champ porte un ambigu du moteur ET un ambigu de porte 2.
    expect(p?.ambigus.some((a) => !a.includes("mention restante (porte 2 : "))).toBe(true);
    expect(p?.ambigus.some((a) => a.includes("mention restante (porte 2 : financiers)"))).toBe(
      true,
    );
    const r = jouer(ligne, {
      [CLE]: {
        excerpt: { origine: empreinte(valeur), valeur, admis: ["financiers", "France Travail"] },
      },
    });
    expect(r.ignores).toHaveLength(1);
    expect(r.proposition.ambigus).toEqual(r.avant.ambigus);
    expect(r.proposition.conservesSurDecision).toBeUndefined();
  });

  it("refus si le seul ambigu du champ vient du moteur (« mention restante après retrait d'un fragment »)", () => {
    const valeur =
      "Choisissez un format adapté (1 à 3 jours), mobilisez les financements disponibles (OPCO, CPF), puis pilotez l'adoption avec des indicateurs concrets sur 90 jours.";
    const ligne = traduction({ excerpt: valeur });
    const r = jouer(ligne, {
      [CLE]: {
        excerpt: { origine: empreinte(valeur), valeur, admis: ["financements", "OPCO", "CPF"] },
      },
    });
    expect(r.ignores).toHaveLength(1);
    expect(r.proposition.ambigus).toEqual(r.avant.ambigus);
  });

  it("refus si le seul ambigu du champ est une « forme non prouvée » du moteur, sans aucun mot du lexique dur", () => {
    // Phrase de l'audit (`…4c00c158`, « finançable et mesurable ») : visée par le MOTEUR, ce n'est pas un faux positif.
    const valeur = "Notre atelier, finançable et mesurable, est animé par nos experts.";
    const ligne = traduction({ excerpt: valeur });
    const r = jouer(ligne, {
      [CLE]: { excerpt: { origine: empreinte(valeur), valeur, admis: ["finançable"] } },
    });
    expect(r.avant.ambigus).toHaveLength(1);
    expect(r.avant.ambigus[0]).toContain("forme non prouvée");
    expect(r.ignores).toHaveLength(1);
    expect(r.ignores[0]).toContain("un ambigu du moteur reste sur ce champ");
    expect(r.proposition.ambigus).toEqual(r.avant.ambigus);
    expect(r.proposition.conservesSurDecision).toBeUndefined();
  });

  it("refus si le moteur réécrit le champ : conserver l'original annulerait sa réécriture", () => {
    const valeur = "Atelier IA (financement) pour les services financiers.";
    const ligne = traduction({ excerpt: valeur });
    const r = jouer(ligne, {
      [CLE]: {
        excerpt: { origine: empreinte(valeur), valeur, admis: ["financement", "financiers"] },
      },
    });
    // Le moteur retire « (financement) » ; le filet signale « financiers » dans la valeur réécrite.
    expect(r.avant.apres.excerpt).toBe("Atelier IA pour les services financiers.");
    expect(r.avant.ambigus).toHaveLength(1);
    expect(r.ignores).toHaveLength(1);
    expect(r.ignores[0]).toContain("le moteur réécrit ce champ");
    expect(r.proposition.ambigus).toHaveLength(1);
    expect(r.proposition.conservesSurDecision).toBeUndefined();
  });

  it("refus si admis contient « OPCO » (lexique dur), même quand la valeur n'en contient pas", () => {
    const ligne = traduction({ excerpt: SERVICES });
    const r = jouer(ligne, {
      [CLE]: {
        excerpt: { origine: empreinte(SERVICES), valeur: SERVICES, admis: ["financiers", "OPCO"] },
      },
    });
    expect(r.ignores).toHaveLength(1);
    expect(r.ignores[0]).toContain("lexique dur");
    expect(r.proposition.ambigus).toHaveLength(1);
  });

  it.each([
    ["OPCO", "Le financement passe par votre OPCO."],
    ["CPF", "Parcours éligible au CPF."],
    ["France Travail", "Un appui de France Travail est possible."],
    ["AIF", "Dossier AIF à monter."],
    ["EDOF", "Inscription sur EDOF."],
    ["Qualiopi", "Organisme certifié Qualiopi."],
    ["subrogation", "La subrogation de paiement est possible."],
    ["FNE", "Le FNE-Formation couvre ce parcours."],
    [
      "plan de développement des compétences",
      "À inscrire au plan de développement des compétences.",
    ],
  ])("le lexique dur refuse « %s », même admis mot pour mot", (_mot, phrase) => {
    expect(LEXIQUE_DUR.test(phrase)).toBe(true);
    // Quel que soit l'ambigu levé par le moteur ou par la porte 2, aucune conservation n'est possible.
    const ligne = traduction({ excerpt: phrase });
    const p = proposerTraduction(ligne);
    expect(p).not.toBeNull();
    const r = appliquerOverrides(p!, ligne as unknown as Record<string, unknown>, {
      [CLE]: {
        excerpt: { origine: empreinte(phrase), valeur: phrase, admis: termesRefuses(phrase) },
      },
    });
    expect(r.ignores).toHaveLength(1);
    expect(r.proposition.ambigus).toEqual(p!.ambigus);
    expect(r.proposition.conservesSurDecision).toBeUndefined();
  });

  it("refus si un terme refusé par la porte 2 manque dans admis (il est nommé)", () => {
    const valeur = `${SERVICES} Un gain financier mesurable.`;
    const ligne = traduction({ excerpt: valeur });
    const r = jouer(ligne, {
      [CLE]: { excerpt: { origine: empreinte(valeur), valeur, admis: ["financiers"] } },
    });
    expect(r.ignores).toHaveLength(1);
    expect(r.ignores[0]).toContain("absent(s) de admis (financier)");
    expect(r.proposition.ambigus).toHaveLength(2);
    // Les deux termes admis : conservé.
    const ok = jouer(ligne, {
      [CLE]: {
        excerpt: { origine: empreinte(valeur), valeur, admis: ["financiers", "financier"] },
      },
    });
    expect(ok.ignores).toEqual([]);
    expect(ok.proposition.ambigus).toEqual([]);
  });

  it("refus si admis est vide ou mal formé", () => {
    const ligne = traduction({ excerpt: SERVICES });
    for (const admis of [[], [""], [12]] as unknown as string[][]) {
      const r = jouer(ligne, {
        [CLE]: { excerpt: { origine: empreinte(SERVICES), valeur: SERVICES, admis } },
      });
      expect(r.ignores).toHaveLength(1);
      expect(r.ignores[0]).toContain("admis doit lister au moins un terme");
      expect(r.proposition.ambigus).toHaveLength(1);
    }
  });

  it("refus sans rien à conserver : contenu sans proposition, ou champ sans ambigu de porte 2", () => {
    const propre = "Un atelier conçu pour les équipes RH.";
    const ligne = traduction({ excerpt: propre });
    expect(proposerTraduction(ligne)).toBeNull();
    const r = integrerOverrides(null, CLE, ligne as unknown as Record<string, unknown>, {
      [CLE]: { excerpt: { origine: empreinte(propre), valeur: propre, admis: ["financiers"] } },
    });
    expect(r.proposition).toBeNull();
    expect(r.ignores).toHaveLength(1);
    expect(r.ignores[0]).toContain("aucun ambigu de porte 2");
  });

  it("sans `admis`, rien ne change : la même valeur reste refusée par la porte 2", () => {
    const ligne = traduction({ excerpt: SERVICES });
    const r = jouer(ligne, {
      [CLE]: { excerpt: { origine: empreinte(SERVICES), valeur: SERVICES } },
    });
    expect(r.ignores).toHaveLength(1);
    expect(r.ignores[0]).toContain("interdit public");
    expect(r.proposition.ambigus).toHaveLength(1);
  });

  it("une conservation ne lève que les ambigus de SON champ", () => {
    const ligne = traduction({ excerpt: SERVICES, metaDescription: EQUIPES });
    const r = jouer(ligne, {
      [CLE]: { excerpt: { origine: empreinte(SERVICES), valeur: SERVICES, admis: ["financiers"] } },
    });
    expect(ambigusNonCouverts([r.proposition]).map((x) => x.champ)).toEqual(["metaDescription"]);
  });
});

describe("voie 2 — termesRefuses : TOUS les termes, pas seulement le premier", () => {
  it("un terme masqué par un autre (début de phrase + « en charge ») est quand même rendu", () => {
    expect(termesRefuses("Le financement prend en charge les frais.")).toEqual(
      expect.arrayContaining(["financement", "en charge + frais"]),
    );
  });

  it("les emplois de secteur admis par la porte 2 ne sont pas des termes refusés", () => {
    expect(termesRefuses("La finance et les directeurs financiers du secteur financier.")).toEqual(
      [],
    );
  });

  it("le terme est rendu en mot entier (lettres accentuées comprises)", () => {
    expect(termesRefuses(EQUIPES)).toEqual(["financières"]);
    expect(termesRefuses("Parcours éligible et cofinancé.")).toEqual(["éligible", "cofinancé"]);
  });
});

// ───────────────────────────── remarques non bloquantes 1 et 2 ─────────────────────────────

describe("remarque 1 — pas de doublon quand le moteur cite la phrase SANS le fragment retiré", () => {
  it("« Vous pouvez mobiliser votre OPCO (CPF)… » n'est cité qu'une fois", () => {
    const phrase = "Vous pouvez mobiliser votre OPCO (CPF) pour cet atelier animé par nos experts.";
    const p = proposerTraduction(traduction({ excerpt: phrase }));
    expect(p?.ambigus).toHaveLength(1);
    expect(p?.ambigus[0]).toContain("phrase mixte");
  });
});

describe("remarque 2 — « en charge » + terme budgétaire : le message cite le terme, pas le début de la phrase", () => {
  const phrase = "L'atelier est pris en charge par votre employeur.";

  it("filet « valeur finale »", () => {
    const p = proposerTraduction(traduction({ excerpt: phrase }));
    expect(p?.ambigus).toHaveLength(1);
    expect(p?.ambigus[0]).toContain(
      "mention restante (porte 2 : en charge + employeur) : « L'atelier",
    );
  });

  it("reste d'une phrase après retrait d'un fragment", () => {
    const r = reecrireTexte(
      "Le coût de la formation est pris en charge (OPCO) selon votre branche.",
      "fr",
    );
    const restante = r.ambigus.find((a) => a.startsWith("mention restante après retrait"));
    expect(restante).toContain("(porte 2 : en charge + formation)");
  });
});
