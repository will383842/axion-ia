import { describe, expect, it } from "vitest";

import {
  BaseAuditSchema,
  FichePersonneSchema,
  PisteSchema,
  SECTIONS_ANALYSE,
  VERSION_BASE_AUDIT,
} from "../base-audit-schema";
import { exigerModeleAutorise, ModeleRefuse, MODELES_RAPPORT } from "../modeles";
import { motsInterditsDans } from "../mots-interdits";

const SOURCE = {
  type: "questionnaire",
  reference: "Réponse du dirigeant",
  personne: "Dirigeant",
} as const;

function baseMinimale() {
  const section = { resume: "", elements: [] };
  return {
    version: VERSION_BASE_AUDIT,
    meta: {
      clientId: "11111111-1111-4111-8111-111111111111",
      raisonSociale: "Société d'exemple",
      generePar: "test",
      genereLe: "2026-11-02T10:00:00Z",
      questionnaires: ["q1"],
      complet: true,
      limites: [],
      reponseDirection: { fournieParUnDirigeant: "oui", repondant: "Président", remarque: "" },
    },
    besoins_declares: [
      {
        id: "B1",
        categorie: "douleur",
        enonce: "Les devis prennent trop de temps",
        citations: [{ texte: "Je passe mes soirées sur les devis", auteur: "Dirigeant" }],
        nbPersonnes: 2,
        intensite: "fort",
      },
    ],
    equipe_analyse: [],
    ...Object.fromEntries(SECTIONS_ANALYSE.map((k) => [k, section])),
    identite: { resume: "", elements: [] as unknown[] },
    evolution_financiere: {
      exercices: [],
      tendance: "indeterminee",
      tauxAnnuelMoyenPct: null,
      lecture: "",
      limites: [],
    },
    pistes: [
      {
        id: "P1",
        titre: "Automatiser les devis",
        description: "Générer un devis depuis la demande",
        besoinsServis: ["B1"],
        horsDemande: false,
        gain: "fort",
        effort: "moyen",
        rang: 1,
        sources: [SOURCE],
      },
    ],
    contradictions: [],
    questions_jour_j: [],
    propositions_fiche: [],
    couverture: {
      personnesAvecReponse: 1,
      reponsesDonnees: 10,
      questionsSansReponse: 3,
      personnesAttenduesSansReponse: [],
      alertes: [],
    },
    fiches_personnes: [] as unknown[],
    annexe_reponses: [],
    sources: [],
  };
}

describe("base d'audit — contrat", () => {
  it("accepte une base minimale cohérente", () => {
    expect(BaseAuditSchema.safeParse(baseMinimale()).success).toBe(true);
  });

  it("refuse une piste qui cite un besoin inexistant", () => {
    const b = baseMinimale();
    b.pistes[0]!.besoinsServis = ["B9"];
    expect(BaseAuditSchema.safeParse(b).success).toBe(false);
  });

  it("refuse une piste retenue qui ne répond à aucun besoin déclaré", () => {
    const p = { ...baseMinimale().pistes[0]!, besoinsServis: [] };
    expect(PisteSchema.safeParse(p).success).toBe(false);
  });

  it("une piste hors demande n'a jamais de rang de priorité", () => {
    const hors = { ...baseMinimale().pistes[0]!, besoinsServis: [], horsDemande: true };
    expect(PisteSchema.safeParse({ ...hors, rang: 1 }).success).toBe(false);
    expect(PisteSchema.safeParse({ ...hors, rang: null }).success).toBe(true);
  });

  it("refuse une affirmation sans source", () => {
    const b = baseMinimale();
    (b.identite.elements as unknown[]).push({
      libelle: "SIREN",
      valeur: "123",
      provenance: "trouve",
      confiance: "etabli",
      sources: [],
    });
    expect(BaseAuditSchema.safeParse(b).success).toBe(false);
  });

  it("distingue ce que le client a dit de ce que nous avons trouvé", () => {
    const web = {
      type: "web",
      reference: "Annuaire des entreprises",
      url: "https://exemple.fr",
    } as const;
    const elt = (provenance: string, sources: unknown[]) => {
      const b = baseMinimale();
      (b.identite.elements as unknown[]).push({
        libelle: "Effectif",
        valeur: "20 à 49",
        provenance,
        confiance: "probable",
        sources,
      });
      return BaseAuditSchema.safeParse(b).success;
    };
    expect(elt("declare", [SOURCE])).toBe(true);
    expect(elt("trouve", [web])).toBe(true);
    expect(elt("croise", [SOURCE, web])).toBe(true);
    // Une information trouvée par nous ne peut pas passer pour une déclaration du client, ni l'inverse.
    expect(elt("declare", [web])).toBe(false);
    expect(elt("trouve", [SOURCE])).toBe(false);
    expect(elt("declare", [SOURCE, web])).toBe(false);
  });

  it("exige une question pour la direction quand ce n'est pas un dirigeant qui a répondu", () => {
    const b = baseMinimale();
    b.meta.reponseDirection = {
      fournieParUnDirigeant: "non",
      repondant: "Styliste modéliste",
      remarque: "Réponse donnée par une salariée.",
    };
    expect(BaseAuditSchema.safeParse(b).success).toBe(false);
    b.questions_jour_j = [
      {
        question: "Quel budget la direction prévoit-elle ?",
        pourquoi: "Réponse non donnée par la direction.",
      },
    ] as never;
    expect(BaseAuditSchema.safeParse(b).success).toBe(true);
  });

  it("refuse une tendance qui ne correspond pas aux chiffres", () => {
    const b = baseMinimale();
    const ex = (annee: number, ca: number) => ({
      annee,
      chiffreAffairesEur: ca,
      resultatNetEur: null,
      effectif: null,
      confiance: "etabli" as const,
      sources: [{ type: "registre" as const, reference: "Comptes publiés" }],
    });
    b.evolution_financiere = {
      exercices: [ex(2018, 3_000_000), ex(2020, 4_100_000)],
      tendance: "decroissance",
      tauxAnnuelMoyenPct: -5,
      lecture: "",
      limites: [],
    } as never;
    expect(BaseAuditSchema.safeParse(b).success).toBe(false);
    b.evolution_financiere = {
      exercices: [ex(2018, 3_000_000), ex(2020, 4_100_000)],
      tendance: "croissance",
      tauxAnnuelMoyenPct: 16.9,
      lecture: "",
      limites: [],
    } as never;
    expect(BaseAuditSchema.safeParse(b).success).toBe(true);
  });

  it("refuse un chiffre d'affaires qui ne vient que d'une réponse du client", () => {
    const b = baseMinimale();
    b.evolution_financiere = {
      exercices: [
        {
          annee: 2020,
          chiffreAffairesEur: 4_100_000,
          resultatNetEur: null,
          effectif: null,
          confiance: "probable",
          sources: [{ type: "questionnaire", reference: "Réponse du dirigeant" }],
        },
      ],
      tendance: "indeterminee",
      tauxAnnuelMoyenPct: null,
      lecture: "",
      limites: [],
    } as never;
    expect(BaseAuditSchema.safeParse(b).success).toBe(false);
  });

  it("refuse une version de schéma inconnue", () => {
    expect(BaseAuditSchema.safeParse({ ...baseMinimale(), version: "base-audit/9" }).success).toBe(
      false,
    );
  });
});

