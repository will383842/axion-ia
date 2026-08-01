/**
 * Tests — lettre-mission-signature.ts (phase 6a, canal B)
 *
 * Les invariants qui comptent ici sont ceux de la COUCHE ACTION, pas ceux du
 * service (déjà couverts par `document-signature-service.spec.ts`) :
 *
 *  1. **Seul le formateur que la lettre NOMME la signe** — pas un co-formateur,
 *     pas un assistant, pas un membre quelconque de la session.
 *  2. **La pièce visée est bien une lettre de mission** — et pas n'importe
 *     quelle pièce dont on aurait deviné l'identifiant.
 *  3. **Les deux parties requises viennent du SSOT** : sans cela, la lettre
 *     passerait `signee` à une signature sur deux.
 *  4. **Une panne de stockage REFUSE la signature**, elle ne la simule pas.
 *  5. **`editor` ne contresigne pas** : contresigner CONFIE une mission.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn() },
    trainingSession: { findUnique: vi.fn() },
  },
}));
vi.mock("@/server/formateur/guard", () => ({ requireFormateurAction: vi.fn() }));
vi.mock("./_guards", () => ({ requireAdminWrite: vi.fn(), logQualiopiActivity: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: vi.fn(),
}));
// ⚠️ Un `Map` NE convient PAS : `Map.get` rend `undefined` là où `Headers.get`
// rend `null`. Le mock doit être fidèle, sinon il fait échouer du code correct —
// ou, plus grave, il fait passer du code qui ne gère pas le vrai contrat.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// ⚠️ `resolvePrincipalTrainerId` n'est PAS mocké : c'est le résolveur que le
// générateur emploie pour imprimer le nom sur la pièce. Le mocker validerait
// l'appel et non la RÈGLE — or la règle est justement que les deux chemins
// donnent le même formateur.

import { prisma } from "@/lib/prisma";
import { requireFormateurAction } from "@/server/formateur/guard";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";
import {
  signerLettreMissionFormateurAction,
  contresignerLettreMissionAction,
} from "./lettre-mission-signature";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentGenere: { findUnique: Mock };
  trainingSession: { findUnique: Mock };
};
const mockFormateur = requireFormateurAction as unknown as Mock;
const mockAdmin = requireAdminWrite as unknown as Mock;
const mockLog = logQualiopiActivity as unknown as Mock;
const mockSigner = signerDocument as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const TRAINER = "33333333-3333-4333-8333-333333333333";
const AUTRE_TRAINER = "99999999-9999-4999-8999-999999999999";
const ADMIN = "44444444-4444-4444-8444-444444444444";
const IMAGE = "data:image/png;base64,AAAA";

const ENTREE = { documentGenereId: DOC, methode: "trace" as const, imageDataUrl: IMAGE };

beforeEach(() => {
  vi.clearAllMocks();
  mockFormateur.mockResolvedValue({
    trainerId: TRAINER,
    nom: "Jullin",
    prenom: "Williams",
    email: "w@axion.test",
  });
  mockAdmin.mockResolvedValue({ userId: ADMIN, role: "super_admin" });
  mockPrisma.documentGenere.findUnique.mockResolvedValue({
    type: "lettre_mission",
    numero: "AXI-LM-2026-0003",
    sessionId: SESSION,
  });
  mockPrisma.trainingSession.findUnique.mockResolvedValue({
    formateurPrincipalId: TRAINER,
    coFormateurs: [],
  });
  mockSigner.mockResolvedValue({
    ok: true,
    signatureId: "sig-1",
    selfHash: "a".repeat(64),
    statutSignature: "partielle",
  });
});

/** Entrée réellement passée au service, pour inspecter ce qui a été demandé. */
function appelService(): Record<string, unknown> {
  return mockSigner.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe("🔴 signature du formateur mandaté", () => {
  it("🔴 refuse un formateur MEMBRE de la session mais que la lettre ne nomme PAS", async () => {
    // C'est l'invariant central de ce circuit, et celui qui le distingue du
    // relevé de connexion : la lettre NOMME une personne et une seule. Un
    // co-formateur signant ici apposerait SON identité (résolue côté serveur)
    // sous le nom d'un autre, imprimé sur le PDF.
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      formateurPrincipalId: AUTRE_TRAINER,
      coFormateurs: [{ trainerId: TRAINER, role: "co_formateur" }],
    });
    const res = await signerLettreMissionFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "non_mandataire" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 refuse une pièce qui n'est PAS une lettre de mission", async () => {
    // Sans ce contrôle, un formateur de session pourrait apposer sa signature
    // « formateur » sur une facture dont il aurait deviné l'identifiant.
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "facture",
      numero: "AXI-F-2026-0001",
      sessionId: SESSION,
    });
    const res = await signerLettreMissionFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "piece_introuvable" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("refuse une lettre sans session NI ancre — plus rien ne la relie à un formateur", async () => {
    // Signer serait deviner. (Une lettre-CADRE, elle, porte l'ancre `trainerId`
    // — cas couvert plus bas.)
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "lettre_mission",
      numero: "AXI-LM-2026-0003",
      sessionId: null,
      trainerId: null,
    });
    const res = await signerLettreMissionFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "non_mandataire" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  // ── Lettres-CADRE (2026-08-01) : le mandat est l'ancre `trainerId` ──

  it("🔴 admet le formateur ANCRÉ sur une lettre-cadre, sans aucune session", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "lettre_mission",
      numero: "AXI-LM-2026-0009",
      sessionId: null,
      trainerId: TRAINER,
    });
    const res = await signerLettreMissionFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: true });
    // Le détour par la session n'a même pas lieu : l'ancre suffit.
    expect(mockPrisma.trainingSession.findUnique).not.toHaveBeenCalled();
  });

  it("🔴 refuse un formateur qui n'est PAS l'ancre d'une lettre-cadre", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "lettre_mission",
      numero: "AXI-LM-2026-0009",
      sessionId: null,
      trainerId: AUTRE_TRAINER,
    });
    const res = await signerLettreMissionFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "non_mandataire" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 l'ancre PRIME sur la session : une pièce ancrée sur un autre refuse, même si la session résout vers moi", async () => {
    // Réaffectation du formateur principal APRÈS émission de la lettre : la
    // pièce imprime et scelle le nom de l'ancien. Le nouveau principal ne doit
    // pas pouvoir signer un mandat qui nomme quelqu'un d'autre — il faut
    // régénérer la lettre.
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "lettre_mission",
      numero: "AXI-LM-2026-0003",
      sessionId: SESSION,
      trainerId: AUTRE_TRAINER,
    });
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      formateurPrincipalId: TRAINER,
      coFormateurs: [],
    });
    const res = await signerLettreMissionFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "non_mandataire" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("refuse quand AUCUN formateur n'est résolvable — la lettre ne mandate personne", async () => {
    // Le générateur a alors imprimé la raison sociale de l'organisme à la place
    // d'un nom de formateur : la pièce est à régénérer, pas à signer.
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      formateurPrincipalId: null,
      coFormateurs: [],
    });
    const res = await signerLettreMissionFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "non_mandataire" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("refuse quand la session référencée n'existe plus", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(null);
    const res = await signerLettreMissionFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "non_mandataire" });
  });

  it("admet le principal résolu par le repli Json legacy, comme le générateur", async () => {
    // Sur une session antérieure à la FK, le nom imprimé vient de l'entrée Json
    // déclarée `principal`. Refuser ici bloquerait le formateur que la lettre
    // nomme — l'autorisation doit suivre le MÊME résolveur que l'impression.
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      formateurPrincipalId: null,
      coFormateurs: [
        { trainerId: AUTRE_TRAINER, role: "co_formateur" },
        { trainerId: TRAINER, role: "principal" },
      ],
    });
    const res = await signerLettreMissionFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: true });
  });

  it("refuse une entrée mal formée sans jamais atteindre le service", async () => {
    // `methode` entre dans le tuple HACHÉ : une valeur hors énumération y serait
    // scellée définitivement.
    const res = await signerLettreMissionFormateurAction({
      ...ENTREE,
      methode: "canvas" as unknown as "trace",
    });
    expect(res).toMatchObject({ ok: false, raison: "requete_invalide" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("signe au titre de FORMATEUR, jamais d'une autre partie", async () => {
    const res = await signerLettreMissionFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: true, statutSignature: "partielle" });
    expect(appelService()["porteur"]).toStrictEqual({
      type: "formateur_authentifie",
      trainerId: TRAINER,
      partie: "formateur",
    });
  });

  it("🔴 déclare les DEUX parties requises — sinon la pièce passerait `signee` à 1 sur 2", async () => {
    await signerLettreMissionFormateurAction(ENTREE);
    expect(appelService()["partiesRequises"]).toStrictEqual(["formateur", "axionia"]);
  });

  it("🔴 une panne de stockage REFUSE la signature, elle ne la simule pas", async () => {
    // Une signature dont l'image n'a pas été écrite est une preuve qui n'existe
    // pas : le formateur aurait vu « signé », le contrôle ne trouverait rien.
    mockSigner.mockRejectedValue(
      new SignatureStockageError("r2_absent", "Stockage R2 non configuré."),
    );
    const res = await signerLettreMissionFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "stockage" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/papier/);
  });

  it("laisse remonter une erreur qui n'est PAS une panne de stockage", async () => {
    // L'avaler transformerait une panne de base en « signature refusée », et on
    // chercherait le problème du mauvais côté.
    mockSigner.mockRejectedValue(new Error("base indisponible"));
    await expect(signerLettreMissionFormateurAction(ENTREE)).rejects.toThrow("base indisponible");
  });

  it("relaie tel quel un refus typé du service", async () => {
    mockSigner.mockResolvedValue({
      ok: false,
      raison: "piece_specimen",
      message: "Cette pièce est un SPÉCIMEN.",
    });
    const res = await signerLettreMissionFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "piece_specimen" });
  });
});

