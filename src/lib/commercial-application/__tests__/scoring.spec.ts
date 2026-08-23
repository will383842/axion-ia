import { describe, expect, it } from "vitest";

import {
  CARNET_DIRIGEANTS_OPTIONS,
  B2B_ANNEES_OPTIONS,
  DEPLACEMENT_OPTIONS,
  STATUT_OPTIONS,
  type CommercialApplicationInput,
} from "../model";
import {
  PRIORITES,
  SCORE_POIDS,
  SCORE_SEUIL_HAUTE,
  SCORE_SEUIL_MOYENNE,
  scoreCandidature,
} from "../scoring";

/** Candidature minimale VALIDE, tous critères au plancher. */
function base(over: Partial<CommercialApplicationInput> = {}): CommercialApplicationInput {
  return {
    prenom: "Jean",
    nom: "Dupont",
    email: "jean@example.com",
    telephone: "0600000000",
    ville: "Lyon",
    codePostal: "69001",
    b2bDejaVendu: false,
    experiences: [
      {
        entreprise: "ACME",
        ville: "Lyon",
        poste: "Commercial",
        debut: "2020-01",
        posteActuel: true,
      },
    ],
    iaUtilise: false,
    informatiqueUtilise: false,
    zoneMobile: false,
    deplacement: "non",
    pitch: "x".repeat(150),
    disponibilite: "2026-10",
    permisVehicule: false,
    consent: true,
    ...over,
  } as CommercialApplicationInput;
}

describe("scoreCandidature — barème", () => {
  it("la somme des poids fait exactement 100", () => {
    const somme = Object.values(SCORE_POIDS).reduce((a, b) => a + b, 0);
    expect(somme).toBe(100);
  });

  it("le plancher absolu n'est jamais négatif et reste dans [0,100]", () => {
    const s = scoreCandidature(base());
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
  });

  it("le profil maximal atteint 100", () => {
    const s = scoreCandidature(
      base({
        carnetDirigeants: "150-plus",
        b2bDejaVendu: true,
        b2bAnnees: "plus-10",
        statut: "independant",
        deplacement: "oui",
        iaUtilise: true,
        iaOutils: ["chatgpt"],
        informatiqueUtilise: true,
        informatiqueUsages: ["crm"],
        zoneMobile: true,
        experiences: [
          {
            entreprise: "ACME",
            ville: "Lyon",
            poste: "Commercial",
            debut: "2010-01",
            posteActuel: true,
            typesClients: ["entreprises"],
          },
        ],
      }),
    );
    expect(s.total).toBe(100);
    expect(s.priorite).toBe("haute");
  });
});

describe("scoreCandidature — le carnet d'adresses, critère le plus lourd", () => {
  it("chaque option du formulaire a un barème (aucune ne vaut 0 par oubli)", () => {
    // Sans ce test, ajouter une tranche dans le formulaire lui donnerait
    // silencieusement 0 point — le pire des échecs : invisible et faux.
    for (const o of CARNET_DIRIGEANTS_OPTIONS) {
      const s = scoreCandidature(base({ carnetDirigeants: o.id }));
      expect(s.parts.carnet, `tranche « ${o.label} » non barémée`).toBeGreaterThan(0);
    }
  });

  it("le barème est strictement croissant avec la taille du carnet", () => {
    const notes = CARNET_DIRIGEANTS_OPTIONS.map(
      (o) => scoreCandidature(base({ carnetDirigeants: o.id })).parts.carnet,
    );
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i]!, `${CARNET_DIRIGEANTS_OPTIONS[i]!.label}`).toBeGreaterThan(notes[i - 1]!);
    }
  });

  it("un carnet absent ne pénalise que son propre poids", () => {
    const avec = scoreCandidature(base({ carnetDirigeants: "0-5" }));
    const sans = scoreCandidature(base());
    expect(avec.total - sans.total).toBe(2);
  });
});

