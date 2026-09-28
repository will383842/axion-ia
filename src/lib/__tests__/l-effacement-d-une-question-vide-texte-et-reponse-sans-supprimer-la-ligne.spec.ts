/**
 * L'EFFACEMENT D'UNE QUESTION VIDE TEXTE ET RÉPONSE SANS SUPPRIMER LA LIGNE
 * (chantier visio, PR 2 ; plan §3.3 c-bis, vérification C26).
 *
 * Un fait issu d'une réponse de questionnaire pointe sa question source par
 * une clé RESTRICT : supprimer la question serait refusé par la base (et
 * ferait échouer tout l'effacement). L'effacement de la personne à qui le
 * questionnaire a été adressé VIDE donc `texte` et `reponse`, et garde la
 * ligne.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  appels: [] as Array<{ table: string; op: string; args: unknown }>,
}));

vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e}`,
}));

vi.mock("@/lib/prisma", () => {
  const modele = (table: string, lignes: unknown[] = []) => ({
    findMany: async (args: unknown) => {
      etat.appels.push({ table, op: "findMany", args });
      return lignes;
    },
    updateMany: async (args: unknown) => {
      etat.appels.push({ table, op: "updateMany", args });
      return { count: table === "questionnaireQuestion" ? 3 : 0 };
    },
    deleteMany: async (args: unknown) => {
      etat.appels.push({ table, op: "deleteMany", args });
      return { count: 0 };
    },
    createMany: async () => ({ count: 0 }),
  });
  const tx = {
    $executeRawUnsafe: async () => 0,
    clientContactAdresse: modele("clientContactAdresse", [
      { contactId: "contact-alice", emailHash: "h:alice@exemple.fr" },
    ]),
    clientContact: modele("clientContact"),
    rencontreParticipant: modele("rencontreParticipant"),
    transcriptionSegment: modele("transcriptionSegment"),
    fait: modele("fait"),
    faitEvenement: modele("faitEvenement"),
    preRemplissage: modele("preRemplissage"),
    compteRendu: modele("compteRendu"),
    questionnaireCadrage: modele("questionnaireCadrage", [{ id: "questionnaire-1" }]),
    questionnaireQuestion: modele("questionnaireQuestion"),
    emailSuivi: modele("emailSuivi"),
    projetContact: modele("projetContact"),
    effacementJournal: modele("effacementJournal"),
  };
  return { prisma: { ...tx, $transaction: async (fn: (t: unknown) => unknown) => fn(tx) } };
});

import { effacerCibleParAdresses } from "../rgpd-erase";

beforeEach(() => {
  etat.appels = [];
});

describe("l'effacement d'une question vide texte et réponse sans supprimer la ligne", () => {
  it("les questions du questionnaire adressé à la personne sont vidées", async () => {
    const r = await effacerCibleParAdresses(["alice@exemple.fr"]);
    const maj = etat.appels.find(
      (a) => a.table === "questionnaireQuestion" && a.op === "updateMany",
    );
    expect(maj?.args).toEqual({
      where: { questionnaireId: { in: ["questionnaire-1"] } },
      data: { texte: "", reponse: null },
    });
    expect(r.questions).toBe(3);
  });

  it("aucune question n'est supprimée", async () => {
    await effacerCibleParAdresses(["alice@exemple.fr"]);
    expect(
      etat.appels.some((a) => a.table === "questionnaireQuestion" && a.op === "deleteMany"),
    ).toBe(false);
    expect(
      etat.appels.some((a) => a.table === "questionnaireCadrage" && a.op === "deleteMany"),
    ).toBe(false);
  });

  it("le questionnaire est retrouvé par la personne destinataire", async () => {
    await effacerCibleParAdresses(["alice@exemple.fr"]);
    const lecture = etat.appels.find(
      (a) => a.table === "questionnaireCadrage" && a.op === "findMany",
    );
    expect(lecture?.args).toMatchObject({
      where: { contactDestinataireId: { in: ["contact-alice"] } },
    });
  });
});
