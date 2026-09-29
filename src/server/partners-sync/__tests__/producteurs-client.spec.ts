// @vitest-environment node
// @req REQ-INT-007
// @req REQ-INT-015
// @req REQ-DM-021
/**
 * INT-T03 — `client.cree` et `client.mis_a_jour`, produits par UNE fonction d'émission
 * (`emettreFaitClient`), sur un faux client de transaction en mémoire :
 *
 *   · la charge est jugée par le contrat publié ; l'`event_id` est celui des fixtures générées
 *     (`client.cree:<id>`, `client.mis_a_jour:<id>:<updatedAt ISO>`), prouvé contre
 *     `fixtures.v2.json` ;
 *   · le SIREN transmis est normalisé, dérivé du SIRET quand il est vide, et jamais faux : un
 *     SIREN (ou un SIRET) invalide part `null` avec une alerte ;
 *   · les deux écrivains branchés (la porte de création, `updateClientAction`) émettent dans
 *     LEUR transaction ; une mise à jour sans champ transmis n'émet rien ;
 *   · canal fermé : rien n'est lu, rien n'est écrit.
 *
 * Ce qu'un faux ne prouve pas — qu'un retour arrière Postgres efface la ligne — l'est contre un
 * vrai Postgres par `tests/integration/partners-sync/outbox-transactionnelle.spec.ts`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { checkSirenFormat, luhnValid } from "@/lib/siret";
import { identifiantEvenement } from "@/server/partners/enveloppe";
import { fautes, resoudre } from "@/server/partners/__tests__/contrat-schema";
import type { PayloadClient } from "@/server/partners/payloads";

import type { Prisma } from "../../../../prisma/generated/client";
import { REGLES } from "../../../../scripts/gates/cliquet-ecrivains";
import {
  CHAMPS_CLIENT_TRANSMIS,
  CLIENT_CREE,
  CLIENT_MIS_A_JOUR,
  CREATION_CLIENT,
  chargeClientAvant,
  emettreFaitClient,
  sirenTransmis,
  type AlerteClient,
  type ChampsClientNonGardes,
} from "../producteurs/client";

// ── Le faux client de transaction, partagé avec le `@/lib/prisma` simulé ───────────────────
type Enregistrement = Record<string, unknown>;
type LigneOutbox = { eventId: string; eventType: string; subjectRef: string; corps: string };

const etat: {
  clients: Enregistrement[];
  outbox: Map<string, LigneOutbox>;
  lectures: number;
  horloge: number;
} = { clients: [], outbox: new Map(), lectures: 0, horloge: 0 };

/** Un instant par écriture, comme `@updatedAt` : deux écritures, deux instants. */
function maintenant(): Date {
  etat.horloge += 1000;
  return new Date(Date.parse("2026-09-29T08:00:00.000Z") + etat.horloge);
}

function fauxTx() {
  return {
    client: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        etat.lectures += 1;
        const l = etat.clients.find((c) => c["id"] === where.id);
        return l ? { ...l } : null;
      },
      findMany: async () => [],
      create: async ({ data }: { data: Enregistrement }) => {
        const le = maintenant();
        const l = {
          id: `c1000000-0000-4000-8000-00000000000${etat.clients.length + 1}`,
          ...base(),
          ...data,
          createdAt: le,
          updatedAt: le,
        };
        etat.clients.push(l);
        return { ...l };
      },
      update: async ({ where, data }: { where: { id: string }; data: Enregistrement }) => {
        const l = etat.clients.find((c) => c["id"] === where.id);
        if (!l) throw new Error("update d'une fiche absente");
        Object.assign(l, data, { updatedAt: maintenant() });
        return { ...l };
      },
    },
    $executeRaw: async () => 1,
    activityLog: { create: async ({ data }: { data: Enregistrement }) => data },
    partnersSyncOutbox: {
      createMany: async ({ data }: { data: LigneOutbox[]; skipDuplicates: boolean }) => {
        let count = 0;
        for (const l of data) {
          if (etat.outbox.has(l.eventId)) continue;
          etat.outbox.set(l.eventId, l);
          count += 1;
        }
        return { count };
      },
    },
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: async () => ({ siret: null, nafCode: null, idcc: null, opcoIdentifie: "X" }),
    },
    $transaction: async (travail: (tx: unknown) => Promise<unknown>) => travail(fauxTx()),
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({ userId: "a0000000-0000-4000-8000-000000000001" }),
  requireHabilitation: async () => ({ userId: "a0000000-0000-4000-8000-000000000001" }),
  logQualiopiActivity: async () => undefined,
}));

