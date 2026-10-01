/**
 * ÉCRIRE SES QUESTIONS, PUIS OUVRIR LE LIEN (console, questionnaire en ligne,
 * 2026-10-01 ; avis de l'architecte B1, B2, C3).
 *
 * « Écrire mes questions » : une question par ligne, sans IA. Règle unique
 * (`versionRemplacable`) : seul un BROUILLON écrit par Will (ou un brouillon IA
 * vide), sans réponse ni fait, est remplacé en place ; sinon, nouvelle version
 * — et l'ancien lien en ligne encore sans réponse est CLOS dans la même
 * transaction. Un questionnaire « à copier » déjà copié reste intact.
 * « Lien du questionnaire en ligne » : `en_ligne` + `copie` ; refusé si clos,
 * déjà répondu, ou sans question à montrer.
 * La ligne « Qui répond ? » (ordre 0) n'est ni réécrite par la saisie de Will,
 * ni cochable « posée de vive voix ».
 *
 * Mutation qui rougit : remplacer une version `copie` (ce qui est parti chez le
 * client se réécrirait) ; effacer sans le verrou conditionnel (B1) ; oublier
 * de clore l'ancien lien ; retirer `QUESTIONS_REELLES` d'un des trois gestes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dechiffrerParole } from "@/lib/chiffrer-parole";
import { CLE_DE_TEST } from "../../../../../tests/outils/fixtures-enregistreur";
import { GesteRefuse } from "../../gestes-compte-rendu";
import {
  ecrireQuestions,
  enregistrerReponses,
  marquerPoseeDeViveVoix,
  marquerQuestionnaireCopie,
  ouvrirLienEnLigne,
  questionsDuTexte,
} from "../../gestes-suivi";
import {
  MAX_QUESTIONS_ECRITES,
  MODELE_QUESTIONS_DE_WILLIAMS,
  ORDRE_QUI_REPOND,
} from "../constantes";
import { versionRemplacable } from "../regles";

type Db = Parameters<typeof ecrireQuestions>[0];

beforeEach(() => {
  vi.stubEnv("PII_ENCRYPTION_KEY", CLE_DE_TEST);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const sansReponse = { reponseRecueLe: null, _count: { faitsProduits: 0 } };

function derniere(p: Record<string, unknown>) {
  return {
    id: "q",
    version: 3,
    statut: "brouillon",
    mode: "en_ligne",
    modele: MODELE_QUESTIONS_DE_WILLIAMS,
    questions: [sansReponse, sansReponse],
    ...p,
  };
}

function base(
  d: unknown,
  o: { statutPourLien?: string; visibles?: number; verrou?: number; cloture?: number } = {},
) {
  const questionnaireCadrage = {
    findFirst: vi.fn().mockResolvedValue(d),
    findUnique: vi.fn().mockResolvedValue({
      id: "q",
      statut: o.statutPourLien ?? "brouillon",
      clientId: "cl",
      projetId: "p",
    }),
    create: vi.fn().mockResolvedValue({ id: "nouveau" }),
    update: vi.fn().mockResolvedValue({}),
    // Le verrou B1 et la clôture de l'ancien lien sont deux `updateMany`
    // distincts : chacun a son propre résultat (sinon la clôture « réussirait »
    // toujours et sa course ne serait jamais testée).
    updateMany: vi.fn().mockImplementation(async (a: { data: { statut?: string } }) => ({
      count: a.data.statut === "clos" ? (o.cloture ?? 1) : (o.verrou ?? 1),
    })),
  };
  const questionnaireQuestion = {
    deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
    count: vi.fn().mockResolvedValue(o.visibles ?? 2),
    findMany: vi.fn().mockResolvedValue([{ id: "qq" }]),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    update: vi.fn().mockResolvedValue({}),
  };
  const db = {
    projet: { findUnique: vi.fn().mockResolvedValue({ clientId: "cl", fusionneDansId: null }) },
    rencontre: { findFirst: vi.fn().mockResolvedValue(null) },
    questionnaireCadrage,
    questionnaireQuestion,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };
  return { db: db as unknown as Db, questionnaireCadrage, questionnaireQuestion };
}

const ecrire = (db: Db, texte: string) =>
  ecrireQuestions(db, { clientId: "cl", projetId: "p", texte, parAdminId: "a" });

/** L'appel `updateMany` qui CLÔT une version (statut « clos »), s'il existe. */
const cloture = (m: ReturnType<typeof vi.fn>) =>
  m.mock.calls.find((c) => (c[0] as { data: { statut?: string } }).data.statut === "clos");

