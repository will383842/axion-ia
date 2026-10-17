/**
 * Chantier QNC, L11 — la fiche formateur est LIMITÉE AUX MESURES.
 *
 * Donnée de santé : le formateur n'a pas à savoir qu'un besoin a été DÉCLARÉ,
 * il a besoin de savoir ce que l'organisme a DÉCIDÉ pour adapter la séance.
 * Interrupteur `qualiopi.dossier_session.actif` allumé pour la session : la
 * fiche porte la mesure consignée, et plus le booléen. Éteint : rien ne change.
 * Jamais, dans aucun état : le détail déclaré, ni les réponses du positionnement.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: vi.fn(), findFirst: vi.fn() },
    setting: { findUnique: vi.fn(async () => null) },
  },
}));
vi.mock("@/server/qualiopi/adaptation/colonne-declaration", () => ({
  colonneDeclarationDisponible: vi.fn(async () => false),
}));

import { prisma } from "@/lib/prisma";
import { getTrainingSessionForFormateur, mesuresPourFormateur } from "../collectif-queries";

type Fn = ReturnType<typeof vi.fn>;
const p = prisma as unknown as {
  trainingSession: { findFirst: Fn };
  setting: { findUnique: Fn };
};

const TRAINER = "trainer-1";

function session(estTestInterne: boolean, adaptationsRealisees: string | null) {
  return {
    id: "s1",
    numero: "AXI-SESS-2026-1",
    titreSession: "IA pour RH",
    statut: "planifiee",
    modalite: "presentiel",
    estTestInterne,
    dateDebut: new Date("2026-09-01"),
    dateFin: new Date("2026-09-02"),
    formateurPrincipalId: TRAINER,
    sessionFormateurs: [],
    jours: [],
    enrollments: [
      {
        id: "e1",
        statut: "confirmee",
        tauxPresencePct: null,
        adaptationsRealisees,
        trainee: {
          nom: "Blanc",
          prenom: "Simone",
          entreprise: null,
          fonction: null,
          situationHandicap: true,
        },
        questionnaires: [
          { reponses: { besoinAdaptation: true, attentes: "reponse-privee-temoin" } },
        ],
      },
    ],
  };
}

function interrupteur(etat: string | null) {
  p.setting.findUnique.mockResolvedValue(etat === null ? null : { value: { etat } });
}

beforeEach(() => {
  vi.clearAllMocks();
  interrupteur(null);
});

describe("éteint — rien ne change", () => {
  it("le booléen « besoin déclaré » reste, aucune mesure n'est rendue", async () => {
    p.trainingSession.findFirst.mockResolvedValue(session(false, "salle accessible"));
    const r = await getTrainingSessionForFormateur("s1", TRAINER);
    expect(r?.inscrits[0]?.besoinAdaptationDeclare).toBe(true);
    expect(r?.inscrits[0]?.mesuresAdaptation).toBeNull();
    expect(JSON.stringify(r)).not.toContain("salle accessible");
  });
});

describe("actif — la mesure, et seulement elle", () => {
  it("la mesure consignée est rendue ; le besoin déclaré ne l'est plus", async () => {
    interrupteur("actif");
    p.trainingSession.findFirst.mockResolvedValue(session(false, "salle accessible"));
    const r = await getTrainingSessionForFormateur("s1", TRAINER);
    expect(r?.inscrits[0]?.mesuresAdaptation).toBe("salle accessible");
    expect(r?.inscrits[0]?.besoinAdaptationDeclare).toBeNull();
    const rendu = JSON.stringify(r);
    expect(rendu).not.toContain("reponse-privee-temoin");
    expect(rendu).not.toContain("situationHandicap");
  });

  it("rien de consigné : rien n'est rendu, pas même le besoin", async () => {
    interrupteur("actif");
    p.trainingSession.findFirst.mockResolvedValue(session(false, null));
    const r = await getTrainingSessionForFormateur("s1", TRAINER);
    expect(r?.inscrits[0]?.mesuresAdaptation).toBeNull();
    expect(r?.inscrits[0]?.besoinAdaptationDeclare).toBeNull();
  });
});

describe("essai — la session du banc d'essai seule", () => {
  it("session réelle : comme éteint ; session d'essai : comme actif", async () => {
    interrupteur("essai");
    p.trainingSession.findFirst.mockResolvedValue(session(false, "salle accessible"));
    const reelle = await getTrainingSessionForFormateur("s1", TRAINER);
    expect(reelle?.inscrits[0]?.besoinAdaptationDeclare).toBe(true);
    expect(reelle?.inscrits[0]?.mesuresAdaptation).toBeNull();
    p.trainingSession.findFirst.mockResolvedValue(session(true, "salle accessible"));
    const essai = await getTrainingSessionForFormateur("s1", TRAINER);
    expect(essai?.inscrits[0]?.mesuresAdaptation).toBe("salle accessible");
  });
});

describe("mesuresPourFormateur (pur)", () => {
  it("une réponse vide ne se lit pas", () => {
    expect(mesuresPourFormateur(null)).toBeNull();
    expect(mesuresPourFormateur("   ")).toBeNull();
  });
});
