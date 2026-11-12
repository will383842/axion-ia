/**
 * Lot S6a — l'après-signature commun, éprouvé branche par branche.
 *
 * Seuls les voisins sont simulés (Prisma, remise, Telegram, activation) : la
 * fonction elle-même est la vraie.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  transmettre: vi.fn(),
  copie: vi.fn(),
  telegram: vi.fn(),
  positionnement: vi.fn(),
  lettreDue: vi.fn(),
  reevaluer: vi.fn(),
  activer: vi.fn(),
  log: vi.fn(),
  prevenir: vi.fn(),
  fiche: vi.fn(),
  monter: vi.fn(),
  confirmer: vi.fn(),
  txDevis: { devis: { updateMany: vi.fn(), findMany: vi.fn() } },
  p: {
    documentGenere: { findUnique: vi.fn() },
    devis: { findMany: vi.fn(async (): Promise<unknown[]> => []) },
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
vi.mock("./notification-interne-devis", () => ({
  prevenirDevisSigne: h.prevenir,
  ficheDevisDePiece: h.fiche,
}));
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
  transactionDevisSigne: vi.fn(async (_p: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn(h.txDevis),
  ),
}));
// Devis à formules (lot 4) : couvert par `acceptation-formules.spec.ts`. Ici, aucun devis à formules.
vi.mock("@/server/qualiopi/devis/acceptation-formules", () => ({
  accepterDevisAFormules: vi.fn(async () => ({ traite: false, ids: [], acceptes: [] })),
}));
const plans = vi.hoisted(() => {
  const proposer = vi.fn(async (_id: string, _o: string): Promise<string | null> => null);
  // `proposes` : vrai si le test le demande (plans réellement créés par l'appel).
  const proposes = { valeur: false };
  return { proposer, proposes };
});
vi.mock("@/server/qualiopi/devis/proposer-plans", () => ({
  proposerPlansApresAcceptation: plans.proposer,
  // La variante détaillée délègue au même simulacre : les assertions existantes restent valables.
  proposerPlansApresAcceptationDetaille: vi.fn(async (id: string, o: string) => {
    const echec = await plans.proposer(id, o);
    return { echec, proposes: echec === null && plans.proposes.valeur };
  }),
}));
vi.mock("@/server/qualiopi/devis/confirmation-commande", () => ({
  envoyerConfirmationCommande: h.confirmer,
}));
vi.mock("@/features/dossier-client/devis-signe-fait-client", () => ({
  faireMonterLesFichesDesDevisSignes: h.monter,
}));

import { accepterDevisAFormules } from "@/server/qualiopi/devis/acceptation-formules";
import { proposerPlansApresAcceptation } from "@/server/qualiopi/devis/proposer-plans";
import {
  apresSignature,
  PREFIXE_ACCEPTATION_DEVIS_ECHOUEE,
  PREFIXE_CONFIRMATION_NON_PREPAREE,
  PREFIXE_PLANS_NON_PROPOSES,
  reprendreAcceptationDevisFormules,
  type ContexteApresSignature,
} from "./apres-signature";

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
  // Horloge figée : le code teste `new Date()` (envoi, acceptation, émission)
  // et l'ordre des appels ne doit jamais dépendre de l'heure réelle.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
  // `clearAllMocks` garde les implémentations : on remet à zéro celles qu'un
  // test modifie pour qu'aucun ne fuie vers le suivant (ordre d'exécution).
  h.p.trainer.findUnique.mockReset();
  h.p.trainerDocument.findFirst.mockReset();
  h.txDevis.devis.findMany.mockReset();
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
  h.confirmer.mockReset();
  h.confirmer.mockResolvedValue({
    envoye: true,
    garePourValidation: true,
    cgvJointes: true,
    cgvVersionAcceptee: "2026-10-04",
  });
  h.transmettre.mockResolvedValue({ ok: true, destinataires: ["f@x.test"], r2Key: "k" });
  h.copie.mockResolvedValue({ ok: true, r2Key: "k2" });
  h.telegram.mockResolvedValue(undefined);
  h.prevenir.mockResolvedValue(undefined);
  h.fiche.mockResolvedValue({ id: "dv-1", numero: "AXI-DEV-2026-042" });
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

afterEach(() => {
  vi.useRealTimers();
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
    await expect(apresSignature(ctx())).resolves.toEqual({ activationRefusee: null });
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

  it("étape 3 (C4) — activation REFUSÉE par la garde : le refus est RENDU à l'appelant, et signalé", async () => {
    const Sentry = await import("@sentry/nextjs");
    h.activer.mockResolvedValue({
      ok: false,
      code: "garde",
      message: "Activation refusée : le dossier du formateur indépendant est incomplet.",
      manques: ["Le numéro de déclaration d'activité n'est pas renseigné."],
    });
    const r = await apresSignature(ctx({ type: "contrat_sous_traitance" }));
    expect(r.activationRefusee).toEqual({
      code: "garde",
      message:
        "Activation refusée : le dossier du formateur indépendant est incomplet. Le numéro de déclaration d'activité n'est pas renseigné.",
      manques: ["Le numéro de déclaration d'activité n'est pas renseigné."],
    });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Activation après contrat-cadre non aboutie",
      expect.objectContaining({ tags: expect.objectContaining({ code: "garde" }) }),
    );
  });

  it("activation réussie, ou autre pièce : rien n'est rendu comme refus", async () => {
    expect((await apresSignature(ctx({ type: "contrat_sous_traitance" }))).activationRefusee).toBe(
      null,
    );
    expect((await apresSignature(ctx())).activationRefusee).toBe(null);
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

describe("devis signé par le client (lien) : e-mail interne à l'organisme", () => {
  const client = (patch: Partial<ContexteApresSignature> = {}) =>
    ctx({
      type: "devis",
      statutSignature: "partielle",
      partie: "client",
      acteur: { type: "signataire" },
      canal: "lien_a_jeton",
      ...patch,
    });

  it("signature du client : UN e-mail « à contresigner », Telegram avec le numéro du devis", async () => {
    await apresSignature(client());
    expect(h.prevenir).toHaveBeenCalledOnce();
    expect(h.prevenir).toHaveBeenCalledWith({
      documentGenereId: DOC,
      numeroPiece: "AXI-DOC-2026-100",
      etape: "a_contresigner",
      essai: false,
    });
    const corps = String(h.telegram.mock.calls[0]![0].body);
    expect(corps).toContain("AXI-DEV-2026-042");
    expect(corps).not.toMatch(/@/);
  });

  it("pièce d'essai : l'appel porte essai: true (la porte de sortie bloque), Telegram muet", async () => {
    await apresSignature(client({ numero: "AXI-DOC-ESSAI-2026-0A1B2C" }));
    expect(h.prevenir).toHaveBeenCalledOnce();
    expect(h.prevenir.mock.calls[0]![0].essai).toBe(true);
    expect(h.telegram).not.toHaveBeenCalled();
  });

  it("fail-soft : une panne de l'e-mail interne ne casse jamais la signature", async () => {
    h.prevenir.mockRejectedValue(new Error("boom"));
    await expect(apresSignature(client())).resolves.toEqual({ activationRefusee: null });
    h.fiche.mockRejectedValue(new Error("db"));
    await expect(apresSignature(client())).resolves.toEqual({ activationRefusee: null });
  });

  it("dernière signature par le client (lien) : « signé des deux parties », une seule fois", async () => {
    await apresSignature(client({ statutSignature: "signee" }));
    expect(h.prevenir).toHaveBeenCalledOnce();
    expect(h.prevenir.mock.calls[0]![0].etape).toBe("complete");
  });

  it("ni contresignature de l'organisme, ni autre pièce, ni autre canal : aucun e-mail interne", async () => {
    await apresSignature(ctx({ type: "devis", statutSignature: "signee", partie: "axionia" }));
    await apresSignature(client({ type: "convention" }));
    await apresSignature(client({ type: "lettre_mission" }));
    await apresSignature(
      ctx({
        type: "devis",
        statutSignature: "partielle",
        partie: "client",
        acteur: { type: "signataire" },
      }),
    );
    expect(h.prevenir).not.toHaveBeenCalled();
  });
});

describe("devis intégralement signé : le prospect passe en client", () => {
  beforeEach(() => {
    h.txDevis.devis.findMany.mockResolvedValue([{ id: "dv-1" }]);
  });

  it("signature intégrale (contresignature comprise) : les devis visés font monter leur fiche", async () => {
    await apresSignature(ctx({ type: "devis", statutSignature: "signee", partie: "axionia" }));
    expect(h.txDevis.devis.findMany).toHaveBeenCalledOnce();
    expect(h.monter).toHaveBeenCalledOnce();
    expect(h.monter).toHaveBeenCalledWith(h.p, ["dv-1"], { origine: "signature_complete" });
    // Hors transaction : jamais le `tx` de l'acceptation (B1).
    expect(h.monter.mock.calls[0]![0]).not.toBe(h.txDevis);
    // La lecture des devis visés précède l'écriture gardée, la montée la suit.
    const ordre = (f: { mock: { invocationCallOrder: number[] } }) =>
      f.mock.invocationCallOrder[0]!;
    expect(ordre(h.txDevis.devis.findMany)).toBeLessThan(ordre(h.txDevis.devis.updateMany));
    expect(ordre(h.txDevis.devis.updateMany)).toBeLessThan(ordre(h.monter));
  });

  it("devis À FORMULES : l'acceptation passe par sa propre transaction, le chemin classique n'est pas pris", async () => {
    (accepterDevisAFormules as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      traite: true,
      ids: ["dv-formules"],
      acceptes: ["dv-formules"],
    });
    await apresSignature(ctx({ type: "devis", statutSignature: "signee", partie: "axionia" }));
    expect(accepterDevisAFormules).toHaveBeenCalledWith(h.p, DOC);
    expect(h.txDevis.devis.updateMany).not.toHaveBeenCalled();
    expect(h.monter).toHaveBeenCalledWith(h.p, ["dv-formules"], { origine: "signature_complete" });
    // 🔴 Argent : sans cet appel, aucun plan récurrent en pause n'est jamais créé.
    expect(proposerPlansApresAcceptation).toHaveBeenCalledTimes(1);
    expect(proposerPlansApresAcceptation).toHaveBeenCalledWith("dv-formules", "signature_complete");
  });

  it("🔴 devis À FORMULES sauté par la transaction (déjà recopié ailleurs) : aucune proposition de plans → pas de fausse alerte devis_non_accepte", async () => {
    (accepterDevisAFormules as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      traite: true,
      ids: ["dv-saute", "dv-accepte"],
      acceptes: ["dv-accepte"],
    });
    const r = await apresSignature(
      ctx({ type: "devis", statutSignature: "signee", partie: "axionia" }),
    );
    expect(proposerPlansApresAcceptation).toHaveBeenCalledTimes(1);
    expect(proposerPlansApresAcceptation).toHaveBeenCalledWith("dv-accepte", "signature_complete");
    expect(proposerPlansApresAcceptation).not.toHaveBeenCalledWith("dv-saute", expect.anything());
    expect(r.activationRefusee ?? null).toBeNull();
  });

  it("🔴 devis À FORMULES : l'échec de la proposition des plans n'annule pas l'acceptation et remonte une alerte distincte", async () => {
    (accepterDevisAFormules as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      traite: true,
      ids: ["dv-formules"],
      acceptes: ["dv-formules"],
    });
    (proposerPlansApresAcceptation as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      "offre_alteree",
    );
    const r = await apresSignature(
      ctx({ type: "devis", statutSignature: "signee", partie: "axionia" }),
    );
    expect(r.activationRefusee).toMatchObject({
      code: "plans_recurrents_non_proposes",
      prefixe: PREFIXE_PLANS_NON_PROPOSES,
    });
    expect(r.activationRefusee?.code).not.toBe("acceptation_devis_echouee");
    expect(h.monter).toHaveBeenCalledWith(h.p, ["dv-formules"], { origine: "signature_complete" });
  });

  describe("confirmation de commande (mise en corbeille à valider)", () => {
    const accepte = (acceptes: string[]) =>
      (accepterDevisAFormules as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        traite: true,
        ids: acceptes,
        acceptes,
      });
    const contresigne = (patch: Partial<ContexteApresSignature> = {}) =>
      apresSignature(
        ctx({ type: "devis", statutSignature: "signee", partie: "axionia", ...patch }),
      );
    const ordre = (m: ReturnType<typeof vi.fn>) => m.mock.invocationCallOrder[0] ?? 0;

    it("contresignature par un administrateur : UNE confirmation pour le devis accepté, après la remise de l'exemplaire", async () => {
      accepte(["dv-formules"]);
      await contresigne();
      expect(h.confirmer).toHaveBeenCalledTimes(1);
      expect(h.confirmer).toHaveBeenCalledWith({
        declencheur: "contresignature_axion_explicite",
        devisId: "dv-formules",
      });
      expect(ordre(h.transmettre)).toBeLessThan(ordre(h.confirmer));
      expect(ordre(h.monter)).toBeLessThan(ordre(h.confirmer));
      expect(ordre(h.confirmer)).toBeLessThan(
        ordre(proposerPlansApresAcceptation as unknown as ReturnType<typeof vi.fn>),
      );
    });

    it("aucun devis accepté par cet appel (acceptes vide) : aucune confirmation", async () => {
      (accepterDevisAFormules as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        traite: true,
        ids: ["dv-deja"],
        acceptes: [],
      });
      await contresigne();
      expect(h.confirmer).not.toHaveBeenCalled();
    });

    it("signature du CLIENT : aucune confirmation", async () => {
      accepte(["dv-formules"]);
      await contresigne({ partie: "client" });
      expect(h.confirmer).not.toHaveBeenCalled();
    });

    it("acteur signataire (pas administrateur) : aucune confirmation", async () => {
      accepte(["dv-formules"]);
      await contresigne({ acteur: { type: "signataire" } });
      expect(h.confirmer).not.toHaveBeenCalled();
    });

    it("devis classique (sans offre) : aucune confirmation, chemin inchangé", async () => {
      h.txDevis.devis.findMany.mockResolvedValue([{ id: "dv-classique" }]);
      await contresigne();
      expect(h.confirmer).not.toHaveBeenCalled();
      expect(h.txDevis.devis.updateMany).toHaveBeenCalledOnce();
    });

    it("l'envoi lève : signature et acceptation acquises, alerte confirmation_commande_non_preparee", async () => {
      const Sentry = await import("@sentry/nextjs");
      accepte(["dv-formules"]);
      h.confirmer.mockRejectedValueOnce(new Error("redis"));
      const r = await contresigne();
      expect(Sentry.captureException).toHaveBeenCalled();
      expect(h.monter).toHaveBeenCalledWith(h.p, ["dv-formules"], {
        origine: "signature_complete",
      });
      expect(proposerPlansApresAcceptation).toHaveBeenCalledWith(
        "dv-formules",
        "signature_complete",
      );
      expect(r.activationRefusee).toMatchObject({
        code: "confirmation_commande_non_preparee",
        prefixe: PREFIXE_CONFIRMATION_NON_PREPAREE,
      });
    });

    it("refus typé (hors formules_eteintes) : alerte ; formules_eteintes : silence", async () => {
      accepte(["dv-a"]);
      h.confirmer.mockResolvedValueOnce({ envoye: false, raison: "exemplaire_absent" });
      const r1 = await contresigne();
      expect(r1.activationRefusee?.code).toBe("confirmation_commande_non_preparee");
      accepte(["dv-b"]);
      h.confirmer.mockResolvedValueOnce({ envoye: false, raison: "formules_eteintes" });
      const r2 = await contresigne();
      expect(r2.activationRefusee ?? null).toBeNull();
    });

    it("confirmation ET plans en échec : un seul écran, les deux préfixes", async () => {
      accepte(["dv-formules"]);
      h.confirmer.mockResolvedValueOnce({ envoye: false, raison: "etat_inconnu" });
      (proposerPlansApresAcceptation as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        "offre_alteree",
      );
      const r = await contresigne();
      expect(r.activationRefusee?.code).toBe("confirmation_commande_non_preparee");
      expect(r.activationRefusee?.prefixe).toContain(PREFIXE_CONFIRMATION_NON_PREPAREE);
      expect(r.activationRefusee?.prefixe).toContain(PREFIXE_PLANS_NON_PROPOSES);
    });

    it("reprise : confirmer:true est transmis → confirmation du devis accepté par la reprise", async () => {
      accepte(["dv-formules"]);
      const r = await reprendreAcceptationDevisFormules(DOC, { confirmer: true });
      expect(h.confirmer).toHaveBeenCalledWith({
        declencheur: "contresignature_axion_explicite",
        devisId: "dv-formules",
      });
      expect(r.confirmationsEchec).toEqual([]);
    });

    it("reprise sans confirmer : aucune confirmation", async () => {
      accepte(["dv-formules"]);
      await reprendreAcceptationDevisFormules(DOC);
      expect(h.confirmer).not.toHaveBeenCalled();
    });

    it("🔴 reprise (confirmer:true) d'un devis DÉJÀ accepté : sa confirmation non garée est préparée", async () => {
      h.p.devis.findMany.mockResolvedValueOnce([{ id: "dv-formules" }]);
      const r = await reprendreAcceptationDevisFormules(DOC, { confirmer: true });
      expect(h.confirmer).toHaveBeenCalledTimes(1);
      expect(h.confirmer).toHaveBeenCalledWith({
        declencheur: "contresignature_axion_explicite",
        devisId: "dv-formules",
      });
      expect(r.confirmationsPreparees).toEqual(["dv-formules"]);
      expect(r.acceptes).toEqual([]);
    });

    it("reprise d'un devis DÉJÀ accepté SANS confirmer:true : aucune confirmation (garde intacte)", async () => {
      h.p.devis.findMany.mockResolvedValueOnce([{ id: "dv-formules" }]);
      await reprendreAcceptationDevisFormules(DOC);
      expect(h.confirmer).not.toHaveBeenCalled();
    });

    it("🔴 reprise d'un devis déjà accepté ET déjà garé : pas de doublon, ni préparée ni en échec", async () => {
      h.p.devis.findMany.mockResolvedValueOnce([{ id: "dv-formules" }]);
      h.confirmer.mockResolvedValueOnce({ envoye: false, raison: "deja_envoyee" });
      const r = await reprendreAcceptationDevisFormules(DOC, { confirmer: true });
      expect(r.confirmationsPreparees).toEqual([]);
      expect(r.confirmationsEchec).toEqual([]);
    });

    it("🔴 reprise d'un devis déjà accepté dont la confirmation échoue encore : signalée, jamais muette", async () => {
      h.p.devis.findMany.mockResolvedValueOnce([{ id: "dv-formules" }]);
      h.confirmer.mockResolvedValueOnce({ envoye: false, raison: "exemplaire_absent" });
      const r = await reprendreAcceptationDevisFormules(DOC, { confirmer: true });
      expect(r.confirmationsEchec).toEqual(["dv-formules"]);
    });

    it("📌 DÉCISION À TRANCHER PAR WILL : confirmation refusée/supprimée en corbeille ⇒ `deja_envoyee` (jobIdDejaGare reste vrai) ⇒ aucune nouvelle confirmation automatique, et ce n'est pas un échec", async () => {
      h.p.devis.findMany.mockResolvedValueOnce([{ id: "dv-formules" }]);
      h.confirmer.mockResolvedValueOnce({ envoye: false, raison: "deja_envoyee" });
      const r = await reprendreAcceptationDevisFormules(DOC, { confirmer: true });
      expect(h.confirmer).toHaveBeenCalledTimes(1); // une tentative, jamais de relance en boucle
      expect(r.confirmationsPreparees).toEqual([]);
      expect(r.confirmationsEchec).toEqual([]);
    });
  });

  it("🔴 reprise manuelle d'un devis DÉJÀ accepté : repropose les plans (idempotent), sans ré-accepter", async () => {
    h.p.devis.findMany.mockResolvedValueOnce([{ id: "dv-formules" }]);
    const r = await reprendreAcceptationDevisFormules(DOC);
    expect(r).toEqual({
      traite: true,
      ids: ["dv-formules"],
      acceptes: [],
      plansEchec: [],
      confirmationsEchec: [],
      confirmationsPreparees: [],
      plansProposes: [],
    });
    expect(proposerPlansApresAcceptation).toHaveBeenCalledWith("dv-formules", "signature_complete");
    // Aucune montée de fiche : l'acceptation n'a pas eu lieu à cet appel.
    expect(h.monter).not.toHaveBeenCalled();
  });

  it("🔴 reprise : `plansProposes` distingue « proposés par cet appel » de « déjà présents »", async () => {
    h.p.devis.findMany.mockResolvedValueOnce([{ id: "dv-formules" }]);
    plans.proposes.valeur = true;
    try {
      const r = await reprendreAcceptationDevisFormules(DOC);
      expect(r.plansProposes).toEqual(["dv-formules"]);
      expect(r.plansEchec).toEqual([]);
    } finally {
      plans.proposes.valeur = false;
    }
    h.p.devis.findMany.mockResolvedValueOnce([{ id: "dv-formules" }]);
    expect((await reprendreAcceptationDevisFormules(DOC)).plansProposes).toEqual([]);
  });

  it("reprise manuelle : aucun devis à formules → rien à proposer", async () => {
    h.p.devis.findMany.mockResolvedValueOnce([]);
    expect(await reprendreAcceptationDevisFormules(DOC)).toEqual({
      traite: false,
      ids: [],
      acceptes: [],
      plansEchec: [],
      confirmationsEchec: [],
      confirmationsPreparees: [],
      plansProposes: [],
    });
    expect(proposerPlansApresAcceptation).not.toHaveBeenCalled();
  });

  it("🔴 devis À FORMULES dont l'acceptation échoue : l'écran de contresignature le dit (pas seulement Sentry)", async () => {
    const Sentry = await import("@sentry/nextjs");
    const echec = Object.assign(new Error("refusée"), { motif: "choix_altere" });
    (accepterDevisAFormules as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(echec);
    const r = await apresSignature(
      ctx({ type: "devis", statutSignature: "signee", partie: "axionia" }),
    );
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(r.activationRefusee).toMatchObject({
      code: "acceptation_devis_echouee",
      prefixe: PREFIXE_ACCEPTATION_DEVIS_ECHOUEE,
    });
    expect(r.activationRefusee?.message).toContain("choix_altere");
  });

  it("une erreur levée par la montée n'empêche jamais l'acceptation du devis", async () => {
    const Sentry = await import("@sentry/nextjs");
    h.monter.mockRejectedValueOnce(new Error("montée"));
    await expect(
      apresSignature(ctx({ type: "devis", statutSignature: "signee", partie: "axionia" })),
    ).resolves.not.toThrow();
    expect(h.txDevis.devis.updateMany).toHaveBeenCalledOnce();
    expect(h.monter).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { action: "devis_signe_fait_client" },
    });
  });

  it("signature partielle : rien ne monte", async () => {
    await apresSignature(
      ctx({
        type: "devis",
        statutSignature: "partielle",
        partie: "client",
        acteur: { type: "signataire" },
      }),
    );
    expect(h.monter).not.toHaveBeenCalled();
  });

  it("une autre pièce que le devis : rien ne monte", async () => {
    await apresSignature(ctx({ type: "lettre_mission" }));
    expect(h.monter).not.toHaveBeenCalled();
  });
});
