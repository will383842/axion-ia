/**
 * Synchro AUTOMATIQUE du dossier client (25/10/2026) : ce qui est lu, ce qui
 * est écrit, et quand RIEN ne part. Base simulée, données FICTIVES.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CLIENT = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

const base = vi.hoisted(() => {
  const etat = { synchro: null as null | { version: number; empreinte: string | null } };
  const sortie: Array<Record<string, unknown>> = [];
  const upserts: Array<Record<string, unknown>> = [];
  const tx = {
    crmSyncOutbox: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        sortie.push(a.data);
        return { id: "ligne-1" };
      }),
    },
    crmDossierSynchro: {
      upsert: vi.fn(async (a: { create: { version: number; empreinte: string } }) => {
        upserts.push(a as unknown as Record<string, unknown>);
        etat.synchro = { version: a.create.version, empreinte: a.create.empreinte };
      }),
    },
  };
  const client = {
    id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    numero: "AXI-CLI-004",
    type: "entreprise",
    raisonSociale: "Pharmacie Fictive",
    siren: "552100554",
    siret: null,
    adresseRue: "1 rue des Tests",
    adresseCodePostal: "75001",
    adresseVille: "Paris",
    effectif: 12,
    updatedAt: new Date("2026-10-25T08:00:00Z"),
    fusionsAbsorbee: [] as unknown[],
    fusionsAbsorbante: [] as unknown[],
    contacts: [
      {
        id: "c1",
        nom: "Marie Dupont",
        fonction: "Titulaire",
        telephone: null,
        statut: "actif",
        origine: "saisie",
        partiLe: null,
        updatedAt: new Date("2026-10-25T09:00:00Z"),
        adresses: [{ email: "marie@exemple.fr", nature: "pro", ajouteeLe: new Date() }],
      },
    ],
  };
  const prisma = {
    client: {
      findUnique: vi.fn(async () => base.courant),
      findMany: vi.fn(async () => [{ id: "x" }]),
    },
    factureFormation: { findMany: vi.fn(async (_a?: unknown) => [] as unknown[]) },
    questionnaireAvantAudit: { findMany: vi.fn(async (_a?: unknown) => [] as unknown[]) },
    emailOpposition: { findMany: vi.fn(async (_a?: unknown) => [] as unknown[]) },
    crmDossierSynchro: { findUnique: vi.fn(async () => etat.synchro) },
    $queryRaw: vi.fn(async () => [{ ok: base.horsConsole }]),
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const base = {
    etat,
    sortie,
    upserts,
    tx,
    client,
    prisma,
    courant: client as unknown,
    horsConsole: false,
  };
  return base;
});

vi.mock("@/lib/prisma", () => ({ prisma: base.prisma }));
vi.mock("@/server/queue/queues", () => ({ crmSyncQueue: null }));

import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  BALAYAGE_DOSSIERS_MAX,
  balayerDossiersClients,
  reinitialiserCurseurBalayage,
  synchroniserDossierClient,
} from "@/server/crm-sync/dossier-client";

const MAINTENANT = new Date("2026-10-25T12:00:00Z");

beforeEach(() => {
  vi.stubEnv("CRM_SYNC_ENABLED", "true");
  vi.stubEnv("CRM_SYNC_DOSSIER_ENABLED", "true");
  base.courant = base.client;
  base.horsConsole = false;
  reinitialiserCurseurBalayage();
});
afterEach(() => {
  vi.unstubAllEnvs();
  base.etat.synchro = null;
  base.sortie.length = 0;
  base.upserts.length = 0;
  vi.clearAllMocks();
});

describe("synchro automatique du dossier client", () => {
  it("drapeau fermé : aucune lecture, aucune écriture", async () => {
    vi.stubEnv("CRM_SYNC_DOSSIER_ENABLED", "false");
    expect(await synchroniserDossierClient(CLIENT, MAINTENANT)).toBe("ferme");
    expect(await balayerDossiersClients(MAINTENANT)).toEqual({ lus: 0, emis: 0, erreurs: 0 });
    expect(base.prisma.client.findUnique).not.toHaveBeenCalled();
    expect(base.prisma.client.findMany).not.toHaveBeenCalled();
    expect(base.sortie).toHaveLength(0);
  });

  it("premier passage : une ligne d'outbox et la version 1, dans la même transaction", async () => {
    expect(await synchroniserDossierClient(CLIENT, MAINTENANT)).toBe("emis");
    expect(base.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(base.sortie).toHaveLength(1);
    const ligne = base.sortie[0]!;
    expect(ligne["eventType"]).toBe("dossier_client_synchro");
    expect(ligne["subjectRef"]).toBe(`site:client:${CLIENT}`);
    const msg = ligne["payload"] as {
      occurred_at: string;
      payload: { dossier: { version: number } };
    };
    expect(msg.payload.dossier.version).toBe(1);
    // L'instant du changement, pas celui du balayage.
    expect(msg.occurred_at).toBe("2026-10-25T09:00:00.000Z");
    expect(base.upserts).toHaveLength(1);
  });

  it("deuxième passage sans changement : rien ne part", async () => {
    await synchroniserDossierClient(CLIENT, MAINTENANT);
    expect(await synchroniserDossierClient(CLIENT, MAINTENANT)).toBe("inchange");
    expect(base.sortie).toHaveLength(1);
  });

  it("un changement de la fiche : version 2, événement distinct", async () => {
    await synchroniserDossierClient(CLIENT, MAINTENANT);
    base.courant = { ...base.client, adresseVille: "Lyon" };
    expect(await synchroniserDossierClient(CLIENT, MAINTENANT)).toBe("emis");
    const versions = base.sortie.map(
      (l) =>
        (l["payload"] as { payload: { dossier: { version: number } } }).payload.dossier.version,
    );
    expect(versions).toEqual([1, 2]);
    expect(base.sortie[0]!["eventId"]).not.toBe(base.sortie[1]!["eventId"]);
  });

  it("facture établie hors console : le dossier part « client »", async () => {
    base.horsConsole = true;
    await synchroniserDossierClient(CLIENT, MAINTENANT);
    const msg = base.sortie[0]!["payload"] as {
      payload: { dossier: { statut: string; facture_emise: boolean } };
    };
    expect(msg.payload.dossier).toMatchObject({ statut: "client", facture_emise: true });
  });

  it("contact cité (mention) ou adresse personnelle : rien d'identifiant ne part", async () => {
    const [c] = base.client.contacts;
    base.courant = {
      ...base.client,
      contacts: [
        { ...c!, id: "m", origine: "mention" },
        {
          ...c!,
          id: "p",
          adresses: [{ email: "marie@exemple.fr", nature: "perso", ajouteeLe: new Date() }],
        },
      ],
    };
    await synchroniserDossierClient(CLIENT, MAINTENANT);
    const texte = JSON.stringify(base.sortie[0]);
    expect(texte).not.toContain("gmail");
    expect(texte).not.toContain('"ref":"m"');
    expect(texte).toContain('"ref":"p"');
  });

  it("un particulier ou une fiche introuvable : ignoré", async () => {
    base.courant = { ...base.client, type: "particulier" };
    expect(await synchroniserDossierClient(CLIENT, MAINTENANT)).toBe("ignore");
    base.courant = null;
    expect(await synchroniserDossierClient(CLIENT, MAINTENANT)).toBe("ignore");
    expect(base.sortie).toHaveLength(0);
  });

  it("outbox non écrite : la version n'est PAS consommée", async () => {
    base.tx.crmSyncOutbox.create.mockRejectedValueOnce(new Error("base indisponible"));
    expect(await synchroniserDossierClient(CLIENT, MAINTENANT)).toBe("erreur");
    expect(base.upserts).toHaveLength(0);
    expect(base.etat.synchro).toBeNull();
  });

  it("ne lit jamais le contenu d'une réponse : seulement le mode et la date", async () => {
    await synchroniserDossierClient(CLIENT, MAINTENANT);
    const appel = base.prisma.questionnaireAvantAudit.findMany.mock.calls[0]?.[0] as unknown as {
      select: { envois: { select: Record<string, true> } };
    };
    expect(Object.keys(appel.select.envois.select).sort()).toEqual(["mode", "recuLe"]);
  });

  it("une facture émise fait passer le dossier à « client »", async () => {
    base.prisma.factureFormation.findMany.mockResolvedValueOnce([
      { emiseAt: new Date("2026-10-24T10:00:00Z") },
    ] as never);
    await synchroniserDossierClient(CLIENT, MAINTENANT);
    const msg = base.sortie[0]!["payload"] as {
      payload: { dossier: { statut: string; facture_emise: boolean } };
    };
    expect(msg.payload.dossier).toMatchObject({ statut: "client", facture_emise: true });
  });

  it("balayage : relit chaque client et compte les envois", async () => {
    expect(await balayerDossiersClients(MAINTENANT)).toEqual({ lus: 1, emis: 1, erreurs: 0 });
  });

  it("une personne qui s'est opposée (email_oppositions) ne part pas, adresse comprise", async () => {
    const h = hashEmailForLookup("marie@exemple.fr");
    base.prisma.emailOpposition.findMany.mockResolvedValueOnce([{ emailHash: h }]);
    await synchroniserDossierClient(CLIENT, MAINTENANT);
    const json = JSON.stringify(base.sortie[0]);
    expect(json).not.toContain("Marie");
    expect(json).not.toContain("marie@exemple.fr");
  });

  it("balayage au-delà du plafond : le passage suivant reprend après le dernier id relu", async () => {
    const page = Array.from({ length: BALAYAGE_DOSSIERS_MAX }, (_, i) => ({ id: `id-${i}` }));
    const avert = vi.spyOn(console, "warn").mockImplementation(() => {});
    base.prisma.client.findMany.mockResolvedValueOnce(page);
    await balayerDossiersClients(MAINTENANT);
    expect(avert).toHaveBeenCalled();
    await balayerDossiersClients(MAINTENANT);
    const appel = (base.prisma.client.findMany.mock.calls as unknown[][])[1]![0] as {
      where: { id?: { gt: string } };
    };
    expect(appel.where.id).toEqual({ gt: `id-${BALAYAGE_DOSSIERS_MAX - 1}` });
    avert.mockRestore();
  });

  it("fiche absorbée par une fusion : rien n'est émis, ni balayé", async () => {
    base.courant = { ...base.client, fusionsAbsorbee: [{ id: "f1" }] };
    expect(await synchroniserDossierClient(CLIENT, MAINTENANT)).toBe("ignore");
    expect(base.sortie).toHaveLength(0);
    await balayerDossiersClients(MAINTENANT);
    const appel = (base.prisma.client.findMany.mock.calls as unknown[][])[0]![0] as {
      where: { fusionsAbsorbee?: unknown };
    };
    expect(appel.where.fusionsAbsorbee).toEqual({ none: { defaiteLe: null } });
  });

  it("la facture d'une fiche absorbée rend l'absorbante client (factures lues sur les deux)", async () => {
    const ABSORBEE = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
    base.courant = { ...base.client, fusionsAbsorbante: [{ absorbeId: ABSORBEE }] };
    base.prisma.factureFormation.findMany.mockResolvedValueOnce([
      { emiseAt: new Date("2026-10-24T10:00:00Z") },
    ] as never);
    await synchroniserDossierClient(CLIENT, MAINTENANT);
    const filtre = base.prisma.factureFormation.findMany.mock.calls[0]![0] as {
      where: { clientId: { in: string[] } };
    };
    expect(filtre.where.clientId.in).toEqual([CLIENT, ABSORBEE]);
    const msg = base.sortie[0]!["payload"] as { payload: { dossier: { statut: string } } };
    expect(msg.payload.dossier.statut).toBe("client");
  });
});
