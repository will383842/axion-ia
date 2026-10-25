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
    client: { findUnique: vi.fn() },
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
    questionnaireAvantAudit: { findMany: vi.fn() },
    clientFusion: { findMany: vi.fn() },
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

import { fichesCouvertes, questionnairesDesFiches } from "../de-la-fiche";
import { cheminConsole } from "../suivi";
import { deposerQuestionnaireClient, listerQuestionnairesSansRencontre } from "../serveur";

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
  bd.tx.client.findUnique.mockResolvedValue({ id: CID });
  bd.tx.questionnaireAvantAudit.create.mockResolvedValue({ id: "nouveau" });
  bd.tx.questionnaireAvantAudit.updateMany.mockResolvedValue({ count: 1 });
  bd.tx.$queryRaw.mockResolvedValue([]);
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
    bd.tx.client.findUnique.mockResolvedValue(null);
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
