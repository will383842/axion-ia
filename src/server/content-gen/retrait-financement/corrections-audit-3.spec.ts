/**
 * Corrections de l'audit Opus (3e passe). Chaque test échouait avant la correction.
 */
import { describe, expect, it } from "vitest";
import {
  ACTION_OVERRIDE,
  ACTION_RESTAURATION,
  ACTION_RESTAURATION_OVERRIDE,
  ACTION_RETRAIT,
  type Champs,
  type Overrides,
  appliquerOverrides,
  ambigusNonCouverts,
  empreinte,
  integrerOverrides,
  proposerFaq,
  proposerOffre,
  proposerTraduction,
  refuserSiAmbigus,
} from "./plan";
import { type Depot, type LigneJournal, appliquer, restaurer } from "./ecriture";
import { construireRapport } from "./rapport";
import { htmlVersTexte, motsDe, reecrireHtml, reecrireTexte } from "./regles";

/** Tous les mots d'un texte : l'override accepte de les perdre (test des mécanismes, pas du lexique). */
const tousLesMots = (v: unknown): string[] => motsDe(htmlVersTexte(String(v)));

describe("1. FAQ : l'ambigu d'une RÉPONSE se range sous le champ réponse", () => {
  const faq = {
    id: "f1",
    questionFr: "Comment se déroule la formation ?",
    answerFr: "Le dossier OPCO dépend de la taille de l'entreprise.",
    questionEn: "How does it work?",
    answerEn: "Ok.",
    metaTitle: null,
    metaDescription: null,
  };
  it("l'ambigu est sous answerFr, pas sous questionFr", () => {
    const p = proposerFaq(faq)!;
    expect(p.ambigus.length).toBeGreaterThan(0);
    expect(p.ambigus.every((a) => a.startsWith("faq:f1.answerFr :"))).toBe(true);
  });
  it("override sur la question seule → apply toujours refusé", () => {
    const p = proposerFaq(faq)!;
    const o: Overrides = {
      [p.cle]: {
        questionFr: {
          origine: empreinte(faq.questionFr),
          valeur: "Comment se déroule la formation ?!",
        },
      },
    };
    const r = appliquerOverrides(p, faq as unknown as Champs, o);
    expect(() => refuserSiAmbigus([r.proposition], "x.json")).toThrow(/REFUSÉ/);
  });
  it("le rapport montre le texte complet de la réponse", () => {
    const p = proposerFaq(faq)!;
    expect(construireRapport("dry-run", [p], [], "sha")).toContain(
      "> Le dossier OPCO dépend de la taille de l'entreprise.",
    );
  });
  it("override sur la réponse → l'ambigu est levé", () => {
    const p = proposerFaq(faq)!;
    const o: Overrides = {
      [p.cle]: {
        answerFr: {
          origine: empreinte(faq.answerFr),
          valeur: "Cela dépend de l'entreprise.",
          pertesAcceptees: tousLesMots(faq.answerFr),
        },
      },
    };
    const r = appliquerOverrides(p, faq as unknown as Champs, o);
    expect(ambigusNonCouverts([r.proposition])).toHaveLength(0);
  });
});

describe("2. énumération coupée : rien de perdu, nombre devant la liste", () => {
  it("« Nos offres : audit, formation, financement OPCO et suivi. »", () => {
    expect(
      reecrireTexte("Nos offres : audit, formation, financement OPCO et suivi.", "fr").valeur,
    ).toBe("Nos offres : audit, formation et suivi.");
  });
  it("« Nos 4 offres : … » : décompte corrigé ou ambigu, jamais « et suivi » perdu", () => {
    const r = reecrireTexte("Nos 4 offres : audit, formation, financement OPCO et suivi.", "fr");
    if (r.ambigus.length > 0) expect(r.modifie).toBe(false);
    else expect(r.valeur).toBe("Nos 3 offres : audit, formation et suivi.");
  });
  it("nom absent de la liste connue (« Nos 4 gammes : … ») : corrigé ou ambigu", () => {
    const r = reecrireTexte("Nos 4 gammes : audit, formation, financement OPCO et suivi.", "fr");
    if (r.ambigus.length > 0) expect(r.modifie).toBe(false);
    else expect(r.valeur).toBe("Nos 3 gammes : audit, formation et suivi.");
  });
});

describe("3. liste de puces : « coût / budget » ne suffit pas à remplacer toute la liste", () => {
  it("seule la puce financée OPCO est retirée", () => {
    const html =
      "<p>Les avantages financiers :</p><ul><li>réduction des coûts</li><li>budget maîtrisé</li><li>financement OPCO</li></ul>";
    const r = reecrireHtml(html, "fr").valeur;
    expect(r).toContain("réduction des coûts");
    expect(r).toContain("budget maîtrisé");
    expect(r).not.toMatch(/OPCO/);
  });
  it("tarif, prix et € : la puce reste", () => {
    const html =
      "<p>Les avantages financiers :</p><ul><li>tarif unique</li><li>prix fixe, 900 €</li><li>prise en charge OPCO</li></ul>";
    const r = reecrireHtml(html, "fr").valeur;
    expect(r).toContain("tarif unique");
    expect(r).toContain("900 €");
    expect(r).not.toMatch(/OPCO/);
  });
});

