/**
 * Fiche S06 — actions du brouillon d'assistant de devis (créer, sauver, reprendre, lister,
 * mettre à l'écart). Prisma est simulé.
 *
 * Mutations qui font rougir ces tests (essayées à la main) :
 *   - retirer `createdByAdminId` des `where` → « autre admin → introuvable » rougit ;
 *   - retirer `revision: attenduRevision` du `where` de la sauvegarde → « révision périmée » rougit ;
 *   - supprimer la branche « rejeu » → « même sauvegardeId rejoué » rougit ;
 *   - remplacer l'`updateMany` d'écart par un `delete` → « aucun delete » rougit ;
 *   - ne pas réécrire `sync` → « sync reçu ignoré » rougit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
  delMany: vi.fn(),
  clientFindUnique: vi.fn(),
  devisFindUnique: vi.fn(),
  venteFindFirst: vi.fn(),
  log: vi.fn(),
  admin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devisAssistantBrouillon: {
      create: m.create,
      findFirst: m.findFirst,
      findUnique: m.findUnique,
      findMany: m.findMany,
      updateMany: m.updateMany,
      update: m.update,
      delete: m.del,
      deleteMany: m.delMany,
    },
    client: { findUnique: m.clientFindUnique },
    devis: { findUnique: m.devisFindUnique },
    venteBrouillon: { findFirst: m.venteFindFirst },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: m.admin,
  logQualiopiActivity: m.log,
}));

import {
  creerBrouillonAssistantAction,
  sauverBrouillonAssistantAction,
  reprendreBrouillonAssistantAction,
  listerMesBrouillonsAssistantAction,
  mettreAEcartBrouillonAssistantAction,
} from "./devis-assistant-brouillon";
import { payloadVide } from "@/server/qualiopi/devis/assistant/payload";

const ADMIN = "550e8400-e29b-41d4-a716-446655440010";
const AUTRE = "550e8400-e29b-41d4-a716-446655440011";
const ID = "550e8400-e29b-41d4-a716-446655440020";
const CLIENT = "550e8400-e29b-41d4-a716-446655440001";
const DEVIS = "550e8400-e29b-41d4-a716-446655440002";
const SAUV = "550e8400-e29b-41d4-a716-446655440030";
const VENTE = "550e8400-e29b-41d4-a716-446655440040";

const base = () => payloadVide(20);

beforeEach(() => {
  vi.clearAllMocks();
  m.admin.mockResolvedValue({ userId: ADMIN, role: "super_admin" });
  m.clientFindUnique.mockResolvedValue({ id: CLIENT });
  m.venteFindFirst.mockResolvedValue(null);
  m.devisFindUnique.mockResolvedValue({
    id: DEVIS,
    clientId: CLIENT,
    statut: "brouillon",
    updatedAt: new Date("2026-11-08T10:00:00.000Z"),
  });
});

describe("creerBrouillonAssistantAction", () => {
  it("crée un brouillon au nom de l'admin connecté, révision 0", async () => {
    m.create.mockResolvedValue({ id: ID, revision: 0 });
    const r = await creerBrouillonAssistantAction({ payload: base() });
    expect(r).toEqual({ data: { id: ID, revision: 0 } });
    const arg = m.create.mock.calls[0]![0];
    expect(arg.data.createdByAdminId).toBe(ADMIN);
    expect(arg.data.devisId ?? null).toBeNull();
  });

  it("refuse sans droit d'écriture (la garde est appelée en premier)", async () => {
    m.admin.mockRejectedValue(new Error("interdit"));
    await expect(creerBrouillonAssistantAction({ payload: base() })).rejects.toThrow("interdit");
    expect(m.create).not.toHaveBeenCalled();
  });

  it("ignore le `sync` reçu et le réécrit (jamais cru)", async () => {
    m.create.mockResolvedValue({ id: ID, revision: 0 });
    const p = base();
    p.sync = {
      devisId: "00000000-0000-4000-8000-000000000000",
      devisMajLe: "2000-01-01T00:00:00.000Z",
    };
    await creerBrouillonAssistantAction({ payload: p });
    const ecrit = m.create.mock.calls[0]![0].data.payload;
    expect(ecrit.sync).toEqual({ devisId: null, devisMajLe: null });
  });

  it("refuse un payload illisible (clé de contact libre) sans rien écrire", async () => {
    const r = await creerBrouillonAssistantAction({
      payload: { ...base(), contactEmail: "a@b.fr" },
    });
    expect("error" in r).toBe(true);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("refuse un client qui n'existe pas en base (jamais cru)", async () => {
    m.clientFindUnique.mockResolvedValue(null);
    const p = base();
    p.clientId = CLIENT;
    const r = await creerBrouillonAssistantAction({ payload: p });
    expect("error" in r).toBe(true);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("ignore un venteBrouillonId qui n'est pas à l'admin", async () => {
    m.create.mockResolvedValue({ id: ID, revision: 0 });
    const p = base();
    p.venteBrouillonId = VENTE;
    await creerBrouillonAssistantAction({ payload: p });
    expect(m.venteFindFirst.mock.calls[0]![0].where).toMatchObject({
      id: VENTE,
      createdByAdminId: ADMIN,
    });
    expect(m.create.mock.calls[0]![0].data.venteBrouillonId ?? null).toBeNull();
    expect(m.create.mock.calls[0]![0].data.payload.venteBrouillonId).toBeNull();
  });

  it("devisId déjà lié à un brouillon de l'admin → renvoie l'existant, sans créer", async () => {
    m.findUnique.mockResolvedValue({ id: ID, revision: 4, createdByAdminId: ADMIN });
    const r = await creerBrouillonAssistantAction({ payload: base(), devisId: DEVIS });
    expect(r).toEqual({ data: { id: ID, revision: 4 } });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("devisId déjà lié au brouillon d'un AUTRE admin → introuvable, sans fuite", async () => {
    m.findUnique.mockResolvedValue({ id: ID, revision: 4, createdByAdminId: AUTRE });
    const r = await creerBrouillonAssistantAction({ payload: base(), devisId: DEVIS });
    expect(r).toEqual({ error: "Brouillon introuvable" });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("devisId libre : le lien et la date de mise à jour viennent de la base", async () => {
    m.findUnique.mockResolvedValue(null);
    m.create.mockResolvedValue({ id: ID, revision: 0 });
    await creerBrouillonAssistantAction({ payload: base(), devisId: DEVIS });
    const data = m.create.mock.calls[0]![0].data;
    expect(data.devisId).toBe(DEVIS);
    expect(data.payload.sync).toEqual({ devisId: DEVIS, devisMajLe: "2026-11-08T10:00:00.000Z" });
  });

  it("devisId inexistant → erreur, rien d'écrit", async () => {
    m.findUnique.mockResolvedValue(null);
    m.devisFindUnique.mockResolvedValue(null);
    const r = await creerBrouillonAssistantAction({ payload: base(), devisId: DEVIS });
    expect("error" in r).toBe(true);
    expect(m.create).not.toHaveBeenCalled();
  });
});

describe("sauverBrouillonAssistantAction", () => {
  const entree = (o: Record<string, unknown> = {}) => ({
    id: ID,
    attenduRevision: 2,
    sauvegardeId: SAUV,
    payload: base(),
    etape: 2 as const,
    ...o,
  });

  it("sauvegarde conditionnelle : propriétaire + révision attendue + hors « à l'écart »", async () => {
    m.findFirst.mockResolvedValue({ id: ID, devisId: null, payload: base(), statut: "en_cours" });
    m.updateMany.mockResolvedValue({ count: 1 });
    const r = await sauverBrouillonAssistantAction(entree());
    expect(r).toEqual({ data: { revision: 3 } });
    const arg = m.updateMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({ id: ID, createdByAdminId: ADMIN, revision: 2 });
    expect(arg.where.statut).toEqual({ not: "a_l_ecart" });
    expect(arg.data.revision).toEqual({ increment: 1 });
    expect(arg.data.derniereSauvegardeId).toBe(SAUV);
    expect(arg.data.etape).toBe(2);
  });

  it("autre admin → introuvable (jamais écrit)", async () => {
    m.findFirst.mockResolvedValue(null);
    const r = await sauverBrouillonAssistantAction(entree());
    expect(r).toEqual({ error: "Brouillon introuvable" });
    expect(m.findFirst.mock.calls[0]![0].where).toMatchObject({ id: ID, createdByAdminId: ADMIN });
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("révision périmée → conflit avec la révision actuelle", async () => {
    m.findFirst
      .mockResolvedValueOnce({ id: ID, devisId: null, payload: base(), statut: "en_cours" })
      .mockResolvedValueOnce({
        id: ID,
        revision: 5,
        derniereSauvegardeId: "autre",
        statut: "en_cours",
      });
    m.updateMany.mockResolvedValue({ count: 0 });
    const r = await sauverBrouillonAssistantAction(entree());
    expect(r).toMatchObject({ conflit: true, revisionActuelle: 5 });
    expect("data" in r).toBe(false);
  });

  it("même sauvegardeId rejoué → succès SANS double incrément", async () => {
    m.findFirst
      .mockResolvedValueOnce({ id: ID, devisId: null, payload: base(), statut: "en_cours" })
      .mockResolvedValueOnce({
        id: ID,
        revision: 3,
        derniereSauvegardeId: SAUV,
        statut: "en_cours",
      });
    m.updateMany.mockResolvedValue({ count: 0 });
    const r = await sauverBrouillonAssistantAction(entree());
    expect(r).toEqual({ data: { revision: 3 } });
    expect(m.updateMany).toHaveBeenCalledTimes(1);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("brouillon mis à l'écart → refus explicite", async () => {
    m.findFirst
      .mockResolvedValueOnce({ id: ID, devisId: null, payload: base(), statut: "a_l_ecart" })
      .mockResolvedValueOnce({
        id: ID,
        revision: 2,
        derniereSauvegardeId: null,
        statut: "a_l_ecart",
      });
    m.updateMany.mockResolvedValue({ count: 0 });
    const r = await sauverBrouillonAssistantAction(entree());
    expect("error" in r && !("conflit" in r)).toBe(true);
  });

  it("`sync` reçu ignoré : le serveur écrit celui de la base (lien du devis)", async () => {
    m.findFirst.mockResolvedValue({
      id: ID,
      devisId: DEVIS,
      payload: { ...base(), sync: { devisId: DEVIS, devisMajLe: "2026-11-08T10:00:00.000Z" } },
      statut: "lie_au_devis",
    });
    m.updateMany.mockResolvedValue({ count: 1 });
    const p = base();
    p.sync = {
      devisId: "00000000-0000-4000-8000-000000000000",
      devisMajLe: "1999-01-01T00:00:00.000Z",
    };
    await sauverBrouillonAssistantAction(entree({ payload: p }));
    expect(m.updateMany.mock.calls[0]![0].data.payload.sync).toEqual({
      devisId: DEVIS,
      devisMajLe: "2026-11-08T10:00:00.000Z",
    });
  });

  it("payload illisible → erreur, aucune écriture", async () => {
    const r = await sauverBrouillonAssistantAction(entree({ payload: { v: 2 } }));
    expect("error" in r).toBe(true);
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("entrée invalide (sauvegardeId non uuid) → refus", async () => {
    const r = await sauverBrouillonAssistantAction(entree({ sauvegardeId: "x" }));
    expect("error" in r).toBe(true);
    expect(m.updateMany).not.toHaveBeenCalled();
  });
});

describe("reprendreBrouillonAssistantAction", () => {
  it("borné au propriétaire : autre admin → introuvable", async () => {
    m.findFirst.mockResolvedValue(null);
    const r = await reprendreBrouillonAssistantAction(ID);
    expect(r).toEqual({ error: "Brouillon introuvable" });
    expect(m.findFirst.mock.calls[0]![0].where).toMatchObject({ id: ID, createdByAdminId: ADMIN });
  });

  it("rend le payload relu, la révision, l'étape, le statut et le devis lié", async () => {
    m.findFirst.mockResolvedValue({
      id: ID,
      payload: base(),
      revision: 7,
      etape: 3,
      statut: "lie_au_devis",
      devisId: DEVIS,
      updatedAt: new Date("2026-11-08T11:00:00.000Z"),
    });
    const r = await reprendreBrouillonAssistantAction(ID);
    if (!("data" in r)) throw new Error("data attendu");
    expect(r.data).toMatchObject({
      revision: 7,
      etape: 3,
      statut: "lie_au_devis",
      devisId: DEVIS,
      majLe: "2026-11-08T11:00:00.000Z",
    });
    expect(r.data.payload.v).toBe(1);
  });
});

describe("listerMesBrouillonsAssistantAction", () => {
  it("ne liste que les brouillons de l'admin, hors « à l'écart »", async () => {
    m.findMany.mockResolvedValue([
      {
        id: ID,
        etape: 2,
        updatedAt: new Date("2026-11-08T11:00:00.000Z"),
        client: { raisonSociale: "SCI Invest Sun" },
        devis: { numero: "AXI-DEV-0001" },
      },
    ]);
    const r = await listerMesBrouillonsAssistantAction();
    expect(m.findMany.mock.calls[0]![0].where).toMatchObject({
      createdByAdminId: ADMIN,
      statut: { not: "a_l_ecart" },
    });
    expect(r).toEqual({
      data: [
        {
          id: ID,
          etape: 2,
          clientLibelle: "SCI Invest Sun",
          devisNumero: "AXI-DEV-0001",
          majLe: "2026-11-08T11:00:00.000Z",
        },
      ],
    });
  });
});

describe("creerBrouillonAssistantAction — S06 correctifs de fond", () => {
  it("impose le client du devis quand le payload n'en porte pas", async () => {
    m.findUnique.mockResolvedValue(null);
    m.create.mockResolvedValue({ id: ID, revision: 0 });
    await creerBrouillonAssistantAction({ payload: base(), devisId: DEVIS });
    const arg = m.create.mock.calls[0]![0];
    expect(arg.data.clientId).toBe(CLIENT);
    expect(arg.data.payload.clientId).toBe(CLIENT);
  });

  it("refuse un payload dont le client diffère de celui du devis, sans écrire", async () => {
    m.findUnique.mockResolvedValue(null);
    const p = { ...base(), clientId: "550e8400-e29b-41d4-a716-446655440099" };
    const r = await creerBrouillonAssistantAction({ payload: p, devisId: DEVIS });
    expect("error" in r).toBe(true);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("refuse un devis qui n'est plus en brouillon", async () => {
    m.findUnique.mockResolvedValue(null);
    m.devisFindUnique.mockResolvedValue({
      id: DEVIS,
      clientId: CLIENT,
      statut: "envoye",
      updatedAt: new Date("2026-11-08T10:00:00.000Z"),
    });
    const r = await creerBrouillonAssistantAction({ payload: base(), devisId: DEVIS });
    expect("error" in r).toBe(true);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("double clic : P2002 sur devis_id → relit et renvoie le brouillon existant", async () => {
    m.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: ID, revision: 2, createdByAdminId: ADMIN });
    m.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const r = await creerBrouillonAssistantAction({ payload: base(), devisId: DEVIS });
    expect(r).toEqual({ data: { id: ID, revision: 2 } });
  });

  it("P2002 dont le gagnant appartient à un autre admin → introuvable", async () => {
    m.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: ID, revision: 2, createdByAdminId: AUTRE });
    m.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const r = await creerBrouillonAssistantAction({ payload: base(), devisId: DEVIS });
    expect(r).toEqual({ error: "Brouillon introuvable" });
  });

  it("une autre erreur de création est propagée", async () => {
    m.findUnique.mockResolvedValue(null);
    m.create.mockRejectedValue(new Error("panne"));
    await expect(
      creerBrouillonAssistantAction({ payload: base(), devisId: DEVIS }),
    ).rejects.toThrow("panne");
  });
});

describe("mettreAEcartBrouillonAssistantAction", () => {
  it("brouillon lié à un devis → refusé avec un message clair, rien d'écrit", async () => {
    m.findFirst.mockResolvedValue({ id: ID, statut: "lie_au_devis" });
    const r = await mettreAEcartBrouillonAssistantAction({ id: ID, attenduRevision: 1 });
    expect(r).toMatchObject({ error: expect.stringContaining("lié à un devis") });
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("passe le statut à « a_l_ecart » par updateMany, AUCUN delete", async () => {
    m.findFirst.mockResolvedValue({ id: ID, statut: "en_cours" });
    m.updateMany.mockResolvedValue({ count: 1 });
    const r = await mettreAEcartBrouillonAssistantAction({ id: ID, attenduRevision: 4 });
    expect(r).toEqual({ data: { id: ID } });
    const arg = m.updateMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({ id: ID, createdByAdminId: ADMIN, revision: 4 });
    expect(arg.data.statut).toBe("a_l_ecart");
    expect(m.del).not.toHaveBeenCalled();
    expect(m.delMany).not.toHaveBeenCalled();
  });

  it("autre admin → introuvable, rien d'écrit", async () => {
    m.findFirst.mockResolvedValue(null);
    const r = await mettreAEcartBrouillonAssistantAction({ id: ID, attenduRevision: 4 });
    expect(r).toEqual({ error: "Brouillon introuvable" });
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("révision périmée → refus, rien d'écrit de plus", async () => {
    m.findFirst.mockResolvedValue({ id: ID, statut: "en_cours" });
    m.updateMany.mockResolvedValue({ count: 0 });
    const r = await mettreAEcartBrouillonAssistantAction({ id: ID, attenduRevision: 1 });
    expect("error" in r).toBe(true);
  });

  it("déjà à l'écart → succès sans réécrire", async () => {
    m.findFirst.mockResolvedValue({ id: ID, statut: "a_l_ecart" });
    const r = await mettreAEcartBrouillonAssistantAction({ id: ID, attenduRevision: 1 });
    expect(r).toEqual({ data: { id: ID } });
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("numérotation en cours → refus", async () => {
    m.findFirst.mockResolvedValue({ id: ID, statut: "numerotation" });
    const r = await mettreAEcartBrouillonAssistantAction({ id: ID, attenduRevision: 1 });
    expect("error" in r).toBe(true);
    expect(m.updateMany).not.toHaveBeenCalled();
  });
});