describe("écrire ses questions", () => {
  it("une question par ligne : numéros et puces retirés, lignes vides ignorées", () => {
    expect(
      questionsDuTexte(
        "1. Combien de personnes ?\n\n2) Quel calendrier ?\r\n- Quels outils ?\n   ",
      ),
    ).toEqual(["Combien de personnes ?", "Quel calendrier ?", "Quels outils ?"]);
  });

  it("sans questionnaire : une version 1, brouillon PAS en ligne, typeVise « autre », chiffrée", async () => {
    const { db, questionnaireCadrage, questionnaireQuestion } = base(null);
    await ecrire(db, "Combien de personnes ?\nQuel calendrier ?");
    expect(questionnaireCadrage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 1,
          // Seul le geste « Lien » ouvre l'accès en ligne (relecture exactitude 2).
          mode: "a_copier",
          statut: "brouillon",
          modele: MODELE_QUESTIONS_DE_WILLIAMS,
        }),
      }),
    );
    const lignes = questionnaireQuestion.createMany.mock.calls[0]?.[0].data;
    expect(lignes.map((l: { ordre: number }) => l.ordre)).toEqual([1, 2]);
    expect(lignes.every((l: { typeVise: string }) => l.typeVise === "autre")).toBe(true);
    expect(dechiffrerParole(lignes[1].texte)).toBe("Quel calendrier ?");
  });

  it("contre-témoin B2 : un BROUILLON de Will est remplacé en place, après le verrou (B1)", async () => {
    const { db, questionnaireCadrage, questionnaireQuestion } = base(derniere({}));
    await ecrire(db, "Une seule question ?");
    expect(questionnaireCadrage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q", statut: "brouillon", reponseRecueLe: null } }),
    );
    // Le verrou AVANT l'effacement.
    expect(questionnaireCadrage.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      questionnaireQuestion.deleteMany.mock.invocationCallOrder[0] as number,
    );
    expect(questionnaireQuestion.deleteMany).toHaveBeenCalledWith({
      where: { questionnaireId: "q" },
    });
    expect(questionnaireCadrage.create).not.toHaveBeenCalled();
    // Le remplacement ne met PAS le questionnaire en ligne.
    expect(questionnaireCadrage.update.mock.calls[0]?.[0].data.mode).toBe("a_copier");
  });

  it("course (exactitude 1) : le client vient de répondre à l'ancien lien → geste REFUSÉ, rien de créé", async () => {
    const { db, questionnaireCadrage, questionnaireQuestion } = base(
      derniere({ statut: "copie", mode: "en_ligne" }),
      { cloture: 0 },
    );
    await expect(ecrire(db, "Question corrigée ?")).rejects.toBeInstanceOf(GesteRefuse);
    expect(questionnaireCadrage.create).not.toHaveBeenCalled();
    expect(questionnaireQuestion.createMany).not.toHaveBeenCalled();
  });

  it("B1 : le verrou ne tient plus (le client vient d'agir) → rien n'est effacé, nouvelle version", async () => {
    const { db, questionnaireCadrage, questionnaireQuestion } = base(derniere({}), { verrou: 0 });
    await ecrire(db, "Question ?");
    expect(questionnaireQuestion.deleteMany).not.toHaveBeenCalled();
    expect(questionnaireCadrage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 4 }) }),
    );
  });

  it("B2 : un lien EN LIGNE déjà envoyé → nouvelle version, l'ancien est CLOS dans la transaction", async () => {
    const { db, questionnaireCadrage, questionnaireQuestion } = base(
      derniere({ statut: "copie", mode: "en_ligne" }),
    );
    const message = await ecrire(db, "Question corrigée ?");
    expect(questionnaireQuestion.deleteMany).not.toHaveBeenCalled();
    expect(cloture(questionnaireCadrage.updateMany)?.[0]).toMatchObject({
      where: { id: "q", statut: "copie", reponseRecueLe: null },
      data: { statut: "clos" },
    });
    expect(questionnaireCadrage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 4 }) }),
    );
    expect(message).toContain("L'ancien lien ne fonctionne plus");
  });

  it("B2 : un questionnaire « à copier » déjà copié reste INTACT (trace de ce qui est parti)", async () => {
    const { db, questionnaireCadrage, questionnaireQuestion } = base(
      derniere({ statut: "copie", mode: "a_copier", modele: "gpt-x" }),
    );
    await ecrire(db, "Question ?");
    expect(questionnaireQuestion.deleteMany).not.toHaveBeenCalled();
    expect(cloture(questionnaireCadrage.updateMany)).toBeUndefined();
    expect(questionnaireCadrage.create).toHaveBeenCalled();
  });

  it("B2 : un brouillon PRÉPARÉ PAR L'IA (avec questions) n'est pas remplacé", async () => {
    const { db, questionnaireQuestion, questionnaireCadrage } = base(
      derniere({ mode: "a_copier", modele: "gpt-x" }),
    );
    await ecrire(db, "Question ?");
    expect(questionnaireQuestion.deleteMany).not.toHaveBeenCalled();
    expect(questionnaireCadrage.create).toHaveBeenCalled();
  });

  it("un brouillon IA VIDE (préparation sans question) est repris en place", async () => {
    const { db, questionnaireQuestion, questionnaireCadrage } = base(
      derniere({ mode: "a_copier", modele: null, questions: [] }),
    );
    await ecrire(db, "Question ?");
    expect(questionnaireQuestion.deleteMany).toHaveBeenCalled();
    expect(questionnaireCadrage.create).not.toHaveBeenCalled();
  });

  it("réponses reçues : une NOUVELLE version, l'ancienne n'est pas touchée", async () => {
    const { db, questionnaireCadrage, questionnaireQuestion } = base(
      derniere({
        version: 2,
        statut: "reponse_recue",
        questions: [{ reponseRecueLe: new Date(), _count: { faitsProduits: 1 } }],
      }),
    );
    await ecrire(db, "Nouvelle question ?");
    expect(questionnaireQuestion.deleteMany).not.toHaveBeenCalled();
    expect(cloture(questionnaireCadrage.updateMany)).toBeUndefined();
    expect(questionnaireCadrage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 3 }) }),
    );
  });

  it("bornes : aucune question, ou trop de questions, est refusé", async () => {
    await expect(ecrire(base(null).db, " \n \n")).rejects.toBeInstanceOf(GesteRefuse);
    const trop = Array.from({ length: MAX_QUESTIONS_ECRITES + 1 }, (_, i) => `Q${i} ?`).join("\n");
    await expect(ecrire(base(null).db, trop)).rejects.toBeInstanceOf(GesteRefuse);
  });

  it("un projet d'une autre fiche est refusé", async () => {
    const { db } = base(null);
    const projet = (db as unknown as { projet: { findUnique: ReturnType<typeof vi.fn> } }).projet;
    projet.findUnique.mockResolvedValue({ clientId: "autre", fusionneDansId: null });
    await expect(ecrire(db, "Question ?")).rejects.toBeInstanceOf(GesteRefuse);
  });
});