describe("fiches par personne — contrat", () => {
  const vide = {
    identite: { nom: "Sandra", fonction: "ADV", service: null },
    demandes: [],
    douleurs: [],
    taches: [],
    outils: [],
    reserves: [],
  };
  it("une personne qui n'a pas répondu a des questions et aucun contenu inventé", () => {
    const ok = {
      ...vide,
      personne: "attendu:Sandra",
      statut: "n_a_pas_repondu",
      aVerifierSurPlace: [{ question: "Journée type ?", pourquoi: "Pas de réponse" }],
    };
    expect(FichePersonneSchema.safeParse(ok).success).toBe(true);
    expect(FichePersonneSchema.safeParse({ ...ok, aVerifierSurPlace: [] }).success).toBe(false);
    const inventee = {
      ...ok,
      douleurs: [{ enonce: "x", citation: "y", tempsParSemaine: null }],
    };
    expect(FichePersonneSchema.safeParse(inventee).success).toBe(false);
  });
  it("refuse une fiche qui cite un besoin inexistant", () => {
    const b = baseMinimale();
    b.fiches_personnes.push({
      ...vide,
      personne: "attendu:Sandra",
      statut: "a_repondu",
      douleurs: [{ enonce: "x", citation: "y", tempsParSemaine: null, besoinId: "B9" }],
      aVerifierSurPlace: [],
    });
    expect(BaseAuditSchema.safeParse(b).success).toBe(false);
  });
});

describe("modèles autorisés", () => {
  it("accepte Opus et Sonnet du rapport", () => {
    expect(exigerModeleAutorise(MODELES_RAPPORT.reflexion)).toBe(MODELES_RAPPORT.reflexion);
    expect(exigerModeleAutorise(MODELES_RAPPORT.execution)).toBe(MODELES_RAPPORT.execution);
  });

  it("refuse tout Haiku et tout modèle inconnu", () => {
    for (const m of ["claude-haiku-4-5", "claude-haiku-5-5", "CLAUDE-HAIKU-X", "gpt-4o", ""]) {
      expect(() => exigerModeleAutorise(m)).toThrow(ModeleRefuse);
    }
  });
});

describe("mots interdits", () => {
  it("repère les interdits, sans tenir compte de la casse ni des accents", () => {
    expect(motsInterditsDans("Axion IA est CERTIFIÉE")).toContain("« certifié »");
    expect(motsInterditsDans("organisme qualiopi")).toContain("« Qualiopi »");
    expect(motsInterditsDans("Nous sommes à GRENOBLE")).toContain("« Grenoble »");
    expect(motsInterditsDans("Un gain garanti de 30 %")).toContain("« gain garanti »");
    expect(motsInterditsDans("Aucun gain garanti")).toContain("« gain garanti »");
  });

  it("laisse passer un texte normal", () => {
    expect(motsInterditsDans("Nous intervenons partout en France pour vos équipes.")).toEqual([]);
  });
});
