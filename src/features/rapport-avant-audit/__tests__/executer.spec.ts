import { describe, expect, it } from "vitest";

import { HTML_SYNTHETIQUE } from "../../questionnaire-preaudit/__tests__/squelette.fixture";
import { lireLaCharge } from "../../questionnaire-preaudit/lecture";
import { collecterReponses } from "../collecte";
import {
  ErreurRapport,
  executerRapport,
  MAX_QUESTIONS_PAR_ROLE,
  MAX_ROLES,
  type AppelIA,
  type FournisseurIA,
} from "../executer";
import { exigerModeleAutorise } from "../modeles";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const WEB = { type: "web", reference: "Comptes publiés", url: "https://exemple.fr/comptes" };
const REP = { type: "questionnaire", reference: "Réponse du dirigeant", personne: "Direction" };

function dossier() {
  const json = JSON.stringify({
    schema: 4,
    mode: "main",
    consentements: { traitement: true },
    donnees: { a_nom: "Alice", a_plus: "Je perds du temps à retaper les fiches" },
  });
  return collecterReponses([
    {
      id: "q1",
      ref: "r1",
      envoyeLe: new Date(),
      closLe: null,
      html: HTML_SYNTHETIQUE,
      reponses: [
        {
          id: "x",
          mode: "main",
          membre: null,
          recuLe: new Date("2026-10-27T10:00:00Z"),
          lignes: [],
          illisible: false,
          ecarteLe: null,
          infosEmail: null,
          lecture: lireLaCharge(json),
        },
      ],
    },
  ]);
}

const BESOINS = {
  besoins: [
    {
      id: "B1",
      categorie: "douleur",
      enonce: "Retaper les mêmes fiches",
      citations: [{ texte: "Je perds du temps à retaper les fiches", auteur: "Direction" }],
      nbPersonnes: 1,
      intensite: "fort",
    },
  ],
};
const PLAN = {
  roles: [
    {
      id: "identite_finances",
      titre: "Identité et finances",
      mission: "Trouver",
      questions: ["CA par année ?"],
    },
    {
      id: "specialiste_secteur",
      titre: "Spécialiste du secteur",
      mission: "Enjeux",
      questions: ["Normes ?"],
    },
  ],
};
const EXERCICES = [
  {
    annee: 2018,
    chiffreAffairesEur: 3_000_000,
    resultatNetEur: null,
    effectif: null,
    confiance: "etabli",
    sources: [WEB],
  },
  {
    annee: 2020,
    chiffreAffairesEur: 4_100_000,
    resultatNetEur: null,
    effectif: null,
    confiance: "etabli",
    sources: [WEB],
  },
];
const SPEC = {
  constats: [
    {
      section: "identite",
      element: {
        libelle: "Forme",
        valeur: "SAS",
        provenance: "croise",
        confiance: "etabli",
        sources: [WEB, REP],
      },
    },
  ],
  exercices: EXERCICES,
  limites: [],
};
const ANALYSE = {
  reponseDirection: {
    fournieParUnDirigeant: "non",
    repondant: "Salariée",
    remarque: "Réponse donnée par une salariée",
  },
  pistes: [
    {
      id: "P1",
      titre: "Générer les fiches",
      description: "Une fiche produite depuis les données",
      besoinsServis: ["B1"],
      horsDemande: false,
      gain: "fort",
      effort: "moyen",
      rang: 1,
      sources: [REP],
    },
  ],
  contradictions: [],
  questions_jour_j: [
    {
      question: "Que veut la direction ?",
      pourquoi: "Réponse non donnée par la direction",
      besoinId: "B1",
    },
  ],
  propositions_fiche: [],
};
const CRITIQUE = {
  corrections: [{ gravite: "mineur", probleme: "Phrase longue", ou: "identite" }],
};
const REDACTION = {
  resumes: { identite: "Une SAS." },
  lectureFinanciere: "Activité en croissance sur la période publiée.",
};

const FICHE = {
  identite: { nom: "Alice", fonction: null, service: null },
  demandes: [],
  douleurs: [
    {
      enonce: "Retaper les fiches",
      citation: "Je perds du temps à retaper les fiches",
      tempsParSemaine: "3 h",
      besoinId: "B1",
    },
  ],
  taches: [],
  outils: [],
  reserves: [],
  aVerifierSurPlace: [{ question: "Quel fichier retapez-vous ?", pourquoi: "Précision" }],
};