describe("ouvrir le lien en ligne", () => {
  it("brouillon : passe en ligne ET « copié »", async () => {
    const { db, questionnaireCadrage } = base(null, { statutPourLien: "brouillon" });
    await ouvrirLienEnLigne(db, "q");
    expect(questionnaireCadrage.update).toHaveBeenCalledWith({
      where: { id: "q" },
      data: expect.objectContaining({ mode: "en_ligne", statut: "copie" }),
    });
  });

  it("clos ou déjà répondu : refusé, rien n'est écrit", async () => {
    for (const statut of ["clos", "reponse_recue"]) {
      const { db, questionnaireCadrage } = base(null, { statutPourLien: statut });
      await expect(ouvrirLienEnLigne(db, "q")).rejects.toBeInstanceOf(GesteRefuse);
      expect(questionnaireCadrage.update).not.toHaveBeenCalled();
    }
  });

  it("sans question à montrer au client : refusé (la ligne « qui répond » ne compte pas)", async () => {
    const { db, questionnaireQuestion } = base(null, { visibles: 0 });
    await expect(ouvrirLienEnLigne(db, "q")).rejects.toBeInstanceOf(GesteRefuse);
    expect(questionnaireQuestion.count.mock.calls[0]?.[0].where).toMatchObject({
      ordre: { gt: ORDRE_QUI_REPOND },
    });
  });
});