import { updateClientAction } from "@/server/actions/qualiopi/clients";
import { creerOuRetrouverClient } from "@/server/qualiopi/crm/porte-client";

// ── Le monde d'essai ──────────────────────────────────────────────────────────────────────
/** L'identifiant et les instants de la fiche des fixtures (`scripts/partners/fixtures.ts`). */
const ID_FIXTURE = "0a1b2c3d-0001-4000-8000-000000000001";
const LE_FIXTURE = new Date("2026-01-02T10:00:00.000Z");
const ID = "c0000000-0000-4000-8000-000000000003";
/** Un SIREN et un SIRET à la clé juste (le Kbis cité par `src/lib/siret.ts`). */
const SIREN = "732829320";
const SIRET = "73282932000074";

function base(): Enregistrement {
  return {
    numero: "AXI-CLI-903",
    type: "entreprise",
    raisonSociale: "Ateliers Témoin SAS",
    siren: SIREN,
    siret: null,
    nafCode: "6201Z",
    secteur: "Informatique",
    taille: "PME",
    statut: "prospect",
  };
}

function fiche(champs: Enregistrement = {}): Enregistrement {
  return { id: ID, ...base(), createdAt: LE_FIXTURE, updatedAt: LE_FIXTURE, ...champs };
}

const tx = () => fauxTx() as unknown as Prisma.TransactionClient;
/** Une écriture sur la première fiche, comme `@updatedAt` la ferait : rend l'instant posé. */
function modifier(champs: Enregistrement): Date {
  const le = maintenant();
  const l = etat.clients[0];
  if (!l) throw new Error("aucune fiche à modifier");
  Object.assign(l, champs, { updatedAt: le });
  return le;
}
const lignes = () => [...etat.outbox.values()];
const charge = (l: LigneOutbox) => (JSON.parse(l.corps) as { payload: PayloadClient }).payload;
const premiere = (): LigneOutbox => {
  const l = lignes()[0];
  if (!l) throw new Error("aucune ligne dans la file");
  return l;
};

const ENV = { ...process.env };
beforeEach(() => {
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.DATABASE_URL = "postgresql://t03@localhost:5432/t03";
  etat.clients = [];
  etat.outbox = new Map();
  etat.lectures = 0;
  etat.horloge = 0;
});
afterEach(() => {
  process.env = { ...ENV };
});

