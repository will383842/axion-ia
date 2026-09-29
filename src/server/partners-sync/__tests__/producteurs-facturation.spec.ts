// @vitest-environment node
// @req REQ-ARG-001
// @req REQ-ARG-005
// @req REQ-ARG-030
// @req REQ-DM-039
// @req REQ-INT-004
// @req REQ-INT-005
// @req REQ-INT-007
// @req REQ-INT-032
/**
 * INT-T05 — les producteurs UNIQUES des faits de facturation, sur un faux client de transaction
 * en mémoire : `facture.emise`, `avoir.emis`, `paiement.recu`, `paiement.rembourse`,
 * `facture.annulee`, `financement.mis_a_jour`.
 *
 * Chaque charge produite est jugée par le contrat publié (`contrat-schema.ts`), enveloppe
 * comprise ; chaque `event_id` est celui de la convention des fixtures (`<type>:<id>`).
 * Ce qu'un faux ne prouve pas — qu'un retour arrière Postgres efface la ligne — l'est contre un
 * vrai Postgres par `tests/integration/partners-sync/outbox-transactionnelle.spec.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TYPES_EVENEMENT } from "@/server/partners/contrat";
import { identifiantEvenement } from "@/server/partners/enveloppe";
import { fautes, RACINE, resoudre } from "@/server/partners/__tests__/contrat-schema";

import type { Prisma, PrismaClient } from "../../../../prisma/generated/client";
import { EvenementHorsContrat, ecrireEvenementPartners, finaliserCorps } from "../outbox";
import {
  AVOIR_EMIS,
  ChargeFacturationRefusee,
  FACTURE_ANNULEE,
  FACTURE_EMISE,
  FINANCEMENT_MIS_A_JOUR,
  PAIEMENT_RECU,
  PAIEMENT_REMBOURSE,
  emettreFactureAnnulee,
  emettreFaitFacture,
  emettreFaitPaiement,
  emettreFinancementMisAJour,
  transactionFaitFacturation,
  verifierAttribution,
  type AlerteFacturation,
} from "../producteurs/facturation";

// ─────────────────────────────────────────────────────────────────────────────
// Le monde d'essai : une entreprise formée, un OPCO qui paie à sa place
// ─────────────────────────────────────────────────────────────────────────────

const ENTREPRISE = "7c000000-0000-4000-8000-000000000005";
/** L'OPCO a lui aussi une fiche client : c'est le piège — il ne porte JAMAIS l'attribution. */
const OPCO = "7c000000-0000-4000-8000-0000000000c0";
const SESSION = "5e000000-0000-4000-8000-000000000005";
const DOSSIER = "d0000000-0000-4000-8000-000000000005";
const F_OPCO = "fa000000-0000-4000-8000-000000000001";
const F_ENTREPRISE = "fa000000-0000-4000-8000-000000000002";
const F_ORPHELINE = "fa000000-0000-4000-8000-000000000003";
const AVOIR = "fa000000-0000-4000-8000-0000000000a1";

type Enregistrement = Record<string, unknown>;
type LigneOutbox = { eventId: string; eventType: string; subjectRef: string; corps: string };

function client(id: string, siren: string, raisonSociale: string): Enregistrement {
  return {
    id,
    numero: `AXI-CLI-${id.slice(-3)}`,
    type: "entreprise",
    raisonSociale,
    siren,
    nafCode: "6201Z",
    secteur: "Informatique",
    taille: "pme_10_49",
    createdAt: new Date("2026-01-02T10:00:00.000Z"),
    updatedAt: new Date("2026-01-02T10:00:00.000Z"),
  };
}

function facture(surcharge: Enregistrement = {}): Enregistrement {
  return {
    id: F_OPCO,
    numero: "AXI-FACT-2026-501",
    activite: "formation",
    clientId: null,
    sessionId: SESSION,
    enrollmentId: null,
    coachingContractId: null,
    dossierFinancementId: DOSSIER,
    destinataire: "opco",
    destinataireSiret: "73282932000012",
    montantHtCents: 100_000,
    montantTvaCents: 20_000,
    montantTtcCents: 120_000,
    regimeTva: "assujetti",
    subrogation: true,
    avoirDeId: null,
    statut: "emise",
    emiseAt: new Date("2026-03-01T09:00:00.000Z"),
    echeanceAt: new Date("2026-03-31T09:00:00.000Z"),
    paidAt: null,
    createdAt: new Date("2026-03-01T09:00:00.000Z"),
    updatedAt: new Date("2026-03-01T09:00:00.000Z"),
    // La session appartient à l'ENTREPRISE : c'est elle, la bénéficiaire.
    session: { clientId: ENTREPRISE },
    enrollment: null,
    dossierFinancement: {
      clientId: ENTREPRISE,
      echeanceFinanceurAt: new Date("2026-05-15T00:00:00.000Z"),
      updatedAt: new Date("2026-03-02T08:00:00.000Z"),
    },
    ...surcharge,
  };
}

