/**
 * Lot A8c — les DEUX circuits de paiement OPCO, de bout en bout au niveau des
 * fonctions de service (base simulée) : créances du dossier → émission des
 * factures → destinataire de la relance.
 *
 *   · SUBROGATION, accord partiel : deux factures (OPCO pour la part accordée,
 *     entreprise pour le reste), dont la somme TTC = le prix TTC ;
 *   · REMBOURSEMENT : une seule facture, du total, à l'entreprise — aucune à
 *     l'OPCO, même quand le dossier ne porte aucune créance ;
 *   · TVA toujours présente ; la relance vise le débiteur de CHAQUE facture.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: null }),
}));

type FactureCreee = Record<string, unknown> & { id: string; numero: string };

const etat = vi.hoisted(() => ({
  session: null as Record<string, unknown> | null,
  creees: [] as FactureCreee[],
  rattachements: [] as Array<{ creanceId: string; factureId: string }>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: vi.fn(async () => {
        if (etat.session === null) return null;
        // La base RELUE à chaque émission : les créances déjà rattachées et
        // les factures déjà émises comptent pour la suivante.
        const dossiers = (
          etat.session["dossiersFinancement"] as Array<{
            id: string;
            payeurs: Array<Record<string, unknown>>;
          }>
        ).map((dos) => ({
          ...dos,
          payeurs: dos.payeurs.map((p) => ({
            ...p,
            factureFormationId:
              etat.rattachements.find((r) => r.creanceId === p["id"])?.factureId ?? null,
          })),
        }));
        return {
          ...etat.session,
          dossiersFinancement: dossiers,
          facturesFormation: etat.creees.map((f) => ({
            id: f.id,
            numero: f.numero,
            statut: "emise",
            montantHtCents: f["montantHtCents"],
            avoirs: [],
          })),
        };
      }),
    },
    factureFormation: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const f = {
          ...data,
          id: `f-${etat.creees.length + 1}`,
          numero: `AXI-FACT-2026-${String(200 + etat.creees.length + 1)}`,
        } as FactureCreee;
        etat.creees.push(f);
        return { id: f.id, numero: f.numero, documentId: null };
      }),
    },
    dossierPayeur: {
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { factureFormationId: string };
        }) => {
          etat.rattachements.push({ creanceId: where.id, factureId: data.factureFormationId });
          return {};
        },
      ),
    },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ $queryRaw: async () => [{ acquis: true }] }),
    ),
  },
}));

// `_guards` charge next-auth, introuvable sous Vitest : simulé SANS
// `importOriginal` (comme dans toutes les suites voisines). Le service
// d'émission ne l'appelle pas ; `site-settings` l'importe.
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/qualiopi/documents/organisme", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/organisme")>()),
  getOrganismeIdentite: vi.fn().mockResolvedValue({
    raisonSociale: "Organisme test",
    siret: "00000000000000",
    nda: "00000000000",
    adresseSiege: "1 rue de l'Exemple, 00000 Ville",
  }),
}));
vi.mock("@/server/qualiopi/documents/conformite", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/conformite")>()),
  champsIdentiteManquants: vi.fn().mockReturnValue([]),
}));
vi.mock("@/server/qualiopi/config/site-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/config/site-settings")>()),
  getQualiopiConfig: vi.fn(async (cle: string) => {
    if (cle === "delai_paiement_financeur_jours") return 45;
    if (cle === "delai_paiement_jours") return 30;
    if (cle === "regime_tva") return "assujetti";
    if (cle === "taux_tva_standard_percent") return 20;
    return null;
  }),
}));

import { emettreFactureFormationSession } from "./facture-formation-emission";
import { construireLignesPayeurs } from "./dossier-payeurs";
import { resoudreDestinataireRelance } from "./relance-destinataire";
import { factureOuvreLaTransmissionRemboursement } from "./circuit-paiement-opco";

const PRIX_HT = 150000;
const PRIX_TTC = 180000;

const CLIENT = {
  id: "c-1",
  type: "entreprise",
  raisonSociale: "Acme",
  siret: "12345678900011",
  adresse: "1 rue de l'Exemple, 00000 Ville",
  adresseRue: null,
  adresseCodePostal: null,
  adresseVille: null,
  tvaIntracom: null,
  opco: null,
  opcoIdentifie: "atlas",
  delaiPaiementJours: null,
  contactNom: "Mme Martin",
  contactEmail: "compta@acme.test",
};

/**
 * Les créances du dossier, calculées par la VRAIE ventilation (celle qu'écrit
 * `reventilerPayeurs` à l'accord), puis posées en base simulée.
 */
