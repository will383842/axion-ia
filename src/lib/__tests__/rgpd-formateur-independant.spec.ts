/**
 * Lot L16a (ADR 0066) — droits RGPD d'un formateur indépendant : export art. 15
 * et effacement art. 17.
 *
 * Tests ROUGES d'abord : ni l'export ni l'effacement ne connaissaient la fiche
 * `Trainer` (déclarée « exception » dans l'inventaire RGPD).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  setting: vi.fn(),
  trainerFindFirst: vi.fn(),
  trainerUpdate: vi.fn(),
  trainerDelete: vi.fn(),
  trainerDeleteMany: vi.fn(),
  docsFindMany: vi.fn(),
  docsUpdateMany: vi.fn(),
  docsDelete: vi.fn(),
  docsDeleteMany: vi.fn(),
  contenuDelete: vi.fn(),
  contenuDeleteMany: vi.fn(),
  journalCreate: vi.fn(),
  verifFindMany: vi.fn(),
  preuveFindMany: vi.fn(),
  jobFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    setting: { findUnique: (...a: unknown[]) => m.setting(...a) },
    trainer: {
      findFirst: (...a: unknown[]) => m.trainerFindFirst(...a),
      update: (...a: unknown[]) => m.trainerUpdate(...a),
      delete: (...a: unknown[]) => m.trainerDelete(...a),
      deleteMany: (...a: unknown[]) => m.trainerDeleteMany(...a),
    },
    trainerDocument: {
      findMany: (...a: unknown[]) => m.docsFindMany(...a),
      updateMany: (...a: unknown[]) => m.docsUpdateMany(...a),
      delete: (...a: unknown[]) => m.docsDelete(...a),
      deleteMany: (...a: unknown[]) => m.docsDeleteMany(...a),
    },
    trainerDocumentContenu: {
      delete: (...a: unknown[]) => m.contenuDelete(...a),
      deleteMany: (...a: unknown[]) => m.contenuDeleteMany(...a),
    },
    activityLog: { create: (...a: unknown[]) => m.journalCreate(...a) },
    verificationRegistreSousTraitance: { findMany: (...a: unknown[]) => m.verifFindMany(...a) },
    preuveVigilance: { findMany: (...a: unknown[]) => m.preuveFindMany(...a) },
    jobApplication: { findMany: (...a: unknown[]) => m.jobFindMany(...a) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };
  return { prisma: client };
});

import {
  candidaturesAConserverPour,
  effacerFormateurIndependant,
  exporterFormateurIndependantPour,
  formateurIndependantASignalerPour,
  pieceAObligationDeConservation,
  masquerIbanFormateur,
} from "../rgpd-formateur-independant";

const ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "formatrice@example.test";

function fiche(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    prenom: "Camille",
    nom: "Exemple",
    email: EMAIL,
    telephone: "0600000000",
    statut: "sous_traitant",
    siret: "12345678200012",
    sousTraitantNda: "84380000000",
    adresseProfessionnelle: "1 rue de l'Exemple",
    codePostalPro: "69001",
    regimeTvaHonoraires: null,
    // Clair hérité (aucune clé en test) : la règle de masquage s'applique quand même.
    iban: "FR7630006000011234567890189",
    dossierStatut: null,
    dossierOuvertAt: null,
    dossierEnvoyeAt: null,
    declarations: null,
    declarationsAt: null,
    sousTraitantContratSigneAt: null,
    activationValideeAt: null,
    mandatAutofacturationSigneAt: null,
    mandatAutofacturationRevoqueAt: null,
    actif: false,
    finCollaborationAt: null,
    _count: {
      statements: 0,
      feeLines: 0,
      missionsFormateur: 0,
      sessionFormateurs: 0,
      documentsGeneres: 0,
      preuvesVigilance: 0,
      sessionsAnimees: 0,
      coachingSessions: 0,
      signaturesRecueillies: 0,
      emargementContresignatures: 0,
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.setting.mockResolvedValue({ value: { actif: true } });
  m.trainerFindFirst.mockResolvedValue(fiche());
  m.trainerUpdate.mockResolvedValue({});
  m.docsFindMany.mockResolvedValue([
    {
      type: "attestation_vigilance_urssaf",
      statutValidation: "valide",
      dateEmission: new Date("2026-09-01"),
      dateExpiration: new Date("2027-03-01"),
      createdAt: new Date("2026-09-02"),
      fichierUrl: "https://stockage.example/secret.pdf",
    },
  ]);
  m.docsUpdateMany.mockResolvedValue({ count: 1 });
  m.journalCreate.mockResolvedValue({});
  m.verifFindMany.mockResolvedValue([
    { verifieAt: new Date("2026-10-01"), verdict: "vert", source: "registre", reponseSource: {} },
  ]);
  m.preuveFindMany.mockResolvedValue([]);
  m.jobFindMany.mockResolvedValue([]);
});

describe("masquerIbanFormateur", () => {
  it("ne rend jamais l'IBAN entier", () => {
    const r = masquerIbanFormateur("FR76 3000 6000 0112 3456 7890 189");
    expect(r).toBe("FR76 •••• •••• 0189");
    expect(masquerIbanFormateur(null)).toBeNull();
  });
});

describe("exporterFormateurIndependantPour — art. 15", () => {
  it("🔴 rend la fiche du formateur indépendant, IBAN masqué, pièces sans fichier", async () => {
    const r = await exporterFormateurIndependantPour(EMAIL);
    expect(r).not.toBeNull();
    expect(r!.identite).toMatchObject({ prenom: "Camille", nom: "Exemple", email: EMAIL });
    expect(r!.iban).toBe("FR76 •••• •••• 0189");
    expect(JSON.stringify(r)).not.toContain("FR7630006000011234567890189");
    expect(JSON.stringify(r)).not.toContain("secret.pdf");
    expect(r!.pieces).toHaveLength(1);
    expect(r!.controlesRegistre[0]).toMatchObject({ verdict: "vert" });
    expect(JSON.stringify(r!.controlesRegistre)).not.toContain("reponseSource");
  });

  it("interrupteur `dossier_en_ligne` absent → comportement d'aujourd'hui (rien)", async () => {
    m.setting.mockResolvedValue(null);
    expect(await exporterFormateurIndependantPour(EMAIL)).toBeNull();
    expect(m.trainerFindFirst).not.toHaveBeenCalled();
  });

  it("ne cherche que les formateurs indépendants", async () => {
    await exporterFormateurIndependantPour(EMAIL);
    const where = (m.trainerFindFirst.mock.calls[0]![0] as { where: Record<string, unknown> })
      .where;
    expect(where).toMatchObject({ statut: "sous_traitant" });
  });
});

// ─── Effacement art. 17 : base EN MÉMOIRE ───────────────────────────────────
//
// Les pièces et leurs contenus vivent dans deux tableaux ; toute suppression
// appelée par le code les raccourcirait. Le test compte donc les LIGNES avant
// et après, au lieu de se fier à l'absence d'un appel.

const ADMIN = "22222222-2222-4222-8222-222222222222";
const OCTETS = Buffer.from("%PDF-1.7 pièce");

interface PieceMemoire {
  id: string;
  trainerId: string;
  type: string;
  fichierUrl: string | null;
  numeroPiece: string | null;
  notes: string | null;
  rejetMotif: string | null;
  archiveAt: Date | null;
  archiveParId: string | null;
  archiveMotif: string | null;
}

let pieces: PieceMemoire[] = [];
let contenus: Array<{ trainerDocumentId: string; octets: Buffer }> = [];

function piece(id: string, type: string): PieceMemoire {
  return {
    id,
    trainerId: ID,
    type,
    fichierUrl: `https://stockage.example/${id}.pdf`,
    numeroPiece: `N-${id}`,
    notes: "note",
    rejetMotif: null,
    archiveAt: null,
    archiveParId: null,
    archiveMotif: null,
  };
}

function base(): void {
  pieces = [
    piece("p-urssaf", "attestation_vigilance_urssaf"),
    piece("p-contrat", "contrat_sous_traitance"),
    piece("p-kbis", "kbis_avis_sirene"),
    piece("p-cv", "cv"),
    piece("p-autre", "autre"),
    piece("p-diplome", "diplome"),
  ];
  contenus = pieces.map((p) => ({ trainerDocumentId: p.id, octets: OCTETS }));
  m.docsFindMany.mockImplementation(async (args: { where: { trainerId: string } }) =>
    pieces.filter((p) => p.trainerId === args.where.trainerId).map((p) => ({ ...p })),
  );
  m.docsUpdateMany.mockImplementation(
    async (args: {
      where: { id: { in: string[] }; archiveAt: null };
      data: Partial<PieceMemoire>;
    }) => {
      let count = 0;
      for (const p of pieces) {
        if (args.where.id.in.includes(p.id) && p.archiveAt === null) {
          Object.assign(p, args.data);
          count++;
        }
      }
      return { count };
    },
  );
  const supprimer = (table: "pieces" | "contenus") => async () => {
    if (table === "pieces") pieces = [];
    else contenus = [];
    return { count: 99 };
  };
  m.docsDelete.mockImplementation(supprimer("pieces"));
  m.docsDeleteMany.mockImplementation(supprimer("pieces"));
  m.contenuDelete.mockImplementation(supprimer("contenus"));
  m.contenuDeleteMany.mockImplementation(supprimer("contenus"));
}

const JOURNAL = async (r: unknown) => ({
  adminUserId: ADMIN,
  action: "qualiopi.trainer.rgpd_effacement",
  targetType: "Trainer",
  targetId: ID,
  changes: r as never,
  ipAddress: null,
  userAgent: null,
});

function effacer() {
  return effacerFormateurIndependant(ID, { acteurId: ADMIN, journal: JOURNAL });
}

describe("effacerFormateurIndependant — art. 17, pseudonymisation", () => {
  beforeEach(base);

  it("interrupteur absent → aucun effet", async () => {
    m.setting.mockResolvedValue(null);
    const r = await effacer();
    expect(r.formateur).toBe("eteint");
    expect(m.trainerUpdate).not.toHaveBeenCalled();
    expect(m.docsUpdateMany).not.toHaveBeenCalled();
    expect(m.journalCreate).not.toHaveBeenCalled();
  });

  it("réglage illisible (base en panne) → « illisible », jamais « éteint » en silence", async () => {
    m.setting.mockRejectedValue(new Error("connexion perdue"));
    const r = await effacer();
    expect(r.formateur).toBe("illisible");
    expect(m.trainerUpdate).not.toHaveBeenCalled();
  });

  it("aucune fiche d'indépendant → aucun effet", async () => {
    m.trainerFindFirst.mockResolvedValue(null);
    expect((await effacer()).formateur).toBe("aucun");
    const where = (m.trainerFindFirst.mock.calls[0]![0] as { where: Record<string, unknown> })
      .where;
    expect(where).toEqual({ id: ID, statut: "sous_traitant" });
  });

  it("🔴 AUCUNE SUPPRESSION : autant de pièces et de contenus après qu'avant", async () => {
    const avant = { pieces: pieces.length, contenus: contenus.length };
    await effacer();
    expect({ pieces: pieces.length, contenus: contenus.length }).toEqual(avant);
    for (const f of [
      m.trainerDelete,
      m.trainerDeleteMany,
      m.docsDelete,
      m.docsDeleteMany,
      m.contenuDelete,
      m.contenuDeleteMany,
    ]) {
      expect(f).not.toHaveBeenCalled();
    }
  });

  it("🔴 les pièces légales restent INTACTES et lisibles par l'administrateur", async () => {
    const avant = pieces.filter(
      (p) => p.id !== "p-cv" && p.id !== "p-autre" && p.id !== "p-diplome",
    );
    const copie = structuredClone(avant);
    await effacer();
    for (const p of copie) {
      expect(pieces.find((x) => x.id === p.id)).toEqual(p);
      expect(contenus.find((c) => c.trainerDocumentId === p.id)?.octets.equals(OCTETS)).toBe(true);
    }
  });

  it("les autres pièces sont conservées, MASQUÉES par un marqueur", async () => {
    const r = await effacer();
    for (const id of ["p-cv", "p-autre", "p-diplome"]) {
      const p = pieces.find((x) => x.id === id)!;
      expect(p.archiveAt).toBeInstanceOf(Date);
      expect(p.archiveParId).toBe(ADMIN);
      expect(p.archiveMotif).toMatch(/conservée/);
      // Rien d'autre n'est touché : adresse du fichier et contenu restent.
      expect(p.fichierUrl).toBe(`https://stockage.example/${id}.pdf`);
      expect(contenus.find((c) => c.trainerDocumentId === id)?.octets.equals(OCTETS)).toBe(true);
    }
    expect(r).toMatchObject({ formateur: "efface", piecesMasquees: 3, piecesLegalesIntactes: 3 });
  });

  it("sans lien contractuel : identité PSEUDONYMISÉE, fiche jamais supprimée", async () => {
    await effacer();
    const data = (m.trainerUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data.prenom).toBe("[erased-rgpd-art17]");
    expect(data.nom).toBe("[erased-rgpd-art17]");
    // Par l'identifiant : deux effacements de la même adresse ne se heurtent pas.
    expect(data.email).toBe(`erased:${ID}@erased.local`);
    expect(data.emailHash).toBeNull();
    expect(data.telephone).toBeNull();
    expect(data.iban).toBeNull();
    expect(data.ibanEmpreinte).toBeNull();
    expect(data.adresseProfessionnelle).toBeNull();
    expect(data.adressePersonnelle).toBeNull();
    expect(data.numeroTvaIntracom).toBeNull();
    expect(data.accesVersion).toEqual({ increment: 1 });
    // Les adresses de pièces ne sont jamais retirées.
    expect(data).not.toHaveProperty("cvUrl");
    expect(data).not.toHaveProperty("sousTraitantScreenshotUrl");
    expect(data).not.toHaveProperty("rcProAttestationUrl");
  });

  it("lien contractuel : identité CONSERVÉE, preuves de compétence intactes, accès révoqués", async () => {
    m.trainerFindFirst.mockResolvedValue(
      fiche({
        sousTraitantContratSigneAt: new Date("2026-09-15"),
        _count: { ...fiche()._count, statements: 1 },
      }),
    );
    const r = await effacer();
    expect(r.formateur).toBe("conserve_obligation_legale");
    const data = (m.trainerUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data).toEqual({ telephone: null, accesVersion: { increment: 1 } });
    expect(pieces.find((p) => p.id === "p-diplome")!.archiveAt).toBeNull();
    expect(pieces.find((p) => p.id === "p-cv")!.archiveAt).toBeInstanceOf(Date);
    expect(r).toMatchObject({ piecesMasquees: 2, piecesLegalesIntactes: 4 });
  });

  it("mandat d'autofacturation signé, ou session animée seule = lien contractuel", async () => {
    m.trainerFindFirst.mockResolvedValue(
      fiche({ mandatAutofacturationSigneAt: new Date("2026-09-20") }),
    );
    expect((await effacer()).formateur).toBe("conserve_obligation_legale");
    m.trainerFindFirst.mockResolvedValue(
      fiche({ _count: { ...fiche()._count, sessionsAnimees: 1 } }),
    );
    expect((await effacer()).formateur).toBe("conserve_obligation_legale");
  });

  it("journal dans la transaction : cible UUID, aucune donnée personnelle", async () => {
    await effacer();
    expect(m.journalCreate).toHaveBeenCalledTimes(1);
    const ligne = (m.journalCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(ligne.targetId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    const texte = JSON.stringify(ligne);
    for (const pii of [EMAIL, "Camille", "Exemple", "0600000000", "FR7630006000011234567890189"]) {
      expect(texte).not.toContain(pii);
    }
  });

  it("une pièce déjà archivée n'est pas re-marquée", async () => {
    pieces.find((p) => p.id === "p-cv")!.archiveAt = new Date("2026-01-01");
    const r = await effacer();
    expect(pieces.find((p) => p.id === "p-cv")!.archiveAt).toEqual(new Date("2026-01-01"));
    expect(r.piecesMasquees).toBe(2);
  });
});

describe("pieceAObligationDeConservation", () => {
  it("contrats et preuves de vigilance : toujours ; CV : jamais", () => {
    for (const t of [
      "contrat_sous_traitance",
      "attestation_vigilance_urssaf",
      "kbis_avis_sirene",
    ]) {
      expect(pieceAObligationDeConservation(t, false)).toBe(true);
    }
    expect(pieceAObligationDeConservation("cv", true)).toBe(false);
    expect(pieceAObligationDeConservation("autre", true)).toBe(false);
    expect(pieceAObligationDeConservation("diplome", false)).toBe(false);
    expect(pieceAObligationDeConservation("diplome", true)).toBe(true);
  });
});

describe("formateurIndependantASignalerPour — la route libre-service ne modifie rien", () => {
  it("fiche présente → « à traiter par l'administrateur », sans écriture", async () => {
    expect(await formateurIndependantASignalerPour(EMAIL)).toBe("a_traiter_par_administrateur");
    expect(m.trainerUpdate).not.toHaveBeenCalled();
    expect(m.docsUpdateMany).not.toHaveBeenCalled();
  });

  it("interrupteur absent → « éteint », aucune lecture de fiche", async () => {
    m.setting.mockResolvedValue(null);
    expect(await formateurIndependantASignalerPour(EMAIL)).toBe("eteint");
    expect(m.trainerFindFirst).not.toHaveBeenCalled();
  });
});

describe("candidaturesAConserverPour — W5 I-11", () => {
  it("garde la candidature d'origine d'un formateur sous contrat", async () => {
    m.trainerFindFirst.mockResolvedValue(
      fiche({
        sousTraitantContratSigneAt: new Date("2026-09-15"),
        candidatureId: "c1",
        candidatures: [{ id: "c2" }],
      }),
    );
    expect([...(await candidaturesAConserverPour(EMAIL))].sort()).toEqual(["c1", "c2"]);
  });

  it("formateur sans lien contractuel → rien n'est retenu", async () => {
    m.trainerFindFirst.mockResolvedValue(fiche({ candidatureId: "c1", candidatures: [] }));
    expect((await candidaturesAConserverPour(EMAIL)).size).toBe(0);
  });

  it("interrupteur absent → aucune candidature retenue (comportement d'aujourd'hui)", async () => {
    m.setting.mockResolvedValue(null);
    expect((await candidaturesAConserverPour(EMAIL)).size).toBe(0);
    expect(m.trainerFindFirst).not.toHaveBeenCalled();
  });
});