function paiement(id: string, factureId: string | null, montant: number, jour: string) {
  return {
    id,
    factureFormationId: factureId,
    provider: "manual_wire",
    amountCents: montant,
    currency: "EUR",
    status: "succeeded",
    type: "balance",
    paidAt: new Date(`2026-04-${jour}T10:00:00.000Z`),
    createdAt: new Date(`2026-04-${jour}T10:00:00.000Z`),
  } as Enregistrement;
}

/** Un faux client de transaction : les accès des producteurs, rien d'autre. */
function fauxTx(
  factures: Enregistrement[],
  paiements: Enregistrement[] = [],
  payeurs: Enregistrement[] = [],
  clientsEnPlus: Enregistrement[] = [],
) {
  const outbox = new Map<string, LigneOutbox>();
  const lectures: string[] = [];
  const clients = [
    client(ENTREPRISE, "123456782", "Entreprise formée"),
    client(OPCO, "732829320", "OPCO"),
    ...clientsEnPlus,
  ];
  const tx = {
    // Le verrou de ligne de la facture : consigné, pour prouver qu'il PRÉCÈDE la lecture du cumul.
    $queryRaw: async (gabarit: TemplateStringsArray, ...valeurs: unknown[]) => {
      if (gabarit.join("?").includes("FOR UPDATE")) lectures.push(`verrou:${String(valeurs[0])}`);
      return [];
    },
    factureFormation: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        lectures.push(`facture:${where.id}`);
        return factures.find((f) => f["id"] === where.id) ?? null;
      },
    },
    client: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        lectures.push(`client:${where.id}`);
        return clients.find((c) => c["id"] === where.id) ?? null;
      },
    },
    dossierPayeur: {
      findMany: async ({ where }: { where: { factureFormationId: string } }) =>
        payeurs
          .filter((p) => p["factureFormationId"] === where.factureFormationId)
          .map((p) => ({
            payeurType: p["payeurType"],
            montantAttenduCents: p["montantAttenduCents"],
          })),
    },
    payment: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        lectures.push(`payment:${where.id}`);
        return paiements.find((p) => p["id"] === where.id) ?? null;
      },
      aggregate: async ({
        where,
      }: {
        where: { factureFormationId: string; status: string; type: { not: string } };
      }) => {
        lectures.push(`cumul:${where.factureFormationId}`);
        const retenus = paiements.filter(
          (p) =>
            p["factureFormationId"] === where.factureFormationId &&
            p["status"] === where.status &&
            p["type"] !== where.type.not,
        );
        return {
          _sum: {
            amountCents:
              retenus.length === 0
                ? null
                : retenus.reduce((s, p) => s + (p["amountCents"] as number), 0),
          },
        };
      },
    },
    partnersSyncOutbox: {
      createMany: async ({ data }: { data: LigneOutbox[]; skipDuplicates: boolean }) => {
        let count = 0;
        for (const l of data) {
          if (outbox.has(l.eventId)) continue;
          outbox.set(l.eventId, l);
          count += 1;
        }
        return { count };
      },
    },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, outbox, lectures };
}

type Enveloppe = { event_type: string; payload: Record<string, unknown> };

function enveloppe(outbox: Map<string, LigneOutbox>, eventId: string | null): Enveloppe {
  const ligne = eventId === null ? undefined : outbox.get(eventId);
  if (!ligne) throw new Error(`aucune ligne ${String(eventId)} dans la file`);
  return JSON.parse(
    finaliserCorps(ligne.corps, 1n, new Date("2026-06-01T00:00:00.000Z")),
  ) as Enveloppe;
}

/** Juge une ligne de la file par le contrat publié : l'enveloppe ET la charge de son type. */
function jugee(outbox: Map<string, LigneOutbox>, eventId: string | null): Enveloppe {
  const env = enveloppe(outbox, eventId);
  expect(fautes(RACINE, env)).toEqual([]);
  const def = `#/$defs/payload_${env.event_type.replace(".", "_")}`;
  expect(fautes(resoudre(def), env.payload)).toEqual([]);
  return env;
}