describe("🔴 contresignature de l'organisme", () => {
  it("🔴 un `editor` ne contresigne PAS — contresigner CONFIE une mission", async () => {
    // `requireAdminWrite` admet `editor` ; le service ne l'admet pas. On refuse
    // ici avec un message qui dit pourquoi, plutôt que de laisser remonter un
    // `identite_non_resolvable` que personne ne saurait interpréter.
    mockAdmin.mockResolvedValue({ userId: ADMIN, role: "editor" });
    const res = await contresignerLettreMissionAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "role_insuffisant" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("contresigne au titre d'AXIONIA, avec l'identité du serveur", async () => {
    // ⚠️ `axionia` et non `responsable_pedagogique` : les deux sont écrivables
    // par un porteur `organisme_authentifie`, mais seule la première engage la
    // personne morale — et c'est elle que le SSOT déclare pour cette pièce.
    const res = await contresignerLettreMissionAction(ENTREE);
    expect(res).toMatchObject({ ok: true });
    expect(appelService()["porteur"]).toStrictEqual({
      type: "organisme_authentifie",
      adminId: ADMIN,
      partie: "axionia",
    });
  });

  it("passe la pièce à `signee` quand le service le dit", async () => {
    mockSigner.mockResolvedValue({
      ok: true,
      signatureId: "sig-2",
      selfHash: "b".repeat(64),
      statutSignature: "signee",
    });
    const res = await contresignerLettreMissionAction(ENTREE);
    expect(res).toMatchObject({ ok: true, statutSignature: "signee" });
  });

  it("trace la contresignature dans le journal d'activité", async () => {
    // Confier une mission est un acte engageant : qui l'a posé, et quand, doit
    // être lisible dans l'audit sans relire la chaîne de hachage.
    await contresignerLettreMissionAction(ENTREE);
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "qualiopi.lettre_mission.contresignature",
        targetType: "DocumentSignature",
        targetId: "sig-1",
      }),
    );
  });

  it("ne trace RIEN quand le service refuse", async () => {
    // Un journal qui consigne une contresignature refusée ferait croire à un
    // engagement qui n'existe pas.
    mockSigner.mockResolvedValue({
      ok: false,
      raison: "deja_signe",
      message: "Cette pièce a déjà été signée à ce titre.",
    });
    const res = await contresignerLettreMissionAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "deja_signe" });
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("refuse une pièce qui n'est pas une lettre de mission", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "convention",
      numero: "AXI-CONV-2026-0042",
      sessionId: SESSION,
    });
    const res = await contresignerLettreMissionAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "piece_introuvable" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("refuse une entrée mal formée sans jamais atteindre le service", async () => {
    const res = await contresignerLettreMissionAction({
      ...ENTREE,
      documentGenereId: "pas-un-uuid",
    });
    expect(res).toMatchObject({ ok: false, raison: "requete_invalide" });
    expect(mockSigner).not.toHaveBeenCalled();
  });
});