function dossierDepuisVentilation(opcoSubrogation: boolean, plafond: number | null) {
  const lignes = construireLignesPayeurs(
    [],
    {
      financementType: "opco",
      montantHtCents: PRIX_HT,
      opcoSubrogation,
      priseEnChargeMontantCents: null,
      client: { id: CLIENT.id, raisonSociale: CLIENT.raisonSociale, opcoIdentifie: "atlas" },
    },
    { plafondFinanceurCents: plafond },
  );
  return [
    {
      id: "dos-1",
      payeurs: lignes.map((l, i) => ({ id: `cr-${i}`, ...l, factureFormationId: null })),
    },
  ];
}

function session(opcoSubrogation: boolean, dossiers: unknown[]) {
  return {
    financementType: "opco",
    opcoStatut: "accord_recu",
    opcoSubrogation,
    numeroDossierOpco: opcoSubrogation ? "ATL-2026-77" : null,
    edofVerifieAt: null,
    montantHtCents: PRIX_HT,
    dureeReelleHeures: 14,
    nbParticipantsReels: 2,
    nbParticipantsPrevus: 2,
    modalite: "presentiel",
    titreSession: "IA générative au quotidien",
    numero: "AXI-SESS-2026-901",
    priseEnChargeMontantCents: null,
    priseEnChargeUnite: null,
    priseEnChargePlafondFormationCents: null,
    priseEnChargePlafondAnnuelCents: null,
    dateDebut: new Date("2026-10-12T07:00:00Z"),
    dateFin: new Date("2026-10-13T15:00:00Z"),
    clientId: CLIENT.id,
    formation: { titre: "IA générative au quotidien", dureeHeures: 14 },
    enrollments: [],
    dossiersFinancement: dossiers,
    client: CLIENT,
  };
}

const emettre = (destinataire: "opco" | "entreprise") =>
  emettreFactureFormationSession({ sessionId: "s-1", destinataire, ventilation: "forfait" });

const DOSSIER_RELANCE = {
  financeurNom: "Atlas",
  financeurContactNom: "Gestionnaire Atlas",
  financeurContactEmail: "gestion@atlas.test",
  numeroDossierExterne: "ATL-2026-77",
  subrogation: true,
};

beforeEach(() => {
  etat.session = null;
  etat.creees = [];
  etat.rattachements = [];
});