interface Options {
  analyse?: unknown;
  specialisteEnPanne?: boolean;
  premiereReponseInvalide?: boolean;
  fences?: boolean;
  ficheEnPanne?: boolean;
  plan?: unknown;
}

function faux(o: Options = {}) {
  const appels: AppelIA[] = [];
  let besoinsDejaRates = false;
  const fournisseur: FournisseurIA = async (a) => {
    appels.push(a);
    let corps: unknown;
    if (a.system.includes("Rédacteur de fiche individuelle")) {
      if (o.ficheEnPanne) throw new Error("service indisponible");
      corps = FICHE;
    } else if (a.system.includes("chef d'orchestre")) corps = o.plan ?? PLAN;
    else if (a.system.includes("Tu es « Analyste des besoins déclarés »")) {
      if (o.premiereReponseInvalide && !besoinsDejaRates) {
        besoinsDejaRates = true;
        return {
          texte: "Voici les besoins : (pas de JSON)",
          jetonsEntree: 10,
          jetonsSortie: 5,
          nbRecherches: 0,
        };
      }
      corps = BESOINS;
    } else if (a.system.includes("« Identité et finances »")) {
      if (o.specialisteEnPanne) throw new Error("service indisponible");
      corps = SPEC;
    } else if (a.system.includes("« Spécialiste du secteur »"))
      corps = { constats: [], exercices: [], limites: ["Peu de sources"] };
    else if (a.system.includes("Analyste croisé")) corps = o.analyse ?? ANALYSE;
    else if (a.system.includes("« Critique »")) corps = CRITIQUE;
    else if (a.system.includes("« Rédacteur »")) corps = REDACTION;
    else throw new Error(`appel inattendu : ${a.system.slice(0, 60)}`);
    const json = JSON.stringify(corps);
    return {
      texte: o.fences ? `\`\`\`json\n${json}\n\`\`\`` : json,
      jetonsEntree: 100,
      jetonsSortie: 50,
      nbRecherches: a.recherche ? 2 : 0,
    };
  };
  return { fournisseur, appels };
}

const opts = (fournisseur: FournisseurIA) => ({
  clientId: CLIENT,
  raisonSociale: "Société d'exemple",
  genereLe: new Date("2026-11-02T10:00:00Z"),
  genereePar: "test",
  fournisseur,
});