const ENV = { ...process.env };
beforeEach(() => {
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.DATABASE_URL = "postgresql://t05@localhost:5432/t05";
});
afterEach(() => {
  process.env = { ...ENV };
});

// ─────────────────────────────────────────────────────────────────────────────

describe("REQ-INT-007 / REQ-INT-032 — six faits, produits par les fonctions d'émission uniques", () => {
  it("REQ-INT-007 : facture.emise — clé facture.emise:<id>, charge conforme au contrat", async () => {
    const { tx, outbox } = fauxTx([facture()]);
    const id = await emettreFaitFacture(tx, F_OPCO);
    expect(id).toBe(identifiantEvenement(FACTURE_EMISE, `facture.emise:${F_OPCO}`));
    expect(jugee(outbox, id).event_type).toBe("facture.emise");
  });

  it("REQ-INT-007 : avoir.emis — la ligne qui porte avoirDeId est un avoir, clé avoir.emis:<id>", async () => {
    const avoir = facture({
      id: AVOIR,
      numero: "AXI-AVO-2026-001",
      avoirDeId: F_OPCO,
      montantHtCents: -100_000,
      montantTvaCents: -20_000,
      montantTtcCents: -120_000,
    });
    const { tx, outbox } = fauxTx([facture(), avoir]);
    const id = await emettreFaitFacture(tx, AVOIR);
    expect(id).toBe(identifiantEvenement(AVOIR_EMIS, `avoir.emis:${AVOIR}`));
    const env = jugee(outbox, id);
    expect(env.event_type).toBe("avoir.emis");
    expect(env.payload).toMatchObject({ avoirId: AVOIR, avoirDeFactureId: F_OPCO });
  });

  it("REQ-INT-005 : paiement.recu — clé paiement.recu:<paymentId>, charge conforme", async () => {
    const p = paiement("pa000000-0000-4000-8000-000000000001", F_OPCO, 120_000, "10");
    const { tx, outbox } = fauxTx([facture()], [p]);
    const id = await emettreFaitPaiement(tx, String(p["id"]));
    expect(id).toBe(identifiantEvenement(PAIEMENT_RECU, `paiement.recu:${String(p["id"])}`));
    expect(jugee(outbox, id).event_type).toBe("paiement.recu");
  });

  it("REQ-INT-032 : paiement.rembourse — les DEUX formes, clé paiement.rembourse:<id>", async () => {
    const neuf = {
      ...paiement("pa000000-0000-4000-8000-0000000000r1", F_OPCO, 30_000, "12"),
      type: "refund",
    };
    const rejete = {
      ...paiement("pa000000-0000-4000-8000-0000000000r2", F_OPCO, 60_000, "13"),
      status: "refunded",
    };
    const { tx, outbox } = fauxTx([facture()], [neuf, rejete]);

    const a = await emettreFaitPaiement(tx, String((neuf as Record<string, unknown>)["id"]), {
      motif: "remboursement",
    });
    const b = await emettreFaitPaiement(tx, String((rejete as Record<string, unknown>)["id"]), {
      motif: "rejet_prelevement",
    });
    expect(a).toBe(
      identifiantEvenement(
        PAIEMENT_REMBOURSE,
        `paiement.rembourse:${String((neuf as Record<string, unknown>)["id"])}`,
      ),
    );
    expect(jugee(outbox, a).payload).toMatchObject({
      forme: "payment_type_refund",
      motif: "remboursement",
    });
    expect(jugee(outbox, b).payload).toMatchObject({
      forme: "payment_status_refunded",
      motif: "rejet_prelevement",
    });
  });

  it("REQ-INT-032 : paiement.rembourse sans motif lève — « autre » ne se devine pas", async () => {
    const neuf = {
      ...paiement("pa000000-0000-4000-8000-0000000000r3", F_OPCO, 1_000, "12"),
      type: "refund",
    };
    const { tx, outbox } = fauxTx([facture()], [neuf]);
    await expect(
      emettreFaitPaiement(tx, String((neuf as Record<string, unknown>)["id"])),
    ).rejects.toThrow(/motif est exigé/);
    expect(outbox.size).toBe(0);
  });

  it("REQ-INT-032 : facture.annulee est PRODUITE, clé facture.annulee:<id>, motif porté", async () => {
    const { tx, outbox } = fauxTx([facture({ statut: "annulee" })]);
    const id = await emettreFactureAnnulee(tx, F_OPCO, "doublon");
    expect(id).toBe(identifiantEvenement(FACTURE_ANNULEE, `facture.annulee:${F_OPCO}`));
    expect(jugee(outbox, id).payload).toEqual({
      factureId: F_OPCO,
      motif: "doublon",
      clientId: ENTREPRISE,
    });
  });

  it("REQ-INT-032 : facture.annulee n'est pas émise pour une facture relue non annulée", async () => {
    const { tx, outbox } = fauxTx([facture()]);
    expect(await emettreFactureAnnulee(tx, F_OPCO, "doublon")).toBeNull();
    expect(outbox.size).toBe(0);
  });

  it("REQ-INT-032 : financement.mis_a_jour est PRODUIT, clé <factureId>:<updatedAt du dossier>", async () => {
    const payeurs = [
      { factureFormationId: F_OPCO, payeurType: "opco", montantAttenduCents: 80_000 },
      { factureFormationId: F_OPCO, payeurType: "entreprise", montantAttenduCents: 40_000 },
    ];
    const { tx, outbox } = fauxTx([facture()], [], payeurs);
    const id = await emettreFinancementMisAJour(tx, F_OPCO);
    expect(id).toBe(
      identifiantEvenement(
        FINANCEMENT_MIS_A_JOUR,
        `financement.mis_a_jour:${F_OPCO}:2026-03-02T08:00:00.000Z`,
      ),
    );
    expect(jugee(outbox, id).payload).toEqual({
      factureId: F_OPCO,
      payers: [
        { payeurType: "opco", montantAttenduCents: 80_000 },
        { payeurType: "entreprise", montantAttenduCents: 40_000 },
      ],
      echeanceFinanceurAt: "2026-05-15T00:00:00.000Z",
    });
  });

  it("REQ-INT-032 : financement.mis_a_jour — une facture sans dossier n'a rien à dire", async () => {
    const { tx, outbox } = fauxTx([
      facture({ dossierFinancement: null, dossierFinancementId: null }),
    ]);
    expect(await emettreFinancementMisAJour(tx, F_OPCO)).toBeNull();
    expect(outbox.size).toBe(0);
  });

  it("REQ-INT-007 : le même fait par deux chemins → un seul event_id, une seule ligne", async () => {
    const { tx, outbox } = fauxTx([facture()]);
    const a = await emettreFaitFacture(tx, F_OPCO);
    const b = await emettreFaitFacture(tx, F_OPCO);
    expect(b).toBe(a);
    expect(outbox.size).toBe(1);
  });

  it("REQ-INT-007 : un brouillon, un paiement en attente ne sont pas des faits", async () => {
    const attente = {
      ...paiement("pa000000-0000-4000-8000-0000000000p1", F_OPCO, 1_000, "11"),
      status: "pending",
    };
    const { tx, outbox } = fauxTx([facture({ statut: "brouillon" })], [attente]);
    expect(await emettreFaitFacture(tx, F_OPCO)).toBeNull();
    expect(
      await emettreFaitPaiement(tx, String((attente as Record<string, unknown>)["id"])),
    ).toBeNull();
    expect(outbox.size).toBe(0);
  });
});

