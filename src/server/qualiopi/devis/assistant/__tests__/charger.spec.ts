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
    client: m(),
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
      type: "entreprise",
      adresse: "1 rue du Test",
      contactNom: "Léa Martin",
      contactEmail: "lea@example.test",
      contactCivilite: "mme",
      contactPrenom: "Léa",
      contactNomFamille: "Martin",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      numero: "CLI-2",
      raisonSociale: "Autre",
      type: "particulier",
    },
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
import { lirePayload, payloadVide, type PayloadAssistantV1 } from "../payload";
import { etatInitial } from "@/components/admin/qualiopi/assistant-devis/etat";
import { etatVersPayload } from "@/components/admin/qualiopi/assistant-devis/vers-payload";

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
  db.client.findMany.mockResolvedValue([]);
  db.devisTexteBibliotheque.findMany.mockResolvedValue([]);
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

  it("chaque client porte type, adresse, contact, e-mail, salutation et fiche d'essai", async () => {
    db.client.findMany.mockResolvedValue([{ id: "22222222-2222-4222-8222-222222222222" }] as never);
    const [a, b] = (await charge()).clients;
    expect(a).toMatchObject({
      type: "entreprise",
      adresse: "1 rue du Test",
      contactNom: "Léa Martin",
      email: "lea@example.test",
      ficheEssai: false,
    });
    expect(a!.salutation).toMatch(/^Bonjour/);
    expect(b).toMatchObject({
      type: "particulier",
      adresse: null,
      contactNom: null,
      email: null,
      ficheEssai: true,
    });
    expect(db.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { testInterne: { isNot: null } } }),
    );
  });

  it("bibliothèque : validés non archivés seulement, achat → A, abonnement → B, avantage / à savoir", async () => {
    db.devisTexteBibliotheque.findMany.mockResolvedValue([
      { formule: "achat", nature: "avantage", texte: "a1" },
      { formule: "achat", nature: "inconvenient", texte: "a2" },
      { formule: "abonnement", nature: "avantage", texte: "b1" },
      { formule: "abonnement", nature: "inconvenient", texte: "b2" },
      { formule: "commun", nature: "clause", texte: "c1" },
      { formule: "achat", nature: "prerequis", texte: "p1" },
    ] as never);
    const c = await charge();
    expect(c.bibliotheque).toEqual({
      avantages: { A: ["a1"], B: ["b1"] },
      aSavoir: { A: ["a2"], B: ["b2"] },
      delais: "",
      garantie: "",
      plafond: "",
    });
    expect(db.devisTexteBibliotheque.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { archiveAt: null, aValider: false } }),
    );
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

/** Payload tel que l'écran l'écrit (source « ecran ») : seul celui-là se rouvre. */
function payloadEcran(clientId = CLIENT, refClient = "REF-BROUILLON"): PayloadAssistantV1 {
  const etat = etatInitial({
    defaultClientId: clientId,
    validiteParDefaut: "",
    formulesActives: true,
  });
  etat.intitule = "Intitulé du brouillon";
  const p = etatVersPayload(etat, 1, { tvaStandardPct: 20, textes: [], refClient });
  // Ce que la sauvegarde persiste : la sortie normalisée de `lirePayload`, jamais le brut de l'écran.
  const lu = lirePayload(JSON.parse(JSON.stringify(p)));
  if (!lu.ok) throw new Error(lu.error);
  return JSON.parse(JSON.stringify(lu.payload)) as PayloadAssistantV1;
}

