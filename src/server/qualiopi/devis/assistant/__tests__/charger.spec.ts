import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const m = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(async () => []),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  });
  return {
    devis: m(),
    devisAssistantBrouillon: m(),
    venteBrouillon: m(),
    devisTexteBibliotheque: m(),
    $transaction: vi.fn(),
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
const aide = vi.hoisted(() => vi.fn());
vi.mock("@/features/dossier-client/aide-du-projet", () => ({ chargerAideDuProjet: aide }));
vi.mock("@/server/qualiopi/crm/clients", () => ({
  listClients: vi.fn(async () => [
    {
      id: "11111111-1111-4111-8111-111111111111",
      numero: "CLI-1",
      raisonSociale: "SCI Invest Sun",
    },
    { id: "22222222-2222-4222-8222-222222222222", numero: "CLI-2", raisonSociale: "Autre" },
  ]),
}));
vi.mock("@/server/qualiopi/offres/offres", () => ({
  listOffres: vi.fn(async () => [
    {
      offre: { tierId: null, code: "AXI-OFF-001", titreFr: "Offre" },
      prixLabelFr: "à partir de 1 €",
      prixHtEur: 12.34,
      noteDevisFr: null,
    },
  ]),
}));
const formules = vi.hoisted(() => vi.fn());
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({ formulesActives: formules }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async (k: string) => (k === "regime_tva" ? "assujetti" : 20)),
}));

import { chargerAssistantDevis, type ContexteAssistant } from "../charger";
import { payloadVide } from "../payload";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT = "11111111-1111-4111-8111-111111111111";
const DEVIS = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const BROUILLON = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RENCONTRE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function charge(i: Partial<Parameters<typeof chargerAssistantDevis>[0]> = {}) {
  const r = await chargerAssistantDevis({ adminId: ADMIN, ...i });
  if ("redirection" in r) throw new Error("redirection " + r.redirection);
  return r as ContexteAssistant;
}
function aucuneEcriture() {
  for (const t of [
    db.devis,
    db.devisAssistantBrouillon,
    db.venteBrouillon,
    db.devisTexteBibliotheque,
  ])
    for (const m of ["create", "update", "updateMany", "upsert", "delete"] as const)
      expect(t[m], m).not.toHaveBeenCalled();
  expect(db.$transaction).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  formules.mockResolvedValue(true);
  aide.mockResolvedValue({ projetId: null, aide: null });
  db.devis.findUnique.mockResolvedValue(null);
  db.devisAssistantBrouillon.findFirst.mockResolvedValue(null);
  db.venteBrouillon.findFirst.mockResolvedValue(null);
});