describe("REQ-INT-004 — des modèles réels, une liste de types FERMÉE", () => {
  it("REQ-INT-004 : les six types produits sont au contrat, qui en compte onze, pas un de plus", () => {
    expect(TYPES_EVENEMENT).toHaveLength(11);
    for (const t of [
      FACTURE_EMISE,
      AVOIR_EMIS,
      PAIEMENT_RECU,
      PAIEMENT_REMBOURSE,
      FACTURE_ANNULEE,
      FINANCEMENT_MIS_A_JOUR,
    ]) {
      expect(TYPES_EVENEMENT).toContain(t);
    }
  });

  it("REQ-INT-004 : un type hors contrat (Invoice, Refund…) est refusé AVANT toute écriture", async () => {
    const { tx, outbox } = fauxTx([]);
    await expect(
      ecrireEvenementPartners(tx, {
        type: "invoice.paid",
        cleDeFait: "invoice.paid:x",
        occurredAt: new Date(),
        sujet: { facture_id: "x" },
        payload: {},
      }),
    ).rejects.toBeInstanceOf(EvenementHorsContrat);
    expect(outbox.size).toBe(0);
  });

  it("REQ-INT-004 : les producteurs lisent FactureFormation, Payment, Client — rien d'autre", async () => {
    const p = paiement("pa000000-0000-4000-8000-000000000009", F_OPCO, 1_000, "10");
    const { tx, lectures } = fauxTx([facture()], [p]);
    await emettreFaitPaiement(tx, String(p["id"]));
    // Le verrou vise la table de FactureFormation, le cumul celle de Payment : les mêmes modèles.
    expect(lectures).toEqual([
      `payment:${String(p["id"])}`,
      `facture:${F_OPCO}`,
      `client:${ENTREPRISE}`,
      `verrou:${F_OPCO}`,
      `cumul:${F_OPCO}`,
    ]);
  });
});