describe("4. override sur le corps : bodyText recalculé", () => {
  const trad = {
    id: "t9",
    locale: "fr" as const,
    title: "Titre",
    excerpt: null,
    body: "<p>Le dossier OPCO dépend de la taille.</p>",
    bodyJson: null,
    bodyText: "Le dossier OPCO dépend de la taille.",
    metaTitle: null,
    metaDescription: null,
    ogImageAlt: null,
  };
  it("body → bodyText, sans le passage ambigu", () => {
    const p = proposerTraduction(trad)!;
    const valeur = "<p>Un texte propre.</p>";
    const r = appliquerOverrides(p, trad, {
      [p.cle]: {
        body: { origine: empreinte(trad.body), valeur, pertesAcceptees: tousLesMots(trad.body) },
      },
    });
    expect(r.proposition.apres.body).toBe(valeur);
    expect(r.proposition.apres.bodyText).toBe(htmlVersTexte(valeur));
    expect(r.proposition.avant.bodyText).toBe(trad.bodyText);
    expect(r.proposition.surcharges).toContain("bodyText");
  });
  it("offre : bodyFr → bodyTextFr", () => {
    const offre = {
      id: "o1",
      slug: "x",
      status: "published",
      titleFr: "Titre",
      titleEn: "Title",
      summaryFr: "Résumé.",
      summaryEn: "Summary.",
      bodyFr: "<p>Le dossier OPCO dépend de la taille.</p>",
      bodyEn: "<p>Body.</p>",
      bodyJsonFr: null,
      bodyJsonEn: null,
      bodyTextFr: "Le dossier OPCO dépend de la taille.",
      bodyTextEn: "Body.",
      metaTitle: null,
      metaDescription: null,
    };
    const p = proposerOffre(offre)!;
    const r = appliquerOverrides(p, offre, {
      [p.cle]: {
        bodyFr: {
          origine: empreinte(offre.bodyFr),
          valeur: "<p>Propre.</p>",
          pertesAcceptees: tousLesMots(offre.bodyFr),
        },
      },
    });
    expect(r.proposition.apres.bodyTextFr).toBe("Propre.");
  });
});

// ───────────── dépôt en mémoire (écriture / restauration) ─────────────

function depotMemoire(init: Record<string, Champs>) {
  const lignes: Record<string, Champs> = structuredClone(init);
  const journal: LigneJournal[] = [];
  let t = 1_000;
  const depot: Depot = {
    existe: async (a, c) => journal.some((l) => l.action === a && l.settingKey === c),
    existeApres: async (a, c, d) =>
      journal.some((l) => l.action === a && l.settingKey === c && l.createdAt > d),
    lignes: async (actions) => journal.filter((l) => actions.includes(l.action)),
    transaction: async (f) => {
      const copie = structuredClone(lignes);
      const nb = journal.length;
      try {
        return await f({
          lire: async (tb, id) => (lignes[`${tb}:${id}`] ? { ...lignes[`${tb}:${id}`]! } : null),
          ecrire: async (tb, id, champs) => {
            Object.assign(lignes[`${tb}:${id}`]!, structuredClone(champs));
          },
          journaliser: async (e) => {
            journal.push({ ...structuredClone(e), createdAt: new Date((t += 10)) });
          },
        });
      } catch (e) {
        for (const k of Object.keys(lignes)) delete lignes[k];
        Object.assign(lignes, copie);
        journal.length = nb;
        throw e;
      }
    },
  };
  return { depot, lignes, journal };
}

const CLE = "article_translation:t1";
const DEJA_TRAITE = {
  title: "Titre",
  body: "<p>Le dossier OPCO dépend de la taille.</p>",
  bodyText: "Le dossier OPCO dépend de la taille.",
  excerpt: null,
  bodyJson: null,
  metaTitle: null,
  metaDescription: null,
  ogImageAlt: null,
  locale: "fr",
};