describe("chargerAssistantDevis", () => {
  it("ouvert VIDE par défaut : aucun prix, aucun modèle, aucun client", async () => {
    const c = await charge();
    expect(c.payloadInitial).toEqual(payloadVide(20));
    expect(c.brouillon).toBeNull();
    expect(c.clients).toHaveLength(2);
    expect(c.offres[0]).toMatchObject({ code: "AXI-OFF-001", prixHtCents: 1234 });
    expect(c.regimeTva).toBe("assujetti");
    expect(c.tauxStandard).toBe(20);
    aucuneEcriture();
  });

  it("clientId retenu seulement s'il existe", async () => {
    expect((await charge({ clientId: CLIENT })).payloadInitial.clientId).toBe(CLIENT);
    expect(
      (await charge({ clientId: "99999999-9999-4999-8999-999999999999" })).payloadInitial.clientId,
    ).toBeNull();
    expect((await charge({ clientId: "pas-un-uuid" })).payloadInitial.clientId).toBeNull();
  });

  it("textes par défaut de la bibliothèque seulement si l'interrupteur formules est allumé", async () => {
    db.devisTexteBibliotheque.findMany.mockResolvedValue([
      { id: "t1", version: 3, texte: "Texte" },
    ] as never);
    expect((await charge()).textesParDefaut).toEqual([
      { bibliothequeId: "t1", version: "3", texte: "Texte", actif: true },
    ]);
    formules.mockResolvedValue(false);
    const c = await charge();
    expect(c.textesParDefaut).toEqual([]);
    expect(c.formulesActives).toBe(false);
  });

  it("?modele inconnu ignoré ; connu appliqué (structure, aucun prix)", async () => {
    expect((await charge({ modele: "nimporte" })).payloadInitial.modeleId).toBeNull();
    const c = await charge({ modele: "site_web" });
    expect(c.payloadInitial.modeleId).toBe("site_web");
    expect(c.payloadInitial.typeDevis).toBe("formules");
    expect(c.payloadInitial.formules.achat.maintenance.mensuelEur).toBe("");
  });

  it("brouillon d'un autre admin ignoré (requête bornée au propriétaire)", async () => {
    db.devisAssistantBrouillon.findFirst.mockResolvedValue(null);
    const c = await charge({ brouillonId: BROUILLON });
    expect(c.brouillon).toBeNull();
    expect(c.payloadInitial).toEqual(payloadVide(20));
    expect(db.devisAssistantBrouillon.findFirst.mock.calls[0]![0].where).toEqual({
      id: BROUILLON,
      createdByAdminId: ADMIN,
    });
  });

  it("brouillon à soi : payload relu, révision renvoyée", async () => {
    const p = payloadVide(20);
    p.refClient = "BC-9";
    db.devisAssistantBrouillon.findFirst.mockResolvedValue({
      id: BROUILLON,
      revision: 4,
      payload: JSON.parse(JSON.stringify(p)),
    });
    const c = await charge({ brouillonId: BROUILLON });
    expect(c.brouillon).toEqual({ id: BROUILLON, revision: 4 });
    expect(c.payloadInitial.refClient).toBe("BC-9");
  });

  it("brouillon illisible : ouvert vide", async () => {
    db.devisAssistantBrouillon.findFirst.mockResolvedValue({
      id: BROUILLON,
      revision: 1,
      payload: { v: 9 },
    });
    const c = await charge({ brouillonId: BROUILLON });
    expect(c.brouillon).toBeNull();
    expect(c.payloadInitial).toEqual(payloadVide(20));
  });

  it("?devis non brouillon → redirection vers sa fiche", async () => {
    for (const statut of ["envoye", "accepte", "refuse", "expire", "transforme"]) {
      db.devis.findUnique.mockResolvedValue({ id: DEVIS, statut });
      expect(await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })).toEqual({
        redirection: `/qualiopi/devis/${DEVIS}`,
      });
    }
    aucuneEcriture();
  });

  it("?devis brouillon classique → hydratation SANS écriture", async () => {
    db.devis.findUnique.mockResolvedValue({
      id: DEVIS,
      statut: "brouillon",
      clientId: CLIENT,
      refClient: "REF",
      activite: "formation",
      dateValidite: new Date("2026-12-01T00:00:00Z"),
      updatedAt: new Date("2026-11-08T09:00:00Z"),
      offre: null,
      lignes: [{ designation: "Formation", quantite: 1, prixUnitaireHtCents: 150000 }],
    });
    const c = await charge({ devisId: DEVIS });
    expect(c.payloadInitial).toMatchObject({
      clientId: CLIENT,
      typeDevis: "classique",
      refClient: "REF",
      dateValidite: "2026-12-01",
      sync: { devisId: DEVIS, devisMajLe: "2026-11-08T09:00:00.000Z" },
    });
    expect(c.payloadInitial.lignesClassiques[0]).toMatchObject({
      designation: "Formation",
      prixEur: "1500",
    });
    expect(c.brouillon).toBeNull();
    aucuneEcriture();
  });

  it("?devis inexistant : ouvert vide", async () => {
    expect((await charge({ devisId: DEVIS })).payloadInitial).toEqual(payloadVide(20));
  });

  it("venteBrouillonId d'un autre admin ignoré, du sien retenu", async () => {
    const V = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    expect((await charge({ venteBrouillonId: V })).payloadInitial.venteBrouillonId).toBeNull();
    expect(db.venteBrouillon.findFirst.mock.calls[0]![0].where).toEqual({
      id: V,
      createdByAdminId: ADMIN,
    });
    db.venteBrouillon.findFirst.mockResolvedValue({ id: V });
    expect((await charge({ venteBrouillonId: V })).payloadInitial.venteBrouillonId).toBe(V);
  });

  it("aide du projet : client reconnu transmis, projet retenu et rencontre conservés", async () => {
    const PROJET = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    aide.mockResolvedValue({ projetId: PROJET, aide: { titre: "P", aide: {} } });
    const c = await charge({
      clientId: CLIENT,
      projetId: PROJET,
      rencontreId: RENCONTRE,
      role: "super_admin",
    });
    expect(aide).toHaveBeenCalledWith({ role: "super_admin", clientId: CLIENT, projetId: PROJET });
    expect(c.payloadInitial.projetId).toBe(PROJET);
    expect(c.rencontreId).toBe(RENCONTRE);
    expect(c.aide).toMatchObject({ titre: "P" });
    // client inconnu : aucune lecture du dossier pour lui
    await charge({ clientId: "99999999-9999-4999-8999-999999999999", projetId: PROJET });
    expect(aide).toHaveBeenLastCalledWith({
      role: undefined,
      clientId: undefined,
      projetId: PROJET,
    });
  });

  it("?rencontre invalide ignoré", async () => {
    expect((await charge({ rencontreId: "x" })).rencontreId).toBeNull();
  });
});

