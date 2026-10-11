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
  contenuDeleteMany: vi.fn(),
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
    },
    trainerDocumentContenu: { deleteMany: (...a: unknown[]) => m.contenuDeleteMany(...a) },
    verificationRegistreSousTraitance: { findMany: (...a: unknown[]) => m.verifFindMany(...a) },
    preuveVigilance: { findMany: (...a: unknown[]) => m.preuveFindMany(...a) },
    jobApplication: { findMany: (...a: unknown[]) => m.jobFindMany(...a) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };
  return { prisma: client };
});

import {
  candidaturesAConserverPour,
  eraseFormateurIndependantForEmail,
  exporterFormateurIndependantPour,
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
    actif: false,
    finCollaborationAt: null,
    _count: {
      statements: 0,
      feeLines: 0,
      missionsFormateur: 0,
      sessionFormateurs: 0,
      documentsGeneres: 0,
      preuvesVigilance: 0,
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
  m.contenuDeleteMany.mockResolvedValue({ count: 2 });
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

describe("eraseFormateurIndependantForEmail — art. 17", () => {
  it("interrupteur absent → aucun effet", async () => {
    m.setting.mockResolvedValue(null);
    const r = await eraseFormateurIndependantForEmail(EMAIL);
    expect(r.formateur).toBe("eteint");
    expect(m.trainerUpdate).not.toHaveBeenCalled();
    expect(m.contenuDeleteMany).not.toHaveBeenCalled();
  });

  it("réglage illisible (base en panne) → « illisible », jamais « éteint » en silence", async () => {
    m.setting.mockRejectedValue(new Error("connexion perdue"));
    const r = await eraseFormateurIndependantForEmail(EMAIL);
    expect(r.formateur).toBe("illisible");
    expect(m.trainerUpdate).not.toHaveBeenCalled();
  });

  it("aucune fiche → aucun effet", async () => {
    m.trainerFindFirst.mockResolvedValue(null);
    expect((await eraseFormateurIndependantForEmail(EMAIL)).formateur).toBe("aucun");
  });

  it("🔴 jamais de suppression de la fiche ; octets des pièces supprimés explicitement", async () => {
    const r = await eraseFormateurIndependantForEmail(EMAIL);
    expect(r.formateur).toBe("efface");
    expect(m.trainerDelete).not.toHaveBeenCalled();
    expect(m.trainerDeleteMany).not.toHaveBeenCalled();
    expect(m.contenuDeleteMany).toHaveBeenCalledTimes(1);
    expect(r.octetsSupprimes).toBe(2);
    const data = (m.trainerUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data.prenom).not.toBe("Camille");
    expect(data.iban).toBeNull();
    expect(data.ibanEmpreinte).toBeNull();
    expect(data.emailHash).toBeNull();
    // Par l'identifiant : deux effacements de la même adresse ne se heurtent pas.
    expect(data.email).toBe(`erased:${ID}@erased.local`);
    expect(data.numeroTvaIntracom).toBeNull();
    expect(data.sousTraitantNda).toBeNull();
    expect(data.accesVersion).toEqual({ increment: 1 });
  });

  it("lien contractuel (contrat signé, relevés…) → identité CONSERVÉE, accès révoqués", async () => {
    m.trainerFindFirst.mockResolvedValue(
      fiche({
        sousTraitantContratSigneAt: new Date("2026-09-15"),
        _count: { ...fiche()._count, statements: 1 },
      }),
    );
    const r = await eraseFormateurIndependantForEmail(EMAIL);
    expect(r.formateur).toBe("conserve_obligation_legale");
    const data = (m.trainerUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty("prenom");
    expect(data).not.toHaveProperty("iban");
    expect(data.telephone).toBeNull();
    expect(data.accesVersion).toEqual({ increment: 1 });
    expect(m.contenuDeleteMany).toHaveBeenCalledTimes(1);
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