describe("chargerAssistantDevis — l'assistant ne rouvre que ses propres devis", () => {
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
  const lie = (extra: Record<string, unknown> = {}) => ({
    id: BROUILLON,
    revision: 7,
    payload: payloadEcran(),
    statut: "en_cours",
    createdByAdminId: ADMIN,
    clientId: CLIENT,
    ...extra,
  });
  const FICHE = `/qualiopi/devis/${DEVIS}`;
  // Devis CLASSIQUE lié : tout refus mène à l'écran de correction (jamais à la fiche → cul-de-sac).
  const CORRIGER = `${FICHE}/corriger`;
  const MSG_ILLISIBLE =
    "Le brouillon d'assistant de ce devis est illisible ; rien n'a été modifié.";

  beforeEach(() => {
    db.devis.findUnique.mockResolvedValue(devisBrouillon());
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(null);
  });

  it("devis inconnu : carte « introuvable », lien vers la liste", async () => {
    db.devis.findUnique.mockResolvedValue(null);
    expect(await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })).toEqual({
      redirection: "/qualiopi/devis",
      message: "Devis introuvable.",
      libelleLien: "Retour à la liste des devis",
    });
    aucuneEcriture();
  });

  it("statut ≠ brouillon : la fiche, sans lire le brouillon", async () => {
    for (const statut of ["envoye", "accepte", "refuse", "expire", "transforme"]) {
      db.devis.findUnique.mockResolvedValue({ id: DEVIS, statut });
      expect(await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })).toEqual({
        redirection: FICHE,
      });
    }
    expect(db.devisAssistantBrouillon.findUnique).not.toHaveBeenCalled();
    aucuneEcriture();
  });

  it("le brouillon lié est lu SANS filtre de compte, par devisId", async () => {
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(lie());
    await charge({ devisId: DEVIS });
    expect(db.devisAssistantBrouillon.findUnique.mock.calls[0]![0].where).toEqual({
      devisId: DEVIS,
    });
  });

  it("aucun brouillon lié, devis classique (offre nulle) : renvoi vers /corriger, message clair", async () => {
    expect(await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })).toEqual({
      redirection: `${FICHE}/corriger`,
      message:
        "Ce devis a été préparé sans l'assistant : corrigez-le depuis son écran de correction.",
      libelleLien: "Corriger le brouillon",
    });
    aucuneEcriture();
  });

  it("aucun brouillon lié, devis à formules : la fiche, jamais /modifier", async () => {
    db.devis.findUnique.mockResolvedValue(devisBrouillon({ offre: { v: 1 } }));
    const r = await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS });
    expect(r).toEqual({
      redirection: FICHE,
      message: "Ce devis a été préparé sans l'assistant : modifiez-le depuis sa fiche.",
      libelleLien: "Ouvrir la fiche du devis",
    });
    expect((r as { redirection: string }).redirection).not.toMatch(/modifier/);
    aucuneEcriture();
  });

  it("brouillon d'assistant mis à l'écart : la fiche", async () => {
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(lie({ statut: "a_l_ecart" }));
    expect(await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })).toEqual({
      redirection: CORRIGER,
      message: "Le brouillon d'assistant de ce devis a été mis à l'écart.",
      libelleLien: "Corriger le brouillon",
    });
    aucuneEcriture();
  });

  it("brouillon d'un autre compte : la fiche, aucune reprise de propriété", async () => {
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(
      lie({ createdByAdminId: "99999999-9999-4999-8999-999999999999" }),
    );
    expect(await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })).toEqual({
      redirection: CORRIGER,
      message:
        "Ce devis a été préparé dans l'assistant par un autre compte : seul ce compte peut le rouvrir.",
      libelleLien: "Corriger le brouillon",
    });
    aucuneEcriture();
  });

  it("payload illisible (lirePayload en échec) : la fiche, l'assistant n'est jamais monté", async () => {
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(lie({ payload: { v: 9 } }));
    expect(await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })).toEqual({
      redirection: CORRIGER,
      message: MSG_ILLISIBLE,
      libelleLien: "Corriger le brouillon",
    });
    aucuneEcriture();
  });

  it("payload lisible mais sans état d'écran (source « payload ») : la fiche", async () => {
    const p = JSON.parse(JSON.stringify(payloadVide(20)));
    p.clientId = CLIENT;
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(lie({ payload: p }));
    expect(await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })).toEqual({
      redirection: CORRIGER,
      message: MSG_ILLISIBLE,
      libelleLien: "Corriger le brouillon",
    });
    aucuneEcriture();
  });

  it("client du brouillon ≠ client du devis (payload, état d'écran ou colonne) : la fiche", async () => {
    const AUTRE = "22222222-2222-4222-8222-222222222222";
    const autrePayload = payloadEcran(AUTRE);
    const mixte = payloadEcran(CLIENT);
    mixte.clientId = AUTRE; // payload et état d'écran divergent
    const cas = [
      lie({ payload: autrePayload, clientId: AUTRE }),
      lie({ payload: mixte }),
      lie({ clientId: AUTRE }),
    ];
    for (const c of cas) {
      db.devisAssistantBrouillon.findUnique.mockResolvedValue(c);
      expect(await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })).toEqual({
        redirection: CORRIGER,
        message: "Le client du brouillon ne correspond pas à celui du devis.",
        libelleLien: "Corriger le brouillon",
      });
    }
    aucuneEcriture();
  });

  it("offre illisible ou TVA non standard restent REFUSÉES, même avec un brouillon lisible", async () => {
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(lie());
    for (const extra of [
      { offre: { v: 99 } },
      { lignes: [{ designation: "x", quantite: 1, prixUnitaireHtCents: 1, tauxTvaPercent: 10 }] },
    ]) {
      db.devis.findUnique.mockResolvedValue(devisBrouillon(extra));
      const r = await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS });
      // Offre non nulle (à formules) → éditeur d'avant ; classique (TVA) → écran de correction.
      expect(r, JSON.stringify(extra)).toMatchObject(
        "offre" in extra
          ? {
              redirection: `${FICHE}/modifier?sans-assistant=1`,
              libelleLien: "Modifier sans l'assistant",
            }
          : { redirection: CORRIGER, libelleLien: "Corriger le brouillon" },
      );
      expect((r as { message?: string }).message).toMatch(/ne peut pas être rouvert/);
    }
    aucuneEcriture();
  });

  it("CONTRE-TÉMOIN : devis d'assistant du même compte → rouvert, payloadInitial strictement égal au payload stocké", async () => {
    const stocke = payloadEcran();
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(lie({ payload: stocke }));
    const c = await charge({ devisId: DEVIS });
    expect(c.brouillon).toEqual({ id: BROUILLON, revision: 7 });
    expect(c.payloadInitial).toEqual(stocke);
    expect(c.payloadInitial.refClient).toBe("REF-BROUILLON");
    aucuneEcriture();
  });

  it("CONTRE-TÉMOIN : un devis d'assistant « OPCO » se rouvre avec le contenu du brouillon (le motif OPCO est levé)", async () => {
    const stocke = payloadEcran();
    db.devis.findUnique.mockResolvedValue(devisBrouillon({ financementSuggere: "opco" }));
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(lie({ payload: stocke }));
    const c = await charge({ devisId: DEVIS });
    expect(c.payloadInitial).toEqual(stocke);
  });

  it("M3 — devis à jour (updatedAt = sync.devisMajLe) : l'assistant s'ouvre", async () => {
    const p = payloadEcran();
    p.sync = { devisId: DEVIS, devisMajLe: "2026-11-08T09:00:00.000Z" };
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(lie({ payload: p }));
    const c = await charge({ devisId: DEVIS });
    expect(c.brouillon).toEqual({ id: BROUILLON, revision: 7 });
    aucuneEcriture();
  });

  it("M3 — devis modifié hors de l'assistant : carte vers la fiche, aucune écriture", async () => {
    const p = payloadEcran();
    p.sync = { devisId: DEVIS, devisMajLe: "2026-11-07T09:00:00.000Z" };
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(lie({ payload: p }));
    expect(await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })).toEqual({
      redirection: CORRIGER,
      message:
        "Ce devis a été modifié hors de l'assistant depuis son dernier enregistrement ici : corrigez-le depuis son écran de correction.",
      libelleLien: "Corriger le brouillon",
    });
    aucuneEcriture();
  });

  it("M3 — devis à formules périmé : modifier?sans-assistant=1, jamais la fiche", async () => {
    const p = payloadEcran();
    p.sync = { devisId: DEVIS, devisMajLe: "2026-11-07T09:00:00.000Z" };
    db.devis.findUnique.mockResolvedValue(devisBrouillon({ offre: { v: 1 } }));
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(lie({ payload: p }));
    expect(await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })).toMatchObject({
      redirection: `${FICHE}/modifier?sans-assistant=1`,
      libelleLien: "Modifier sans l'assistant",
    });
    aucuneEcriture();
  });

  it("devis à formules, brouillon lié d'un autre compte : modifier?sans-assistant=1", async () => {
    db.devis.findUnique.mockResolvedValue(devisBrouillon({ offre: { v: 1 } }));
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(
      lie({ createdByAdminId: "99999999-9999-4999-8999-999999999999" }),
    );
    expect(await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })).toMatchObject({
      redirection: `${FICHE}/modifier?sans-assistant=1`,
      libelleLien: "Modifier sans l'assistant",
    });
  });

  it("M3 — sync.devisMajLe nul : l'assistant s'ouvre (le finaliseur garde son verrou)", async () => {
    const p = payloadEcran();
    p.sync = { devisId: DEVIS, devisMajLe: null };
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(lie({ payload: p }));
    const c = await charge({ devisId: DEVIS });
    expect(c.brouillon).toEqual({ id: BROUILLON, revision: 7 });
  });

  it("aucun cul-de-sac : pour chaque refus d'un devis lié, la cible n'est ni ?devis= ni la fiche", async () => {
    const perime = payloadEcran();
    perime.sync = { devisId: DEVIS, devisMajLe: "2026-11-07T09:00:00.000Z" };
    const cas = [
      lie({ statut: "a_l_ecart" }),
      lie({ createdByAdminId: "99999999-9999-4999-8999-999999999999" }),
      lie({ payload: { v: 9 } }),
      lie({ clientId: "22222222-2222-4222-8222-222222222222" }),
      lie({ payload: perime }),
    ];
    for (const offre of [null, { v: 1 }]) {
      for (const c of cas) {
        db.devis.findUnique.mockResolvedValue(devisBrouillon({ offre }));
        db.devisAssistantBrouillon.findUnique.mockResolvedValue(c);
        const r = (await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })) as {
          redirection: string;
        };
        expect(r.redirection).not.toBe(FICHE);
        expect(r.redirection).not.toMatch(/new\?devis=/);
        expect(r.redirection).toBe(
          offre === null ? CORRIGER : `${FICHE}/modifier?sans-assistant=1`,
        );
      }
    }
    aucuneEcriture();
  });

  it("formules ÉTEINTES : un refus d'un devis à formules lié mène à la fiche, jamais à /modifier (boucle)", async () => {
    formules.mockResolvedValue(false);
    db.devis.findUnique.mockResolvedValue(devisBrouillon({ offre: { v: 1 } }));
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(
      lie({ createdByAdminId: "99999999-9999-4999-8999-999999999999" }),
    );
    const r = (await chargerAssistantDevis({ adminId: ADMIN, devisId: DEVIS })) as {
      redirection: string;
    };
    expect(r.redirection).toBe(FICHE);
    expect(r.redirection).not.toMatch(/modifier|new\?devis=/);
    aucuneEcriture();
  });

  it("CONTRE-TÉMOIN : une fiche d'essai est respectée (le client reste dans la liste, marqué essai)", async () => {
    db.client.findMany.mockResolvedValue([{ id: CLIENT }] as never);
    db.devisAssistantBrouillon.findUnique.mockResolvedValue(lie());
    const c = await charge({ devisId: DEVIS });
    expect(c.clients.find((x) => x.id === CLIENT)?.ficheEssai).toBe(true);
    expect(c.payloadInitial.clientId).toBe(CLIENT);
  });
});

