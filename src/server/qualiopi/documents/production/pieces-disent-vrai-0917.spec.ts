/**
 * Trois pièces remises au stagiaire, trois défauts relevés à la préparation de
 * l'audit initial Qualiopi (2026-09-17/18) — chacun vérifié ici AU POINT DE
 * PRODUCTION, sur ce que le producteur passe réellement au gabarit :
 *
 * - (h) la grille d'évaluation imprimait la date de DÉBUT DE SESSION comme date
 *   d'évaluation, y compris quand l'évaluation portait sa propre date ;
 * - (f) le programme n'imprimait pas les ressources pédagogiques, alors que le
 *   dossier d'audit le présente comme la preuve de l'indicateur 19 ;
 * - la convocation en présentiel ne disait rien du matériel : la section
 *   « Équipement requis » n'existait qu'en distanciel.
 *
 * Stratégie : Prisma et `generateDocument` sont simulés ; on capture l'élément
 * React construit, on lit ses `data`, puis on rend son TEXTE réel.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type React from "react";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: { findUnique: vi.fn() },
    trainingSession: { findUnique: vi.fn() },
    evaluationAcquis: { findFirst: vi.fn() },
    sessionJour: { findMany: vi.fn() },
    trainer: { findUnique: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(),
}));

vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import {
  DATE_EVALUATION_NON_RENSEIGNEE,
  produireConvocation,
  produireGrilleEvaluation,
  produireProgramme,
} from "./producteurs";

const mp = prisma as unknown as {
  enrollment: { findUnique: ReturnType<typeof vi.fn> };
  trainingSession: { findUnique: ReturnType<typeof vi.fn> };
  evaluationAcquis: { findFirst: ReturnType<typeof vi.fn> };
  sessionJour: { findMany: ReturnType<typeof vi.fn> };
  trainer: { findUnique: ReturnType<typeof vi.fn> };
};

const IDENTITE = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 38000 Grenoble",
  adresseExercice: "1 rue de la Paix, 38000 Grenoble",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
  referentHandicapEmail: "handicap@axion-ia.fr",
  dpoEmail: "dpo@axion-ia.fr",
};

const LIEU = {
  lieuType: "sur_site",
  lieuIntitule: "SCI Invest Sun",
  lieuAdresse: "2 avenue Alsace-Lorraine",
  lieuCodePostal: "38000",
  lieuVille: "Grenoble",
  lieuSalle: null,
  lieuVisioUrl: null,
};

/** Élément React passé au gabarit par le dernier `generateDocument`. */
let dernierElement: React.ReactElement<{ data: Record<string, unknown> }> | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  dernierElement = null;
  (getOrganismeIdentite as ReturnType<typeof vi.fn>).mockResolvedValue(IDENTITE);
  mp.trainer.findUnique.mockResolvedValue(null);
  mp.sessionJour.findMany.mockResolvedValue([{ heureDebut: "09h00", heureFin: "17h00" }]);
  (generateDocument as ReturnType<typeof vi.fn>).mockImplementation(
    async (input: { buildElement: (n: string) => React.ReactElement }) => {
      dernierElement = input.buildElement("AXI-DOC-TEST") as typeof dernierElement;
      return { id: "doc-1", numero: "AXI-DOC-TEST" };
    },
  );
});

function data(): Record<string, unknown> {
  if (dernierElement === null) throw new Error("aucune pièce construite");
  return dernierElement.props.data;
}

function texte(): string {
  if (dernierElement === null) throw new Error("aucune pièce construite");
  return collectPdfTextNormalized(dernierElement);
}

// ─────────────────────────────────────────────────────────────────────────────
// (h) Grille d'évaluation : la date d'évaluation est celle de l'évaluation
// ─────────────────────────────────────────────────────────────────────────────

function enrollmentGrille() {
  return {
    id: "enr-1",
    trainee: { id: "t-1", nom: "Blanc", prenom: "Simone" },
    session: {
      id: "s-1",
      titreSession: "IA pour bien commencer — journée complète",
      // Début de session le 04/09, évaluation le 05/09 : deux dates distinctes,
      // pour que la mauvaise colonne se voie.
      dateDebut: new Date("2026-09-04T07:00:00Z"),
      coFormateurs: [],
      formateurPrincipalId: null,
      formationSnapshot: null,
      formation: { objectifsPedagogiques: ["Formuler une demande"] },
    },
  };
}

