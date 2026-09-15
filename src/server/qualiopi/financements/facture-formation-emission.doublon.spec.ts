/**
 * 🔴 JAMAIS DEUX FACTURES VIVANTES POUR LA MÊME PRESTATION — relecture A09 de la
 * PR 1097, dette n° 1.
 *
 * Depuis que l'automate émet la facture d'une session en financement direct le
 * lendemain de sa fin, le bouton « Générer la facture de formation » — affiché
 * sans condition sur la fiche session — pouvait en émettre une SECONDE l'après-
 * midi : sans créance de dossier, le chemin d'émission ne regardait pas les
 * factures existantes. Deux numéros de la série légale pour une prestation.
 *
 * La règle, au point d'émission partagé par le bouton et l'automate :
 *   - sans créance : aucune autre facture VIVANTE de la session ne doit exister ;
 *   - avec créances : aucune facture vivante NON rattachée à une créance du
 *     dossier (une facture « globale » couvre déjà tout) — les factures des
 *     autres créances restent permises, c'est le cas légitime OPCO + reste à
 *     charge ;
 *   - VIVANTE = ni annulée, ni entièrement rectifiée par ses avoirs non annulés.
 *     Un brouillon est vivant.
 *
 * Et les deux chemins prennent le MÊME verrou consultatif par session : deux
 * clics simultanés, ou un clic pendant le passage du cron, ne font qu'une pièce.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

type FactureEtat = {
  id: string;
  numero: string;
  statut: string;
  montantHtCents: number;
  avoirs: Array<{ statut: string; montantHtCents: number }>;
};

const etat = vi.hoisted(() => ({
  factures: [] as FactureEtat[],
  verrous: new Set<string>(),
  session: null as Record<string, unknown> | null,
  compteur: 0,
}));

const d = vi.hoisted(() => ({ create: vi.fn(), payeurUpdate: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: vi.fn(async () =>
        etat.session === null
          ? null
          : { ...etat.session, facturesFormation: etat.factures.map((f) => ({ ...f })) },
      ),
    },
    factureFormation: {
      findMany: vi.fn(async () => []),
      create: (...a: unknown[]) => d.create(...a),
    },
    dossierPayeur: { update: (...a: unknown[]) => d.payeurUpdate(...a) },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tenues: string[] = [];
      const tx = {
        $queryRaw: async (_s: TemplateStringsArray, ...valeurs: unknown[]) => {
          const cle = String(valeurs[0]);
          if (etat.verrous.has(cle)) return [{ acquis: false }];
          etat.verrous.add(cle);
          tenues.push(cle);
          return [{ acquis: true }];
        },
      };
      try {
        return await fn(tx);
      } finally {
        for (const c of tenues) etat.verrous.delete(c);
      }
    }),
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({
    raisonSociale: "Organisme test",
    siret: "00000000000000",
    nda: "00000000000",
    adresseSiege: "1 rue de l'Exemple, 00000 Ville",
  }),
}));
vi.mock("@/server/qualiopi/documents/conformite", () => ({
  champsIdentiteManquants: vi.fn().mockReturnValue([]),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async (cle: string) =>
    cle === "delai_paiement_financeur_jours" ? 45 : 30,
  ),
}));

import { genererFactureFormationAction } from "@/server/actions/qualiopi/financements";

const SESSION_ID = "66666666-6666-4666-8666-666666666666";

function sessionDirecte(over: Record<string, unknown> = {}) {
  return {
    financementType: "direct",
    opcoStatut: null,
    opcoSubrogation: false,
    numeroDossierOpco: null,
    edofVerifieAt: null,
    montantHtCents: 150000,
    dureeReelleHeures: 7,
    nbParticipantsReels: 1,
    nbParticipantsPrevus: 1,
    modalite: "presentiel",
    titreSession: "Formation test",
    numero: "AXI-SESS-2026-900",
    priseEnChargeMontantCents: null,
    priseEnChargeUnite: null,
    priseEnChargePlafondFormationCents: null,
    priseEnChargePlafondAnnuelCents: null,
    dateDebut: new Date("2026-10-05T07:00:00Z"),
    dateFin: new Date("2026-10-05T15:00:00Z"),
    clientId: "c-1",
    dossiersFinancement: [],
    client: {
      type: "entreprise",
      raisonSociale: "Acme",
      siret: "12345678900011",
      adresse: "1 rue de l'Exemple, 00000 Ville",
      adresseRue: null,
      adresseCodePostal: null,
      adresseVille: null,
      tvaIntracom: null,
      opcoIdentifie: null,
      delaiPaiementJours: null,
    },
    ...over,
  };
}

const facture = (over: Partial<FactureEtat> = {}): FactureEtat => ({
  id: "f-1",
  numero: "AXI-FACT-2026-041",
  statut: "emise",
  montantHtCents: 150000,
  avoirs: [],
  ...over,
});

const generer = () =>
  genererFactureFormationAction({
    sessionId: SESSION_ID,
    destinataire: "entreprise",
    ventilation: "forfait",
  });

beforeEach(() => {
  vi.clearAllMocks();
  etat.factures = [];
  etat.verrous = new Set();
  etat.session = sessionDirecte();
  etat.compteur = 0;
  d.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    // L'écriture prend du temps : c'est dans cette fenêtre qu'un second clic
    // lirait « aucune facture » sans verrou.
    await new Promise((r) => setTimeout(r, 5));
    etat.compteur += 1;
    const f = facture({
      id: `f-new-${etat.compteur}`,
      numero: `AXI-FACT-2026-${String(100 + etat.compteur)}`,
      montantHtCents: data["montantHtCents"] as number,
    });
    etat.factures.push(f);
    return { id: f.id, numero: f.numero, documentId: null };
  });
  d.payeurUpdate.mockResolvedValue({});
});

describe("🔴 sans créance : une facture vivante existe déjà → refus, rien n'est émis", () => {
  it.each(["emise", "partiellement_payee", "en_retard", "payee", "brouillon"])(
    "facture « %s » existante",
    async (statut) => {
      etat.factures = [facture({ statut })];
      const r = await generer();
      expect(r).toEqual({
        error:
          "Une facture existe déjà pour cette session : AXI-FACT-2026-041. " +
          "Pour refacturer, émettez d'abord un avoir sur cette facture.",
      });
      expect(d.create).not.toHaveBeenCalled();
    },
  );

  it("un avoir PARTIEL laisse la facture vivante : refus", async () => {
    etat.factures = [facture({ avoirs: [{ statut: "emise", montantHtCents: -50000 }] })];
    expect("error" in (await generer())).toBe(true);
    expect(d.create).not.toHaveBeenCalled();
  });

  it("une facture ANNULÉE ne bloque pas la réémission", async () => {
    etat.factures = [facture({ statut: "annulee" })];
    expect("data" in (await generer())).toBe(true);
    expect(d.create).toHaveBeenCalledTimes(1);
  });

  it("une facture couverte par un avoir TOTAL ne bloque pas la réémission", async () => {
    etat.factures = [facture({ avoirs: [{ statut: "emise", montantHtCents: -150000 }] })];
    expect("data" in (await generer())).toBe(true);
  });

  it("un avoir total lui-même ANNULÉ laisse la facture vivante : refus", async () => {
    etat.factures = [facture({ avoirs: [{ statut: "annulee", montantHtCents: -150000 }] })];
    expect("error" in (await generer())).toBe(true);
  });
});

describe("✅ les cas LÉGITIMES de plusieurs factures restent possibles", () => {
  function dossierSubroge(factureOpco: string | null) {
    return [
      {
        id: "dos-1",
        payeurs: [
          {
            id: "cr-opco",
            payeurType: "opco_subroge",
            payeurNom: "Atlas",
            montantAttenduCents: 100000,
            factureFormationId: factureOpco,
          },
          {
            id: "cr-ent",
            payeurType: "entreprise",
            payeurNom: "Acme",
            montantAttenduCents: 50000,
            factureFormationId: null,
          },
        ],
      },
    ];
  }

  it("créances multiples : la part OPCO facturée n'empêche pas la facture du reste à charge", async () => {
    etat.session = sessionDirecte({
      financementType: "opco",
      opcoStatut: "accord_recu",
      opcoSubrogation: true,
      numeroDossierOpco: "ATL-1",
      dossiersFinancement: dossierSubroge("f-opco"),
    });
    etat.factures = [facture({ id: "f-opco", numero: "AXI-FACT-2026-050" })];
    const r = await generer();
    expect("data" in r, JSON.stringify(r)).toBe(true);
    expect(d.create).toHaveBeenCalledTimes(1);
  });

  it("🔴 mais une facture GLOBALE, rattachée à aucune créance, bloque la facture d'une créance", async () => {
    etat.session = sessionDirecte({
      financementType: "opco",
      opcoStatut: "accord_recu",
      opcoSubrogation: true,
      numeroDossierOpco: "ATL-1",
      dossiersFinancement: dossierSubroge(null),
    });
    etat.factures = [facture({ id: "f-globale", numero: "AXI-FACT-2026-060" })];
    const r = await generer();
    expect(r).toMatchObject({ error: expect.stringContaining("AXI-FACT-2026-060") });
    expect(d.create).not.toHaveBeenCalled();
  });

  it("sans aucune facture, l'émission historique est intacte", async () => {
    expect("data" in (await generer())).toBe(true);
  });
});

describe("🔴 le MÊME verrou consultatif pour le bouton et l'automate", () => {
  it("deux clics simultanés : UNE seule facture", async () => {
    const [a, b] = await Promise.all([generer(), generer()]);
    expect(d.create).toHaveBeenCalledTimes(1);
    expect([a, b].filter((r) => "data" in r)).toHaveLength(1);
    const refus = [a, b].find((r) => "error" in r) as { error: string };
    expect(refus.error).toMatch(/en cours|existe déjà/);
  });

  it("verrou tenu par un autre passage : refus explicite, rien n'est émis", async () => {
    etat.verrous.add(`facture_session:${SESSION_ID}`);
    const r = await generer();
    expect(r).toEqual({
      error:
        "Une génération de facture est déjà en cours pour cette session. Réessayez dans un instant.",
    });
    expect(d.create).not.toHaveBeenCalled();
  });
});