describe("chargerAssistantDevis — ?brouillon=", () => {
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

  const brouillonLie = () => ({
    id: BROUILLON,
    revision: 3,
    payload: JSON.parse(JSON.stringify(payloadVide(20))),
    statut: "en_cours",
    devisId: DEVIS,
  });

  it("?brouillon lié à un devis déjà envoyé : la fiche, avec un message", async () => {
    db.devisAssistantBrouillon.findFirst.mockResolvedValue(brouillonLie());
    db.devis.findUnique.mockResolvedValue({ id: DEVIS, statut: "envoye" });
    const r = await chargerAssistantDevis({ adminId: ADMIN, brouillonId: BROUILLON });
    expect(r).toMatchObject({ redirection: `/qualiopi/devis/${DEVIS}` });
    expect((r as { message?: string }).message).toBeTruthy();
    aucuneEcriture();
  });

  it("M1/M2 — ?brouillon lié à un devis encore brouillon : JAMAIS rouvert ici, renvoi vers ?devis= (gardes)", async () => {
    db.devisAssistantBrouillon.findFirst.mockResolvedValue(brouillonLie());
    db.devis.findUnique.mockResolvedValue({ id: DEVIS, statut: "brouillon" });
    expect(await chargerAssistantDevis({ adminId: ADMIN, brouillonId: BROUILLON })).toEqual({
      redirection: `/qualiopi/devis/new?devis=${DEVIS}`,
    });
    aucuneEcriture();
  });

  it("M1/M2 — ?brouillon lié, payload illisible : renvoi vers ?devis=, jamais un assistant vide", async () => {
    db.devisAssistantBrouillon.findFirst.mockResolvedValue({
      ...brouillonLie(),
      payload: { v: 9 },
    });
    db.devis.findUnique.mockResolvedValue({ id: DEVIS, statut: "brouillon" });
    const r = await chargerAssistantDevis({ adminId: ADMIN, brouillonId: BROUILLON });
    expect(r).toEqual({ redirection: `/qualiopi/devis/new?devis=${DEVIS}` });
  });

  it("M1/M2 — ?brouillon lié à un devis disparu : la liste, avec un message", async () => {
    db.devisAssistantBrouillon.findFirst.mockResolvedValue(brouillonLie());
    db.devis.findUnique.mockResolvedValue(null);
    const r = await chargerAssistantDevis({ adminId: ADMIN, brouillonId: BROUILLON });
    expect(r).toMatchObject({ redirection: "/qualiopi/devis", message: "Devis introuvable." });
  });

  it("CONTRE-TÉMOIN : ?brouillon NON lié (devisId nul) s'ouvre normalement", async () => {
    db.devisAssistantBrouillon.findFirst.mockResolvedValue({ ...brouillonLie(), devisId: null });
    const c = await charge({ brouillonId: BROUILLON });
    expect(c.brouillon).toEqual({ id: BROUILLON, revision: 3 });
  });

  it("aucune boucle : ?devis= ne renvoie jamais vers ?brouillon=", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/server/qualiopi/devis/assistant/charger.ts", "utf8");
    expect(src).not.toMatch(/redirection:\s*[`"'][^`"']*\?brouillon=/);
  });
});