describe("REQ-INT-005 — paiement.recu porte ses champs, et le HT encaissé calculé ici", () => {
  it("REQ-INT-005 : paiement, facture, bénéficiaire, SIREN, TTC, HT et TTC facture, régime, cumul, date, fournisseur, HT", async () => {
    const p = paiement("pa000000-0000-4000-8000-000000000011", F_OPCO, 40_000, "10");
    const { tx, outbox } = fauxTx([facture()], [p]);
    const charge = jugee(outbox, await emettreFaitPaiement(tx, String(p["id"]))).payload;
    expect(charge).toEqual({
      paymentId: p["id"],
      factureId: F_OPCO,
      clientId: ENTREPRISE,
      origineClient: "session",
      siren: "123456782",
      montantEncaisseTtcCents: 40_000,
      factureMontantHtCents: 100_000,
      factureMontantTtcCents: 120_000,
      regimeTva: "assujetti",
      totalEncaisseTtcCents: 40_000,
      paidAt: "2026-04-10T10:00:00.000Z",
      provider: "manual_wire",
      montantHtCents: 33_333,
      soldeLaFacture: false,
    });
  });

  it("REQ-INT-005 : trois tiers — le dernier solde le reliquat, Σ HT = HT de la facture", async () => {
    const ps = [
      paiement("pa000000-0000-4000-8000-000000000021", F_OPCO, 40_000, "10"),
      paiement("pa000000-0000-4000-8000-000000000022", F_OPCO, 40_000, "11"),
      paiement("pa000000-0000-4000-8000-000000000023", F_OPCO, 40_000, "12"),
    ];
    const connus: Enregistrement[] = [];
    const { tx, outbox } = fauxTx([facture()], connus);
    const hts: number[] = [];
    // Chaque encaissement est émis dans SA transaction, quand il est écrit : le cumul grandit.
    for (const p of ps) {
      connus.push(p);
      const c = jugee(outbox, await emettreFaitPaiement(tx, String(p["id"]))).payload;
      hts.push(c["montantHtCents"] as number);
    }
    expect(hts).toEqual([33_333, 33_333, 33_334]);
    expect(hts.reduce((a, b) => a + b, 0)).toBe(100_000);
  });

  it("REQ-INT-005 : cinq petits encaissements puis le solde — Σ HT = HT au centime (relecture #1228)", async () => {
    const connus: Enregistrement[] = [];
    const { tx, outbox } = fauxTx([facture()], connus);
    const montants = [1_000, 1_000, 1_000, 1_000, 1_000, 115_000];
    const hts: number[] = [];
    for (const [i, m] of montants.entries()) {
      const p = paiement(`pa000000-0000-4000-8000-00000000004${i}`, F_OPCO, m, "10");
      connus.push(p);
      hts.push(
        jugee(outbox, await emettreFaitPaiement(tx, String(p["id"]))).payload[
          "montantHtCents"
        ] as number,
      );
    }
    expect(hts.reduce((a, b) => a + b, 0)).toBe(100_000);
  });

  it("REQ-INT-005 : le cumul est relu SOUS le verrou de ligne de la facture, jamais avant", async () => {
    const p = paiement("pa000000-0000-4000-8000-000000000051", F_OPCO, 40_000, "10");
    const { tx, lectures } = fauxTx([facture()], [p]);
    await emettreFaitPaiement(tx, String(p["id"]));
    const verrou = lectures.indexOf(`verrou:${F_OPCO}`);
    expect(verrou).toBeGreaterThanOrEqual(0);
    expect(verrou).toBeLessThan(lectures.indexOf(`cumul:${F_OPCO}`));
  });
});