describe("chargerAssistantDevis — brouillon lié, brouillon écarté, refus d'ouverture", () => {
  const devisBrouillon = (extra: Record<string, unknown> = {}) => ({
    id: DEVIS,
    statut: "brouillon",
    clientId: CLIENT,
    refClient: "REF-DEVIS",
    activite: "formation",
    dateValidite: null,
    updatedAt: new Date("2026-11-08T09:00:00Z"),
    offre: null,
    lignes: [{ designation: "Formation", quantite: 1, prixUnitaireHtCents: 150000 }],
    financementSuggere: null,
    montantOpcoEstimeCents: null,
    ...extra,
  });

  it("?devis déjà lié à un brouillon à soi : SON contenu est relu, pas le devis", async () => {
    db.devis.findUnique.mockResolvedValue(devisBrouillon());
    const p = payloadVide(20);
    p.refClient = "REF-BROUILLON";
    p.recit.intitule = "Intitulé du brouillon";
    db.devisAssistantBrouillon.findFirst.mockResolvedValue({
      id: BROUILLON,
      revision: 7,
      payload: JSON.parse(JSON.stringify(p)),
    });
    const c = await charge({ devisId: DEVIS });
    expect(c.brouillon).toEqual({ id: BROUILLON, revision: 7 });
    expect(c.payloadInitial.refClient).toBe("REF-BROUILLON");
    expect(c.payloadInitial.recit.intitule).toBe("Intitulé du brouillon");
    aucuneEcriture();
  });

  it("?devis lié à un brouillon illisible : repli sur l'hydratation du devis, lien gardé", async () => {
    db.devis.findUnique.mockResolvedValue(devisBrouillon());
    db.devisAssistantBrouillon.findFirst.mockResolvedValue({
      id: BROUILLON,
      revision: 2,
      payload: { v: 9 },
    });
    const c = await charge({ devisId: DEVIS });
    expect(c.payloadInitial.refClient).toBe("REF-DEVIS");
    expect(c.brouillon).toEqual({ id: BROUILLON, revision: 2 });
  });

  it("?brouillon a_l_ecart : jamais rouvert, redirection vers un assistant vide", async () => {
    db.devisAssistantBrouillon.findFirst.mockResolvedValue({
      id: BROUILLON,
      revision: 1,
      payload: JSON.parse(JSON.stringify(payloadVide(20))),
      statut: "a_l_ecart",
      devisId: null,
    });
    expect(await chargerAssistantDevis({ adminId: ADMIN, brouillonId: BROUILLON })).toEqual({
      redirection: "/qualiopi/devis/new",
    });
    aucuneEcriture();
  });

  it("?brouillon lié à un devis déjà envoyé : redirection vers la fiche", async () => {
    db.devisAssistantBrouillon.findFirst.mockResolvedValue({
      id: BROUILLON,
      revision: 1,
      payload: JSON.parse(JSON.stringify(payloadVide(20))),
      statut: "en_cours",
      devisId: DEVIS,
    });
    db.devis.findUnique.mockResolvedValue({ id: DEVIS, statut: "envoye" });
    expect(await chargerAssistantDevis({ adminId: ADMIN, brouillonId: BROUILLON })).toEqual({
      redirection: `/qualiopi/devis/${DEVIS}`,
    });
    aucuneEcriture();
  });

  it("?brouillon lié à un devis encore brouillon : ouvert normalement", async () => {
    db.devisAssistantBrouillon.findFirst.mockResolvedValue({
      id: BROUILLON,
      revision: 3,
      payload: JSON.parse(JSON.stringify(payloadVide(20))),
      statut: "en_cours",
      devisId: DEVIS,
    });
    db.devis.findUnique.mockResolvedValue({ id: DEVIS, statut: "brouillon" });
    const c = await charge({ brouillonId: BROUILLON });
    expect(c.brouillon).toEqual({ id: BROUILLON, revision: 3 });
  });

  it("?devis classique OPCO, offre illisible ou TVA non standard : refus, renvoi vers la fiche avec message", async () => {
    for (const extra of [
      { financementSuggere: "opco" },
      { montantOpcoEstimeCents: 5000 },
      { offre: { v: 99 } },
      { lignes: [{ designation: "x", quantite: 1, prixUnitaireHtCents: 1, tauxTvaPercent: 10 }] },
    ]) {
      db.devis.findUnique.mockResolvedValue(devisBrouillon(extra));
      const r = await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS });
      expect(r, JSON.stringify(extra)).toMatchObject({ redirection: `/qualiopi/devis/${DEVIS}` });
      expect((r as { message?: string }).message).toMatch(/ne peut pas être rouvert/);
    }
    aucuneEcriture();
  });

  it("?devis lié à un brouillon a_l_ecart : jamais relu (requête filtrée), hydratation du devis", async () => {
    db.devis.findUnique.mockResolvedValue(devisBrouillon());
    db.devisAssistantBrouillon.findFirst.mockImplementation(
      async ({ where }: { where: { statut?: { not: string } } }) =>
        where.statut?.not === "a_l_ecart"
          ? null
          : { id: BROUILLON, revision: 9, payload: JSON.parse(JSON.stringify(payloadVide(20))) },
    );
    const c = await charge({ devisId: DEVIS });
    expect(c.brouillon).toBeNull();
    expect(c.payloadInitial.refClient).toBe("REF-DEVIS");
    expect(db.devisAssistantBrouillon.findFirst.mock.calls[0]![0].where).toMatchObject({
      statut: { not: "a_l_ecart" },
    });
  });

  it("?devis classique OPCO avec brouillon lié lisible : rouvert (contenu du brouillon)", async () => {
    db.devis.findUnique.mockResolvedValue(devisBrouillon({ financementSuggere: "opco" }));
    const p = payloadVide(20);
    p.refClient = "REF-BROUILLON";
    db.devisAssistantBrouillon.findFirst.mockResolvedValue({
      id: BROUILLON,
      revision: 4,
      payload: JSON.parse(JSON.stringify(p)),
    });
    const c = await charge({ devisId: DEVIS });
    expect(c.brouillon).toEqual({ id: BROUILLON, revision: 4 });
    expect(c.payloadInitial.refClient).toBe("REF-BROUILLON");
  });

  it("?devis avec brouillon lié lisible : offre illisible ou TVA non standard restent REFUSÉES (seul le motif OPCO est levé)", async () => {
    const p = payloadVide(20);
    p.refClient = "REF-BROUILLON";
    db.devisAssistantBrouillon.findFirst.mockResolvedValue({
      id: BROUILLON,
      revision: 4,
      payload: JSON.parse(JSON.stringify(p)),
    });
    for (const extra of [
      { offre: { v: 99 } },
      { lignes: [{ designation: "x", quantite: 1, prixUnitaireHtCents: 1, tauxTvaPercent: 10 }] },
    ]) {
      db.devis.findUnique.mockResolvedValue(devisBrouillon(extra));
      const r = await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS });
      expect(r, JSON.stringify(extra)).toMatchObject({ redirection: `/qualiopi/devis/${DEVIS}` });
      expect((r as { message?: string }).message).toMatch(/ne peut pas être rouvert/);
    }
    aucuneEcriture();
  });

  it("?devis OPCO + ligne à 10 % + brouillon lié lisible : refus (redirection vers la fiche)", async () => {
    db.devisAssistantBrouillon.findFirst.mockResolvedValue({
      id: BROUILLON,
      revision: 4,
      payload: JSON.parse(JSON.stringify(payloadVide(20))),
    });
    db.devis.findUnique.mockResolvedValue(
      devisBrouillon({
        financementSuggere: "opco",
        lignes: [{ designation: "x", quantite: 1, prixUnitaireHtCents: 1, tauxTvaPercent: 10 }],
      }),
    );
    const r = await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS });
    expect(r).toMatchObject({ redirection: `/qualiopi/devis/${DEVIS}` });
    expect((r as { message?: string }).message).toMatch(/ne peut pas être rouvert/);
    aucuneEcriture();
  });

  it("?devis classique OPCO sans brouillon lisible (absent ou illisible) : refus", async () => {
    db.devis.findUnique.mockResolvedValue(devisBrouillon({ financementSuggere: "opco" }));
    for (const lie of [null, { id: BROUILLON, revision: 1, payload: { v: 9 } }]) {
      db.devisAssistantBrouillon.findFirst.mockResolvedValue(lie);
      const r = await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS });
      expect(r).toMatchObject({ redirection: `/qualiopi/devis/${DEVIS}` });
      expect((r as { message?: string }).message).toMatch(/ne peut pas être rouvert/);
    }
  });
});
