// @vitest-environment node
// @req REQ-INT-006
// @req REQ-INT-007
/**
 * INT-T04 — le producteur UNIQUE de `devis.signe`, sur un faux client de transaction en mémoire.
 *
 *   (2) la charge porte, par ligne, le palier ou nul, le HT en centimes, l'activité et la
 *       désignation, calculés ici depuis la grille du dépôt (REQ-INT-006) ;
 *   (3) un palier qui ne résout pas dans la grille publiée part NUL avec son motif ;
 *   (5) témoin à deux faces : une ligne en euros est refusée avec le nom du champ, les lignes du
 *       dépôt passent ;
 *   et l'unicité : deux chemins d'acceptation du même devis → un seul `event_id` (REQ-INT-007).
 *
 * Ce qu'un faux ne prouve pas — qu'un retour arrière Postgres efface la ligne — l'est contre un
 * vrai Postgres par `tests/integration/partners-sync/outbox-transactionnelle.spec.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { identifiantEvenement } from "@/server/partners/enveloppe";

import { COMMERCIAL_COMMISSIONS } from "@/content/pricing";
import {
  GRILLE_VERSION,
  resoudreCommission,
  versionDeLaGrille,
} from "@/server/partners/commission";
import fixtures from "@/server/partners/contrat/fixtures.v3.json";
import type { PayloadDevisSigne } from "@/server/partners/payloads";
import { fautes, resoudre } from "@/server/partners/__tests__/contrat-schema";

import type { Prisma, PrismaClient } from "../../../../prisma/generated/client";
import {
  ChargeDevisSigneRefusee,
  devisConcernesPourEmission,
  emettreDevisSigne,
  transactionDevisSigne,
  verifierChargeDevisSigne,
  prixPublicsDesOffres,
} from "../producteurs/devis";

const SCHEMA_CHARGE = resoudre("#/$defs/payload_devis_signe");

const DEVIS_ID = "7a000000-0000-4000-8000-000000000001";
const CLIENT_ID = "7c000000-0000-4000-8000-000000000001";

type Enregistrement = Record<string, unknown>;
type LigneOutbox = { eventId: string; eventType: string; subjectRef: string; corps: string };

/** Un faux client de transaction : les quatre accès du producteur, rien d'autre. */
function fauxTx(devis: Enregistrement[]) {
  const outbox = new Map<string, LigneOutbox>();
  const lectures: string[] = [];
  const client = {
    id: CLIENT_ID,
    numero: "AXI-CLI-T04",
    type: "entreprise",
    raisonSociale: "Entreprise témoin",
    siren: "123456789",
    nafCode: "6201Z",
    secteur: "Informatique",
    taille: "pme_10_49",
    createdAt: new Date("2026-01-02T10:00:00.000Z"),
    updatedAt: new Date("2026-01-02T10:00:00.000Z"),
  };
  const tx = {
    devis: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        lectures.push(`devis:${where.id}`);
        return devis.find((d) => d["id"] === where.id) ?? null;
      },
      findMany: async ({ where }: { where: { documentGenereId: string } }) => {
        lectures.push("devis:findMany");
        return devis
          .filter((d) => d["documentGenereId"] === where.documentGenereId)
          .map((d) => ({ id: d["id"] }));
      },
    },
    client: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        lectures.push(`client:${where.id}`);
        return where.id === CLIENT_ID ? client : null;
      },
    },
    // Contrat v3 : l'offre citée, lue dans la transaction. Elle porte une durée (1 journée par
    // session) mais AUCUN prix public ferme (ni palier ni gamme) : la référence du prorata est
    // donc absente.
    offreSite: {
      findMany: async () => {
        lectures.push("offres:findMany");
        return [
          { code: "AXI-OFF-004", tierId: null, gamme: null, dureeCode: "1j", tarifType: null },
        ];
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

function devisAccepte(surcharge: Enregistrement = {}): Enregistrement {
  return {
    id: DEVIS_ID,
    numero: "AXI-DEV-2026-T04",
    activite: "formation",
    clientId: CLIENT_ID,
    montantTotalHtCents: 500_000,
    statut: "accepte",
    acceptedAt: new Date("2026-02-14T15:00:00.000Z"),
    createdAt: new Date("2026-02-01T15:00:00.000Z"),
    updatedAt: new Date("2026-02-14T15:00:00.000Z"),
    documentGenereId: "doc-t04",
    lignes: [
      {
        designation: "Formation IA 2 jours",
        quantite: 2,
        prixUnitaireHtCents: 250_000,
        offreCode: "AXI-OFF-004",
      },
    ],
    ...surcharge,
  };
}

function chargeEmise(outbox: Map<string, LigneOutbox>): PayloadDevisSigne {
  const [ligne] = [...outbox.values()];
  if (!ligne) throw new Error("aucune ligne dans la file");
  return (JSON.parse(ligne.corps) as { payload: PayloadDevisSigne }).payload;
}

const ENV = { ...process.env };
beforeEach(() => {
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.DATABASE_URL = "postgresql://t04@localhost:5432/t04";
});
afterEach(() => {
  process.env = { ...ENV };
  vi.doUnmock("@/content/pricing");
  vi.resetModules();
});

describe("REQ-INT-006 — la charge de devis.signe, calculée dans axionia", () => {
  it("REQ-INT-006 : par ligne, le palier, le HT en centimes, l'activité et la désignation", async () => {
    const { tx, outbox } = fauxTx([devisAccepte()]);
    await emettreDevisSigne(tx, DEVIS_ID);

    const charge = chargeEmise(outbox);
    expect(charge.lignes).toHaveLength(1);
    const ligne = charge.lignes[0];
    expect(ligne).toMatchObject({
      commissionId: "com-formation-2j",
      montantHtCents: 500_000,
      activite: "formation",
      designation: "Formation IA 2 jours",
    });
    expect(Number.isInteger(ligne?.montantHtCents)).toBe(true);
    expect(fautes(SCHEMA_CHARGE, charge)).toEqual([]);
  });

  it("REQ-INT-006 : le verdict est celui de la fonction pure sur la grille du dépôt, épinglée", async () => {
    const { tx, outbox } = fauxTx([devisAccepte()]);
    await emettreDevisSigne(tx, DEVIS_ID);
    const ligne = chargeEmise(outbox).lignes[0];

    // Même verdict que la fonction pure, AVEC le prix de référence réellement émis (prorata de
    // remise, art. 4.1 bis — 2026-10-08).
    expect(ligne?.commission).toEqual(
      resoudreCommission({
        activite: "formation",
        jours: 2,
        montantHtCents: 500_000,
        prixReferenceHtCents: ligne?.prixReferenceHtCents ?? null,
      }),
    );
    // La fausse base de ce test ne porte AUCUN prix public d'offre : sans référence, le prorata
    // de remise (art. 4.1 bis) est incalculable → bloquée, aucun montant inventé. Le calcul avec
    // un prix public est verrouillé dans payloads.spec.ts et pricing-et-moteur-concordent.
    expect(ligne?.prixReferenceHtCents).toBeNull();
    expect(ligne?.commission.statut).toBe("bloquee");
    expect(ligne?.commission.montantCents).toBeNull();

    expect(ligne?.commission.grilleVersion).toBe(versionDeLaGrille(COMMERCIAL_COMMISSIONS));
    expect(ligne?.commission.grilleVersion).toBe(GRILLE_VERSION);
  });

  it("REQ-INT-006 : une quantité à décimales donne un HT arrondi en centimes, comme à la création", async () => {
    // createDevisAction : total = Σ Math.round(quantite × prixUnitaireHtCents).
    const { tx, outbox } = fauxTx([
      devisAccepte({
        activite: "audit",
        montantTotalHtCents: 33_334,
        lignes: [
          { designation: "Audit — demi-journée", quantite: 0.5, prixUnitaireHtCents: 66_667 },
        ],
      }),
    ]);
    await emettreDevisSigne(tx, DEVIS_ID);
    const charge = chargeEmise(outbox);
    expect(charge.lignes[0]?.montantHtCents).toBe(33_334);
    expect(fautes(SCHEMA_CHARGE, charge)).toEqual([]);
  });
});

describe("REQ-INT-006 — un palier qui ne résout pas part NUL, avec son motif", () => {
  it("REQ-INT-006 : une activité sans entrée de grille (site web) → commissionId nul, motif a_qualifier", async () => {
    const { tx, outbox } = fauxTx([
      devisAccepte({
        activite: "site_web",
        montantTotalHtCents: 300_000,
        lignes: [{ designation: "Site vitrine", quantite: 1, prixUnitaireHtCents: 300_000 }],
      }),
    ]);
    await emettreDevisSigne(tx, DEVIS_ID);
    const ligne = chargeEmise(outbox).lignes[0];
    expect(ligne?.commissionId).toBeNull();
    expect(ligne?.commission).toMatchObject({
      statut: "bloquee",
      commissionId: null,
      montantCents: null,
      motifBlocage: "a_qualifier",
    });
  });

  it("REQ-INT-006 : un palier RETIRÉ de la grille publiée n'est jamais deviné (ni 1 j, ni 3 j)", async () => {
    vi.resetModules();
    vi.doMock("@/content/pricing", async (importOriginal) => {
      const vrai = await importOriginal<typeof import("@/content/pricing")>();
      return {
        ...vrai,
        COMMERCIAL_COMMISSIONS: vrai.COMMERCIAL_COMMISSIONS.filter(
          (c) => c.id !== "com-formation-2j",
        ),
      };
    });
    const producteur = await import("../producteurs/devis");

    const { tx, outbox } = fauxTx([devisAccepte()]);
    await producteur.emettreDevisSigne(tx, DEVIS_ID);
    const ligne = chargeEmise(outbox).lignes[0];
    expect(ligne?.commissionId).toBeNull();
    expect(ligne?.commission).toMatchObject({
      statut: "bloquee",
      commissionId: null,
      montantCents: null,
      motifBlocage: "a_qualifier",
    });
    expect(fautes(SCHEMA_CHARGE, chargeEmise(outbox))).toEqual([]);
  });
});

describe("REQ-INT-006 — témoin à deux faces : des centimes, jamais des euros", () => {
  const ligneFixture = () => {
    const e = (fixtures.evenements as unknown as { event_type: string; payload: unknown }[]).find(
      (x) => x.event_type === "devis.signe",
    );
    if (!e) throw new Error("fixture devis.signe absente");
    return e.payload as PayloadDevisSigne;
  };

  it("REQ-INT-006 face verte : la charge de la fixture GÉNÉRÉE du dépôt passe contrat et sortie", () => {
    const charge = ligneFixture();
    expect(fautes(SCHEMA_CHARGE, charge)).toEqual([]);
    expect(verifierChargeDevisSigne(charge)).toBe(charge);
  });

  it("REQ-INT-006 face rouge : des euros à décimales sont refusés AU CONTRAT, champ nommé", () => {
    const charge = ligneFixture();
    const enEuros = {
      ...charge,
      lignes: charge.lignes.map((l) => ({ ...l, montantHtCents: 5_000.5 })),
    };
    expect(fautes(SCHEMA_CHARGE, enEuros)).toEqual([
      "$.lignes[0].montantHtCents : type number, attendu integer",
    ]);
  });

  it("REQ-INT-006 face rouge : des euros ENTIERS passent le contrat, et la sortie les refuse, champ nommé", () => {
    const charge = ligneFixture();
    const enEuros = {
      ...charge,
      lignes: charge.lignes.map((l) => ({ ...l, montantHtCents: l.montantHtCents / 100 })),
    };
    // Le contrat ne suffit pas : `integer` accepte 5 000 comme 500 000.
    expect(fautes(SCHEMA_CHARGE, enEuros)).toEqual([]);
    expect(() => verifierChargeDevisSigne(enEuros)).toThrow(ChargeDevisSigneRefusee);
    expect(() => verifierChargeDevisSigne(enEuros)).toThrow(/lignes\[\]\.montantHtCents/);
  });

  it("REQ-INT-006 face rouge : un devis dont la ligne est en euros n'écrit RIEN dans la file", async () => {
    const { tx, outbox } = fauxTx([
      devisAccepte({
        lignes: [{ designation: "Formation IA 2 jours", quantite: 2, prixUnitaireHtCents: 2_500 }],
      }),
    ]);
    await expect(emettreDevisSigne(tx, DEVIS_ID)).rejects.toMatchObject({
      name: "ChargeDevisSigneRefusee",
      champ: "lignes[].montantHtCents",
    });
    expect(outbox.size).toBe(0);
  });

  it("REQ-INT-006 face rouge : un montant de ligne non entier est refusé en nommant la ligne", () => {
    const charge = ligneFixture();
    const faux = { ...charge, lignes: charge.lignes.map((l) => ({ ...l, montantHtCents: 0.5 })) };
    expect(() => verifierChargeDevisSigne(faux)).toThrow(/lignes\[0\]\.montantHtCents/);
  });
});

describe("REQ-INT-007 — un seul événement, quel que soit le chemin", () => {
  it("REQ-INT-007 : deux chemins d'acceptation du même devis → un seul event_id", async () => {
    const devis = devisAccepte();
    const { tx, outbox } = fauxTx([devis]);

    // Chemin 1 : le webhook DocuSeal.
    const premier = await emettreDevisSigne(tx, DEVIS_ID);
    // Chemin 2 : l'acceptation admin, qui repose `acceptedAt` plus tard.
    devis["acceptedAt"] = new Date("2026-02-15T09:00:00.000Z");
    const second = await emettreDevisSigne(tx, DEVIS_ID);

    expect(premier).not.toBeNull();
    // La clé suit la convention des fixtures (`devis.signe:<id>`) : même event_id qu'en bac d'essai.
    expect(premier).toBe(identifiantEvenement("devis.signe", `devis.signe:${DEVIS_ID}`));
    expect(second).toBe(premier);
    expect(outbox.size).toBe(1);
    // La première acceptation fait foi : la ligne n'est pas réécrite.
    expect(chargeEmise(outbox).signeLe).toBe("2026-02-14T15:00:00.000Z");
  });

  it("REQ-INT-007 : deux devis distincts → deux événements", async () => {
    const autre = "7a000000-0000-4000-8000-000000000002";
    const { tx, outbox } = fauxTx([devisAccepte(), devisAccepte({ id: autre })]);
    const a = await emettreDevisSigne(tx, DEVIS_ID);
    const b = await emettreDevisSigne(tx, autre);
    expect(a).not.toBe(b);
    expect(outbox.size).toBe(2);
  });

  it("REQ-INT-007 : un devis relu non accepté (course perdue sous garde) n'émet rien", async () => {
    const { tx, outbox } = fauxTx([devisAccepte({ statut: "transforme_convention" })]);
    expect(await emettreDevisSigne(tx, DEVIS_ID)).toBeNull();
    expect(outbox.size).toBe(0);
  });

  it("REQ-INT-007 : l'écrivain gardé relit les devis de la garde avant d'écrire", async () => {
    const { tx } = fauxTx([devisAccepte({ statut: "envoye" })]);
    const ids = await devisConcernesPourEmission(tx, {
      documentGenereId: "doc-t04",
      statut: { in: ["envoye", "expire"] },
    });
    expect(ids).toEqual([DEVIS_ID]);
  });

  it("REQ-INT-007 : l'émission refuse le client global (hors transaction)", async () => {
    const { tx } = fauxTx([devisAccepte()]);
    const global = Object.assign(Object.create(tx) as object, { $transaction: () => undefined });
    await expect(
      emettreDevisSigne(global as unknown as Prisma.TransactionClient, DEVIS_ID),
    ).rejects.toThrow(/exige le client d'une transaction/);
  });
});

describe("REQ-INT-007 — inertie : canal fermé, le comportement d'avant", () => {
  it("REQ-INT-007 : canal fermé, aucune lecture, aucune ligne, null", async () => {
    process.env.PARTNERS_SYNC_ENABLED = "false";
    const { tx, outbox, lectures } = fauxTx([devisAccepte()]);
    expect(await emettreDevisSigne(tx, DEVIS_ID)).toBeNull();
    expect(await devisConcernesPourEmission(tx, { documentGenereId: "doc-t04" })).toEqual([]);
    expect(lectures).toEqual([]);
    expect(outbox.size).toBe(0);
  });

  it("REQ-INT-007 : au build (base stub), rien non plus, même drapeau levé", async () => {
    process.env.DATABASE_URL = "postgresql://x@stub.invalid:5432/x";
    const { tx, lectures } = fauxTx([devisAccepte()]);
    expect(await emettreDevisSigne(tx, DEVIS_ID)).toBeNull();
    expect(lectures).toEqual([]);
  });

  it("REQ-INT-007 : transactionDevisSigne — fermé, le travail sur le client ; ouvert, $transaction", async () => {
    const transaction = vi.fn(async (f: (tx: unknown) => Promise<string>) => f("tx"));
    const client = { $transaction: transaction } as unknown as PrismaClient;

    process.env.PARTNERS_SYNC_ENABLED = "false";
    expect(
      await transactionDevisSigne(client, async (tx) => (tx === client ? "client" : "?")),
    ).toBe("client");
    expect(transaction).not.toHaveBeenCalled();

    process.env.PARTNERS_SYNC_ENABLED = "true";
    expect(
      await transactionDevisSigne(client, async (tx) => (String(tx) === "tx" ? "tx" : "?")),
    ).toBe("tx");
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});

describe("REQ-INT-006 — le prix public ferme des offres d'un devis, lu dans la transaction", () => {
  it("REQ-INT-006 : TÉMOIN — chaque code lu une fois ; prix ferme, sur devis, offre inconnue", async () => {
    const lus: unknown[] = [];
    const tx = {
      offreSite: {
        findMany: async (q: unknown) => {
          lus.push(q);
          return [
            {
              code: "AXI-OFF-001",
              tierId: null,
              gamme: "generale",
              dureeCode: "1j",
              tarifType: "fixe",
            },
            {
              code: "AXI-OFF-002",
              tierId: null,
              gamme: "generale",
              dureeCode: "1j",
              tarifType: "sur_devis",
            },
          ];
        },
      },
    } as unknown as Prisma.TransactionClient;
    const prix = await prixPublicsDesOffres(tx, [
      "AXI-OFF-001",
      "AXI-OFF-002",
      "AXI-OFF-001",
      "AXI-OFF-999",
    ]);
    expect(lus).toStrictEqual([
      {
        where: { code: { in: ["AXI-OFF-001", "AXI-OFF-002", "AXI-OFF-999"] } },
        select: { code: true, tierId: true, gamme: true, dureeCode: true, tarifType: true },
      },
    ]);
    expect(prix.get("AXI-OFF-001")).toBe(1900);
    expect(prix.get("AXI-OFF-002")).toBeNull();
    expect(prix.get("AXI-OFF-999")).toBeNull();
  });

  it("REQ-INT-006 : sans aucun code, aucune lecture", async () => {
    const tx = {
      offreSite: {
        findMany: async () => {
          throw new Error("lecture inattendue");
        },
      },
    } as unknown as Prisma.TransactionClient;
    expect((await prixPublicsDesOffres(tx, [])).size).toBe(0);
  });

  it("REQ-INT-006 : TÉMOIN — canal fermé, aucune lecture et aucun prix (inertie, règle R2)", async () => {
    process.env.PARTNERS_SYNC_ENABLED = "false";
    const tx = {
      offreSite: {
        findMany: async () => {
          throw new Error("lecture inattendue");
        },
      },
    } as unknown as Prisma.TransactionClient;
    expect((await prixPublicsDesOffres(tx, ["ia-essentiel-2j"])).size).toBe(0);
  });
});
