/**
 * Questionnaire envoyé à une fiche SANS rendez-vous (2026-10-25). Base SIMULÉE : rien n'est écrit.
 * Garde : le dépôt ne supprime jamais, la liste des orphelins laisse les questionnaires des fiches
 * à leur fiche, le lien de la console mène à la fiche, et la fusion de fiches les suit sans
 * déplacer aucune ligne.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const CID = "11111111-1111-4111-8111-111111111111";
const ABSORBEE = "22222222-2222-4222-8222-222222222222";

const bd = vi.hoisted(() => {
  const tx = {
    questionnaireAvantAudit: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
  return {
    tx,
    questionnaireAvantAudit: { findMany: vi.fn(), findFirst: vi.fn() },
    clientFusion: { findMany: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: bd }));
// Modules qui tirent la session ou la file d'e-mails : sans objet ici (rien n'est envoyé).
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("../completer-fiche", () => ({ completerFicheDepuisQuestionnaire: vi.fn() }));

import {
  fichesCouvertes,
  ficheVivante,
  questionnairesDesFiches,
  questionnairesDirectsDesFiches,
} from "../de-la-fiche";
import { cheminConsole } from "../suivi";
import {
  deposerQuestionnaireClient,
  listerQuestionnairesSansRencontre,
  lireDuClientSansRendezVous,
} from "../serveur";

const HTML = `<!doctype html><html><head><title>Q</title></head><body>
<script>
"use strict";
const CONFIG = {
  marque: "Axion IA",
  client: "",
};
const payload = () => ({ schema: 3, mode: "main" });
</script></body></html>`;

beforeEach(() => {
  vi.clearAllMocks();
  bd.tx.questionnaireAvantAudit.create.mockResolvedValue({ id: "nouveau" });
  bd.tx.questionnaireAvantAudit.updateMany.mockResolvedValue({ count: 1 });
  // Verrou de la fiche : rend la ligne si elle existe.
  bd.tx.$queryRaw.mockResolvedValue([{ id: CID }]);
  bd.clientFusion.findMany.mockResolvedValue([]);
  bd.clientFusion.findFirst.mockResolvedValue(null);
  bd.questionnaireAvantAudit.findFirst.mockResolvedValue(null);
});

describe("dépôt du questionnaire d'une fiche", () => {
  it("rien d'envoyé : le brouillon est remplacé sur place, rien n'est créé ni supprimé", async () => {
    bd.tx.questionnaireAvantAudit.findFirst.mockResolvedValue({ id: "brouillon", envoyeLe: null });
    const r = await deposerQuestionnaireClient(CID, HTML);
    expect(r).toEqual({ id: "brouillon", nouveau: false });
    expect(bd.tx.questionnaireAvantAudit.create).not.toHaveBeenCalled();
    expect(bd.tx.questionnaireAvantAudit.deleteMany).not.toHaveBeenCalled();
  });

  it("déjà envoyé : le parti n'est pas touché, un NOUVEAU questionnaire est créé, rattaché à la fiche", async () => {
    bd.tx.questionnaireAvantAudit.findFirst.mockResolvedValue({
      id: "parti",
      envoyeLe: new Date(),
    });
    const r = await deposerQuestionnaireClient(CID, HTML);
    expect(r).toEqual({ id: "nouveau", nouveau: true });
    expect(bd.tx.questionnaireAvantAudit.updateMany).not.toHaveBeenCalled();
    expect(bd.tx.questionnaireAvantAudit.deleteMany).not.toHaveBeenCalled();
    expect(bd.tx.questionnaireAvantAudit.create.mock.calls[0]![0].data).toMatchObject({
      clientId: CID,
      html: HTML,
    });
    // Sans rendez-vous : aucune colonne rencontre_id n'est écrite.
    expect(bd.tx.questionnaireAvantAudit.create.mock.calls[0]![0].data).not.toHaveProperty(
      "rencontreId",
    );
  });

  it("brouillon envoyé entre-temps (course) : crée un nouveau plutôt que d'écraser le parti", async () => {
    bd.tx.questionnaireAvantAudit.findFirst.mockResolvedValue({ id: "b", envoyeLe: null });
    bd.tx.questionnaireAvantAudit.updateMany.mockResolvedValue({ count: 0 });
    expect(await deposerQuestionnaireClient(CID, HTML)).toEqual({ id: "nouveau", nouveau: true });
  });

  it("fiche introuvable : refus lisible, rien n'est créé", async () => {
    bd.tx.$queryRaw.mockResolvedValue([]);
    await expect(deposerQuestionnaireClient(CID, HTML)).rejects.toThrow(/introuvable/);
    expect(bd.tx.questionnaireAvantAudit.create).not.toHaveBeenCalled();
  });
});

describe("liste des questionnaires sans rencontre", () => {
  it("ne contient que les ORPHELINS : ceux d'une fiche se lisent dans la fiche", async () => {
    bd.questionnaireAvantAudit.findMany.mockResolvedValue([]);
    await listerQuestionnairesSansRencontre();
    expect(bd.questionnaireAvantAudit.findMany.mock.calls[0]![0].where).toEqual({
      rencontreId: null,
      clientId: null,
    });
  });
});

describe("chemin de la console", () => {
  it("rendez-vous d'abord, sinon la fiche, sinon la liste des orphelins", () => {
    expect(cheminConsole("r1", CID)).toBe("rendez-vous/rencontres/r1#questionnaire-avant-audit");
    expect(cheminConsole(null, CID)).toBe(`qualiopi/clients/${CID}?onglet=questionnaire`);
    expect(cheminConsole(null, null)).toBe("rendez-vous?vue=questionnaires");
    expect(cheminConsole(null)).toBe("rendez-vous?vue=questionnaires");
  });
});

describe("fusion de fiches", () => {
  it("la fiche absorbante couvre l'absorbée tant que la fusion n'est pas défaite", async () => {
    bd.clientFusion.findMany
      .mockResolvedValueOnce([{ absorbeId: ABSORBEE }])
      .mockResolvedValueOnce([]);
    expect(await fichesCouvertes(CID)).toEqual([CID, ABSORBEE]);
    // Seules les fusions NON défaites comptent : « Défaire » rend le questionnaire sans le déplacer.
    expect(bd.clientFusion.findMany.mock.calls[0]![0].where).toEqual({
      absorbantId: { in: [CID] },
      defaiteLe: null,
    });
  });

  it("une boucle de fusions ne tourne pas sans fin", async () => {
    bd.clientFusion.findMany.mockResolvedValue([{ absorbeId: CID }]);
    expect(await fichesCouvertes(CID)).toEqual([CID]);
  });

  it("le filtre couvre le rendez-vous ET le rattachement direct", () => {
    expect(questionnairesDesFiches([CID])).toEqual({
      OR: [{ clientId: { in: [CID] } }, { rencontre: { clientId: { in: [CID] } } }],
    });
  });
});

describe("après une fusion : le dépôt et la lecture visent le MÊME questionnaire", () => {
  it("le dépôt cherche dans la fiche et dans les fiches absorbées, comme la lecture", async () => {
    bd.clientFusion.findMany.mockResolvedValueOnce([{ absorbeId: ABSORBEE }]).mockResolvedValue([]);
    bd.questionnaireAvantAudit.findFirst.mockResolvedValue({ id: "b", creeLe: new Date() });
    await lireDuClientSansRendezVous(CID);
    const lecture = bd.questionnaireAvantAudit.findFirst.mock.calls[0]![0].where;
    expect(lecture).toEqual(questionnairesDirectsDesFiches([CID, ABSORBEE]));

    bd.clientFusion.findMany.mockResolvedValueOnce([{ absorbeId: ABSORBEE }]).mockResolvedValue([]);
    bd.tx.questionnaireAvantAudit.findFirst.mockResolvedValue({ id: "ancien", envoyeLe: null });
    await deposerQuestionnaireClient(CID, HTML);
    const depot = bd.tx.questionnaireAvantAudit.findFirst.mock.calls[0]![0].where;
    expect(depot).toEqual(lecture);
  });

  it("le brouillon de la fiche absorbée est mis à jour, rien n'est créé en double", async () => {
    bd.clientFusion.findMany.mockResolvedValueOnce([{ absorbeId: ABSORBEE }]).mockResolvedValue([]);
    bd.tx.questionnaireAvantAudit.findFirst.mockResolvedValue({ id: "de-B", envoyeLe: null });
    const r = await deposerQuestionnaireClient(CID, HTML);
    expect(r).toEqual({ id: "de-B", nouveau: false });
    expect(bd.tx.questionnaireAvantAudit.create).not.toHaveBeenCalled();
  });

  it("ficheVivante remonte à la fiche absorbante, et s'arrête sur une boucle", async () => {
    bd.clientFusion.findFirst
      .mockResolvedValueOnce({ absorbantId: CID })
      .mockResolvedValueOnce(null);
    expect(await ficheVivante(ABSORBEE)).toBe(CID);
    bd.clientFusion.findFirst.mockReset();
    bd.clientFusion.findFirst.mockResolvedValue({ absorbantId: ABSORBEE });
    expect(await ficheVivante(ABSORBEE)).toBe(ABSORBEE);
  });
});

describe("deux dépôts en même temps", () => {
  it("la fiche est verrouillée (FOR UPDATE) AVANT de chercher un questionnaire existant", async () => {
    const ordre: string[] = [];
    bd.tx.$queryRaw.mockImplementation(async () => {
      ordre.push("verrou");
      return [{ id: CID }];
    });
    bd.tx.questionnaireAvantAudit.findFirst.mockImplementation(async () => {
      ordre.push("lecture");
      return null;
    });
    await deposerQuestionnaireClient(CID, HTML);
    expect(ordre.slice(0, 2)).toEqual(["verrou", "lecture"]);
    const sql = String(bd.tx.$queryRaw.mock.calls[0]![0].join(" "));
    expect(sql).toMatch(/FROM clients WHERE id/);
    expect(sql).toMatch(/FOR UPDATE/);
  });
});
