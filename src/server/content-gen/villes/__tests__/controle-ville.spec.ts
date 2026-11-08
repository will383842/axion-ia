/**
 * Contrôle de doctrine des textes de ville + décision d'approbation automatique
 * (audit blog/RAG du 24/10/2026, option B de Will).
 */

import { describe, expect, it } from "vitest";
import type { VilleEconomicData } from "@/content/villes/economic-data/types";
import {
  OPTIONS_INTERDITS_VILLE,
  REVIEWED_BY_GENERATEUR_LLM,
  SOURCE_DONNEES_MEMOIRE_MODELE,
  champsCopieVille,
  champsIndexes,
  decisionApprobationAuto,
  donneesEconomiquesDeLaMemoire,
  fautesDoctrineVille,
  resumerFautesDoctrine,
  type CopieVillePourControle,
} from "../controle-ville";

function copieSaine(surcharge: Partial<CopieVillePourControle> = {}): CopieVillePourControle {
  return {
    pitchFr: "Axion-IA aide les dirigeants de Lyon à gagner du temps sur leurs devis.",
    directAnswerFr: "Un audit repère les tâches à automatiser en premier.",
    ecosystemFr: "Lyon compte de nombreuses petites entreprises de services.",
    distancesFr: "La gare de Part-Dieu est à dix minutes du centre.",
    topSectorsNaf: ["Commerce", "Services aux entreprises", "Santé"],
    servicesContext: {
      audit: { fr: "Un audit court pour choisir les premiers usages." },
      interventions: { fr: "Une intervention dans vos locaux ou à distance." },
      implementation: { fr: "Mise en place pas à pas des outils retenus." },
      unAUn: { fr: "Un accompagnement individuel du dirigeant." },
    },
    faqGeolocalisee: [
      { q: "Intervenez-vous à Lyon ?", a: "Oui, partout en France, sur place ou à distance." },
      { q: "Combien de temps dure un audit ?", a: "Cela dépend de la taille de l'entreprise." },
    ],
    ...surcharge,
  };
}

/** Fiche minimale : seuls les champs lus par `donneesEconomiquesDeLaMemoire` comptent. */
function ecoMinimal(surcharge: Record<string, unknown> = {}): VilleEconomicData {
  return {
    topSectorsNaf: [],
    statsInsee: { anneeReference: 2023, source: "INSEE", verifiedOn: "2026-01-01" },
    lastReviewedOn: "2026-01-01",
    reviewedBy: "Will",
    ...surcharge,
  } as unknown as VilleEconomicData;
}

describe("fautesDoctrineVille", () => {
  it("laisse passer une copie saine", () => {
    expect(fautesDoctrineVille(champsCopieVille(copieSaine()))).toEqual([]);
  });

  it("signale Qualiopi dans la FAQ avec le nom du champ", () => {
    const copie = copieSaine({
      faqGeolocalisee: [{ q: "Etes-vous certifiés ?", a: "Oui, nous sommes certifiés Qualiopi." }],
    });
    const fautes = fautesDoctrineVille(champsCopieVille(copie));
    expect(fautes.map((f) => f.code)).toContain("qualiopi");
    expect(fautes.find((f) => f.code === "qualiopi")?.champ).toBe("faq[0].a");
  });

  it("signale Grenoble dans le pitch", () => {
    const copie = copieSaine({ pitchFr: "Depuis Grenoble, Axion-IA accompagne les dirigeants." });
    const codes = fautesDoctrineVille(champsCopieVille(copie)).map((f) => f.code);
    expect(codes).toContain("grenoble");
  });

  it("garde OPCO et France Travail interdits par défaut", () => {
    expect(OPTIONS_INTERDITS_VILLE.financementPublicAutorise).toBe(false);
  });

  it("produit une ligne lisible par faute", () => {
    const fautes = fautesDoctrineVille({ pitchFr: "Notre label Qualiopi" });
    const lignes = resumerFautesDoctrine(fautes);
    expect(lignes).toHaveLength(fautes.length);
    expect(lignes[0]).toContain("pitchFr");
    expect(lignes[0]).toContain("qualiopi");
  });
});

describe("champsCopieVille / champsIndexes", () => {
  it("expose tous les textes publiés", () => {
    const champs = champsCopieVille(copieSaine());
    expect(Object.keys(champs)).toEqual(
      expect.arrayContaining([
        "pitchFr",
        "directAnswerFr",
        "ecosystemFr",
        "distancesFr",
        "servicesContext.audit",
        "servicesContext.unAUn",
        "topSectorsNaf[2]",
        "faq[1].q",
        "faq[1].a",
      ]),
    );
  });

  it("numérote une liste", () => {
    expect(champsIndexes("x", ["a", "b"])).toEqual({ "x[0]": "a", "x[1]": "b" });
  });
});

describe("donneesEconomiquesDeLaMemoire", () => {
  it("faux sans données", () => {
    expect(donneesEconomiquesDeLaMemoire(undefined)).toBe(false);
  });

  it("faux pour une fiche écrite à la main", () => {
    expect(donneesEconomiquesDeLaMemoire(ecoMinimal())).toBe(false);
  });

  it("vrai quand reviewedBy vient du générateur", () => {
    const eco = ecoMinimal({ reviewedBy: `${REVIEWED_BY_GENERATEUR_LLM}@1.0` });
    expect(donneesEconomiquesDeLaMemoire(eco)).toBe(true);
  });

  it("vrai quand la source d'un secteur est la mémoire du modèle", () => {
    const eco = ecoMinimal({
      topSectorsNaf: [
        { naf: "47", label: "Commerce", source: SOURCE_DONNEES_MEMOIRE_MODELE, verifiedOn: "x" },
      ],
    });
    expect(donneesEconomiquesDeLaMemoire(eco)).toBe(true);
  });
});

describe("decisionApprobationAuto", () => {
  const base = { qualityScore: 80, seuil: 70, donneesDeLaMemoire: false, nbFautesDoctrine: 0 };

  it("approuve une ville à données écrites à la main, doctrine propre, score suffisant", () => {
    expect(decisionApprobationAuto(base).approuver).toBe(true);
  });

  it("refuse une ville à données de la mémoire du modèle, même avec 100/100", () => {
    const d = decisionApprobationAuto({ ...base, qualityScore: 100, donneesDeLaMemoire: true });
    expect(d.approuver).toBe(false);
    expect(d.motif).toContain("mémoire du modèle");
  });

  it("refuse dès qu'une faute de doctrine existe, même données écrites à la main", () => {
    const d = decisionApprobationAuto({ ...base, nbFautesDoctrine: 1 });
    expect(d.approuver).toBe(false);
    expect(d.motif).toContain("doctrine");
  });

  it("refuse sous le seuil", () => {
    expect(decisionApprobationAuto({ ...base, qualityScore: 69 }).approuver).toBe(false);
  });
});
