/**
 * Correctif de relecture du lot B — l'écran « Vérifier et contresigner » (W-4)
 * passe par la porte COMMUNE de contresignature, et n'en a pas d'autre.
 *
 *  · W-4 ne contresigne qu'en appelant `contresignerPieceAction` (chemin commun,
 *    qui porte `objectionContresignatureContratCadre`) : il n'écrit jamais une
 *    signature lui-même ;
 *  · si la porte refuse (attestation dont la preuve n'est pas en base, par
 *    exemple), W-4 s'arrête : ni dossier « vérifié », ni activation, ni F20.
 *
 * Plus l'INVENTAIRE des chemins qui écrivent une signature : tout nouvel appel au
 * moteur fait échouer ce test, pour qu'on décide s'il doit passer par la porte.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  contresigner: vi.fn(),
  activer: vi.fn(),
  envoyer: vi.fn(),
  vigilance: vi.fn(),
  valider: vi.fn(),
  habiliter: vi.fn(),
  orange: vi.fn(),
  lireEcran: vi.fn(),
  verifie: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationRegistreSousTraitance: { findFirst: vi.fn(async () => null) },
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
  requireHabilitation: vi.fn(async () => ({ userId: "u-1", role: "admin" })),
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
  lireEtatsInterrupteurs: vi.fn(async () => ({ activation_auto: true })),
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

import { MESSAGES_CONTRESIGNATURE_CONTRAT_CADRE } from "@/server/qualiopi/formateurs-independants/garde-contresignature-contrat-cadre";

import { contresignerEtOuvrirEspaceAction } from "../formateurs-verifier-contresigner";

const TRAINER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FORMATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function ecran() {
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
  h.lireEcran.mockResolvedValue(ecran());
  h.vigilance.mockResolvedValue({ data: { id: "att" } });
  h.valider.mockResolvedValue({ data: { id: "cv" } });
  h.habiliter.mockResolvedValue({ data: { id: TRAINER } });
  h.activer.mockResolvedValue({
    ok: true,
    actif: true,
    inchange: false,
    sollicitationsRetirees: 0,
  });
  h.envoyer.mockResolvedValue("envoye");
  h.orange.mockResolvedValue({ ok: true });
  h.verifie.mockResolvedValue(true);
});

describe("W-4 contresigne par la porte commune", () => {
  it("la porte refuse : W-4 s'arrête sur son message, rien d'autre n'est fait", async () => {
    h.contresigner.mockResolvedValue({
      ok: false,
      raison: "piece_non_signable_maintenant",
      message: MESSAGES_CONTRESIGNATURE_CONTRAT_CADRE.attestation,
    });
    const r = await contresignerEtOuvrirEspaceAction(saisie);
    expect(r).toEqual({ ok: false, error: MESSAGES_CONTRESIGNATURE_CONTRAT_CADRE.attestation });
    expect(h.contresigner).toHaveBeenCalledWith({
      documentGenereId: "doc-1",
      methode: "confirmation_accessible",
    });
    expect(h.verifie).not.toHaveBeenCalled();
    expect(h.activer).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("l'attestation est validée AVANT l'appel à la porte (elle peut donc passer)", async () => {
    const ordre: string[] = [];
    h.vigilance.mockImplementation(async () => {
      ordre.push("attestation");
      return { data: { id: "att" } };
    });
    h.valider.mockImplementation(async () => {
      ordre.push("pieces");
      return { data: { id: "cv" } };
    });
    h.contresigner.mockImplementation(async () => {
      ordre.push("contresignature");
      return { ok: true, signatureId: "s", statutSignature: "signee" };
    });
    const r = await contresignerEtOuvrirEspaceAction(saisie);
    expect(r.ok).toBe(true);
    expect(ordre).toEqual(["attestation", "pieces", "contresignature"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inventaire des chemins qui écrivent une signature
// ─────────────────────────────────────────────────────────────────────────────

const RACINE = join(__dirname, "../../../../..");

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "__tests__" ? [] : fichiers(p);
    return /\.(ts|tsx)$/.test(n) && !/\.(spec|test)\.tsx?$/.test(n) ? [p] : [];
  });
}

const lire = (rel: string): string => readFileSync(join(RACINE, rel), "utf8");

describe("inventaire des chemins de contresignature", () => {
  it("les seuls appelants du moteur `signerDocument` sont connus", () => {
    const appelants = fichiers(join(RACINE, "src"))
      .filter((p) => /\bsignerDocument\(/.test(readFileSync(p, "utf8")))
      .map((p) => relative(RACINE, p))
      .sort();
    expect(appelants).toEqual([
      "src/server/actions/qualiopi/contrat-travail-signature.ts",
      "src/server/actions/qualiopi/lettre-mission-signature.ts",
      "src/server/actions/qualiopi/piece-signature.ts",
      "src/server/actions/qualiopi/releve-signature.ts",
      "src/server/qualiopi/documents/signature/document-signature-service.ts",
      "src/server/qualiopi/formateurs-independants/contrat-dans-le-dossier.ts",
    ]);
  });

  it("piece-signature : la contresignature (unitaire, lot, W-4) et le jeton passent par la porte", () => {
    const src = lire("src/server/actions/qualiopi/piece-signature.ts");
    // Deux appels au moteur (jeton, contresignature commune), deux appels à la porte.
    expect(src.match(/\bsignerDocument\(/g)).toHaveLength(2);
    expect(src.match(/objectionAvantSignature\(/g)?.length).toBeGreaterThanOrEqual(3);
    // Le lot réutilise la contresignature unitaire, pièce par pièce.
    expect(src).toMatch(/r = await contresignerUne\(session,/);
  });

  it("W-4 n'écrit aucune signature lui-même : il appelle le chemin commun", () => {
    const src = lire("src/server/actions/qualiopi/formateurs-verifier-contresigner.ts");
    expect(src).not.toMatch(/\bsignerDocument\(/);
    expect(src).toMatch(/await contresignerPieceAction\(/);
  });

  it("les autres actions de signature sont verrouillées sur LEUR type de pièce", () => {
    expect(lire("src/server/actions/qualiopi/contrat-travail-signature.ts")).toMatch(
      /piece\.type !== "contrat_travail"/,
    );
    expect(lire("src/server/actions/qualiopi/lettre-mission-signature.ts")).toMatch(
      /piece\.type !== "lettre_mission"/,
    );
    expect(lire("src/server/actions/qualiopi/releve-signature.ts")).toMatch(
      /piece\.type !== "releve_connexion"/,
    );
  });

  it("le contrat dans le dossier ne signe qu'au titre du sous-traitant, jamais de l'organisme", () => {
    const src = lire("src/server/qualiopi/formateurs-independants/contrat-dans-le-dossier.ts");
    expect(src).not.toMatch(/partie:\s*"axionia"/);
    expect(src).not.toMatch(/organisme_authentifie/);
  });

  it("la fiche du formateur ne contresigne pas : elle renvoie vers W-4", () => {
    const src = lire("src/components/admin/qualiopi/ContratCadrePanel.tsx");
    expect(src).not.toMatch(/contresignerPieceAction|contresignerParLotAction/);
    expect(src).toMatch(/Vérifier et contresigner/);
  });
});
