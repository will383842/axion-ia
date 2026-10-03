// @vitest-environment node
// @req REQ-INT-006
// @req REQ-INT-007
/**
 * INT-T46-A — le fait « devis émis », produit à l'ENVOI d'un devis par l'UNIQUE fonction d'émission
 * `emettreDevisEmis`, dans la transaction de l'envoi (contrat d'événements v3, en lockstep avec
 * l'adoption de la v3). Décision D2 de Williams (option A) : l'antériorité « devis » se lit sur
 * l'émission, le SIREN venant du client destinataire.
 *
 * CE QUE CE FICHIER GARDE : la charge est celle du contrat publié, champ pour champ ; un envoi émet
 * EXACTEMENT un événement, et un rejeu (ou un second envoi du même devis) n'en ajoute aucun ; un devis
 * qui n'est pas `envoye` n'émet rien ; canal fermé, rien n'est lu ni écrit.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { identifiantEvenement } from "@/server/partners/enveloppe";
import type { PayloadDevisEmis } from "@/server/partners/payloads";
import { fautes, resoudre } from "@/server/partners/__tests__/contrat-schema";

import type { Prisma } from "../../../../prisma/generated/client";
import { DEVIS_EMIS, emettreDevisEmis } from "../producteurs/devis";

const SCHEMA_CHARGE = resoudre("#/$defs/payload_devis_emis");

const DEVIS_ID = "7a000000-0000-4000-8000-0000000000e1";
const CLIENT_ID = "7c000000-0000-4000-8000-0000000000e1";

type Enregistrement = Record<string, unknown>;
type LigneOutbox = { eventId: string; eventType: string; subjectRef: string; corps: string };

/** Un faux client de transaction : les accès du producteur, rien d'autre. */
function fauxTx(devis: Enregistrement[], siren: string | null = "123456789") {
  const outbox = new Map<string, LigneOutbox>();
  const lectures: string[] = [];
  const client = {
    id: CLIENT_ID,
    numero: "AXI-CLI-T46",
    type: "entreprise",
    raisonSociale: "Entreprise témoin",
    siren,
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
    },
    client: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        lectures.push(`client:${where.id}`);
        return where.id === CLIENT_ID ? client : null;
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

function devisEnvoye(surcharge: Enregistrement = {}): Enregistrement {
  return {
    id: DEVIS_ID,
    numero: "AXI-DEV-2026-T46",
    activite: "formation",
    clientId: CLIENT_ID,
    montantTotalHtCents: 500_000,
    statut: "envoye",
    sentAt: new Date("2026-02-10T09:30:00.000Z"),
    acceptedAt: null,
    createdAt: new Date("2026-02-01T15:00:00.000Z"),
    updatedAt: new Date("2026-02-10T09:30:00.000Z"),
    lignes: [],
    ...surcharge,
  };
}

function chargeEmise(outbox: Map<string, LigneOutbox>): PayloadDevisEmis {
  const [ligne] = [...outbox.values()];
  if (!ligne) throw new Error("aucune ligne dans la file");
  return (JSON.parse(ligne.corps) as { payload: PayloadDevisEmis }).payload;
}

const ENV = { ...process.env };
beforeEach(() => {
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.DATABASE_URL = "postgresql://t46@localhost:5432/t46";
});
afterEach(() => {
  process.env = { ...ENV };
});

describe("REQ-INT-006 — la charge de devis.emis est celle du contrat publié (v3)", () => {
  it("REQ-INT-006 : TÉMOIN — devisId, numero, clientId, le SIREN du client destinataire, et emisLe = l'instant de l'envoi", async () => {
    const { tx, outbox } = fauxTx([devisEnvoye()]);
    await emettreDevisEmis(tx, DEVIS_ID);
    const charge = chargeEmise(outbox);
    expect(charge).toEqual({
      devisId: DEVIS_ID,
      numero: "AXI-DEV-2026-T46",
      clientId: CLIENT_ID,
      siren: "123456789",
      emisLe: "2026-02-10T09:30:00.000Z",
    });
    expect(fautes(SCHEMA_CHARGE, charge)).toEqual([]);
  });

  it("REQ-INT-006 : un client sans SIREN émet un SIREN nul, toujours conforme", async () => {
    const { tx, outbox } = fauxTx([devisEnvoye()], null);
    await emettreDevisEmis(tx, DEVIS_ID);
    const charge = chargeEmise(outbox);
    expect(charge.siren).toBeNull();
    expect(fautes(SCHEMA_CHARGE, charge)).toEqual([]);
  });
});

describe("REQ-INT-007 — un seul événement par devis émis", () => {
  it("REQ-INT-007 : TÉMOIN — l'envoi émet EXACTEMENT un événement, et le rejoué n'en ajoute aucun", async () => {
    const { tx, outbox } = fauxTx([devisEnvoye()]);
    const premier = await emettreDevisEmis(tx, DEVIS_ID);
    expect(premier).toBe(identifiantEvenement(DEVIS_EMIS, `${DEVIS_EMIS}:${DEVIS_ID}`));
    expect(outbox.size).toBe(1);
    const second = await emettreDevisEmis(tx, DEVIS_ID);
    expect(second).toBe(premier);
    expect(outbox.size).toBe(1);
  });

  it("REQ-INT-007 : un devis renvoyé plus tard garde sa première émission", async () => {
    const devis = devisEnvoye();
    const { tx, outbox } = fauxTx([devis]);
    await emettreDevisEmis(tx, DEVIS_ID);
    devis["sentAt"] = new Date("2026-03-01T09:30:00.000Z");
    await emettreDevisEmis(tx, DEVIS_ID);
    expect(outbox.size).toBe(1);
    expect(chargeEmise(outbox).emisLe).toBe("2026-02-10T09:30:00.000Z");
  });

  it("REQ-INT-007 : un devis qui n'est pas envoyé (brouillon) n'émet rien", async () => {
    const { tx, outbox } = fauxTx([devisEnvoye({ statut: "brouillon", sentAt: null })]);
    expect(await emettreDevisEmis(tx, DEVIS_ID)).toBeNull();
    expect(outbox.size).toBe(0);
  });

  it("REQ-INT-007 : un devis introuvable dans la transaction lève, nommé", async () => {
    const { tx } = fauxTx([]);
    await expect(emettreDevisEmis(tx, DEVIS_ID)).rejects.toThrow(/devis\.emis/);
  });
});

describe("REQ-INT-007 — inertie : canal fermé", () => {
  it("REQ-INT-007 : canal fermé, aucune lecture, aucune ligne, null", async () => {
    process.env.PARTNERS_SYNC_ENABLED = "false";
    const { tx, outbox, lectures } = fauxTx([devisEnvoye()]);
    expect(await emettreDevisEmis(tx, DEVIS_ID)).toBeNull();
    expect(lectures).toEqual([]);
    expect(outbox.size).toBe(0);
  });
});