describe("SUBROGATION — accord partiel de l'OPCO", () => {
  it("deux factures : l'OPCO pour la part accordée, l'entreprise pour le reste ; somme TTC = prix TTC", async () => {
    const ACCORDE = 123457;
    etat.session = session(true, dossierDepuisVentilation(true, ACCORDE));

    const opco = await emettre("opco");
    expect("data" in opco, JSON.stringify(opco)).toBe(true);
    const reste = await emettre("entreprise");
    expect("data" in reste, JSON.stringify(reste)).toBe(true);

    expect(etat.creees).toHaveLength(2);
    const [fOpco, fEnt] = etat.creees as [FactureCreee, FactureCreee];

    expect(fOpco["destinataire"]).toBe("opco");
    expect(fOpco["destinataireNom"]).toBe("Atlas");
    expect(fOpco["montantHtCents"]).toBe(ACCORDE);
    expect(fOpco["subrogation"]).toBe(true);
    expect(fOpco["numeroDossierOpco"]).toBe("ATL-2026-77");

    expect(fEnt["destinataire"]).toBe("entreprise");
    expect(fEnt["destinataireNom"]).toBe("Acme");
    expect(fEnt["montantHtCents"]).toBe(PRIX_HT - ACCORDE);
    // Le reste à charge n'est pas une facture subrogée.
    expect(fEnt["subrogation"]).toBe(false);

    for (const f of etat.creees) {
      expect(f["montantTvaCents"] as number).toBeGreaterThan(0);
      expect(f["tvaExoneree"]).toBe(false);
    }
    const sommeTtc = etat.creees.reduce((n, f) => n + (f["montantTtcCents"] as number), 0);
    expect(sommeTtc).toBe(PRIX_TTC);
  });

  it("accord total : une seule facture, à l'OPCO, TVA comprise ; plus rien à facturer à l'entreprise", async () => {
    etat.session = session(true, dossierDepuisVentilation(true, PRIX_HT));
    expect("data" in (await emettre("opco"))).toBe(true);
    const reste = await emettre("entreprise");
    expect("error" in reste).toBe(true);
    expect(etat.creees).toHaveLength(1);
    expect(etat.creees[0]!["montantTtcCents"]).toBe(PRIX_TTC);
  });

  it("la relance vise le FINANCEUR sur sa facture, l'ENTREPRISE sur le reste à charge", async () => {
    etat.session = session(true, dossierDepuisVentilation(true, 100000));
    await emettre("opco");
    await emettre("entreprise");
    const [fOpco, fEnt] = etat.creees as [FactureCreee, FactureCreee];

    const surOpco = resoudreDestinataireRelance({
      destinataire: fOpco["destinataire"] as "opco",
      destinataireNom: fOpco["destinataireNom"] as string,
      dossier: DOSSIER_RELANCE,
      client: CLIENT,
    });
    expect(surOpco.qualite).toBe("financeur");
    expect(surOpco.email).toBe("gestion@atlas.test");

    const surReste = resoudreDestinataireRelance({
      destinataire: fEnt["destinataire"] as "entreprise",
      destinataireNom: fEnt["destinataireNom"] as string,
      dossier: DOSSIER_RELANCE,
      client: CLIENT,
    });
    expect(surReste.qualite).toBe("entreprise");
    expect(surReste.email).toBe("compta@acme.test");
  });
});

describe("REMBOURSEMENT — l'entreprise paie tout, l'OPCO la rembourse", () => {
  it("une seule facture, du total TTC, à l'entreprise ; l'OPCO est refusé", async () => {
    etat.session = session(false, dossierDepuisVentilation(false, 100000));

    const opco = await emettre("opco");
    expect("error" in opco).toBe(true);

    const ent = await emettre("entreprise");
    expect("data" in ent, JSON.stringify(ent)).toBe(true);

    expect(etat.creees).toHaveLength(1);
    const f = etat.creees[0]!;
    expect(f["destinataire"]).toBe("entreprise");
    expect(f["montantHtCents"]).toBe(PRIX_HT);
    expect(f["montantTtcCents"]).toBe(PRIX_TTC);
    expect(f["montantTvaCents"]).toBe(PRIX_TTC - PRIX_HT);
    expect(f["subrogation"]).toBe(false);
    expect(f["numeroDossierOpco"]).toBeNull();
  });

  it("🔴 sans dossier ni créance, une facture à l'OPCO est REFUSÉE (elle passait)", async () => {
    etat.session = session(false, []);
    const opco = await emettre("opco");
    expect(opco).toEqual({ error: expect.stringContaining("rembourse l'entreprise") });
    expect(etat.creees).toHaveLength(0);
  });

  it("la relance vise l'entreprise, et la facture soldée ouvre la transmission des pièces", async () => {
    etat.session = session(false, dossierDepuisVentilation(false, null));
    await emettre("entreprise");
    const f = etat.creees[0]!;
    const relance = resoudreDestinataireRelance({
      destinataire: f["destinataire"] as "entreprise",
      destinataireNom: f["destinataireNom"] as string,
      dossier: { ...DOSSIER_RELANCE, subrogation: false },
      client: CLIENT,
    });
    expect(relance.qualite).toBe("entreprise");
    expect(relance.email).toBe("compta@acme.test");

    expect(
      factureOuvreLaTransmissionRemboursement({
        destinataire: f["destinataire"] as "entreprise",
        subrogation: f["subrogation"] as boolean,
        avoirDeId: null,
        session: { financementType: "opco", opcoSubrogation: false },
      }),
    ).toBe(true);
  });
});