describe("REQ-ARG-005 — le BÉNÉFICIAIRE, jamais le destinataire", () => {
  it("REQ-ARG-005 : l'OPCO règle la facture subrogée — l'entreprise formée porte l'attribution", async () => {
    const p = paiement("pa000000-0000-4000-8000-000000000031", F_OPCO, 120_000, "10");
    const { tx, outbox } = fauxTx([facture()], [p]);
    const charge = jugee(outbox, await emettreFaitPaiement(tx, String(p["id"]))).payload;
    expect(charge["clientId"]).toBe(ENTREPRISE);
    expect(charge["clientId"]).not.toBe(OPCO);
    expect(charge["siren"]).toBe("123456782");
    // Le SIRET du destinataire ne traverse sous aucune forme.
    expect(JSON.stringify(charge)).not.toContain("732829320");
  });

  it("REQ-ARG-001 / REQ-ARG-005 : plusieurs payeurs d'une même prestation se proratisent sans cas particulier", async () => {
    // La session produit DEUX factures : la part OPCO (subrogée) et le reste à charge.
    const partEntreprise = facture({
      id: F_ENTREPRISE,
      numero: "AXI-FACT-2026-502",
      destinataire: "entreprise",
      destinataireSiret: null,
      subrogation: false,
      clientId: ENTREPRISE,
      montantHtCents: 50_000,
      montantTvaCents: 10_000,
      montantTtcCents: 60_000,
    });
    const ps = [
      paiement("pa000000-0000-4000-8000-000000000041", F_OPCO, 60_000, "10"),
      paiement("pa000000-0000-4000-8000-000000000042", F_ENTREPRISE, 30_000, "11"),
      paiement("pa000000-0000-4000-8000-000000000043", F_OPCO, 60_000, "12"),
      paiement("pa000000-0000-4000-8000-000000000044", F_ENTREPRISE, 30_000, "13"),
    ];
    const connus: Enregistrement[] = [];
    const { tx, outbox } = fauxTx([facture(), partEntreprise], connus);
    const parFacture: Record<string, number> = {};
    for (const p of ps) {
      connus.push(p);
      const c = jugee(outbox, await emettreFaitPaiement(tx, String(p["id"]))).payload;
      expect(c["clientId"]).toBe(ENTREPRISE);
      const f = String(c["factureId"]);
      parFacture[f] = (parFacture[f] ?? 0) + (c["montantHtCents"] as number);
    }
    expect(parFacture).toEqual({ [F_OPCO]: 100_000, [F_ENTREPRISE]: 50_000 });
  });

  it("REQ-ARG-005 : facture.emise — l'entreprise résolue par la session, jamais le destinataire", async () => {
    const { tx, outbox } = fauxTx([facture()]);
    const charge = jugee(outbox, await emettreFaitFacture(tx, F_OPCO)).payload;
    expect(charge).toMatchObject({
      clientId: ENTREPRISE,
      origineClient: "session",
      siren: "123456782",
    });
  });
});

