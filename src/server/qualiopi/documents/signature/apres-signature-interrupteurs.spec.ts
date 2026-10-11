/**
 * Lot S6a — les comportements NEUFS de l'après-signature sont livrés ÉTEINTS.
 *
 * Pour chacun des quatre : clé absente → exactement ce que faisait `main`
 * avant S6a ; clé allumée → le nouveau comportement. Une lecture des réglages
 * en panne vaut « clé absente ».
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  transmettre: vi.fn(),
  copie: vi.fn(),
  telegram: vi.fn(),
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
  envoyerPositionnement: vi.fn(),
}));
vi.mock("./crochets-mission", () => ({ lettreDue: vi.fn(), reevaluerMission: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/activation", () => ({
  changerActivationFormateur: h.activer,
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: h.log }));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  devisConcernesPourEmission: vi.fn(async () => []),
  emettreDevisSigne: vi.fn(),
  transactionDevisSigne: vi.fn(),
}));

import { apresSignature, type ContexteApresSignature } from "./apres-signature";

const ADMIN = { userId: "adm-1", role: "admin", email: "x", name: "x" } as never;
const DOC = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";

function ctx(patch: Partial<ContexteApresSignature> = {}): ContexteApresSignature {
  return {
    documentGenereId: DOC,
    type: "convention",
    numero: "AXI-DOC-2026-200",
    statutSignature: "partielle",
    partie: "client",
    acteur: { type: "signataire" },
    ...patch,
  };
}

/** Allume les clés données ; toutes les autres sont ABSENTES. */
function allumer(...cles: string[]): void {
  h.p.setting.findMany.mockResolvedValue(cles.map((key) => ({ key, value: { actif: true } })));
}

beforeEach(() => {
  vi.clearAllMocks();
  allumer();
  h.transmettre.mockResolvedValue({ ok: true, destinataires: ["s@x.test"], r2Key: "k" });
  h.copie.mockResolvedValue({ ok: true, r2Key: "k2" });
  h.telegram.mockResolvedValue(undefined);
  h.p.documentSignature.findMany.mockResolvedValue([{ partie: "client" }]);
  h.p.documentGenere.findUnique.mockResolvedValue({ sessionId: null, trainerId: null });
  h.p.questionnaire.findMany.mockResolvedValue([]);
  h.activer.mockResolvedValue({ ok: true, actif: true, inchange: false });
});

describe("(1) copie partielle au signataire — signature.copie_partielle", () => {
  it("clé absente : aucune copie, ni par jeton ni côté formateur", async () => {
    await apresSignature(ctx({ canal: "lien_a_jeton" }));
    await apresSignature(
      ctx({ type: "lettre_mission", partie: "formateur", acteur: { type: "signataire" } }),
    );
    expect(h.copie).not.toHaveBeenCalled();
  });

  it("clé allumée : copie au signataire", async () => {
    allumer("signature.copie_partielle");
    await apresSignature(ctx({ canal: "lien_a_jeton" }));
    expect(h.copie).toHaveBeenCalledOnce();
    expect(h.copie).toHaveBeenCalledWith(DOC, "client");
  });

  it("lecture des réglages en panne : comme clé absente", async () => {
    h.p.setting.findMany.mockRejectedValue(new Error("db"));
    await expect(apresSignature(ctx({ canal: "lien_a_jeton" }))).resolves.toBeUndefined();
    expect(h.copie).not.toHaveBeenCalled();
  });

  it("valeur illisible : comme clé absente", async () => {
    h.p.setting.findMany.mockResolvedValue([
      { key: "signature.copie_partielle", value: { actif: "true" } },
    ]);
    await apresSignature(ctx({ canal: "lien_a_jeton" }));
    expect(h.copie).not.toHaveBeenCalled();
  });
});

