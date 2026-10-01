/**
 * L'ENVOI EN LIGNE EST UNIQUE, BORNÉ ET CLOISONNÉ (questionnaire en ligne,
 * 2026-10-01 ; avis de l'architecte B1, B3, B4, C3).
 *
 * Ce que le client peut faire depuis la page publique, et rien de plus :
 *
 *   · un jeton invalide, ou la base factice du build, ne coûte AUCUNE requête ;
 *   · seul `en_ligne` + `copie` s'ouvre ; `clos`, inconnu, brouillon, « à
 *     copier » → même refus neutre ;
 *   · une version DÉPASSÉE (une plus récente existe) ne s'ouvre plus (B3) ;
 *   · un dossier VIDÉ par l'effacement RGPD ne s'ouvre plus et ne se remplit
 *     plus (B4) ;
 *   · un second envoi ne réécrit rien (`deja_envoye`), même en course ;
 *   · si Will a remplacé les questions pendant que le client répondait, rien
 *     n'est validé (`questions_changees`, B1) ;
 *   · chaque réponse est bornée à `MAX_REPONSE`, chiffrée ;
 *   · une question d'un AUTRE questionnaire n'est jamais écrite (IDOR) ;
 *   · « Qui répond ? » : ligne d'ordre 0, 80 caractères, vidé s'il porte un
 *     canal de contact (C3) ;
 *   · la lecture IA n'est programmée que si le drapeau la permet.
 *
 * Chaque cas porte son contre-témoin (« contre-témoin : … ») : un envoi
 * valide qui, lui, écrit.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";
import { CLE_DE_TEST } from "../../../../../tests/outils/fixtures-enregistreur";
import {
  MAX_CHAMPS_ENVOI,
  MAX_QUI_REPOND,
  MAX_REPONSE,
  ORDRE_QUI_REPOND,
  REPONSE_JE_NE_SAIS_PAS,
} from "../constantes";
import { jetonQuestionnaire } from "../jeton";
import { enregistrerReponsesEnLigne, lireQuestionnairePublic } from "../reponses";

type Db = Parameters<typeof enregistrerReponsesEnLigne>[0];

const QID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const Q1 = "11111111-1111-4111-8111-111111111111";
const Q2 = "22222222-2222-4222-8222-222222222222";
const AUTRE = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
  vi.stubEnv("PII_ENCRYPTION_KEY", CLE_DE_TEST);
  vi.stubEnv("AUTH_SECRET", "secret-de-test-assez-long-pour-l-exemple");
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/test");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const jeton = () => jetonQuestionnaire(QID) as string;

interface Etat {
  statut?: "brouillon" | "copie" | "reponse_recue" | "clos";
  mode?: "a_copier" | "en_ligne";
  /** Questions au texte VIDÉ (effacement RGPD). */
  videes?: number;
  /** Une version plus récente existe-t-elle ? */
  depassee?: boolean;
  /** Lignes que `updateMany` du questionnaire « trouve » (0 = un autre envoi est passé). */
  passe?: number;
  /** Les questions relues DANS la transaction (B1) — par défaut, les mêmes. */
  questionsDansTx?: string[];
  /** Une version plus récente qui n'apparaît QUE sous le verrou (B3 revérifié). */
  depasseeDansTx?: boolean;
  rencontre?: { id: string } | null;
}

/** Le filtre B4 attendu : seules les questions au texte VIDÉ sont comptées. */
const COMPTE_VIDEES = { select: { questions: { where: { texte: "" } } } };

/**
 * Une base factice qui APPLIQUE les filtres (vérificateur rouge) : un `where`
 * faux ne passe plus inaperçu. Et une transaction `tx` DISTINCTE de `db` : ce
 * qui doit être relu ou écrit sous le verrou ne peut pas l'être par `db`.
 */
