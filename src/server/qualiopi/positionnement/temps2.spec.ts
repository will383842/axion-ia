/**
 * Chantier QNC, L04 — le passage du temps 2, interrupteur compris.
 * Éteint : aucune requête, aucun envoi. Allumé : positionnement retenu faute
 * de convention signée ; liste demandée puis rangée au dossier de la session.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const questionnaireFindMany = vi.fn();
const sessionFindMany = vi.fn();
const remiseCreate = vi.fn(async (_a: unknown) => ({}));
const relanceCreate = vi.fn(async (_a: unknown) => ({}));
const enqueueEmail = vi.fn(async (..._a: unknown[]) => ({ enqueued: true }));
const lireInterrupteur = vi.fn(async (_lot: string) => "eteint");

vi.mock("@/lib/prisma", () => {
  const tx = {
    remiseRetour: { create: (a: unknown) => remiseCreate(a) },
    relanceJournal: { create: (a: unknown) => relanceCreate(a) },
  };
  return {
    prisma: {
      questionnaire: { findMany: (a: unknown) => questionnaireFindMany(a) },
      trainingSession: { findMany: (a: unknown) => sessionFindMany(a) },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));
const creerOuActualiser = vi.fn(async (_a: unknown) => null);
const resoudreAlertesParCode = vi.fn(async (_c: readonly string[]) => 0);
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuActualiser: (a: unknown) => creerOuActualiser(a),
  resoudreAlertesParCode: (c: readonly string[]) => resoudreAlertesParCode(c),
}));
vi.mock("@/server/qualiopi/socle/interrupteurs", async () => ({
  ...(await vi.importActual<object>("@/server/qualiopi/socle/interrupteurs")),
  lireInterrupteurQualiopi: (lot: string) => lireInterrupteur(lot),
}));

import { passerDemandesListeStagiaires, positionnementsRetenusFauteDeConvention } from "./temps2";

const MAINTENANT = new Date("2026-11-02T07:30:00Z");
const signee = {
  type: "convention",
  statutSignature: "signee",
  annuleeAt: null,
  clientId: "c1",
  traineeId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  lireInterrupteur.mockResolvedValue("eteint");
});

describe("éteint = inchangé", () => {
  it("aucune requête, aucun envoi", async () => {
    expect((await positionnementsRetenusFauteDeConvention(["q1"])).size).toBe(0);
    expect(await passerDemandesListeStagiaires(MAINTENANT)).toMatchObject({ demandes: 0 });
    expect(questionnaireFindMany).not.toHaveBeenCalled();
    expect(sessionFindMany).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(creerOuActualiser).not.toHaveBeenCalled();
    expect(resoudreAlertesParCode).not.toHaveBeenCalled();
  });
});

describe("positionnement bloqué sans convention signée", () => {
  it("allumé : retenu sans convention signée, libéré avec", async () => {
    lireInterrupteur.mockResolvedValue("actif");
    const ins = (documents: unknown[]) => ({
      traineeId: "t1",
      clientId: null,
      estTestInterne: false,
      session: {
        numero: "AXI-S-2026-010",
        estTestInterne: false,
        interEntreprises: false,
        documents,
      },
    });
    questionnaireFindMany.mockResolvedValue([
      { id: "sans", enrollment: ins([]) },
      { id: "partielle", enrollment: ins([{ ...signee, statutSignature: "partielle" }]) },
      { id: "signee", enrollment: ins([signee]) },
    ]);
    const retenus = await positionnementsRetenusFauteDeConvention(["sans", "partielle", "signee"]);
    expect([...retenus].sort()).toEqual(["partielle", "sans"]);
    // 🔴 La retenue ne reste pas silencieuse : une alerte visible, sans nom.
    expect(creerOuActualiser).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "positionnement_retenu_sans_convention",
        titre: expect.stringContaining("(2)"),
        message: expect.stringContaining("AXI-S-2026-010"),
      }),
    );
    expect(resoudreAlertesParCode).not.toHaveBeenCalled();
  });

  it("allumé, plus rien de retenu : l'alerte est refermée", async () => {
    lireInterrupteur.mockResolvedValue("actif");
    questionnaireFindMany.mockResolvedValue([
      {
        id: "signee",
        enrollment: {
          traineeId: "t1",
          clientId: null,
          estTestInterne: false,
          session: {
            numero: "N",
            estTestInterne: false,
            interEntreprises: false,
            documents: [signee],
          },
        },
      },
    ]);
    expect((await positionnementsRetenusFauteDeConvention(["signee"])).size).toBe(0);
    expect(resoudreAlertesParCode).toHaveBeenCalledWith(["positionnement_retenu_sans_convention"]);
    expect(creerOuActualiser).not.toHaveBeenCalled();
  });

  it("🔴 inter : un particulier n'est pas couvert par la convention d'une autre entreprise", async () => {
    lireInterrupteur.mockResolvedValue("actif");
    questionnaireFindMany.mockResolvedValue([
      {
        id: "particulier",
        enrollment: {
          traineeId: "t1",
          clientId: null,
          estTestInterne: false,
          session: {
            numero: "N",
            estTestInterne: false,
            interEntreprises: true,
            documents: [signee],
          },
        },
      },
    ]);
    expect([...(await positionnementsRetenusFauteDeConvention(["particulier"]))]).toEqual([
      "particulier",
    ]);
  });

  it("essai : seules les sessions du banc d'essai sont retenues", async () => {
    lireInterrupteur.mockResolvedValue("essai");
    questionnaireFindMany.mockResolvedValue([
      {
        id: "reelle",
        enrollment: {
          traineeId: "t1",
          clientId: null,
          estTestInterne: false,
          session: { estTestInterne: false, documents: [] },
        },
      },
      {
        id: "essai",
        enrollment: {
          traineeId: "t1",
          clientId: null,
          estTestInterne: false,
          session: { estTestInterne: true, documents: [] },
        },
      },
    ]);
    expect([...(await positionnementsRetenusFauteDeConvention(["reelle", "essai"]))]).toEqual([
      "essai",
    ]);
  });
});

describe("liste des stagiaires demandée à l'entreprise", () => {
  const session = (remises: { survenuLe: Date }[], inscrits = 1) => ({
    id: "s1",
    numero: "AXI-S-2026-010",
    titreSession: "IA générative",
    dateDebut: new Date("2026-11-20T08:00:00Z"),
    nbParticipantsPrevus: 4,
    clientId: "c1",
    estTestInterne: false,
    client: {
      raisonSociale: "Atelier Lumen",
      contactNom: "Camille",
      contactEmail: "c@exemple.invalid",
    },
    documents: [signee],
    _count: { enrollments: inscrits },
    remisesRetours: remises,
  });

  it("demande : e-mail à l'entreprise, remise rangée au dossier, pas de relance journalisée", async () => {
    lireInterrupteur.mockResolvedValue("actif");
    sessionFindMany.mockResolvedValue([session([])]);
    const b = await passerDemandesListeStagiaires(MAINTENANT);
    expect(b).toMatchObject({ demandes: 1, relances: 0 });
    expect(enqueueEmail).toHaveBeenCalledWith(
      "qualiopi-liste-stagiaires",
      "c@exemple.invalid",
      "fr",
      expect.objectContaining({ nbPrevus: 4, nbInscrits: 1, relance: false }),
      expect.anything(),
    );
    expect(remiseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "s1",
        nature: "remise",
        destinataire: "entreprise",
        objet: "liste_stagiaires",
      }),
    });
    expect(relanceCreate).not.toHaveBeenCalled();
  });

  it("relance : rang 1 au journal des relances", async () => {
    lireInterrupteur.mockResolvedValue("actif");
    sessionFindMany.mockResolvedValue([session([{ survenuLe: new Date("2026-10-28T07:30:00Z") }])]);
    const b = await passerDemandesListeStagiaires(MAINTENANT);
    expect(b.relances).toBe(1);
    expect(relanceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ rang: 1, automatique: true, objet: "liste_stagiaires" }),
    });
  });

  it("envoi non parti : aucune trace (le passage suivant reprend)", async () => {
    lireInterrupteur.mockResolvedValue("actif");
    sessionFindMany.mockResolvedValue([session([])]);
    enqueueEmail.mockResolvedValueOnce({ enqueued: false });
    expect((await passerDemandesListeStagiaires(MAINTENANT)).ko).toBe(1);
    expect(remiseCreate).not.toHaveBeenCalled();
  });

  it("liste complète : rien ne part", async () => {
    lireInterrupteur.mockResolvedValue("actif");
    sessionFindMany.mockResolvedValue([session([], 4)]);
    await passerDemandesListeStagiaires(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});
