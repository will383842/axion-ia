/**
 * Lot B, M15 — après la contresignature (écran W-4) :
 *   · le dossier passe « vérifié » et son lien est révoqué (`marquerDossierVerifie`) ;
 *   · F20 part avec le prénom et le bouton vers l'espace formateur.
 * Mêmes simulations que le spec du lot L9.
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
  verifie: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationRegistreSousTraitance: { findFirst: vi.fn(async () => h.dernierControle) },
    trainer: {
      findUnique: vi.fn(async () => ({
        email: "f@exemple.fr",
        prenom: "Paul",
        statut: "sous_traitant",
      })),
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
  motifsControle: (m: string | null) => (m ? m.split(",") : []),
}));

vi.mock("@/server/qualiopi/formateurs-independants/dossier-verifie", () => ({
  marquerDossierVerifie: h.verifie,
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
    habilitationsActives: [] as string[],
    faits: {
      controle: { statut: "vert", dernierAt: new Date(), raison: null, motifs: [] },
      nda: { renseigne: true, vuSurListe: true },
      attestation: { id: "att", statutValidation: "en_attente", code: "A1B2C3D4", prouvee: false },
      pieces: {
        cv: { id: "cv", statutValidation: "en_attente", fichierPresent: true },
        rcPro: null,
        rib: { id: "rib", statutValidation: "valide", fichierPresent: true },
      },
      dossier: { cvDate: true, regimeTva: true, iban: true, declarations: true },
      habilitationsActives: 0,
      contrat: { id: "doc-1", numero: "CST-1", statutSignature: "partielle" },
      actif: false,
      finCollaboration: false,
      dossierStatut: "a_verifier",
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
  h.dernierControle = null;
  h.orange.mockResolvedValue({ ok: true });
  h.verifie.mockResolvedValue(true);
});

describe("lot B — après la contresignature", () => {
  it("le dossier passe « vérifié » (lien révoqué), au nom de la personne qui contresigne", async () => {
    const r = await contresignerEtOuvrirEspaceAction(saisie);
    expect(r.ok).toBe(true);
    expect(h.verifie).toHaveBeenCalledWith(
      expect.objectContaining({ trainerId: TRAINER, parId: "u-1" }),
    );
    // Après la contresignature, jamais avant.
    expect(h.contresigner.mock.invocationCallOrder[0]!).toBeLessThan(
      h.verifie.mock.invocationCallOrder[0]!,
    );
  });

  it("contresignature refusée : le dossier n'est pas marqué vérifié", async () => {
    h.contresigner.mockResolvedValue({ ok: false, raison: "x", message: "Registre muet." });
    const r = await contresignerEtOuvrirEspaceAction(saisie);
    expect(r.ok).toBe(false);
    expect(h.verifie).not.toHaveBeenCalled();
  });

  it("F20 part avec le prénom et le bouton vers l'espace formateur", async () => {
    await contresignerEtOuvrirEspaceAction(saisie);
    const e = h.envoyer.mock.calls[0]![0];
    expect(e.gabarit).toBe("formateur-espace-ouvert");
    expect(e.payload.prenom).toBe("Paul");
    expect(e.payload.lien).toMatch(/\/fr\/espace-formateur\/connexion$/);
  });
});
