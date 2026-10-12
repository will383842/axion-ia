/**
 * M7 (lot A) — les boutons « Demander un complément » (F12) et « Refuser le dossier »
 * (F13) de l'écran W-4 passent par les envois du dossier : le motif part DANS `valeurs`,
 * F12 rouvre le dossier avec un lien, F13 écrit l'état refusé. Éteint par défaut.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  allume: true,
  complement: vi.fn(),
  refuser: vi.fn(),
  lireEcran: vi.fn(),
  log: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: vi.fn(async () => ({ userId: "0a1b2c3d-4e5f-4061-8a7b-9c0d1e2f3a4c" })),
  logQualiopiActivity: h.log,
}));
vi.mock("@/server/actions/qualiopi/piece-signature", () => ({ contresignerPieceAction: vi.fn() }));
vi.mock("@/server/actions/qualiopi/trainer-documents", () => ({
  validateTrainerDocumentAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/trainers", () => ({ setTrainerHabilitationsAction: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/activation", () => ({
  changerActivationFormateur: vi.fn(),
  messageRefusActivation: vi.fn(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/controle", () => ({
  validerControleOrange: vi.fn(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/envois-dossier", () => ({
  demanderComplementW4: h.complement,
  refuserDossier: h.refuser,
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-etat", () => ({
  lireEtatsInterrupteurs: vi.fn(async () => ({ activation_auto: h.allume })),
}));
vi.mock("@/server/qualiopi/formateurs-independants/validation-vigilance", () => ({
  validerAttestationVigilance: vi.fn(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/verifier-contresigner-lecture", () => ({
  lireEcranVerifierContresigner: h.lireEcran,
  motifsControle: () => [],
}));

import {
  demanderComplementFormateurAction,
  refuserDossierFormateurAction,
} from "../formateurs-verifier-contresigner";

const TRAINER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  vi.clearAllMocks();
  h.allume = true;
  h.complement.mockResolvedValue({ ok: true, envoi: "envoye" });
  h.refuser.mockResolvedValue({ ok: true, envoi: "envoye" });
  h.lireEcran.mockResolvedValue({
    trainerId: TRAINER,
    faits: {
      controle: { statut: "rouge", motifs: ["siren_cesse"] },
      actif: false,
    },
  });
});

describe("F12 depuis W-4", () => {
  it("passe le motif et la date au service qui rouvre le dossier", async () => {
    const r = await demanderComplementFormateurAction({ trainerId: TRAINER, motif: "le CV" });
    expect(r.ok).toBe(true);
    expect(h.complement).toHaveBeenCalledWith(
      expect.objectContaining({ trainerId: TRAINER, motif: "le CV", maintenant: expect.any(Date) }),
    );
  });

  it("dossier pas en attente de vérification : refus lisible", async () => {
    h.complement.mockResolvedValue({ ok: false, raison: "etat" });
    const r = await demanderComplementFormateurAction({ trainerId: TRAINER, motif: "le CV" });
    expect(r.ok).toBe(false);
  });

  it("éteint : rien n'est appelé", async () => {
    h.allume = false;
    await demanderComplementFormateurAction({ trainerId: TRAINER, motif: "le CV" });
    expect(h.complement).not.toHaveBeenCalled();
  });
});

describe("F13 depuis W-4", () => {
  it("registre rouge : le service écrit l'état refusé avec le motif fermé", async () => {
    const r = await refuserDossierFormateurAction({ trainerId: TRAINER });
    expect(r.ok).toBe(true);
    expect(h.refuser).toHaveBeenCalledWith(
      expect.objectContaining({ trainerId: TRAINER, motif: "entreprise fermée" }),
    );
  });

  it("registre pas rouge : refusé avant tout appel", async () => {
    h.lireEcran.mockResolvedValue({
      trainerId: TRAINER,
      faits: { controle: { statut: "vert", motifs: [] }, actif: false },
    });
    const r = await refuserDossierFormateurAction({ trainerId: TRAINER });
    expect(r.ok).toBe(false);
    expect(h.refuser).not.toHaveBeenCalled();
  });

  it("texte non validé : rien n'est parti, rien n'est écrit", async () => {
    h.refuser.mockResolvedValue({ ok: false, raison: "texte-non-valide" });
    const r = await refuserDossierFormateurAction({ trainerId: TRAINER });
    expect(r).toEqual({
      ok: false,
      error: "Le texte de cet e-mail n'est pas encore validé : rien n'est parti.",
    });
  });
});