describe("REQ-INT-007 — la fonction d'émission unique de client.cree et client.mis_a_jour", () => {
  it("REQ-INT-007 : une création émet client.cree, conforme au contrat publié", async () => {
    etat.clients.push(fiche());
    const eventId = await emettreFaitClient(tx(), ID, CREATION_CLIENT);

    expect(eventId).toBe(identifiantEvenement(CLIENT_CREE, `${CLIENT_CREE}:${ID}`));
    expect(premiere()).toMatchObject({ eventType: CLIENT_CREE, subjectRef: `client:${ID}` });
    expect(fautes(resoudre("#/$defs/payload_client_cree"), charge(premiere()))).toEqual([]);
    expect(charge(premiere())).toMatchObject({ clientId: ID, siren: SIREN, numero: "AXI-CLI-903" });
  });

  it("REQ-INT-007 : une mise à jour qui change la charge émet client.mis_a_jour, clé à l'instant relu", async () => {
    etat.clients.push(fiche());
    const avant = await chargeClientAvant(tx(), ID);
    const le = modifier({ secteur: "Industrie" });
    const eventId = await emettreFaitClient(tx(), ID, { avant });

    expect(eventId).toBe(
      identifiantEvenement(CLIENT_MIS_A_JOUR, `${CLIENT_MIS_A_JOUR}:${ID}:${le.toISOString()}`),
    );
    expect(fautes(resoudre("#/$defs/payload_client_mis_a_jour"), charge(premiere()))).toEqual([]);
    expect(charge(premiere())).toMatchObject({
      secteur: "Industrie",
      misAJourLe: le.toISOString(),
    });
  });

  it("REQ-INT-007 : la convention de clé EST celle des fixtures générées (event_id de fixtures.v2.json)", async () => {
    const fixtures = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../partners/contrat/fixtures.v2.json"), "utf8"),
    ) as { evenements: { event_id: string; event_type: string }[] };
    const attendu = (type: string) =>
      fixtures.evenements.find((e) => e.event_type === type)?.event_id;

    etat.clients.push(fiche({ id: ID_FIXTURE }));
    const cree = await emettreFaitClient(tx(), ID_FIXTURE, CREATION_CLIENT);
    const misAJour = await emettreFaitClient(tx(), ID_FIXTURE, { avant: null });

    expect(cree).toBe(attendu(CLIENT_CREE));
    expect(misAJour).toBe(attendu(CLIENT_MIS_A_JOUR));
  });

  it("REQ-INT-007 : deux émissions du même fait ne font qu'une ligne ; deux instants, deux faits", async () => {
    etat.clients.push(fiche());
    await emettreFaitClient(tx(), ID, CREATION_CLIENT);
    await emettreFaitClient(tx(), ID, CREATION_CLIENT);
    expect(lignes()).toHaveLength(1);

    await emettreFaitClient(tx(), ID, { avant: null });
    await emettreFaitClient(tx(), ID, { avant: null });
    expect(lignes()).toHaveLength(2);
    modifier({ taille: "ETI" });
    await emettreFaitClient(tx(), ID, { avant: null });
    expect(lignes()).toHaveLength(3);
  });

  it("REQ-INT-007 : une écriture qui ne change pas la charge n'est pas un fait (statut, note, SIRET du même SIREN)", async () => {
    etat.clients.push(fiche());
    const avant = await chargeClientAvant(tx(), ID);
    modifier({ statut: "devis_envoye", notes: "rappeler", contactNom: "Témoin", siret: SIRET });
    expect(await emettreFaitClient(tx(), ID, { avant })).toBeNull();
    expect(lignes()).toEqual([]);
  });

  it("REQ-INT-015 : un SIRET posé sur une fiche SANS SIREN change la charge : c'est un fait", async () => {
    etat.clients.push(fiche({ siren: null }));
    const avant = await chargeClientAvant(tx(), ID);
    expect(avant?.siren).toBeNull();
    modifier({ siret: SIRET });
    expect(await emettreFaitClient(tx(), ID, { avant })).not.toBeNull();
    expect(charge(premiere()).siren).toBe(SIREN);
  });

  it("REQ-INT-007 : canal fermé, rien n'est lu ni écrit (inertie)", async () => {
    process.env.PARTNERS_SYNC_ENABLED = "false";
    etat.clients.push(fiche());
    expect(await chargeClientAvant(tx(), ID)).toBeNull();
    expect(await emettreFaitClient(tx(), ID, CREATION_CLIENT)).toBeNull();
    expect(await emettreFaitClient(tx(), ID, { avant: null })).toBeNull();
    expect(etat.lectures).toBe(0);
    expect(lignes()).toEqual([]);
  });

  it("REQ-INT-007 : une fiche introuvable dans la transaction lève (l'écrivain vient de l'écrire)", async () => {
    await expect(emettreFaitClient(tx(), ID, CREATION_CLIENT)).rejects.toThrow(/introuvable/);
  });

  it("REQ-INT-007 : la liste des champs transmis est CELLE du cliquet, et couvre la charge", () => {
    const regle = REGLES.find((r) => r.emission === "emettreFaitClient");
    expect(regle?.champsTransmis).toEqual([...CHAMPS_CLIENT_TRANSMIS]);
    expectTypeOf<ChampsClientNonGardes>().toEqualTypeOf<never>();
  });
});

describe("REQ-INT-007 — les écrivains branchés émettent dans LEUR transaction", () => {
  it("REQ-INT-007 : la porte de création (creerOuRetrouverClient) émet client.cree", async () => {
    const r = await creerOuRetrouverClient(
      { client: fauxTx().client, $transaction: async (t) => t(tx()) } as Parameters<
        typeof creerOuRetrouverClient
      >[0],
      { raisonSociale: "Nouvelle Fiche SAS", siret: SIRET, siren: SIREN },
      null,
      { parAdminId: null },
    );
    if (r.statut !== "cree") throw new Error(`création refusée : ${r.statut}`);
    expect(lignes().map((l) => [l.eventType, l.subjectRef])).toEqual([
      [CLIENT_CREE, `client:${r.id}`],
    ]);
    expect(charge(premiere()).siren).toBe(SIREN);
  });

  it("REQ-INT-007 : updateClientAction émet client.mis_a_jour pour un champ transmis, rien pour une note", async () => {
    etat.clients.push(fiche());
    expect(await updateClientAction({ id: ID, secteur: "Industrie" })).toEqual({
      data: { id: ID },
    });
    expect(lignes().map((l) => l.eventType)).toEqual([CLIENT_MIS_A_JOUR]);
    expect(charge(premiere()).secteur).toBe("Industrie");

    expect(await updateClientAction({ id: ID, notes: "rappeler lundi" })).toEqual({
      data: { id: ID },
    });
    expect(lignes()).toHaveLength(1);
  });
});