describe("C3 : la ligne « Qui répond ? » n'est pas une question pour la console", () => {
  it("« posée de vive voix » sur la ligne d'ordre 0 : refusé", async () => {
    const { db, questionnaireQuestion } = base(null);
    questionnaireQuestion.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(marquerPoseeDeViveVoix(db, "ligne-0", true)).rejects.toBeInstanceOf(GesteRefuse);
    expect(questionnaireQuestion.updateMany.mock.calls[0]?.[0].where).toMatchObject({
      ordre: { gt: ORDRE_QUI_REPOND },
    });
  });

  it("contre-témoin : une vraie question se coche", async () => {
    const { db } = base(null);
    await expect(marquerPoseeDeViveVoix(db, "qq", true)).resolves.toContain("vive voix");
  });

  it("la saisie collée par Will ne lit (donc n'écrit) que les vraies questions", async () => {
    const { db, questionnaireQuestion } = base(null, { statutPourLien: "copie" });
    await enregistrerReponses(db, { questionnaireId: "q", reponses: new Map([["qq", "oui"]]) });
    expect(questionnaireQuestion.findMany.mock.calls[0]?.[0].where).toEqual({
      questionnaireId: "q",
      ordre: { gt: ORDRE_QUI_REPOND },
    });
  });
});

describe("exactitude 2 : seul le geste « Lien » ouvre l'accès en ligne, et seul un envoi en ligne se dit « reçu en ligne »", () => {
  it("« J'ai copié » ne met PAS le questionnaire en ligne", async () => {
    const { db, questionnaireCadrage } = base(null, { statutPourLien: "brouillon" });
    await marquerQuestionnaireCopie(db, "q");
    expect(questionnaireCadrage.update.mock.calls[0]?.[0].data).not.toHaveProperty("mode");
  });

  it("des réponses COLLÉES repassent le questionnaire en « à copier »", async () => {
    const { db, questionnaireCadrage } = base(null, { statutPourLien: "copie" });
    await enregistrerReponses(db, { questionnaireId: "q", reponses: new Map([["qq", "oui"]]) });
    expect(questionnaireCadrage.update.mock.calls[0]?.[0].data).toMatchObject({
      statut: "reponse_recue",
      mode: "a_copier",
    });
  });

  it("contre-témoin : une correction APRÈS un envoi en ligne garde le mode (et la date)", async () => {
    const { db, questionnaireCadrage } = base(null, { statutPourLien: "reponse_recue" });
    await enregistrerReponses(db, { questionnaireId: "q", reponses: new Map([["qq", "oui"]]) });
    expect(questionnaireCadrage.update.mock.calls[0]?.[0].data).toEqual({
      statut: "reponse_recue",
    });
  });
});

describe("B2 : la règle de remplacement (`versionRemplacable`)", () => {
  const sans = { reponseRecueLe: null, faits: 0 };
  const de = (p: Partial<Parameters<typeof versionRemplacable>[0] & object>) =>
    versionRemplacable({
      statut: "brouillon",
      modele: MODELE_QUESTIONS_DE_WILLIAMS,
      questions: [sans],
      ...p,
    });

  it("contre-témoin : un brouillon de Will, sans réponse ni fait, se remplace", () => {
    expect(de({})).toBe(true);
  });
  it("un brouillon de Will avec UN FAIT tiré d'une réponse ne se remplace pas", () => {
    expect(de({ questions: [sans, { reponseRecueLe: null, faits: 1 }] })).toBe(false);
  });
  it("un brouillon de Will avec UNE RÉPONSE ne se remplace pas", () => {
    expect(de({ questions: [{ reponseRecueLe: new Date(), faits: 0 }] })).toBe(false);
  });
  it("une version partie chez le client, ou préparée par l'IA, ne se remplace pas", () => {
    expect(de({ statut: "copie" })).toBe(false);
    expect(de({ modele: "gpt-x" })).toBe(false);
    expect(de({ modele: null, questions: [] })).toBe(true);
    expect(versionRemplacable(null)).toBe(false);
  });
});
