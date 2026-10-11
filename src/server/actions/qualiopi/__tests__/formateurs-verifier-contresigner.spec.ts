/**
 * Lot L9 — « Contresigner et ouvrir son espace » (écran W-4).
 *
 * Éteint par défaut ; rôles vérifiés côté serveur ; un double clic ne fait
 * qu'un acte ; l'activation passe par l'écrivain unique, au nom de la personne.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  role: "admin",
  allume: false,
  ecran: null as unknown,
  contresigner: vi.fn(),
  activer: vi.fn(),
  envoyer: vi.fn(),
  vigilance: vi.fn(),
  valider: vi.fn(),
  habiliter: vi.fn(),
  orange: vi.fn(),
  lireEcran: vi.fn(),
  dernierControle: null as unknown,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationRegistreSousTraitance: { findFirst: vi.fn(async () => h.dernierControle) },
    trainer: {
      findUnique: vi.fn(async () => ({ email: "f@exemple.fr", statut: "sous_traitant" })),
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: vi.fn(async () => ({ userId: "u-1", role: h.role })),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/piece-signature", () => ({
  contresignerPieceAction: h.contresigner,
}));
vi.mock("@/server/actions/qualiopi/trainer-documents", () => ({
  validateTrainerDocumentAction: h.valider,
}));
vi.mock("@/server/actions/qualiopi/trainers", () => ({
  setTrainerHabilitationsAction: h.habiliter,
}));
vi.mock("@/server/qualiopi/formateurs-independants/activation", () => ({
  changerActivationFormateur: h.activer,
  messageRefusActivation: (r: { message: string }) => r.message,
}));
vi.mock("@/server/qualiopi/formateurs-independants/controle", () => ({
  validerControleOrange: h.orange,
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer: h.envoyer }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-etat", () => ({
  lireEtatsInterrupteurs: vi.fn(async () => ({ activation_auto: h.allume })),
}));
vi.mock("@/server/qualiopi/formateurs-independants/validation-vigilance", () => ({
  validerAttestationVigilance: h.vigilance,
}));
vi.mock("@/server/qualiopi/formateurs-independants/verifier-contresigner-lecture", () => ({
  lireEcranVerifierContresigner: h.lireEcran,
}));

import { contresignerEtOuvrirEspaceAction } from "../formateurs-verifier-contresigner";

const TRAINER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FORMATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function ecran(extra: Record<string, unknown> = {}) {
  return {
    trainerId: TRAINER,
    nomAffiche: "Paul R.",
    signeLe: null,
    liens: [],
    lienAttestation: null,
    formations: [{ id: FORMATION, titre: "IA pour managers", habilite: false }],
    faits: {
      controle: { statut: "vert", dernierAt: new Date(), raison: null },
      nda: { renseigne: true, vuSurListe: true },
      attestation: { id: "att", statutValidation: "en_attente", code: "A1B2C3D4", prouvee: false },
      pieces: {
        cv: { id: "cv", statutValidation: "en_attente", fichierPresent: true },
        rcPro: null,
        rib: { id: "rib", statutValidation: "valide", fichierPresent: true },
      },
      dossier: { regimeTva: true, iban: true, declarations: true },
      habilitationsActives: 0,
      contrat: { id: "doc-1", numero: "CST-1", statutSignature: "partielle" },
      actif: false,
      finCollaboration: false,
      ...extra,
    },
  };
}

const saisie = {
  trainerId: TRAINER,
  codeAttestation: "A1B2C3D4",
  attestationAuthentique: true,
  piecesVerifiees: true,
  formationIds: [FORMATION],
  orangeVerifie: false,
  motifOrange: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.role = "admin";
  h.allume = true;
  h.lireEcran.mockResolvedValue(ecran());
  h.vigilance.mockResolvedValue({ data: { id: "att" } });
  h.valider.mockResolvedValue({ data: { id: "cv" } });
  h.habiliter.mockResolvedValue({ data: { id: TRAINER } });
  h.contresigner.mockResolvedValue({ ok: true, signatureId: "s", statutSignature: "signee" });
  h.activer.mockResolvedValue({
    ok: true,
    actif: true,
    inchange: false,
    sollicitationsRetirees: 0,
  });
  h.envoyer.mockResolvedValue("envoye");
});

describe("contresignerEtOuvrirEspaceAction", () => {
  it("ÉTEINT par défaut : refuse sans rien lire ni écrire", async () => {
    h.allume = false;
    const r = await contresignerEtOuvrirEspaceAction(saisie);
    expect(r.ok).toBe(false);
    expect(h.lireEcran).not.toHaveBeenCalled();
    expect(h.contresigner).not.toHaveBeenCalled();
    expect(h.activer).not.toHaveBeenCalled();
  });

  it("un rôle qui ne contresigne pas (responsable qualité) est refusé côté serveur", async () => {
    h.role = "responsable_qualite";
    const r = await contresignerEtOuvrirEspaceAction(saisie);
    expect(r.ok).toBe(false);
    expect(h.contresigner).not.toHaveBeenCalled();
  });

  it("un bloc à faire : refus avec la raison, rien n'est écrit", async () => {
    const r = await contresignerEtOuvrirEspaceAction({ ...saisie, formationIds: [] });
    expect(r).toEqual({
      ok: false,
      error: "Pour contresigner, il manque : au moins une formation.",
    });
    expect(h.vigilance).not.toHaveBeenCalled();
    expect(h.contresigner).not.toHaveBeenCalled();
  });

  it("chemin complet : vérifie, habilite, contresigne, active au nom de la personne, F20 une fois", async () => {
    const r = await contresignerEtOuvrirEspaceAction(saisie);
    expect(r).toEqual({ ok: true, message: "Contrat contresigné, espace ouvert." });
    expect(h.vigilance).toHaveBeenCalledWith({
      trainerDocumentId: "att",
      codeVerification: "A1B2C3D4",
      authenticiteVerifiee: true,
      resultat: "valide",
    });
    expect(h.valider).toHaveBeenCalledTimes(1); // le RIB déjà validé n'est pas revalidé
    expect(h.habiliter).toHaveBeenCalledWith({ id: TRAINER, formationsHabilitees: [FORMATION] });
    expect(h.contresigner).toHaveBeenCalledWith({
      documentGenereId: "doc-1",
      methode: "confirmation_accessible",
    });
    expect(h.activer).toHaveBeenCalledWith(
      expect.objectContaining({
        trainerId: TRAINER,
        actif: true,
        acteur: { type: "administrateur", session: { userId: "u-1", role: "admin" } },
      }),
    );
    expect(h.envoyer).toHaveBeenCalledTimes(1);
    expect(h.envoyer.mock.calls[0]![0]).toMatchObject({
      gabarit: "formateur-espace-ouvert",
      jobId: `fi-espace-ouvert-${TRAINER}`,
    });
  });

  it("double clic : contrat déjà contresigné → aucune seconde signature, activation inchangée, aucun second e-mail", async () => {
    h.contresigner.mockResolvedValue({ ok: false, raison: "deja_signe", message: "déjà" });
    h.activer.mockResolvedValue({
      ok: true,
      actif: true,
      inchange: true,
      sollicitationsRetirees: 0,
    });
    const r = await contresignerEtOuvrirEspaceAction(saisie);
    expect(r.ok).toBe(true);
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("contresignature refusée (registre relu en direct) : rien n'est activé", async () => {
    h.contresigner.mockResolvedValue({
      ok: false,
      raison: "piece_non_signable_maintenant",
      message: "Le registre public ne répond pas pour l'instant.",
    });
    const r = await contresignerEtOuvrirEspaceAction(saisie);
    expect(r).toEqual({ ok: false, error: "Le registre public ne répond pas pour l'instant." });
    expect(h.activer).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("orange coché : le contrôle fait par la contresignature est validé avant l'activation", async () => {
    h.lireEcran.mockResolvedValue(ecran({ nda: { renseigne: true, vuSurListe: false } }));
    h.dernierControle = { id: "ctl-2", verdict: "orange", source: "registre_entreprises+liste_of" };
    const r = await contresignerEtOuvrirEspaceAction({
      ...saisie,
      orangeVerifie: true,
      motifOrange: "Numéro de déclaration en cours d'attribution",
    });
    expect(r.ok).toBe(true);
    expect(h.orange).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ controleId: "ctl-2", valideParId: "u-1" }),
    );
    expect(h.orange.mock.invocationCallOrder[0]!).toBeGreaterThan(
      h.contresigner.mock.invocationCallOrder[0]!,
    );
    expect(h.orange.mock.invocationCallOrder[0]!).toBeLessThan(
      h.activer.mock.invocationCallOrder[0]!,
    );
  });

  it("fiche déjà active : rien n'est refait", async () => {
    h.lireEcran.mockResolvedValue(ecran({ actif: true }));
    const r = await contresignerEtOuvrirEspaceAction(saisie);
    expect(r.ok).toBe(true);
    expect(h.contresigner).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });
});
