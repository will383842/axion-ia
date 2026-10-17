/**
 * Correctifs L11b — l'action de choix en cartes et la réponse depuis l'espace.
 *
 *   - ARGENT : un indépendant ne se choisit en cartes que si la session est
 *     réglée par le paiement par mission (sinon le relevé mensuel paierait un
 *     autre montant que celui annoncé) ;
 *   - le choix écrit avant l'affectation n'est pas retenu si elle échoue ;
 *   - une réponse autre que « acceptee » ou « refusee » est rejetée, jamais lue
 *     comme un refus.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SESSION = UUID(1);
const A = UUID(11);
const MISSION = UUID(21);

const h = vi.hoisted(() => ({
  payeeParMission: vi.fn(async () => false),
  enregistrer: vi.fn(async () => undefined),
  abandonner: vi.fn(async () => undefined),
  assign: vi.fn(async () => ({ data: { missionProposee: true, avertissements: [] } }) as unknown),
  session: vi.fn(async () => ({ trainerId: "t" }) as unknown),
  repondre: vi.fn(async () => ({ data: { statut: "acceptee", sessionId: "s" } }) as unknown),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("@/server/formateur/guard", () => ({
  requireFormateurAction: vi.fn(async () => ({ trainerId: A })),
  getFormateurSession: h.session,
}));
vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: vi.fn(async () => true),
}));
vi.mock("@/server/qualiopi/formateurs-independants/conditions-figees", () => ({
  sessionPayeeParMission: h.payeeParMission,
}));
vi.mock("@/server/qualiopi/formateurs-independants/choix-formateur-service", () => ({
  enregistrerChoix: h.enregistrer,
  abandonnerChoix: h.abandonner,
  seDesister: vi.fn(),
  lireCartesChoix: vi.fn(async () => ({
    lieu: { distanciel: false, codePostal: "69003" },
    ouverte: true,
    disponibles: [
      {
        trainerId: A,
        nomCourt: "Marie D.",
        independant: true,
        regimeTva: "franchise_293b",
        departement: "69",
        proximite: "meme_departement",
        refus: [],
        avertissements: [],
      },
    ],
    indisponibles: [],
    choixActuels: [],
  })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: vi.fn(async () => ({ formateurPrincipalId: null })) },
    missionFormateur: { findFirst: vi.fn(async () => null) },
  },
}));
vi.mock("@/server/qualiopi/trainers/mission-formateur", () => ({
  STATUTS_ACCORD_DONNE: ["acceptee", "accord_hors_outil"],
}));
vi.mock("../_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ user: { id: UUID(5) } })),
  logQualiopiActivity: vi.fn(async () => undefined),
}));
vi.mock("../mission-formateur", () => ({ repondreMissionFormateurAction: h.repondre }));
vi.mock("../trainers", () => ({ assignTrainerToSessionAction: h.assign }));

import { choisirFormateursSessionAction, repondreDepuisFormulaireAction } from "../choix-formateur";

const SAISIE = {
  sessionId: SESSION,
  choix: [{ trainerId: A, rang: 1, forfaitDeplacementParJourHtCents: 0 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.payeeParMission.mockResolvedValue(false);
  h.session.mockResolvedValue({ trainerId: "t" });
});

describe("ARGENT — honoraires figés seulement sur une session réglée par mission", () => {
  it("session réglée par le relevé mensuel : refus, rien n'est écrit ni proposé", async () => {
    const r = await choisirFormateursSessionAction(SAISIE);
    expect(r).toMatchObject({ error: expect.stringContaining("relevé mensuel") });
    expect(h.enregistrer).not.toHaveBeenCalled();
    expect(h.assign).not.toHaveBeenCalled();
  });

  it("session réglée par mission : le choix est écrit avec le régime de TVA figé", async () => {
    h.payeeParMission.mockResolvedValue(true);
    const r = await choisirFormateursSessionAction(SAISIE);
    expect(r).toMatchObject({ data: { missionProposee: true } });
    expect(h.enregistrer).toHaveBeenCalledWith(
      SESSION,
      [
        expect.objectContaining({
          trainerId: A,
          tarifHtCents: 35_000,
          regimeTvaFige: "franchise_293b",
        }),
      ],
      expect.any(Date),
    );
  });

  it("l'affectation du 1er choix échoue : le choix n'est pas retenu", async () => {
    h.payeeParMission.mockResolvedValue(true);
    h.assign.mockResolvedValueOnce({ error: "Formateur non habilité." });
    const r = await choisirFormateursSessionAction(SAISIE);
    expect(r).toMatchObject({ error: expect.stringContaining("n'est pas retenu") });
    expect(h.abandonner).toHaveBeenCalledWith(SESSION, expect.any(Date));
  });
});

describe("réponse depuis le formulaire de l'espace", () => {
  function formulaire(reponse: string | null): FormData {
    const f = new FormData();
    f.set("missionId", MISSION);
    if (reponse !== null) f.set("reponse", reponse);
    return f;
  }

  it("session expirée : renvoi vers la connexion, aucune réponse enregistrée", async () => {
    h.session.mockResolvedValue(null);
    await expect(repondreDepuisFormulaireAction(formulaire("acceptee"))).rejects.toThrow(
      /REDIRECT .*connexion\?erreur=session/,
    );
    expect(h.repondre).not.toHaveBeenCalled();
  });

  it("une valeur autre qu'« acceptee » ou « refusee » est rejetée, jamais lue comme un refus", async () => {
    for (const v of ["autre", "", null]) {
      await expect(repondreDepuisFormulaireAction(formulaire(v))).rejects.toThrow(
        /REDIRECT .*erreur=reponse/,
      );
    }
    expect(h.repondre).not.toHaveBeenCalled();
  });

  it("« refusee » est bien un refus, « acceptee » un accord", async () => {
    await expect(repondreDepuisFormulaireAction(formulaire("refusee"))).rejects.toThrow(
      /reponse=refusee/,
    );
    expect(h.repondre).toHaveBeenLastCalledWith(expect.objectContaining({ reponse: "refusee" }));
    await expect(repondreDepuisFormulaireAction(formulaire("acceptee"))).rejects.toThrow(
      /reponse=acceptee/,
    );
    expect(h.repondre).toHaveBeenLastCalledWith(expect.objectContaining({ reponse: "acceptee" }));
  });
});

describe("ARGENT — proposition faite avant les cartes (relecture #1501, 2e tour)", () => {
  it("le 1er choix tient déjà une proposition SANS honoraires figés : refus, même à forfait 0", async () => {
    const { prisma } = await import("@/lib/prisma");
    h.payeeParMission.mockResolvedValue(true);
    vi.mocked(prisma.trainingSession.findUnique).mockResolvedValueOnce({
      formateurPrincipalId: A,
    } as never);
    vi.mocked(prisma.missionFormateur.findFirst).mockResolvedValueOnce({
      tarifHtCents: null,
      forfaitDeplacementParJourHtCents: null,
      regimeTvaFige: null,
    } as never);
    const r = await choisirFormateursSessionAction(SAISIE);
    expect(r).toMatchObject({ error: expect.stringContaining("sans honoraires") });
    expect(h.enregistrer).not.toHaveBeenCalled();
    expect(h.assign).not.toHaveBeenCalled();
  });
});
