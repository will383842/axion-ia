/**
 * Tests — acceptation d'un devis À FORMULES (lot 4) : recopie du choix scellé, acceptation et fait
 * `commande.signee` dans UNE transaction. Un faux client Prisma en mémoire, sans base.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const emettre = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({ emettreDevisSigne: emettre }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { accepterDevisAFormules, AcceptationFormulesRefusee } from "./acceptation-formules";
import { eventIdCommandeSignee } from "./commande-signee";
import { montantsDevis } from "./montants-devis";
import { choixCanonique, sha256Choix, sha256Offre } from "./offre-calculs";
import { offreFictive } from "./offre-fixtures.spec-util";

const DOC = "11111111-1111-4111-8111-111111111111";
const DEVIS_ID = "22222222-2222-4222-8222-222222222222";
const SIG_ID = "33333333-3333-4333-8333-333333333333";
const NUMERO = "AXI-DEV-2026-001";

function etat(
  over: {
    offre?: ReturnType<typeof offreFictive>;
    sig?: Record<string, unknown>;
    devis?: Record<string, unknown>;
  } = {},
) {
  const offre = over.offre ?? offreFictive();
  const offreSha256 = sha256Offre(offre);
  const choix = choixCanonique({
    devisNumero: NUMERO,
    offreSha256,
    formule: "abonnement",
    automatisationsRetenues: ["auto1"],
    maintenanceRetenue: false,
    periodiciteMois: 1,
  });
  return {
    offre,
    offreSha256,
    choix,
    devis: {
      id: DEVIS_ID,
      numero: NUMERO,
      statut: "envoye",
      offre,
      offreSha256,
      formuleRetenue: null as string | null,
      lignes: [],
      montantTotalHtCents: 0,
      clientId: "client-1",
      replacesDevisId: null,
      ...over.devis,
    },
    sig: {
      id: SIG_ID,
      hashVersion: 4,
      choixOffre: choix,
      choixOffreSha256: sha256Choix(choix),
      signataireNom: "C. Martin",
      signataireQualite: "gérante",
      signeAt: new Date("2026-11-20T10:12:00Z"),
      cgvVersion: "2026-10-04",
      ...over.sig,
    },
  };
}

function faux_(
  e: ReturnType<typeof etat>,
  opts: { updateFormuleCount?: number; axioniaSigneAt?: Date | null } = {},
) {
  const appels: string[] = [];
  const tx = {
    devis: {
      findMany: vi.fn(async () => [{ id: DEVIS_ID }]),
      findUnique: vi.fn(async () => e.devis),
      updateMany: vi.fn(
        async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          appels.push(args.data["statut"] !== undefined ? "statut" : "recopie");
          if (args.data["statut"] === undefined) return { count: opts.updateFormuleCount ?? 1 };
          return { count: 1 };
        },
      ),
    },
    documentSignature: {
      findFirst: vi.fn(async (args: { where: { partie: string } }) =>
        args.where.partie === "client"
          ? e.sig
          : opts.axioniaSigneAt === null
            ? null
            : { signeAt: opts.axioniaSigneAt ?? new Date("2026-11-20T14:03:00Z") },
      ),
    },
    client: {
      findUnique: vi.fn(async () => ({
        numero: "AXI-CLI-000123",
        raisonSociale: "Boulangerie Martin",
        siren: "123456782",
        siret: null,
        adresse: "1 rue de la Paix",
      })),
    },
    consoleCommande: { createMany: vi.fn(async (_args: unknown) => ({ count: 1 })) },
  };
  const client = {
    devis: { findMany: tx.devis.findMany },
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  };
  return { client, tx, appels };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("accepterDevisAFormules", () => {
  it("devis sans offre : ne fait rien (traite=false), aucune transaction", async () => {
    const e = etat();
    const { client } = faux_(e);
    client.devis.findMany.mockResolvedValue([]);
    const r = await accepterDevisAFormules(client as never, DOC);
    expect(r).toEqual({ traite: false, ids: [] });
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("recopie le choix : formule retenue, signature du choix, lignes et total de la formule", async () => {
    const e = etat();
    const { client, tx, appels } = faux_(e);
    const r = await accepterDevisAFormules(client as never, DOC);
    expect(r).toEqual({ traite: true, ids: [DEVIS_ID] });
    const attendu = montantsDevis({
      offre: e.offre,
      lignes: [],
      montantTotalHtCents: 0,
      choix: { formule: "abonnement", automatisationsRetenues: ["auto1"] },
    });
    const recopie = tx.devis.updateMany.mock.calls.find(
      (c) => c[0].data["formuleRetenue"] !== undefined,
    )![0];
    expect(recopie.where).toMatchObject({ id: DEVIS_ID, formuleRetenue: null });
    expect(recopie.data).toMatchObject({
      formuleRetenue: "abonnement",
      choixSignatureId: SIG_ID,
      choixRetenu: e.choix,
      montantTotalHtCents: attendu.montantTotalHtCents,
    });
    expect(recopie.data["lignes"]).toEqual(attendu.lignes);
    expect(attendu.montantTotalHtCents).toBe(35000);
    // Ordre : recopie, puis acceptation, puis émission de `devis.signe`.
    expect(appels).toEqual(["recopie", "statut"]);
    expect(emettre).toHaveBeenCalledWith(tx, DEVIS_ID);
    expect(tx.devis.updateMany.mock.invocationCallOrder[1]!).toBeLessThan(
      emettre.mock.invocationCallOrder[0]!,
    );
  });

  it("range le fait commande.signee dans la MÊME transaction, avec l'identifiant fixe", async () => {
    const e = etat();
    const { client, tx } = faux_(e);
    await accepterDevisAFormules(client as never, DOC);
    expect(client.$transaction).toHaveBeenCalledOnce();
    const arg = tx.consoleCommande.createMany.mock.calls[0]![0] as {
      data: Record<string, unknown>[];
      skipDuplicates: boolean;
    };
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data[0]).toMatchObject({
      devisId: DEVIS_ID,
      numeroDevis: NUMERO,
      choixOffreSha256: sha256Choix(e.choix),
      eventId: eventIdCommandeSignee(NUMERO, sha256Choix(e.choix)),
    });
    expect(JSON.stringify(arg.data[0]!["payload"])).not.toMatch(/token|jeton|ipHash/i);
  });

  it("idempotent : la recopie perdue (autre accepteur gagnant) ne réécrit ni le statut ni le fait", async () => {
    const e = etat();
    const { client, tx, appels } = faux_(e, { updateFormuleCount: 0 });
    const r = await accepterDevisAFormules(client as never, DOC);
    expect(r.traite).toBe(true);
    expect(appels).toEqual(["recopie"]);
    expect(tx.consoleCommande.createMany).not.toHaveBeenCalled();
    expect(emettre).not.toHaveBeenCalled();
  });

  it("un devis déjà accepté n'est pas retouché", async () => {
    const e = etat({ devis: { statut: "accepte" } });
    const { client, tx } = faux_(e);
    const r = await accepterDevisAFormules(client as never, DOC);
    expect(r.traite).toBe(true);
    expect(tx.devis.updateMany).not.toHaveBeenCalled();
    expect(tx.consoleCommande.createMany).not.toHaveBeenCalled();
  });

  it("🔴 choix_offre altéré en base : la transaction est refusée, rien n'est accepté", async () => {
    const e = etat();
    e.sig.choixOffre = { ...e.choix, formule: "achat" };
    const { client, tx } = faux_(e);
    await expect(accepterDevisAFormules(client as never, DOC)).rejects.toBeInstanceOf(
      AcceptationFormulesRefusee,
    );
    expect(tx.devis.updateMany).not.toHaveBeenCalled();
    expect(emettre).not.toHaveBeenCalled();
  });

  it("🔴 signature du client sans sceau V4 : refusée", async () => {
    const e = etat({ sig: { hashVersion: 3 } });
    const { client } = faux_(e);
    await expect(accepterDevisAFormules(client as never, DOC)).rejects.toBeInstanceOf(
      AcceptationFormulesRefusee,
    );
  });

  it("🔴 offre modifiée depuis l'envoi : refusée", async () => {
    const e = etat();
    const autre = { ...e.offre, garantie: { jours: 999 } };
    e.devis.offre = autre;
    const { client } = faux_(e);
    await expect(accepterDevisAFormules(client as never, DOC)).rejects.toBeInstanceOf(
      AcceptationFormulesRefusee,
    );
  });

  it("🔴 choix scellé sur une autre offre : refusé", async () => {
    const e = etat();
    const autre = choixCanonique({ ...e.choix, offreSha256: "0".repeat(64) });
    e.sig.choixOffre = autre;
    e.sig.choixOffreSha256 = sha256Choix(autre);
    const { client } = faux_(e);
    await expect(accepterDevisAFormules(client as never, DOC)).rejects.toBeInstanceOf(
      AcceptationFormulesRefusee,
    );
  });

  it("🔴 choix bien formé mais contraire aux règles de l'offre (maintenance obligatoire décochée) : refusé", async () => {
    const offre = offreFictive();
    offre.achat!.maintenance.regle = "obligatoire";
    const e = etat({ offre });
    const faux = choixCanonique({
      devisNumero: NUMERO,
      offreSha256: e.offreSha256,
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: false,
      periodiciteMois: null,
    });
    e.sig.choixOffre = faux;
    e.sig.choixOffreSha256 = sha256Choix(faux);
    const { client, tx } = faux_(e);
    await expect(accepterDevisAFormules(client as never, DOC)).rejects.toBeInstanceOf(
      AcceptationFormulesRefusee,
    );
    expect(tx.devis.updateMany).not.toHaveBeenCalled();
    expect(emettre).not.toHaveBeenCalled();
  });

  it("aucune signature client active : refusée", async () => {
    const e = etat();
    const { client, tx } = faux_(e);
    tx.documentSignature.findFirst.mockResolvedValue(null as never);
    await expect(accepterDevisAFormules(client as never, DOC)).rejects.toBeInstanceOf(
      AcceptationFormulesRefusee,
    );
  });

  it("🔴 contresignature d'Axion-IA absente : refusée (contresignature_absente), rien n'est écrit", async () => {
    const e = etat();
    const { client, tx } = faux_(e, { axioniaSigneAt: null });
    await expect(accepterDevisAFormules(client as never, DOC)).rejects.toMatchObject({
      motif: "contresignature_absente",
    });
    expect(tx.devis.updateMany).not.toHaveBeenCalled();
    expect(tx.consoleCommande.createMany).not.toHaveBeenCalled();
    expect(emettre).not.toHaveBeenCalled();
  });

  it("révision : première version → null ; remplaçant d'une v1 → 2 (fait lu sur replacesDevisId)", async () => {
    const payloadDe = async (replaces: string | null) => {
      const e = etat({ devis: { replacesDevisId: replaces } });
      const { client, tx } = faux_(e);
      tx.devis.findUnique.mockImplementation((async (a: { where: { id: string } }) =>
        a.where.id === DEVIS_ID ? e.devis : { replacesDevisId: null }) as never);
      await accepterDevisAFormules(client as never, DOC);
      const arg = tx.consoleCommande.createMany.mock.calls[0]![0] as {
        data: { payload: { revision: number | null } }[];
      };
      return arg.data[0]!.payload.revision;
    };
    expect(await payloadDe(null)).toBeNull();
    expect(await payloadDe("44444444-4444-4444-8444-444444444444")).toBe(2);
  });
});