describe("REQ-INT-015 — le SIREN transmis : normalisé, dérivé du SIRET, jamais faux", () => {
  const alertes: AlerteClient[] = [];
  const alerter = (a: AlerteClient) => alertes.push(a);
  beforeEach(() => {
    alertes.length = 0;
  });

  it("REQ-INT-015 : un SIREN saisi avec séparateurs part normalisé à 9 chiffres", async () => {
    etat.clients.push(fiche({ siren: "732 829 320" }));
    await emettreFaitClient(tx(), ID, CREATION_CLIENT, { alerter });
    expect(charge(premiere()).siren).toBe(SIREN);
    expect(alertes).toEqual([]);
  });

  it("REQ-INT-015 : un SIREN VIDE est DÉRIVÉ du SIRET valide", async () => {
    etat.clients.push(fiche({ siren: null, siret: "732 829 320 00074" }));
    await emettreFaitClient(tx(), ID, CREATION_CLIENT, { alerter });
    expect(charge(premiere()).siren).toBe(SIREN);
    expect(sirenTransmis({ siren: "", siret: SIRET })).toEqual({ siren: SIREN, origine: "siret" });
    expect(alertes).toEqual([]);
  });

  it("REQ-INT-015 : un SIREN à la clé fausse n'est JAMAIS transmis tel quel : null, et une alerte", async () => {
    etat.clients.push(fiche({ siren: "123456789", siret: SIRET }));
    const eventId = await emettreFaitClient(tx(), ID, CREATION_CLIENT, { alerter });
    expect(charge(premiere()).siren).toBeNull();
    expect(premiere().corps).not.toContain("123456789");
    expect(alertes).toEqual([
      { type: CLIENT_CREE, motif: "siren_invalide", sujet: `client:${ID}`, eventId },
    ]);
  });

  it("REQ-INT-015 : SIREN vide et SIRET invalide : rien n'est dérivé d'une valeur fausse, alerte", async () => {
    etat.clients.push(fiche({ siren: null, siret: "73282932000075" }));
    await emettreFaitClient(tx(), ID, { avant: null }, { alerter });
    expect(charge(premiere()).siren).toBeNull();
    expect(alertes.map((a) => a.motif)).toEqual(["siret_invalide"]);
  });

  it("REQ-INT-015 : ni SIREN ni SIRET : null, sans alerte (un particulier, un prospect)", async () => {
    etat.clients.push(fiche({ siren: null, siret: null }));
    await emettreFaitClient(tx(), ID, CREATION_CLIENT, { alerter });
    expect(charge(premiere()).siren).toBeNull();
    expect(alertes).toEqual([]);
  });

  it("REQ-INT-015 : un SIRET à la clé juste dont le SIREN a la clé fausse ne donne rien", () => {
    // 14 chiffres Luhn-valides dont les 9 premiers ne le sont pas.
    const siret = "12345678900007";
    expect(luhnValid(siret)).toBe(true);
    expect(luhnValid(siret.slice(0, 9))).toBe(false);
    expect(sirenTransmis({ siren: null, siret })).toEqual({
      siren: null,
      origine: "invalide",
      champ: "siret",
    });
  });
});

describe("REQ-DM-021 — le SIREN bénéficiaire transmis est fiable ou absent, jamais faux", () => {
  const CAS: readonly (string | null)[] = [
    SIREN,
    "732 829 320",
    "732.829.320",
    "123456789",
    "12345678",
    "FR732829320",
    "000000000",
    "",
    null,
  ];

  it("REQ-DM-021 : toute sortie est null ou 9 chiffres à la clé juste", () => {
    for (const siren of CAS) {
      for (const siret of [null, SIRET, "73282932000075", "12345678900007"]) {
        const r = sirenTransmis({ siren, siret });
        if (r.siren !== null) {
          expect(r.siren).toMatch(/^\d{9}$/);
          expect(checkSirenFormat(r.siren).ok).toBe(true);
        }
      }
    }
  });

  it("REQ-DM-021 : sur le SIREN de la fiche, même verdict que la barrière de lireFacture (lot A)", () => {
    // `facturation.ts` part `non_resolue` quand `checkSirenFormat(client.siren)` échoue : la
    // fiche que client.* transmet sans SIREN est exactement celle que facture.* ne résout pas.
    for (const siren of CAS) {
      if (siren === null || siren === "") continue;
      const transmis = sirenTransmis({ siren, siret: null }).siren !== null;
      expect(transmis, `SIREN « ${siren} »`).toBe(checkSirenFormat(siren).ok);
    }
  });
});