describe("5. contenu déjà traité sans mention restante : l'override présent n'est pas abandonné", () => {
  const propre = { ...DEJA_TRAITE, body: "<p>Texte propre.</p>", bodyText: "Texte propre." };
  it("proposition null + override à empreinte valide → appliqué", () => {
    const o: Overrides = {
      [CLE]: {
        body: {
          origine: empreinte(propre.body),
          valeur: "<p>Mieux.</p>",
          pertesAcceptees: tousLesMots(propre.body),
        },
      },
    };
    const r = integrerOverrides(null, CLE, propre, o);
    expect(r.proposition?.apres.body).toBe("<p>Mieux.</p>");
    expect(r.proposition?.apres.bodyText).toBe("Mieux.");
    expect(r.ignores).toEqual([]);
  });
  it("empreinte d'origine différente → signalé « override ignoré », rien d'appliqué", () => {
    const o: Overrides = { [CLE]: { body: { origine: "autre", valeur: "<p>Mieux.</p>" } } };
    const r = integrerOverrides(null, CLE, propre, o);
    expect(r.proposition).toBeNull();
    expect(r.ignores.join("\n")).toMatch(/empreinte.*override ignoré/);
    expect(construireRapport("dry-run", [], r.ignores, "sha")).toContain("Overrides ignorés");
  });
  it("sans override : toujours null", () => {
    expect(integrerOverrides(null, CLE, propre, {}).proposition).toBeNull();
  });
});

describe("6. override sur un contenu déjà traité : sa propre sauvegarde, et --restore l'annule", () => {
  const urlsDe = async () => ["/fr/blog/x"];

  async function scenario() {
    const ligne = {
      id: "t1",
      locale: "fr" as const,
      title: "Titre",
      excerpt: null,
      body: "<p>Nous formons vos équipes sur leurs vrais dossiers. Le financement OPCO est possible. Ensuite nous mesurons les résultats obtenus.</p>",
      bodyJson: null,
      bodyText: null,
      metaTitle: null,
      metaDescription: null,
      ogImageAlt: null,
    };
    const m = depotMemoire({ [CLE]: { ...ligne } });
    const premier = proposerTraduction(ligne)!;
    expect(Object.keys(premier.apres)).toContain("body");
    await appliquer(m.depot, [premier]);
    return { m, premier };
  }

  it("deuxième passage avec override : nouvelle ligne de journal, la première est intacte", async () => {
    const { m } = await scenario();
    const apresPremier = (m.journal[0]!.newValue as Champs).title;
    const courant = { ...m.lignes[CLE]! };
    const p = integrerOverrides(null, CLE, courant, {
      [CLE]: {
        body: {
          origine: empreinte(courant.body),
          valeur: "<p>Réécrit à la main.</p>",
          pertesAcceptees: tousLesMots(courant.body),
        },
      },
    }).proposition!;
    const r = await appliquer(m.depot, [p]);
    expect(r.ecrits).toBe(1);
    expect(m.journal).toHaveLength(2);
    expect(m.journal[0]!.action).toBe(ACTION_RETRAIT);
    expect((m.journal[0]!.newValue as Champs).title).toBe(apresPremier);
    expect(m.journal[1]!.action).toBe(ACTION_OVERRIDE);
    expect((m.journal[1]!.oldValue as Champs).body).toBe(courant.body);
    expect(m.lignes[CLE]!.body).toBe("<p>Réécrit à la main.</p>");
  });

  it("--restore : défait l'override puis le premier passage, chacun si la valeur est celle écrite", async () => {
    const { m, premier } = await scenario();
    const courant = { ...m.lignes[CLE]! };
    const p = integrerOverrides(null, CLE, courant, {
      [CLE]: {
        body: {
          origine: empreinte(courant.body),
          valeur: "<p>Réécrit à la main.</p>",
          pertesAcceptees: tousLesMots(courant.body),
        },
      },
    }).proposition!;
    await appliquer(m.depot, [p]);
    const r = await restaurer(m.depot, null, urlsDe);
    expect(r.divergences).toEqual([]);
    expect(r.restaures).toBe(2);
    expect(m.lignes[CLE]!.body).toBe(premier.avant.body);
    const actions = m.journal.map((l) => l.action);
    expect(actions.indexOf(ACTION_RESTAURATION_OVERRIDE)).toBeLessThan(
      actions.indexOf(ACTION_RESTAURATION),
    );
    // Relance : rien de plus.
    expect((await restaurer(m.depot, null, urlsDe)).restaures).toBe(0);
  });

  it("--restore : un champ modifié à la main depuis n'est pas écrasé", async () => {
    const { m } = await scenario();
    const courant = { ...m.lignes[CLE]! };
    const p = integrerOverrides(null, CLE, courant, {
      [CLE]: {
        body: {
          origine: empreinte(courant.body),
          valeur: "<p>Réécrit à la main.</p>",
          pertesAcceptees: tousLesMots(courant.body),
        },
      },
    }).proposition!;
    await appliquer(m.depot, [p]);
    m.lignes[CLE]!.body = "<p>Retouché depuis.</p>";
    const r = await restaurer(m.depot, null, urlsDe);
    expect(r.divergences.join()).toMatch(/non restauré/);
    expect(m.lignes[CLE]!.body).toBe("<p>Retouché depuis.</p>");
  });
});