function base(e: Etat = {}) {
  // Les versions connues : celle-ci, une plus récente si `depassee`, et la
  // version 9 d'un AUTRE projet (un `findFirst` sans `projetId` la trouverait).
  const versions = (dansTx: boolean) => [
    { id: QID, projetId: "p", version: 1 },
    ...(e.depassee || (dansTx && e.depasseeDansTx)
      ? [{ id: "v2", projetId: "p", version: 2 }]
      : []),
    { id: "autre", projetId: "autre-projet", version: 9 },
  ];
  const chercherVersion =
    (dansTx: boolean) =>
    async (a: { where: { projetId?: string; version?: { gt?: number; gte?: number } } }) =>
      versions(dansTx).find(
        (v) =>
          (a.where.projetId === undefined || v.projetId === a.where.projetId) &&
          (a.where.version?.gt === undefined || v.version > a.where.version.gt) &&
          (a.where.version?.gte === undefined || v.version >= a.where.version.gte),
      ) ?? null;

  const lignes = (ids: string[], select: Record<string, unknown>) =>
    ids.map((id, i) =>
      "texte" in select
        ? { id, ordre: i + 1, texte: chiffrerParole(`Question ${i + 1} ?`) }
        : { id },
    );

  const findUnique = vi.fn().mockImplementation(async (a: { select: Record<string, unknown> }) => ({
    id: QID,
    statut: e.statut ?? "copie",
    mode: e.mode ?? "en_ligne",
    version: 1,
    clientId: "cl",
    projetId: "p",
    // Sans le filtre « texte vide », le compte porterait sur TOUTES les questions (2).
    _count: {
      questions:
        JSON.stringify(a.select["_count"]) === JSON.stringify(COMPTE_VIDEES) ? (e.videes ?? 0) : 2,
    },
  }));
  const dbFindMany = vi
    .fn()
    .mockImplementation(async (a: { select: Record<string, unknown> }) =>
      lignes([Q1, Q2], a.select),
    );

  const tx = {
    questionnaireCadrage: {
      updateMany: vi.fn().mockResolvedValue({ count: e.passe ?? 1 }),
      findFirst: vi.fn().mockImplementation(chercherVersion(true)),
    },
    questionnaireQuestion: {
      findMany: vi
        .fn()
        .mockImplementation(async (a: { select: Record<string, unknown> }) =>
          lignes(e.questionsDansTx ?? [Q1, Q2], a.select),
        ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  const db = {
    questionnaireCadrage: {
      findUnique,
      findFirst: vi.fn().mockImplementation(chercherVersion(false)),
    },
    // ⚠️ Pas d'`updateMany` ni d'`upsert` ici : une écriture hors transaction échoue.
    questionnaireQuestion: { findMany: dbFindMany },
    rencontre: {
      findFirst: vi.fn().mockResolvedValue(e.rencontre === undefined ? { id: "r" } : e.rencontre),
      findUnique: vi.fn().mockResolvedValue({ estTestInterne: false }),
    },
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };
  return {
    db: db as unknown as Db,
    tx,
    questionnaireCadrage: {
      findUnique,
      findFirst: db.questionnaireCadrage.findFirst,
      updateMany: tx.questionnaireCadrage.updateMany,
    },
    questionnaireQuestion: {
      findMany: dbFindMany,
      updateMany: tx.questionnaireQuestion.updateMany,
      upsert: tx.questionnaireQuestion.upsert,
    },
    $executeRaw: tx.$executeRaw,
  };
}

const envoyer = (
  db: Db,
  reponses: Array<[string, string]>,
  o: { jeton?: string; repondant?: string; mode?: "ferme" | "pilote" | "ouvert" } = {},
) =>
  enregistrerReponsesEnLigne(
    db,
    {
      questionnaireId: QID,
      jeton: o.jeton ?? jeton(),
      reponses: new Map(reponses),
      repondant: o.repondant ?? "",
    },
    { mode: o.mode ?? "ferme" },
  );

describe("la page publique ne montre que ce qu'elle doit", () => {
  it("contre-témoin : un lien en ligne envoyé s'ouvre, questions déchiffrées", async () => {
    const etat = await lireQuestionnairePublic(base().db, QID, jeton());
    expect(etat).toEqual({
      etat: "ouvert",
      questions: [
        { id: Q1, ordre: 1, texte: "Question 1 ?" },
        { id: Q2, ordre: 2, texte: "Question 2 ?" },
      ],
    });
  });

  it("un jeton altéré ne lit pas la base", async () => {
    const { db, questionnaireCadrage } = base();
    const j = jeton();
    const faux = `${j.slice(0, 5)}${j[5] === "x" ? "y" : "x"}${j.slice(6)}`;
    expect(await lireQuestionnairePublic(db, QID, faux)).toEqual({ etat: "introuvable" });
    expect(questionnaireCadrage.findUnique).not.toHaveBeenCalled();
  });

  it("au build (stub.invalid), aucune requête — même avec un bon jeton", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://stub:stub@stub.invalid:5432/stub");
    const { db, questionnaireCadrage, questionnaireQuestion } = base();
    expect(await lireQuestionnairePublic(db, QID, jeton())).toEqual({ etat: "introuvable" });
    expect(await envoyer(db, [[Q1, "oui"]])).toEqual({ issue: "introuvable" });
    expect(questionnaireCadrage.findUnique).not.toHaveBeenCalled();
    expect(questionnaireQuestion.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ["clos", { statut: "clos" as const }],
    ["brouillon (lien pas encore donné par Will)", { statut: "brouillon" as const }],
    ["« à copier »", { mode: "a_copier" as const }],
  ])("%s : la même page neutre", async (_, e) => {
    expect(await lireQuestionnairePublic(base(e).db, QID, jeton())).toEqual({
      etat: "introuvable",
    });
  });

  it("B3 : une version plus récente existe → page neutre", async () => {
    expect(await lireQuestionnairePublic(base({ depassee: true }).db, QID, jeton())).toEqual({
      etat: "introuvable",
    });
  });

  it("B4 : une question vidée par l'effacement RGPD → page neutre", async () => {
    expect(await lireQuestionnairePublic(base({ videes: 1 }).db, QID, jeton())).toEqual({
      etat: "introuvable",
    });
  });

  it("ne demande que les questions du client (ni vive voix, ni « qui répond », ni vidées)", async () => {
    const { db, questionnaireQuestion } = base();
    await lireQuestionnairePublic(db, QID, jeton());
    const where = questionnaireQuestion.findMany.mock.calls[0]?.[0]?.where;
    expect(where).toEqual({
      questionnaireId: QID,
      ordre: { gt: ORDRE_QUI_REPOND },
      poseeDeViveVoix: false,
      NOT: { texte: "" },
    });
  });

  it("réponses déjà reçues : « déjà envoyé »", async () => {
    expect(
      await lireQuestionnairePublic(base({ statut: "reponse_recue" }).db, QID, jeton()),
    ).toEqual({ etat: "deja_envoye" });
  });
});

describe("l'envoi est unique, borné et cloisonné", () => {
  it("contre-témoin : un envoi valide écrit les réponses chiffrées et passe « reçu »", async () => {
    const { db, questionnaireCadrage, questionnaireQuestion } = base();
    const issue = await envoyer(db, [
      [Q1, "  Douze personnes.  "],
      [Q2, REPONSE_JE_NE_SAIS_PAS],
    ]);
    expect(issue).toMatchObject({ issue: "enregistre", clientId: "cl", projetId: "p" });
    expect(questionnaireCadrage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: QID, statut: "copie", mode: "en_ligne" },
        data: expect.objectContaining({ statut: "reponse_recue" }),
      }),
    );
    const ecrit = questionnaireQuestion.updateMany.mock.calls[0]?.[0];
    expect(ecrit.where).toMatchObject({ id: Q1, questionnaireId: QID, poseeDeViveVoix: false });
    expect(ecrit.data.reponse.startsWith("enc:v1:")).toBe(true);
    expect(dechiffrerParole(ecrit.data.reponse)).toBe("Douze personnes.");
  });

  it("jeton invalide : rien n'est lu ni écrit", async () => {
    const { db, questionnaireCadrage } = base();
    expect(await envoyer(db, [[Q1, "oui"]], { jeton: "x".repeat(43) })).toEqual({
      issue: "introuvable",
    });
    expect(questionnaireCadrage.findUnique).not.toHaveBeenCalled();
    expect(questionnaireCadrage.updateMany).not.toHaveBeenCalled();
  });

  it("questionnaire clos : refusé, rien n'est écrit", async () => {
    const { db, questionnaireCadrage } = base({ statut: "clos" });
    expect(await envoyer(db, [[Q1, "oui"]])).toEqual({ issue: "introuvable" });
    expect(questionnaireCadrage.updateMany).not.toHaveBeenCalled();
  });

  it("B3 : version dépassée → refusé, rien n'est écrit", async () => {
    const { db, questionnaireCadrage } = base({ depassee: true });
    expect(await envoyer(db, [[Q1, "oui"]])).toEqual({ issue: "introuvable" });
    expect(questionnaireCadrage.updateMany).not.toHaveBeenCalled();
  });

  it("B4 : dossier vidé (RGPD) → refusé, aucune parole réécrite", async () => {
    const { db, questionnaireCadrage, questionnaireQuestion } = base({ videes: 2 });
    expect(await envoyer(db, [[Q1, "oui"]])).toEqual({ issue: "introuvable" });
    expect(questionnaireCadrage.updateMany).not.toHaveBeenCalled();
    expect(questionnaireQuestion.updateMany).not.toHaveBeenCalled();
  });

  it("second envoi : « déjà envoyé », rien n'est réécrit", async () => {
    const { db, questionnaireCadrage, questionnaireQuestion } = base({ statut: "reponse_recue" });
    expect(await envoyer(db, [[Q1, "autre chose"]])).toEqual({ issue: "deja_envoye" });
    expect(questionnaireCadrage.updateMany).not.toHaveBeenCalled();
    expect(questionnaireQuestion.updateMany).not.toHaveBeenCalled();
  });

  it("deux envois concurrents : le second ne trouve plus la ligne et n'écrit aucune réponse", async () => {
    const { db, questionnaireQuestion, $executeRaw } = base({ passe: 0 });
    expect(await envoyer(db, [[Q1, "en course"]], { mode: "ouvert" })).toEqual({
      issue: "deja_envoye",
    });
    expect(questionnaireQuestion.updateMany).not.toHaveBeenCalled();
    expect(questionnaireQuestion.upsert).not.toHaveBeenCalled();
    expect($executeRaw).not.toHaveBeenCalled();
  });

  it("B1 : questions remplacées pendant la saisie → rien n'est validé (`questions_changees`)", async () => {
    const { db, questionnaireQuestion, $executeRaw } = base({ questionsDansTx: [AUTRE] });
    expect(await envoyer(db, [[Q1, "réponse à l'ancienne question"]], { mode: "ouvert" })).toEqual({
      issue: "questions_changees",
    });
    expect(questionnaireQuestion.updateMany).not.toHaveBeenCalled();
    expect($executeRaw).not.toHaveBeenCalled();
  });

  it("B1 : une écriture qui ne touche aucune ligne annule tout", async () => {
    const { db, questionnaireQuestion } = base();
    questionnaireQuestion.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await envoyer(db, [[Q1, "oui"]])).toEqual({ issue: "questions_changees" });
    expect(questionnaireQuestion.upsert).not.toHaveBeenCalled();
  });

  it("une réponse trop longue est bornée à MAX_REPONSE", async () => {
    const { db, questionnaireQuestion } = base();
    await envoyer(db, [[Q1, "a".repeat(MAX_REPONSE + 3000)]]);
    const ecrit = questionnaireQuestion.updateMany.mock.calls[0]?.[0];
    expect(dechiffrerParole(ecrit.data.reponse)).toHaveLength(MAX_REPONSE);
  });

  it("trop de champs : refusé sans lire la base", async () => {
    const { db, questionnaireCadrage } = base();
    const champs: Array<[string, string]> = Array.from({ length: MAX_CHAMPS_ENVOI + 1 }, (_, i) => [
      `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      "x",
    ]);
    expect(await envoyer(db, champs)).toEqual({ issue: "introuvable" });
    expect(questionnaireCadrage.findUnique).not.toHaveBeenCalled();
  });

  it("IDOR : la question d'un autre questionnaire n'est jamais écrite", async () => {
    const { db, questionnaireQuestion } = base();
    await envoyer(db, [
      [Q1, "la mienne"],
      [AUTRE, "celle d'un autre client"],
    ]);
    const ids = questionnaireQuestion.updateMany.mock.calls.map((c) => c[0].where.id);
    expect(ids).toEqual([Q1]);
  });

  it("IDOR : un envoi qui ne vise QUE des questions étrangères n'écrit rien", async () => {
    const { db, questionnaireCadrage, questionnaireQuestion } = base();
    expect(await envoyer(db, [[AUTRE, "intrusion"]])).toEqual({ issue: "vide" });
    expect(questionnaireCadrage.updateMany).not.toHaveBeenCalled();
    expect(questionnaireQuestion.updateMany).not.toHaveBeenCalled();
  });

  it("un envoi vide est refusé, sans rien écrire", async () => {
    const { db, questionnaireCadrage } = base();
    expect(await envoyer(db, [[Q1, "   "]], { repondant: "Camille" })).toEqual({ issue: "vide" });
    expect(questionnaireCadrage.updateMany).not.toHaveBeenCalled();
  });

  it("« Qui répond ? » va dans la ligne d'ordre 0, chiffrée, sans caractère de contrôle", async () => {
    const { db, questionnaireQuestion } = base();
    await envoyer(db, [[Q1, "oui"]], { repondant: "  Camille\u0007 Fictive,\n DRH " });
    const u = questionnaireQuestion.upsert.mock.calls[0]?.[0];
    expect(u.where).toEqual({
      questionnaireId_ordre: { questionnaireId: QID, ordre: ORDRE_QUI_REPOND },
    });
    expect(u.create.poseeDeViveVoix).toBe(true);
    expect(dechiffrerParole(u.create.reponse)).toBe("Camille Fictive, DRH");
  });

  it("C3 : « Qui répond ? » est borné à 80 caractères", async () => {
    const { db, questionnaireQuestion } = base();
    await envoyer(db, [[Q1, "oui"]], { repondant: "x".repeat(300) });
    const u = questionnaireQuestion.upsert.mock.calls[0]?.[0];
    expect(dechiffrerParole(u.create.reponse)).toHaveLength(MAX_QUI_REPOND);
  });

  it.each([
    ["une adresse e-mail", "Camille, camille@exemple.fr"],
    ["un numéro de téléphone", "Camille 06 12 34 56 78"],
    ["une adresse web", "Camille www.exemple.fr"],
  ])(
    "C3 : « Qui répond ? » portant %s est vidé (ce n'est pas un canal de contact)",
    async (_, v) => {
      const { db, questionnaireQuestion } = base();
      expect(await envoyer(db, [[Q1, "oui"]], { repondant: v })).toMatchObject({
        issue: "enregistre",
      });
      expect(questionnaireQuestion.upsert).not.toHaveBeenCalled();
    },
  );

  it("drapeau fermé : la saisie passe, la lecture IA n'est PAS programmée", async () => {
    const { db, $executeRaw } = base();
    const issue = await envoyer(db, [[Q1, "oui"]], { mode: "ferme" });
    expect(issue).toMatchObject({ issue: "enregistre", lecturePrevue: false });
    expect($executeRaw).not.toHaveBeenCalled();
  });

  it("contre-témoin : drapeau ouvert, la lecture IA est programmée", async () => {
    const { db, $executeRaw } = base();
    const issue = await envoyer(db, [[Q1, "oui"]], { mode: "ouvert" });
    expect(issue).toMatchObject({ issue: "enregistre", lecturePrevue: true });
    expect($executeRaw).toHaveBeenCalled();
  });

  it("sans rendez-vous dans le projet : enregistré, aucune lecture programmée", async () => {
    const { db, $executeRaw } = base({ rencontre: null });
    expect(await envoyer(db, [[Q1, "oui"]], { mode: "ouvert" })).toMatchObject({
      issue: "enregistre",
      lecturePrevue: false,
    });
    expect($executeRaw).not.toHaveBeenCalled();
  });
});

describe("vérificateur rouge : les gardes lisent leurs vrais filtres", () => {
  it("B3 : la version plus récente se cherche sur CE projet, strictement après (`gt`)", async () => {
    const { db, questionnaireCadrage } = base();
    expect(await lireQuestionnairePublic(db, QID, jeton())).toMatchObject({ etat: "ouvert" });
    expect(questionnaireCadrage.findFirst.mock.calls[0]?.[0].where).toEqual({
      projetId: "p",
      version: { gt: 1 },
    });
  });

  it("B4 : le compte ne porte que sur les questions au texte vidé", async () => {
    const { db, questionnaireCadrage } = base();
    await lireQuestionnairePublic(db, QID, jeton());
    expect(questionnaireCadrage.findUnique.mock.calls[0]?.[0].select._count).toEqual(COMPTE_VIDEES);
  });

  it("B3 sous le verrou : une version apparue PENDANT l'envoi annule tout", async () => {
    const { db, questionnaireQuestion, $executeRaw } = base({ depasseeDansTx: true });
    expect(await envoyer(db, [[Q1, "oui"]], { mode: "ouvert" })).toEqual({ issue: "introuvable" });
    expect(questionnaireQuestion.updateMany).not.toHaveBeenCalled();
    expect($executeRaw).not.toHaveBeenCalled();
  });

  it("B1 : les questions sont relues par la TRANSACTION, pas par la base hors verrou", async () => {
    const { db, tx } = base();
    await envoyer(db, [[Q1, "oui"]]);
    expect(tx.questionnaireQuestion.findMany).toHaveBeenCalledTimes(1);
  });
});