describe("(h) grille d'évaluation — la date imprimée est celle de l'évaluation", () => {
  it("imprime la date de l'évaluation finale enregistrée, pas le début de session", async () => {
    mp.enrollment.findUnique.mockResolvedValue(enrollmentGrille());
    mp.evaluationAcquis.findFirst.mockResolvedValue({
      competences: [],
      recommandations: null,
      dateEvaluation: new Date("2026-09-05T15:00:00Z"),
    });

    const r = await produireGrilleEvaluation("enr-1");

    expect(r.ok).toBe(true);
    expect(data()["dateEvaluation"]).toBe("05/09/2026");
    expect(texte()).not.toContain("04/09/2026");
  });

  it("sans évaluation enregistrée : le DIT, ne se replie pas sur le début de session", async () => {
    mp.enrollment.findUnique.mockResolvedValue(enrollmentGrille());
    mp.evaluationAcquis.findFirst.mockResolvedValue(null);

    await produireGrilleEvaluation("enr-1");

    expect(data()["dateEvaluation"]).toBe(DATE_EVALUATION_NON_RENSEIGNEE);
    expect(texte()).not.toContain("04/09/2026");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (f) Programme : les ressources pédagogiques sont imprimées (indicateur 19)
// ─────────────────────────────────────────────────────────────────────────────

function sessionProgramme(ressourcesPedagogiques: unknown) {
  return {
    id: "s-1",
    titreSession: "IA pour l'immobilier",
    modalite: "presentiel",
    formationSnapshot: null,
    ...LIEU,
    formation: {
      titre: "IA pour l'immobilier",
      dureeHeures: 7,
      objectifsPedagogiques: ["Formuler une demande"],
      programmeDetaille: null,
      methodesPedagogiques: "Exercices sur les tâches réelles",
      moyensTechniques: "",
      versionProgramme: null,
      certificationType: "attestation",
      prerequis: "Aucun",
      niveau: "debutant",
      accessibleHandicap: true,
      seuilReussitePct: 70,
      ressourcesPedagogiques,
      offreSite: { publicViseFr: "Agents immobiliers" },
    },
  };
}

// Forme mesurée en production le 2026-09-18 (22 formations sur 22).
const RESSOURCES_PROD = [
  { type: "support", libelle: "Support de présentation projeté en séance" },
  { type: "memo", libelle: "Fiche mémo des méthodes vues (réutilisable au poste)" },
  { type: "exercices", libelle: "Exercices pratiques sur les cas réels des participants" },
];

describe("(f) programme — les ressources pédagogiques sont imprimées", () => {
  it("passe les trois ressources au gabarit, qui les imprime sous leur titre", async () => {
    mp.trainingSession.findUnique.mockResolvedValue(sessionProgramme(RESSOURCES_PROD));

    const r = await produireProgramme("s-1");

    expect(r.ok).toBe(true);
    expect(data()["ressourcesPedagogiques"]).toEqual(RESSOURCES_PROD.map((x) => x.libelle));
    const t = texte();
    expect(t).toContain("Ressources pédagogiques mises à disposition");
    expect(t).toContain("Fiche mémo des méthodes vues");
    expect(t).toContain("7. Modalités d'évaluation et sanction");
  });

  it("aucune ressource : la section est OMISE et la numérotation ne saute pas", async () => {
    mp.trainingSession.findUnique.mockResolvedValue(sessionProgramme([]));

    await produireProgramme("s-1");

    expect(data()["ressourcesPedagogiques"]).toBeUndefined();
    const t = texte();
    expect(t).not.toContain("Ressources pédagogiques mises à disposition");
    expect(t).toContain("6. Modalités d'évaluation et sanction");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Convocation : le matériel déclaré par la formation, hors distanciel pur
// ─────────────────────────────────────────────────────────────────────────────

function enrollmentConvocation(
  modalite: "presentiel" | "distanciel" | "hybride",
  moyensTechniques: string,
) {
  return {
    id: "enr-1",
    trainee: { id: "t-1", nom: "Blanc", prenom: "Simone", entreprise: "SCI Invest Sun" },
    session: {
      id: "s-1",
      titreSession: "IA pour l'immobilier",
      dateDebut: new Date("2026-09-05T07:00:00Z"),
      dateFin: new Date("2026-09-05T15:00:00Z"),
      modalite,
      ...LIEU,
      ...(modalite === "distanciel"
        ? { lieuType: "distanciel", lieuVisioUrl: "https://visio.example/1" }
        : {}),
      formationSnapshot: null,
      formation: { dureeHeures: 7, moyensTechniques },
      coFormateurs: [],
      formateurPrincipalId: null,
      numeroDossierOpco: null,
      financementType: "direct",
    },
  };
}

const MATERIEL = "Chaque participant apporte un ordinateur portable avec connexion internet.";

describe("convocation — le matériel déclaré par la formation est annoncé", () => {
  it("présentiel : imprime le champ de la formation, tel quel", async () => {
    mp.enrollment.findUnique.mockResolvedValue(enrollmentConvocation("presentiel", MATERIEL));

    const r = await produireConvocation("enr-1");

    expect(r.ok).toBe(true);
    expect(data()["materielAPrevoir"]).toBe(MATERIEL);
    const t = texte();
    expect(t).toContain("Matériel à prévoir sur place");
    expect(t).toContain(MATERIEL);
  });

  it("champ vide : rien n'est imprimé, aucun texte inventé", async () => {
    mp.enrollment.findUnique.mockResolvedValue(enrollmentConvocation("presentiel", "   "));

    await produireConvocation("enr-1");

    expect(data()["materielAPrevoir"]).toBeUndefined();
    expect(texte()).not.toContain("Matériel à prévoir sur place");
  });

  it("distanciel pur : la section présentiel n'apparaît pas", async () => {
    mp.enrollment.findUnique.mockResolvedValue(enrollmentConvocation("distanciel", MATERIEL));

    await produireConvocation("enr-1");

    const t = texte();
    expect(t).not.toContain("Matériel à prévoir sur place");
    expect(t).toContain("Équipement requis (distanciel)");
  });
});