describe("REQ-ARG-030 — une attribution impossible est ALERTÉE, jamais tue", () => {
  it.each([
    ["sans SIREN", null],
    ["au SIREN illisible (clé fausse)", "123456789"],
  ])(
    "REQ-ARG-030 : un bénéficiaire %s part non_resolue et alerté — jamais une devinette (arbitrage -d7)",
    async (_, siren) => {
      const SANS = "cccc3333-3333-4333-8333-333333333333";
      const f = facture({ id: F_ORPHELINE, clientId: SANS });
      const p = paiement("pa000000-0000-4000-8000-000000000061", F_ORPHELINE, 10_000, "10");
      const autre = { ...client(SANS, "000000000", "Sans SIREN"), siren, siret: null };
      const { tx, outbox } = fauxTx([f], [p], [], [autre]);
      const alertes: AlerteFacturation[] = [];
      const id = await emettreFaitPaiement(tx, String(p["id"]), {
        alerter: (a) => alertes.push(a),
      });
      expect(jugee(outbox, id).payload).toMatchObject({
        clientId: null,
        origineClient: "non_resolue",
      });
      expect(alertes.map((a) => a.motif)).toEqual(["client_non_resolu"]);
    },
  );

  it.each([
    ["saisi avec des espaces", "123 456 782", null, "123456782"],
    ["absent, dérivé du SIRET", null, "12345678200010", "123456782"],
  ])(
    "REQ-INT-015 : un SIREN %s part normalisé à 9 chiffres (même règle que client.*)",
    async (_, siren, siret, attendu) => {
      const C = "dddd4444-4444-4444-8444-444444444444";
      const f = facture({ id: F_ORPHELINE, clientId: C });
      const p = paiement("pa000000-0000-4000-8000-000000000063", F_ORPHELINE, 10_000, "10");
      const fiche = { ...client(C, "000000000", "Saisie libre"), siren, siret };
      const { tx, outbox } = fauxTx([f], [p], [], [fiche]);
      const charge = jugee(outbox, await emettreFaitPaiement(tx, String(p["id"]))).payload;
      expect(charge).toMatchObject({ clientId: C, siren: attendu });
    },
  );

  it("REQ-ARG-030 : un même paiement n'est JAMAIS attribué deux fois — un seul événement, un seul client", async () => {
    const p = paiement("pa000000-0000-4000-8000-000000000062", F_OPCO, 10_000, "10");
    const { tx, outbox } = fauxTx([facture()], [p]);
    const un = await emettreFaitPaiement(tx, String(p["id"]));
    const deux = await emettreFaitPaiement(tx, String(p["id"]));
    expect(deux).toBe(un);
    expect([...outbox.values()].filter((l) => l.eventType === "paiement.recu")).toHaveLength(1);
  });

  it("REQ-ARG-030 : bénéficiaire introuvable → l'événement PART non résolu, et l'alerte est levée", async () => {
    const orpheline = facture({
      id: F_ORPHELINE,
      session: null,
      sessionId: null,
      dossierFinancement: null,
      dossierFinancementId: null,
    });
    const p = paiement("pa000000-0000-4000-8000-000000000051", F_ORPHELINE, 10_000, "10");
    const { tx, outbox } = fauxTx([orpheline], [p]);
    const alertes: AlerteFacturation[] = [];

    const id = await emettreFaitPaiement(tx, String(p["id"]), { alerter: (a) => alertes.push(a) });
    const charge = jugee(outbox, id).payload;
    expect(charge).toMatchObject({ clientId: null, origineClient: "non_resolue", siren: null });
    expect(alertes).toEqual([
      {
        type: "paiement.recu",
        motif: "client_non_resolu",
        sujet: `facture:${F_ORPHELINE}`,
        eventId: id,
      },
    ]);
  });

  it("REQ-ARG-030 : facture.emise non résolue part aussi, alertée", async () => {
    const orpheline = facture({ id: F_ORPHELINE, session: null, dossierFinancement: null });
    const { tx, outbox } = fauxTx([orpheline]);
    const alertes: AlerteFacturation[] = [];
    const id = await emettreFaitFacture(tx, F_ORPHELINE, { alerter: (a) => alertes.push(a) });
    expect(jugee(outbox, id).payload).toMatchObject({
      clientId: null,
      origineClient: "non_resolue",
    });
    expect(alertes.map((a) => a.motif)).toEqual(["client_non_resolu"]);
  });

  it("REQ-ARG-030 : un encaissement SANS facture ne peut partir (factureId exigé) — il est alerté, l'écriture n'est pas bloquée", async () => {
    const p = paiement("pa000000-0000-4000-8000-000000000052", null, 10_000, "10");
    const { tx, outbox } = fauxTx([], [p]);
    const alertes: AlerteFacturation[] = [];
    await expect(
      emettreFaitPaiement(tx, String(p["id"]), { alerter: (a) => alertes.push(a) }),
    ).resolves.toBeNull();
    expect(outbox.size).toBe(0);
    expect(alertes).toEqual([
      {
        type: "paiement.recu",
        motif: "facture_introuvable",
        sujet: `payment:${String(p["id"])}`,
        eventId: null,
      },
    ]);
  });

  it("REQ-ARG-030 : un bénéficiaire résolu n'alerte pas", async () => {
    const { tx } = fauxTx([facture()]);
    const alertes: AlerteFacturation[] = [];
    await emettreFaitFacture(tx, F_OPCO, { alerter: (a) => alertes.push(a) });
    expect(alertes).toEqual([]);
  });
});

describe("REQ-DM-039 — facture.emise porte le destinataire et l'échéance du financeur", () => {
  it("REQ-DM-039 : destinataire tel qu'axionia le définit, échéance financeur, payeurs", async () => {
    const payeurs = [
      { factureFormationId: F_OPCO, payeurType: "opco", montantAttenduCents: 120_000 },
    ];
    const { tx, outbox } = fauxTx([facture()], [], payeurs);
    const charge = jugee(outbox, await emettreFaitFacture(tx, F_OPCO)).payload;
    expect(charge).toMatchObject({
      destinataire: "opco",
      subrogation: true,
      echeanceLe: "2026-03-31T09:00:00.000Z",
      echeanceFinanceurAt: "2026-05-15T00:00:00.000Z",
      payers: [{ payeurType: "opco", montantAttenduCents: 120_000 }],
    });
  });
});