describe("executerRapport", () => {
  it("produit une base valide, besoins en tête, annexe intégrale, tendance calculée par le code", async () => {
    const { fournisseur } = faux();
    const r = await executerRapport(dossier(), opts(fournisseur));
    expect(r.base.besoins_declares[0]?.id).toBe("B1");
    expect(r.base.annexe_reponses[0]?.reponses.map((x) => x.reponse)).toContain(
      "Je perds du temps à retaper les fiches",
    );
    expect(r.base.evolution_financiere.tendance).toBe("croissance");
    expect(r.base.evolution_financiere.limites.join(" ")).toContain("2020");
    expect(r.base.identite.elements[0]?.provenance).toBe("croise");
    expect(r.base.pistes[0]?.besoinsServis).toEqual(["B1"]);
    expect(r.base.meta.complet).toBe(true);
    expect(r.jetonsEntree).toBeGreaterThan(0);
    expect(r.nbRecherches).toBe(4);
  });

  it("n'emploie que des modèles autorisés ; seuls les chercheurs ont le web", async () => {
    const { fournisseur, appels } = faux();
    await executerRapport(dossier(), opts(fournisseur));
    for (const a of appels) expect(() => exigerModeleAutorise(a.modele)).not.toThrow();
    const besoins = appels.find((a) =>
      a.system.includes("Tu es « Analyste des besoins déclarés »"),
    );
    expect(besoins?.recherche).toBe(false);
    expect(appels.filter((a) => a.recherche)).toHaveLength(2);
  });

  it("accepte un JSON entouré de barrières de code", async () => {
    const { fournisseur } = faux({ fences: true });
    const r = await executerRapport(dossier(), opts(fournisseur));
    expect(r.base.besoins_declares).toHaveLength(1);
  });

  it("répare une réponse invalide une fois", async () => {
    const { fournisseur, appels } = faux({ premiereReponseInvalide: true });
    const r = await executerRapport(dossier(), opts(fournisseur));
    expect(r.base.besoins_declares).toHaveLength(1);
    expect(
      appels.filter((a) => a.system.includes("Tu es « Analyste des besoins déclarés »")),
    ).toHaveLength(2);
    expect(appels.find((a) => a.user.includes("INVALIDE"))).toBeDefined();
  });

  it("un spécialiste en panne n'arrête pas le rapport : limite notée, rapport marqué incomplet", async () => {
    const { fournisseur } = faux({ specialisteEnPanne: true });
    const r = await executerRapport(dossier(), opts(fournisseur));
    expect(r.base.meta.complet).toBe(false);
    expect(r.base.meta.limites.join(" ")).toContain("Identité et finances");
    // Sans chiffres trouvés, aucune tendance n'est affirmée.
    expect(r.base.evolution_financiere.tendance).toBe("indeterminee");
  });

  it("ne rend JAMAIS une base qui viole le contrat (piste sur un besoin inexistant)", async () => {
    const mauvaise = { ...ANALYSE, pistes: [{ ...ANALYSE.pistes[0], besoinsServis: ["B9"] }] };
    const { fournisseur } = faux({ analyse: mauvaise });
    await expect(executerRapport(dossier(), opts(fournisseur))).rejects.toThrow(ErreurRapport);
  });

  it("refuse de partir sans aucune réponse lisible", async () => {
    const { fournisseur } = faux();
    const vide = collecterReponses([]);
    await expect(executerRapport(vide, opts(fournisseur))).rejects.toThrow(/rien à analyser/);
  });

  it("signale l'avancement étape par étape", async () => {
    const { fournisseur } = faux();
    const etapes: string[] = [];
    await executerRapport(dossier(), {
      ...opts(fournisseur),
      surProgression: (p) => etapes.push(p.etape),
    });
    expect(etapes[0]).toBe("Besoins déclarés");
    expect(etapes.at(-1)).toBe("Terminé");
  });

  it("produit une fiche par personne, plus une fiche vide par personne attendue", async () => {
    const { fournisseur } = faux();
    const r = await executerRapport(dossier(), {
      ...opts(fournisseur),
      attenduesSansReponse: [{ nom: "Sandra", fonction: "ADV", service: "ADV" }],
    });
    const f = r.base.fiches_personnes;
    expect(f).toHaveLength(2);
    expect(f[0]?.statut).toBe("a_repondu");
    expect(f[0]?.douleurs[0]?.besoinId).toBe("B1");
    expect(f[1]?.statut).toBe("n_a_pas_repondu");
    expect(f[1]?.aVerifierSurPlace.length).toBeGreaterThan(0);
    expect(r.base.couverture.personnesAttenduesSansReponse[0]).toContain("Sandra");
  });

  it("si la fiche ne peut être rédigée, une fiche de secours renvoie à l'annexe", async () => {
    const { fournisseur } = faux({ ficheEnPanne: true });
    const r = await executerRapport(dossier(), opts(fournisseur));
    expect(r.base.fiches_personnes[0]?.aVerifierSurPlace[0]?.question).toContain("annexe");
    expect(r.base.meta.limites.join(" ")).toContain("fiche individuelle");
  });

  it("plafonne l'équipe : un chef qui propose trop de spécialistes est borné et le dit", async () => {
    const beaucoup = {
      roles: Array.from({ length: 12 }, () => ({
        id: "specialiste_secteur",
        titre: "Spécialiste du secteur",
        mission: "m",
        questions: Array.from({ length: 20 }, (_, j) => `q${j}`),
      })),
    };
    const { fournisseur, appels } = faux({ plan: beaucoup });
    const r = await executerRapport(dossier(), opts(fournisseur));
    expect(r.base.equipe_analyse).toHaveLength(MAX_ROLES);
    expect(r.base.equipe_analyse[0]?.questionsDeRecherche).toHaveLength(MAX_QUESTIONS_PAR_ROLE);
    expect(r.base.meta.limites.join(" ")).toContain("12 spécialistes");
    expect(appels.filter((a) => a.recherche)).toHaveLength(MAX_ROLES);
  });
});
