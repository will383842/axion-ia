/**
 * Lot B, M3 — règles du contrat créé DANS le dossier (parcours « dossier »), et
 * émission du lien de signature par le système.
 *
 *   · le parcours « dossier » n'exige ni l'attestation URSSAF vérifiée ni l'orange
 *     validé (ils le sont à la contresignature, W-4) ; un contrôle rouge, l'absence de
 *     contrôle, un registre muet ou inactif refusent toujours ;
 *   · le parcours « console » (défaut) est inchangé.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  REFUS_EMISSION,
  verdictEmissionContrat,
  type FaitsEmissionContrat,
} from "../contrat-cadre-emission-regles";

const MAINTENANT = new Date("2026-10-11T10:00:00Z");
const SIRET = "12345678900011";
const HIER = new Date("2026-10-10T10:00:00Z");

const NOUVEAU: FaitsEmissionContrat = {
  statut: "sous_traitant",
  organismeSousTraitantId: null,
  finCollaborationAt: null,
  prenom: "Camille",
  nom: "Exemple",
  email: "camille@exemple.fr",
  siret: SIRET,
  adresseProfessionnelle: "1 rue de l'Exemple, 69001 Lyon",
  sousTraitantNda: "en cours",
  numeroTvaIntracom: null,
  contrats: [],
  // Numéro de déclaration en cours : orange, pas encore validé par Axion.
  controles: [
    { verdict: "orange", source: "registre", verifieAt: HIER, createdAt: HIER, siret: SIRET },
  ],
  // Attestation déposée, pas encore vérifiée.
  pieces: [
    {
      id: "p-1",
      type: "attestation_vigilance_urssaf",
      statutValidation: "en_attente",
      fichierUrl: "trainer-documents/p-1",
      dateEmission: new Date("2026-10-01T00:00:00Z"),
      dateExpiration: null,
    },
  ],
  preuvesVigilance: [],
  registre: { lu: true, siret: SIRET, active: true, entrepreneurIndividuel: true },
};

const dossier = (f: Partial<FaitsEmissionContrat> = {}) => {
  const r = verdictEmissionContrat({ ...NOUVEAU, ...f }, 3, MAINTENANT, { parcours: "dossier" });
  return r.ok ? [] : r.refus;
};

describe("verdictEmissionContrat — parcours « dossier »", () => {
  it("nouveau formateur (attestation non vérifiée, orange non validé) : le contrat se crée", () => {
    expect(dossier()).toEqual([]);
  });

  it("le parcours console, lui, refuse toujours ces mêmes faits (inchangé)", () => {
    const r = verdictEmissionContrat(NOUVEAU, 3, MAINTENANT);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.refus).toContain(REFUS_EMISSION.vigilance);
      expect(r.refus).toContain(REFUS_EMISSION.controle);
    }
  });

  it("contrôle rouge ou absent : refus", () => {
    expect(
      dossier({
        controles: [
          { verdict: "rouge", source: "registre", verifieAt: HIER, createdAt: HIER, siret: SIRET },
        ],
      }),
    ).toContain(REFUS_EMISSION.controle);
    expect(dossier({ controles: [] })).toContain(REFUS_EMISSION.controle);
  });

  it("registre muet ou établissement inactif : refus", () => {
    expect(dossier({ registre: { lu: false } })).toContain(REFUS_EMISSION.registreMuet);
    expect(
      dossier({
        registre: { lu: true, siret: SIRET, active: false, entrepreneurIndividuel: true },
      }),
    ).toContain(REFUS_EMISSION.inactive);
  });

  it("le dernier contrôle porte un autre SIRET : refus", () => {
    expect(
      dossier({
        controles: [
          {
            verdict: "vert",
            source: "registre",
            verifieAt: HIER,
            createdAt: HIER,
            siret: "98765432100019",
          },
        ],
      }),
    ).toContain(REFUS_EMISSION.siret);
  });
});

// ── Émission du lien par le système ─────────────────────────────────────────

const h = vi.hoisted(() => ({
  p: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { count: vi.fn() },
    documentSignatureToken: { count: vi.fn() },
    trainer: { findUnique: vi.fn() },
  },
  creerToken: vi.fn(),
  log: vi.fn(),
  journal: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: h.log }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: h.journal }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: h.creerToken,
  TokenDocumentError: class TokenDocumentError extends Error {},
}));

import { emettreLienSignature } from "@/server/qualiopi/documents/signature/emettre-lien-signature";

const DOC = "33333333-3333-4333-8333-333333333333";
const TRAINER = "44444444-4444-4444-8444-444444444444";
const PIECE = {
  id: DOC,
  type: "contrat_sous_traitance",
  numero: "AXI-DOC-2026-200",
  hashSha256: "b".repeat(64),
  metadata: {},
  annuleeAt: null,
  clientId: null,
  traineeId: null,
  sousTraitantId: null,
  sessionId: null,
  trainerId: TRAINER,
  suppressionPrevueAt: new Date("2031-01-01T00:00:00Z"),
};

describe("emettreLienSignature — acteur système (dossier formateur)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["DATABASE_URL"] = "postgresql://u:p@db.example:5432/x";
    h.p.documentGenere.findUnique.mockResolvedValue(PIECE);
    h.p.documentSignature.count.mockResolvedValue(0);
    h.p.documentSignatureToken.count.mockResolvedValue(0);
    h.p.trainer.findUnique.mockResolvedValue({
      statut: "sous_traitant",
      prenom: "Ada",
      nom: "Lovelace",
      email: "ada@exemple.test",
    });
    h.creerToken.mockResolvedValue({ token: "JETON", expiresAt: new Date() });
  });

  it("émet le lien du contrat-cadre, identité lue sur la fiche, journal sans auteur ni lien", async () => {
    const r = await emettreLienSignature({
      documentGenereId: DOC,
      partie: "sous_traitant",
      acteur: { systeme: "dossier_formateur" },
    });
    expect(r).toHaveProperty("data");
    expect(h.creerToken.mock.calls[0]![0]).toMatchObject({
      signataireNom: "Ada Lovelace",
      signataireEmail: "ada@exemple.test",
    });
    expect(h.log).not.toHaveBeenCalled();
    expect(h.journal.mock.calls[0]![1]).toMatchObject({
      action: "qualiopi.piece.lien_signature",
      targetId: DOC,
      session: null,
    });
    expect(JSON.stringify(h.journal.mock.calls)).not.toContain("JETON");
  });

  it("le système n'émet rien pour une autre pièce ni une autre partie", async () => {
    h.p.documentGenere.findUnique.mockResolvedValue({ ...PIECE, type: "convention" });
    const r = await emettreLienSignature({
      documentGenereId: DOC,
      partie: "sous_traitant",
      acteur: { systeme: "dossier_formateur" },
    });
    expect(r).toHaveProperty("error");
    expect(h.creerToken).not.toHaveBeenCalled();

    h.p.documentGenere.findUnique.mockResolvedValue(PIECE);
    const r2 = await emettreLienSignature({
      documentGenereId: DOC,
      partie: "client",
      acteur: { systeme: "dossier_formateur" },
    });
    expect(r2).toHaveProperty("error");
    expect(h.creerToken).not.toHaveBeenCalled();
  });
});