describe("REQ-ARG-005 — témoin à deux faces : le destinataire à la place du bénéficiaire", () => {
  const attendu = { clientId: ENTREPRISE, siren: "123456782" };

  it("REQ-ARG-005 face verte : la charge conforme passe, inchangée", async () => {
    const p = paiement("pa000000-0000-4000-8000-000000000061", F_OPCO, 120_000, "10");
    const { tx, outbox } = fauxTx([facture()], [p]);
    const charge = jugee(outbox, await emettreFaitPaiement(tx, String(p["id"]))).payload as {
      clientId: string | null;
      siren: string | null;
    };
    expect(verifierAttribution("paiement.recu", charge, attendu)).toBe(charge);
  });

  it("REQ-ARG-005 face rouge : l'id du DESTINATAIRE est refusé, champ clientId nommé — le contrat, lui, l'accepte", async () => {
    const p = paiement("pa000000-0000-4000-8000-000000000062", F_OPCO, 120_000, "10");
    const { tx, outbox } = fauxTx([facture()], [p]);
    const conforme = jugee(outbox, await emettreFaitPaiement(tx, String(p["id"]))).payload;
    const faussee = { ...conforme, clientId: OPCO } as {
      clientId: string | null;
      siren: string | null;
    };
    // Le contrat ne suffit pas : un identifiant est un identifiant.
    expect(fautes(resoudre("#/$defs/payload_paiement_recu"), faussee)).toEqual([]);
    expect(() => verifierAttribution("paiement.recu", faussee, attendu)).toThrow(
      ChargeFacturationRefusee,
    );
    expect(() => verifierAttribution("paiement.recu", faussee, attendu)).toThrow(/clientId/);
  });

  it("REQ-ARG-005 face rouge : le SIREN du destinataire est refusé, champ siren nommé", () => {
    try {
      verifierAttribution("facture.emise", { clientId: ENTREPRISE, siren: "732829320" }, attendu);
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ name: "ChargeFacturationRefusee", champ: "siren" });
    }
  });
});

describe("REQ-INT-007 — inertie : canal fermé, le comportement d'avant", () => {
  it("REQ-INT-007 : canal fermé, aucune lecture, aucune ligne, null partout", async () => {
    process.env.PARTNERS_SYNC_ENABLED = "false";
    const p = paiement("pa000000-0000-4000-8000-000000000071", F_OPCO, 1_000, "10");
    const { tx, outbox, lectures } = fauxTx([facture({ statut: "annulee" })], [p]);
    expect(await emettreFaitFacture(tx, F_OPCO)).toBeNull();
    expect(await emettreFaitPaiement(tx, String(p["id"]))).toBeNull();
    expect(await emettreFactureAnnulee(tx, F_OPCO, "doublon")).toBeNull();
    expect(await emettreFinancementMisAJour(tx, F_OPCO)).toBeNull();
    expect(lectures).toEqual([]);
    expect(outbox.size).toBe(0);
  });

  it("REQ-INT-007 : l'émission refuse le client global (hors transaction)", async () => {
    const { tx } = fauxTx([facture()]);
    const global = Object.assign(Object.create(tx) as object, { $transaction: () => undefined });
    await expect(
      emettreFaitFacture(global as unknown as Prisma.TransactionClient, F_OPCO),
    ).rejects.toThrow(/exige le client d'une transaction/);
  });

  it("REQ-INT-007 : transactionFaitFacturation — fermé, le travail sur le client ; ouvert, $transaction", async () => {
    const transaction = vi.fn(async (f: (tx: unknown) => Promise<string>) => f("tx"));
    const prisma = { $transaction: transaction } as unknown as PrismaClient;

    process.env.PARTNERS_SYNC_ENABLED = "false";
    expect(
      await transactionFaitFacturation(prisma, async (tx) => (tx === prisma ? "client" : "?")),
    ).toBe("client");
    expect(transaction).not.toHaveBeenCalled();

    process.env.PARTNERS_SYNC_ENABLED = "true";
    expect(
      await transactionFaitFacturation(prisma, async (tx) => (String(tx) === "tx" ? "tx" : "?")),
    ).toBe("tx");
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
