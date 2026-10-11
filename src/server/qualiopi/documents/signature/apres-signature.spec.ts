/**
 * Lot S6a — l'après-signature commun, éprouvé branche par branche.
 *
 * Seuls les voisins sont simulés (Prisma, remise, Telegram, activation) : la
 * fonction elle-même est la vraie.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  transmettre: vi.fn(),
  copie: vi.fn(),
  telegram: vi.fn(),
  positionnement: vi.fn(),
  lettreDue: vi.fn(),
  reevaluer: vi.fn(),
  activer: vi.fn(),
  log: vi.fn(),
  p: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { findMany: vi.fn() },
    questionnaire: { findMany: vi.fn(), update: vi.fn() },
    trainer: { findUnique: vi.fn(), updateMany: vi.fn() },
    trainerDocument: { findFirst: vi.fn(), create: vi.fn() },
    activityLog: { create: vi.fn() },
    setting: { findMany: vi.fn() },
  },
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: h.telegram }));
vi.mock("./transmission-exemplaire", () => ({
  transmettreExemplaireSigne: h.transmettre,
  transmettreCopiePartielle: h.copie,
}));
vi.mock("@/server/qualiopi/notifications/notifications-service", () => ({
  envoyerPositionnement: h.positionnement,
}));
vi.mock("./crochets-mission", () => ({ lettreDue: h.lettreDue, reevaluerMission: h.reevaluer }));
vi.mock("@/server/qualiopi/formateurs-independants/activation", () => ({
  changerActivationFormateur: h.activer,
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: h.log }));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  devisConcernesPourEmission: vi.fn(async () => []),
  emettreDevisSigne: vi.fn(),
  transactionDevisSigne: vi.fn(async (_p: unknown, fn: (tx: unknown) => Promise<void>) =>
    fn({ devis: { updateMany: vi.fn() } }),
  ),
}));

import { apresSignature, type ContexteApresSignature } from "./apres-signature";

const ADMIN = { userId: "adm-1", role: "admin", email: "x", name: "x" } as never;
const DOC = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";

function ctx(patch: Partial<ContexteApresSignature> = {}): ContexteApresSignature {
  return {
    documentGenereId: DOC,
    type: "lettre_mission",
    numero: "AXI-DOC-2026-100",
    statutSignature: "signee",
    partie: "axionia",
    acteur: { type: "administrateur", session: ADMIN },
    ...patch,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Ce fichier éprouve les comportements NEUFS de S6a : leurs interrupteurs
  // sont allumés. Clé absente = comportement d'avant S6a, éprouvé dans
  // `apres-signature-interrupteurs.spec.ts`.
  h.p.setting.findMany.mockResolvedValue(
    [
      "signature.copie_partielle",
      "signature.exemplaire_contrat_travail",
      "signature.alertes_hors_jeton",
      "formateurs.suite_contrat_cadre",
    ].map((key) => ({ key, value: { actif: true } })),
  );
  h.transmettre.mockResolvedValue({ ok: true, destinataires: ["f@x.test"], r2Key: "k" });
  h.copie.mockResolvedValue({ ok: true, r2Key: "k2" });
  h.telegram.mockResolvedValue(undefined);
  h.p.documentSignature.findMany.mockResolvedValue([{ partie: "formateur" }]);
  h.p.documentGenere.findUnique.mockResolvedValue({ sessionId: null, trainerId: null });
  h.p.questionnaire.findMany.mockResolvedValue([]);
  h.activer.mockResolvedValue({
    ok: true,
    actif: true,
    inchange: false,
    sollicitationsRetirees: 0,
  });
});

describe("remise de l'exemplaire", () => {
  it("lettre signée par le formateur puis contresignée : l'exemplaire part SANS le rattrapage", async () => {
    await apresSignature(
      ctx({ statutSignature: "partielle", partie: "formateur", acteur: { type: "signataire" } }),
    );
    expect(h.transmettre).not.toHaveBeenCalled();

    await apresSignature(ctx({ statutSignature: "signee", partie: "axionia" }));
    expect(h.transmettre).toHaveBeenCalledOnce();
    expect(h.transmettre).toHaveBeenCalledWith(DOC);
  });

  it("une panne de remise ne lève jamais", async () => {
    h.transmettre.mockRejectedValue(new Error("redis"));
    await expect(apresSignature(ctx())).resolves.toBeUndefined();
  });
});

describe("signature partielle", () => {
  it("alerte « reste à signer » SANS donnée personnelle, et copie partielle au signataire", async () => {
    await apresSignature(
      ctx({ statutSignature: "partielle", partie: "formateur", acteur: { type: "signataire" } }),
    );
    expect(h.telegram).toHaveBeenCalledOnce();
    const corps = String(h.telegram.mock.calls[0]![0].body);
    expect(corps).toContain("AXI-DOC-2026-100");
    expect(corps).toContain("Reste à signer : axionia");
    expect(corps).not.toMatch(/@/);
    expect(h.copie).toHaveBeenCalledOnce();
    expect(h.copie).toHaveBeenCalledWith(DOC, "formateur");
  });
});

describe("pièce engageante", () => {
  it("convention intégralement signée : positionnement puis crochet lettreDue", async () => {
    await apresSignature(ctx({ type: "convention" }));
    expect(h.p.documentGenere.findUnique).toHaveBeenCalled();
    expect(h.lettreDue).toHaveBeenCalledOnce();
    expect(h.lettreDue).toHaveBeenCalledWith(DOC);
  });

  it("le devis n'est pas engageant : pas de lettre due", async () => {
    await apresSignature(ctx({ type: "devis" }));
    expect(h.lettreDue).not.toHaveBeenCalled();
  });
});

describe("lettre de mission", () => {
  it("chaque signature réévalue la mission", async () => {
    await apresSignature(
      ctx({ statutSignature: "partielle", partie: "formateur", acteur: { type: "signataire" } }),
    );
    await apresSignature(ctx());
    expect(h.reevaluer).toHaveBeenCalledTimes(2);
  });
});

describe("contrat de sous-traitance d'un formateur indépendant", () => {
  const signeLe = new Date("2026-10-10T10:00:00Z");

  beforeEach(() => {
    h.p.documentGenere.findUnique.mockResolvedValue({
      trainerId: TRAINER,
      hashSha256: "a".repeat(64),
      signatures: [{ signeAt: signeLe }],
    });
    h.p.trainer.findUnique.mockResolvedValue({ statut: "sous_traitant" });
    h.p.trainerDocument.findFirst.mockResolvedValue(null);
  });

  it("date, casier, preuve, puis activation DEMANDÉE au nom de l'administrateur", async () => {
    await apresSignature(ctx({ type: "contrat_sous_traitance" }));
    expect(h.p.trainer.updateMany.mock.calls[0]![0].data).toEqual({
      sousTraitantContratSigneAt: signeLe,
    });
    expect(h.p.trainerDocument.create.mock.calls[0]![0].data).toMatchObject({
      trainerId: TRAINER,
      type: "contrat_sous_traitance",
      numeroPiece: "AXI-DOC-2026-100",
      hashSha256: "a".repeat(64),
    });
    expect(h.log).toHaveBeenCalledOnce();
    expect(h.activer).toHaveBeenCalledOnce();
    expect(h.activer.mock.calls[0]![0]).toMatchObject({
      trainerId: TRAINER,
      actif: true,
      acteur: { type: "administrateur", session: ADMIN },
    });
  });

  it("complété par un signataire : AUCUNE activation, jamais par « système »", async () => {
    await apresSignature(
      ctx({
        type: "contrat_sous_traitance",
        partie: "sous_traitant",
        acteur: { type: "signataire" },
      }),
    );
    expect(h.activer).not.toHaveBeenCalled();
    expect(h.p.activityLog.create).toHaveBeenCalledOnce();
  });

  it("un salarié ou un organisme sous-traitant n'est pas concerné", async () => {
    h.p.trainer.findUnique.mockResolvedValue({ statut: "salarie" });
    await apresSignature(ctx({ type: "contrat_sous_traitance" }));
    expect(h.p.trainer.updateMany).not.toHaveBeenCalled();
    expect(h.activer).not.toHaveBeenCalled();

    h.p.documentGenere.findUnique.mockResolvedValue({ trainerId: null, signatures: [] });
    await apresSignature(ctx({ type: "contrat_sous_traitance" }));
    expect(h.activer).not.toHaveBeenCalled();
  });

  it("un casier déjà classé n'est pas doublé", async () => {
    h.p.trainerDocument.findFirst.mockResolvedValue({ id: "td-1" });
    await apresSignature(ctx({ type: "contrat_sous_traitance" }));
    expect(h.p.trainerDocument.create).not.toHaveBeenCalled();
  });
});

describe("contrat de travail", () => {
  it("le contrat signé est classé au casier du salarié", async () => {
    h.p.documentGenere.findUnique.mockResolvedValue({ trainerId: TRAINER });
    h.p.trainerDocument.findFirst.mockResolvedValue(null);
    await apresSignature(ctx({ type: "contrat_travail" }));
    expect(h.p.trainerDocument.create.mock.calls[0]![0].data).toMatchObject({
      trainerId: TRAINER,
      type: "contrat_travail",
      statutValidation: "valide",
    });
    expect(h.transmettre).toHaveBeenCalledOnce();
  });
});