describe("(2) exemplaire du contrat de travail — signature.exemplaire_contrat_travail", () => {
  beforeEach(() => {
    h.p.documentGenere.findUnique.mockResolvedValue({ trainerId: TRAINER });
    h.p.trainerDocument.findFirst.mockResolvedValue(null);
  });
  const signe = () =>
    ctx({
      type: "contrat_travail",
      statutSignature: "signee",
      partie: "axionia",
      acteur: { type: "administrateur", session: ADMIN },
    });

  it("clé absente : classé au dossier, NON remis", async () => {
    await apresSignature(signe());
    expect(h.transmettre).not.toHaveBeenCalled();
    expect(h.p.trainerDocument.create).toHaveBeenCalledOnce();
  });

  it("clé allumée : classé ET remis", async () => {
    allumer("signature.exemplaire_contrat_travail");
    await apresSignature(signe());
    expect(h.transmettre).toHaveBeenCalledWith(DOC);
    expect(h.p.trainerDocument.create).toHaveBeenCalledOnce();
  });

  it("les autres pièces restent remises, clé absente comme avant", async () => {
    await apresSignature(ctx({ statutSignature: "signee", canal: "lien_a_jeton" }));
    expect(h.transmettre).toHaveBeenCalledWith(DOC);
  });
});

describe("(3) alertes Telegram hors lien à jeton — signature.alertes_hors_jeton", () => {
  const contresignaturePartielle = () =>
    ctx({ partie: "axionia", acteur: { type: "administrateur", session: ADMIN } });

  it("clé absente : contresignature partielle SANS alerte", async () => {
    await apresSignature(contresignaturePartielle());
    expect(h.telegram).not.toHaveBeenCalled();
  });

  it("clé absente : lettre de mission et contrat de travail côté signataire SANS alerte", async () => {
    await apresSignature(
      ctx({ type: "lettre_mission", partie: "formateur", acteur: { type: "signataire" } }),
    );
    await apresSignature(
      ctx({ type: "contrat_travail", partie: "formateur", acteur: { type: "signataire" } }),
    );
    expect(h.telegram).not.toHaveBeenCalled();
  });

  it("clé absente : le lien à jeton alerte comme avant, partielle et complète", async () => {
    await apresSignature(ctx({ canal: "lien_a_jeton" }));
    expect(String(h.telegram.mock.calls[0]![0].body)).toContain("Reste à signer");
    await apresSignature(ctx({ statutSignature: "signee", canal: "lien_a_jeton" }));
    expect(String(h.telegram.mock.calls[1]![0].body)).toContain("intégralement signée");
  });

  it("clé allumée : la contresignature partielle alerte", async () => {
    allumer("signature.alertes_hors_jeton");
    await apresSignature(contresignaturePartielle());
    expect(h.telegram).toHaveBeenCalledOnce();
    expect(String(h.telegram.mock.calls[0]![0].body)).toContain("Reste à signer");
  });
});

describe("(4) suite du contrat-cadre formateur — formateurs.suite_contrat_cadre", () => {
  beforeEach(() => {
    h.p.documentGenere.findUnique.mockResolvedValue({
      trainerId: TRAINER,
      hashSha256: "a".repeat(64),
      signatures: [{ signeAt: new Date("2026-10-10T10:00:00Z") }],
    });
    h.p.trainer.findUnique.mockResolvedValue({ statut: "sous_traitant" });
    h.p.trainerDocument.findFirst.mockResolvedValue(null);
  });
  const signe = () =>
    ctx({
      type: "contrat_sous_traitance",
      statutSignature: "signee",
      partie: "axionia",
      acteur: { type: "administrateur", session: ADMIN },
    });

  it("clé absente : exemplaire remis comme avant, et RIEN d'autre", async () => {
    await apresSignature(signe());
    expect(h.transmettre).toHaveBeenCalledWith(DOC);
    expect(h.p.trainer.updateMany).not.toHaveBeenCalled();
    expect(h.p.trainerDocument.create).not.toHaveBeenCalled();
    expect(h.log).not.toHaveBeenCalled();
    expect(h.p.activityLog.create).not.toHaveBeenCalled();
    expect(h.activer).not.toHaveBeenCalled();
  });

  it("clé allumée : fiche, pièce au dossier, journal, activation demandée", async () => {
    allumer("formateurs.suite_contrat_cadre");
    await apresSignature(signe());
    expect(h.p.trainer.updateMany).toHaveBeenCalledOnce();
    expect(h.p.trainerDocument.create).toHaveBeenCalledOnce();
    expect(h.log).toHaveBeenCalledOnce();
    expect(h.activer).toHaveBeenCalledOnce();
  });
});