describe("scoreCandidature — années B2B", () => {
  it("chaque option a un barème", () => {
    for (const o of B2B_ANNEES_OPTIONS) {
      const s = scoreCandidature(base({ b2bDejaVendu: true, b2bAnnees: o.id }));
      expect(s.parts.b2bAnnees, `tranche « ${o.label} » non barémée`).toBeGreaterThan(0);
    }
  });

  it("« jamais vendu en B2B » annule les années, même si elles traînent", () => {
    // Aller-retour dans le wizard : on décoche « déjà vendu » sans effacer la
    // tranche. C'est la réponse la plus récente qui fait foi.
    const s = scoreCandidature(base({ b2bDejaVendu: false, b2bAnnees: "plus-10" }));
    expect(s.parts.b2bAnnees).toBe(0);
  });
});

describe("scoreCandidature — statut et déplacement", () => {
  it("chaque statut a un barème", () => {
    for (const o of STATUT_OPTIONS) {
      const s = scoreCandidature(base({ statut: o.id }));
      expect(s.parts.statut, `statut « ${o.label} » non barémé`).toBeGreaterThan(0);
    }
  });

  it("déjà indépendant vaut plus que salarié — il peut facturer demain matin", () => {
    const indep = scoreCandidature(base({ statut: "independant" })).parts.statut;
    const salarie = scoreCandidature(base({ statut: "salarie" })).parts.statut;
    expect(indep).toBeGreaterThan(salarie);
  });

  it("chaque option de déplacement a un barème", () => {
    for (const o of DEPLACEMENT_OPTIONS) {
      const s = scoreCandidature(base({ deplacement: o.id }));
      expect(s.parts.deplacement, `« ${o.label} » non barémé`).toBeGreaterThan(0);
    }
  });
});

describe("scoreCandidature — types de clients agrégés sur les expériences", () => {
  it("vendre aux entreprises une seule fois suffit", () => {
    const s = scoreCandidature(
      base({
        experiences: [
          {
            entreprise: "A",
            ville: "Lyon",
            poste: "P",
            debut: "2019-01",
            posteActuel: false,
            fin: "2020-01",
            typesClients: ["particuliers"],
          },
          {
            entreprise: "B",
            ville: "Lyon",
            poste: "P",
            debut: "2020-02",
            posteActuel: true,
            typesClients: ["entreprises"],
          },
        ],
      }),
    );
    expect(s.parts.typesClients).toBe(SCORE_POIDS.typesClients);
  });

  it("vendre uniquement aux particuliers ne rapporte rien sur ce critère", () => {
    const s = scoreCandidature(
      base({
        experiences: [
          {
            entreprise: "A",
            ville: "Lyon",
            poste: "P",
            debut: "2019-01",
            posteActuel: true,
            typesClients: ["particuliers"],
          },
        ],
      }),
    );
    expect(s.parts.typesClients).toBe(0);
  });
});

describe("scoreCandidature — aiguillage", () => {
  it("les trois priorités sont documentées", () => {
    expect(Object.keys(PRIORITES).sort()).toEqual(["haute", "moyenne", "vivier"]);
  });

  it("les seuils découpent bien les trois zones", () => {
    expect(SCORE_SEUIL_MOYENNE).toBeLessThan(SCORE_SEUIL_HAUTE);
    expect(scoreCandidature(base()).priorite).toBe("vivier");
  });

  it("un carnet énorme sans expérience B2B ne suffit PAS à passer prioritaire", () => {
    // Garde-fou métier : un gros carnet mal exploité reste à qualifier. Sans
    // ce test, un barème déséquilibré ferait remonter des profils qu'on
    // rappellerait sous 24 h pour rien.
    const s = scoreCandidature(base({ carnetDirigeants: "150-plus" }));
    expect(s.priorite).not.toBe("haute");
  });

  it("le score n'exclut jamais : même le plancher rend une note exploitable", () => {
    // Le contrat explicite du module — le score ORIENTE, il ne rejette pas.
    const s = scoreCandidature(base());
    expect(s.priorite).toBe("vivier");
    expect(PRIORITES[s.priorite].action).toBeTruthy();
  });
});
