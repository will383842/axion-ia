/**
 * Fiche S08 — numérotation, mise à jour et envoi depuis l'assistant de devis. Prisma est simulé
 * par un faux à ÉTAT (la ligne du brouillon d'assistant vit en mémoire, `updateMany` interprète
 * les `where` réellement utilisés) : c'est ce qui permet de jouer le double clic, la reprise
 * d'un verrou expiré et la sauvegarde qui s'intercale pendant la numérotation.
 *
 * Les validations (`validerEtape`) et les conversions (`payloadVersCreation`) sont les VRAIES
 * (aucun mock) : l'action rejoue la conversion, elle ne croit pas l'écran.
 *
 * Mutations qui font rougir ces tests (essayées à la main) :
 *   - retirer `revision` du `where` du verrou → « révision périmée » et « rejeu » rougissent ;
 *   - retirer le test du statut `numerotation` frais → « deux appels simultanés » rougit ;
 *   - ne pas relâcher le verrou sur échec → « échec de création » rougit ;
 *   - appeler `create*` même quand `devisId` est posé → « déjà lié » rougit (2e numéro) ;
 *   - ne pas rejouer `validerEtape(4)` → « automatisation neuve » et « total 0 € » rougissent ;
 *   - appeler `sendDevisAction` avant la synchronisation → « ordre » rougit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Ligne = Record<string, unknown>;

const m = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  ecritures: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  executeRaw: vi.fn(),
  devisFindUnique: vi.fn(),
  clientFindUnique: vi.fn(),
  venteUpdateMany: vi.fn(),
  creerClassique: vi.fn(),
  creerFormules: vi.fn(),
  modifierClassique: vi.fn(),
  modifierFormules: vi.fn(),
  fixerValidite: vi.fn(),
  envoyer: vi.fn(),
  formulesActives: vi.fn(),
  projetOuvrable: vi.fn(),
  log: vi.fn(),
  admin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devisAssistantBrouillon: { findFirst: m.findFirst, updateMany: m.updateMany },
    devis: { findUnique: m.devisFindUnique },
    client: { findUnique: m.clientFindUnique },
    venteBrouillon: { updateMany: m.venteUpdateMany },
    $executeRaw: m.executeRaw,
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: m.admin,
  logQualiopiActivity: m.log,
}));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  createDevisAction: m.creerClassique,
  sendDevisAction: m.envoyer,
}));
vi.mock("@/server/actions/qualiopi/devis-formules", () => ({
  creerDevisFormulesAction: m.creerFormules,
  modifierDevisBrouillonAction: m.modifierFormules,
}));
vi.mock("@/server/actions/qualiopi/devis-classique-modifier", () => ({
  modifierDevisClassiqueBrouillonAction: m.modifierClassique,
  fixerValiditeDevisBrouillonAction: m.fixerValidite,
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: m.formulesActives,
}));
vi.mock("@/server/qualiopi/crm/devis-projet", () => ({
  projetOuvrableDuClient: m.projetOuvrable,
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async () => 20),
}));

import {
  numeroterDevisAssistantAction,
  envoyerDepuisAssistantAction,
} from "./devis-assistant-finaliser";
import { payloadVide, type PayloadAssistantV1 } from "@/server/qualiopi/devis/assistant/payload";

const ADMIN = "550e8400-e29b-41d4-a716-446655440010";
const AUTRE = "550e8400-e29b-41d4-a716-446655440011";
const ID = "550e8400-e29b-41d4-a716-446655440020";
const CLIENT = "550e8400-e29b-41d4-a716-446655440001";
const AUTRE_CLIENT = "550e8400-e29b-41d4-a716-446655440003";
const DEVIS = "550e8400-e29b-41d4-a716-446655440002";
const PROJET = "550e8400-e29b-41d4-a716-446655440050";
const VENTE = "550e8400-e29b-41d4-a716-446655440040";
const MAJ0 = new Date("2026-11-08T10:00:00.000Z");
const MAJ1 = new Date("2026-11-08T10:05:00.000Z");

function classique(): PayloadAssistantV1 {
  const p = payloadVide(20);
  p.clientId = CLIENT;
  p.activite = "formation";
  p.typeDevis = "classique";
  p.lignesClassiques = [
    { designation: "Formation", quantite: "2,3", prixEur: "123,45" },
    { designation: "Atelier", quantite: "1", prixEur: "2 400" },
  ];
  return p;
}

function formules(modele: "A" | "B" | "AB" = "AB"): PayloadAssistantV1 {
  const p = classique();
  p.activite = "implementation";
  p.typeDevis = "formules";
  p.formules.formules = { achat: modele !== "B", abonnement: modele !== "A" };
  p.formules.achat.maintenance.mensuelEur = "190,00";
  p.formules.abonnement.mensuelCatalogueEur = "199,99";
  p.formules.abonnement.periodes = [
    { mois: 1, remisePct: "0" },
    { mois: 12, remisePct: "5" },
  ];
  p.formules.abonnement.engagementMois = 12;
  p.formules.abonnement.indemniteTauxPct = "50";
  p.formules.abonnement.lignes = [
    { libelle: "Mise en service et adaptation", quantite: "1", prixEur: "1 900", tauxTvaPct: "20" },
  ];
  return p;
}

function poser(payload: PayloadAssistantV1, extra: Ligne = {}) {
  m.row = {
    id: ID,
    createdByAdminId: ADMIN,
    clientId: payload.clientId,
    devisId: null,
    venteBrouillonId: payload.venteBrouillonId,
    statut: "en_cours",
    revision: 4,
    verrouDepuis: null,
    etape: 4,
    payload,
    ...extra,
  };
}

/** Un `where` du code produit contre la ligne simulée (seuls les opérateurs réellement utilisés). */
function correspond(row: Ligne, where: Ligne): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Ligne[]).some((w) => correspond(row, w));
    const cur = row[k];
    if (v instanceof Date) return cur instanceof Date && cur.getTime() === v.getTime();
    if (v && typeof v === "object" && "lt" in v) {
      return cur instanceof Date && cur.getTime() < ((v as { lt: Date }).lt as Date).getTime();
    }
    if (v && typeof v === "object" && "not" in v) return cur !== (v as { not: unknown }).not;
    return cur === v;
  });
}

const devisBrouillon = (extra: Ligne = {}) => ({
  id: DEVIS,
  numero: "AXI-DEV-2026-007",
  statut: "brouillon",
  clientId: CLIENT,
  offreSha256: null,
  offre: null,
  updatedAt: MAJ1,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.row = null;
  m.ecritures = [];
  m.admin.mockResolvedValue({ userId: ADMIN, role: "super_admin" });
  m.formulesActives.mockResolvedValue(true);
  m.projetOuvrable.mockResolvedValue(false);
  m.clientFindUnique.mockResolvedValue({ type: "entreprise" });
  m.venteUpdateMany.mockResolvedValue({ count: 1 });
  m.findFirst.mockImplementation(async ({ where }: { where: Ligne }) =>
    m.row && correspond(m.row, where) ? { ...m.row } : null,
  );
  m.updateMany.mockImplementation(
    async ({ where, data }: { where: Ligne; data: Record<string, unknown> }) => {
      m.ecritures.push({ where, data });
      if (!m.row || !correspond(m.row, where)) return { count: 0 };
      for (const [k, v] of Object.entries(data)) {
        m.row[k] =
          v && typeof v === "object" && "increment" in v
            ? (m.row[k] as number) + (v as { increment: number }).increment
            : v;
      }
      return { count: 1 };
    },
  );
  // Dernier recours de `lier` : UPDATE brut atomique (payload.sync + lien), mêmes conditions.
  m.executeRaw.mockImplementation(async (_s: TemplateStringsArray, ...v: unknown[]) => {
    const [syncJson, devisId, id, adminId, verrou] = v as [string, string, string, string, Date];
    const where = { id, createdByAdminId: adminId, statut: "numerotation", verrouDepuis: verrou };
    if (!m.row || !correspond(m.row, where)) return 0;
    m.row["payload"] = { ...(m.row["payload"] as object), sync: JSON.parse(syncJson) };
    m.row["devisId"] = devisId;
    m.row["statut"] = "lie_au_devis";
    m.row["verrouDepuis"] = null;
    m.row["revision"] = (m.row["revision"] as number) + 1;
    return 1;
  });
  // Le devis « en base » : créé par l'action, relu pour sa date de dernière mise à jour.
  m.devisFindUnique.mockResolvedValue(devisBrouillon());
  m.creerClassique.mockResolvedValue({ data: { id: DEVIS, numero: "AXI-DEV-2026-007" } });
  m.creerFormules.mockResolvedValue({ data: { id: DEVIS, numero: "AXI-DEV-2026-007" } });
  m.modifierClassique.mockResolvedValue({ data: { id: DEVIS, majLe: MAJ1.toISOString() } });
  m.modifierFormules.mockResolvedValue({ data: { id: DEVIS } });
  m.fixerValidite.mockResolvedValue({ data: { majLe: MAJ1.toISOString() } });
  m.envoyer.mockResolvedValue({
    data: { id: DEVIS, emailEnvoye: true, signatureCreee: true },
  });
});

const num = (attenduRevision = 4) =>
  numeroterDevisAssistantAction({ brouillonId: ID, attenduRevision });

describe("numerotation — première fois", () => {
  it("classique : createDevisAction reçoit l'entrée attendue, aucune TVA transmise, brouillon lié", async () => {
    poser(classique());
    const r = await num();
    expect(r).toEqual({
      data: {
        devisId: DEVIS,
        numero: "AXI-DEV-2026-007",
        devisMajLe: MAJ1.toISOString(),
        revision: 5,
      },
    });
    expect(m.creerClassique).toHaveBeenCalledTimes(1);
    const entree = m.creerClassique.mock.calls[0]![0];
    expect(entree.clientId).toBe(CLIENT);
    expect(entree.lignes).toEqual([
      { designation: "Formation", quantite: 2.3, prixUnitaireHtCents: 12345 },
      { designation: "Atelier", quantite: 1, prixUnitaireHtCents: 240000 },
    ]);
    expect(JSON.stringify(entree)).not.toMatch(/tauxTva/);
    expect(m.creerFormules).not.toHaveBeenCalled();
    expect(m.row).toMatchObject({ devisId: DEVIS, statut: "lie_au_devis", verrouDepuis: null });
    expect((m.row!["payload"] as PayloadAssistantV1).sync).toEqual({
      devisId: DEVIS,
      devisMajLe: MAJ1.toISOString(),
    });
  });

  it.each(["A", "B", "AB"] as const)(
    "formules %s : creerDevisFormulesAction, jamais createDevisAction",
    async (mod) => {
      poser(formules(mod));
      const r = await num();
      expect("data" in r).toBe(true);
      expect(m.creerFormules).toHaveBeenCalledTimes(1);
      const entree = m.creerFormules.mock.calls[0]![0];
      expect(entree).toMatchObject({ clientId: CLIENT, activite: "implementation" });
      expect(entree.offre.achat !== undefined).toBe(mod !== "B");
      expect(entree.offre.abonnement !== undefined).toBe(mod !== "A");
      expect(m.creerClassique).not.toHaveBeenCalled();
    },
  );

  it("le numéro n'est pris que par l'appel à la porte existante (aucun devis.create ici)", async () => {
    poser(classique());
    await num();
    expect(m.creerClassique).toHaveBeenCalledTimes(1);
  });

  it("autre admin : introuvable, rien d'appelé", async () => {
    poser(classique(), { createdByAdminId: AUTRE });
    expect(await num()).toEqual({ error: "Brouillon introuvable" });
    expect(m.creerClassique).not.toHaveBeenCalled();
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("brouillon mis à l'écart : refusé", async () => {
    poser(classique(), { statut: "a_l_ecart" });
    const r = await num();
    expect("error" in r).toBe(true);
    expect(m.creerClassique).not.toHaveBeenCalled();
  });

  it("révision périmée : conflit, aucun verrou, aucune création", async () => {
    poser(classique(), { revision: 5 });
    const r = await num(4);
    expect(r).toMatchObject({ conflit: true, revisionActuelle: 5 });
    expect(m.creerClassique).not.toHaveBeenCalled();
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("construit pour build : stub.invalid → indisponible", async () => {
    const avant = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      expect(await num()).toEqual({ error: "Indisponible pendant le build" });
    } finally {
      if (avant === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = avant;
    }
  });
});

describe("numerotation — validations rejouées (le serveur ne croit pas l'écran)", () => {
  it("automatisation NEUVE refusée (D1 architecte) : aucun numéro", async () => {
    const p = formules("A");
    p.formules.automatisations = [
      { code: "OPT1", libelle: "Option", prixEur: "1 800", obligatoire: false },
    ] as never;
    poser(p);
    const r = await num();
    expect("error" in r).toBe(true);
    expect(m.creerFormules).not.toHaveBeenCalled();
    expect(m.creerClassique).not.toHaveBeenCalled();
    expect(m.row).toMatchObject({ statut: "en_cours" });
  });

  it("total à 0 € refusé avant tout numéro", async () => {
    const p = classique();
    p.lignesClassiques = [{ designation: "x", quantite: "1", prixEur: "0" }];
    poser(p);
    expect("error" in (await num())).toBe(true);
    expect(m.creerClassique).not.toHaveBeenCalled();
  });

  it("mensuel de B à 0 € refusé", async () => {
    const p = formules("B");
    p.formules.abonnement.mensuelCatalogueEur = "0";
    poser(p);
    expect("error" in (await num())).toBe(true);
    expect(m.creerFormules).not.toHaveBeenCalled();
  });

  it("formules pour un particulier refusées", async () => {
    m.clientFindUnique.mockResolvedValue({ type: "particulier" });
    poser(formules("A"));
    expect("error" in (await num())).toBe(true);
    expect(m.creerFormules).not.toHaveBeenCalled();
  });

  it("formules avec l'interrupteur éteint refusées", async () => {
    m.formulesActives.mockResolvedValue(false);
    poser(formules("A"));
    expect("error" in (await num())).toBe(true);
    expect(m.creerFormules).not.toHaveBeenCalled();
  });

  it("client introuvable en base : refusé", async () => {
    m.clientFindUnique.mockResolvedValue(null);
    poser(classique());
    expect("error" in (await num())).toBe(true);
    expect(m.creerClassique).not.toHaveBeenCalled();
  });

  it("validité hors bornes refusée", async () => {
    const p = classique();
    p.dateValidite = "2026-11-09";
    poser(p);
    expect("error" in (await num())).toBe(true);
    expect(m.creerClassique).not.toHaveBeenCalled();
  });
});

describe("numerotation — idempotence", () => {
  it("deux appels simultanés (double clic) : UN SEUL createDevisAction", async () => {
    poser(classique());
    m.creerClassique.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { data: { id: DEVIS, numero: "AXI-DEV-2026-007" } };
    });
    const [a, b] = await Promise.all([num(), num()]);
    expect(m.creerClassique).toHaveBeenCalledTimes(1);
    const reussites = [a, b].filter((x) => "data" in x);
    expect(reussites).toHaveLength(1);
    const echec = [a, b].find((x) => "error" in x) as { error: string };
    expect(echec.error).toBe("Numérotation déjà en cours");
  });

  it("rejeu après la fin (même révision attendue) : renvoie le devis existant, aucune écriture", async () => {
    poser(classique());
    const premiere = await num(4);
    expect("data" in premiere).toBe(true);
    const ecrituresAvant = m.ecritures.length;
    const rejeu = await num(4);
    expect(m.creerClassique).toHaveBeenCalledTimes(1);
    expect(m.modifierClassique).not.toHaveBeenCalled();
    expect(rejeu).toMatchObject({ data: { devisId: DEVIS, numero: "AXI-DEV-2026-007" } });
    expect(m.ecritures.length).toBe(ecrituresAvant);
  });

  it("deux onglets : l'onglet resté sur l'ancienne révision ne crée pas de second numéro", async () => {
    poser(classique());
    await num(4);
    // L'autre onglet a sauvé entre-temps (révision 7) ; l'onglet périmé retombe sur un conflit.
    m.row!["revision"] = 7;
    const r = await num(4);
    expect(r).toMatchObject({ conflit: true, revisionActuelle: 7 });
    expect(m.creerClassique).toHaveBeenCalledTimes(1);
  });

  it("sauvegarde entre la lecture et le verrou : le verrou refuse (révision), aucune création", async () => {
    poser(classique());
    m.clientFindUnique.mockImplementation(async () => {
      m.row!["revision"] = 5; // un autre onglet sauve juste après notre lecture
      return { type: "entreprise" };
    });
    const r = await num(4);
    expect(r).toMatchObject({ conflit: true, revisionActuelle: 5 });
    expect(m.creerClassique).not.toHaveBeenCalled();
    expect(m.row).toMatchObject({ statut: "en_cours", verrouDepuis: null });
  });

  it("verrou FRAIS (< 2 min) : refus, rien n'est créé", async () => {
    poser(classique(), {
      statut: "numerotation",
      verrouDepuis: new Date(Date.now() - 60_000),
    });
    expect(await num()).toEqual({ error: "Numérotation déjà en cours" });
    expect(m.creerClassique).not.toHaveBeenCalled();
  });

  it("verrou EXPIRÉ (> 2 min) : la numérotation reprend", async () => {
    poser(classique(), {
      statut: "numerotation",
      verrouDepuis: new Date(Date.now() - 3 * 60_000),
    });
    const r = await num();
    expect("data" in r).toBe(true);
    expect(m.creerClassique).toHaveBeenCalledTimes(1);
    expect(m.row).toMatchObject({ statut: "lie_au_devis", verrouDepuis: null });
  });

  it("échec de la création : le brouillon redevient en_cours, verrou levé, aucun lien", async () => {
    poser(classique());
    m.creerClassique.mockResolvedValue({ error: "Données invalides" });
    const r = await num();
    expect(r).toEqual({ error: "Données invalides" });
    expect(m.row).toMatchObject({ statut: "en_cours", verrouDepuis: null, devisId: null });
    expect(m.row!["revision"]).toBe(4);
  });

  it("exception pendant la création : verrou levé aussi", async () => {
    poser(classique());
    m.creerClassique.mockRejectedValue(new Error("base indisponible"));
    const r = await num();
    expect("error" in r).toBe(true);
    expect(m.row).toMatchObject({ statut: "en_cours", verrouDepuis: null, devisId: null });
  });

  it("sauvegarde intercalée pendant la numérotation (sauver accepte `numerotation` et incrémente) : le lien est posé quand même, la saisie plus récente est signalée", async () => {
    poser(classique());
    m.creerClassique.mockImplementation(async () => {
      // Ce que fait `sauverBrouillonAssistantAction` : statut ≠ a_l_ecart, révision + 1.
      m.row!["revision"] = (m.row!["revision"] as number) + 1;
      return { data: { id: DEVIS, numero: "AXI-DEV-2026-007" } };
    });
    const r = await num();
    expect(r).toMatchObject({
      data: { devisId: DEVIS, revision: 6, aRenumeroter: true },
    });
    expect(m.row).toMatchObject({ devisId: DEVIS, statut: "lie_au_devis", verrouDepuis: null });
  });

  it("S10 qui REJETTE après la création : le brouillon reste lié, un 2e appel ne recrée pas de numéro", async () => {
    const p = classique();
    p.dateValidite = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    poser(p);
    m.fixerValidite.mockRejectedValue(new Error("base indisponible"));
    const r = await num();
    expect(r).toMatchObject({ error: expect.stringContaining("AXI-DEV-2026-007") });
    expect(m.row).toMatchObject({ devisId: DEVIS, statut: "lie_au_devis", verrouDepuis: null });
    await num(m.row!["revision"] as number);
    expect(m.creerClassique).toHaveBeenCalledTimes(1);
  });

  it("3 sauvegardes intercalées (lier à court d'essais) : le devis est lié quand même, pas de 2e création après verrou vieilli", async () => {
    poser(classique());
    let lectures = 0;
    m.findFirst.mockImplementation(async ({ where }: { where: Ligne }) => {
      if (!m.row || !correspond(m.row, where)) return null;
      const copie = { ...m.row };
      // Lectures de `lier` (where.statut = numerotation) : une sauvegarde s'intercale à chaque fois.
      if (where["statut"] === "numerotation" && lectures++ < 3) {
        m.row["revision"] = (m.row["revision"] as number) + 1;
      }
      return copie;
    });
    const r = await num();
    expect(r).toMatchObject({ data: { devisId: DEVIS, aRenumeroter: true } });
    expect(m.row).toMatchObject({ devisId: DEVIS, statut: "lie_au_devis", verrouDepuis: null });
    if (m.row!["statut"] === "numerotation") {
      m.row!["verrouDepuis"] = new Date(Date.now() - 3 * 60_000);
    }
    await num(m.row!["revision"] as number);
    expect(m.creerClassique).toHaveBeenCalledTimes(1);
  });

  it("3 sauvegardes intercalées : sync est écrit (devisMajLe du devis créé), le 2e appel MODIFIE au lieu d'être périmé", async () => {
    poser(classique());
    let lectures = 0;
    m.findFirst.mockImplementation(async ({ where }: { where: Ligne }) => {
      if (!m.row || !correspond(m.row, where)) return null;
      const copie = { ...m.row };
      if (where["statut"] === "numerotation" && lectures++ < 3) {
        m.row["revision"] = (m.row["revision"] as number) + 1;
      }
      return copie;
    });
    await num();
    expect((m.row!["payload"] as PayloadAssistantV1).sync).toEqual({
      devisId: DEVIS,
      devisMajLe: MAJ1.toISOString(),
    });
    const r2 = await num(m.row!["revision"] as number);
    expect(r2).not.toMatchObject({ error: expect.stringContaining("modifi") });
    expect(m.modifierClassique).toHaveBeenCalledTimes(1);
    expect(m.creerClassique).toHaveBeenCalledTimes(1);
  });

  it("brouillon vide de sync après un lien : le devis lié est recherché dans la colonne, pas dans le texte", async () => {
    const p = classique();
    p.sync = { devisId: AUTRE, devisMajLe: MAJ0.toISOString() };
    poser(p);
    await num();
    expect(m.row).toMatchObject({ devisId: DEVIS });
    expect((m.row!["payload"] as PayloadAssistantV1).sync.devisId).toBe(DEVIS);
  });
});

describe("numerotation — déjà lié : mise à jour, jamais un 2e numéro", () => {
  function lier(p: PayloadAssistantV1) {
    p.sync = { devisId: DEVIS, devisMajLe: MAJ0.toISOString() };
    poser(p, { devisId: DEVIS, statut: "lie_au_devis" });
  }

  it("classique : modifierDevisClassiqueBrouillonAction avec sync.devisMajLe, pas de création", async () => {
    lier(classique());
    m.devisFindUnique.mockResolvedValue(devisBrouillon({ updatedAt: MAJ0 }));
    const r = await num();
    expect(m.creerClassique).not.toHaveBeenCalled();
    expect(m.creerFormules).not.toHaveBeenCalled();
    expect(m.modifierClassique).toHaveBeenCalledTimes(1);
    expect(m.modifierClassique.mock.calls[0]![0]).toMatchObject({
      id: DEVIS,
      attenduMajLe: MAJ0.toISOString(),
      input: { clientId: CLIENT },
    });
    expect(r).toMatchObject({ data: { devisId: DEVIS, numero: "AXI-DEV-2026-007", revision: 5 } });
    expect(m.row).toMatchObject({ statut: "lie_au_devis", verrouDepuis: null });
  });

  it("formules : modifierDevisBrouillonAction avec l'offre rejouée et sync.devisMajLe", async () => {
    lier(formules("AB"));
    m.devisFindUnique.mockResolvedValue(
      devisBrouillon({
        updatedAt: MAJ0,
        offreSha256: "a".repeat(64),
        offre: { automatisations: [] },
      }),
    );
    const r = await num();
    expect(m.creerFormules).not.toHaveBeenCalled();
    expect(m.modifierFormules).toHaveBeenCalledTimes(1);
    const arg = m.modifierFormules.mock.calls[0]![0];
    expect(arg).toMatchObject({ id: DEVIS, attenduMajLe: MAJ0.toISOString(), refClient: null });
    expect(arg.offre.achat).toBeDefined();
    expect(arg.offre.abonnement).toBeDefined();
    expect("data" in r).toBe(true);
  });

  it("devis hérité avec automatisations : elles passent la garde (comparées à l'identique)", async () => {
    const p = formules("A");
    const auto = { code: "HERITEE", libelle: "Option héritée", prixHtCents: 100000 };
    p.formules.automatisations = [auto] as never;
    lier(p);
    m.devisFindUnique.mockResolvedValue(
      devisBrouillon({
        updatedAt: MAJ0,
        offreSha256: "a".repeat(64),
        offre: { automatisations: [auto] },
      }),
    );
    const r = await num();
    // Refusée ou acceptée par le moteur de validation, la garde « neuve » ne doit pas être la cause.
    if ("error" in r) expect(r.error).not.toMatch(/options facultatives/);
  });

  it("devis déjà envoyé : refus net, aucune modification", async () => {
    lier(classique());
    m.devisFindUnique.mockResolvedValue(devisBrouillon({ statut: "envoye" }));
    const r = await num();
    expect(r).toEqual({ error: "Ce devis a été envoyé : ouvrez sa fiche." });
    expect(m.modifierClassique).not.toHaveBeenCalled();
    expect(m.modifierFormules).not.toHaveBeenCalled();
    expect(m.row).toMatchObject({ statut: "lie_au_devis" });
  });

  it("changement de client après numérotation : refusé", async () => {
    const p = classique();
    p.clientId = AUTRE_CLIENT;
    lier(p);
    m.devisFindUnique.mockResolvedValue(devisBrouillon({ updatedAt: MAJ0 }));
    const r = await num();
    expect("error" in r).toBe(true);
    expect(m.modifierClassique).not.toHaveBeenCalled();
    expect(m.creerClassique).not.toHaveBeenCalled();
  });

  it("changement de type (classique → formules) après numérotation : refusé", async () => {
    lier(formules("A"));
    m.devisFindUnique.mockResolvedValue(devisBrouillon({ updatedAt: MAJ0, offreSha256: null }));
    const r = await num();
    expect("error" in r).toBe(true);
    expect(m.modifierFormules).not.toHaveBeenCalled();
    expect(m.creerFormules).not.toHaveBeenCalled();
  });

  it("changement de type (formules → classique) après numérotation : refusé", async () => {
    lier(classique());
    m.devisFindUnique.mockResolvedValue(
      devisBrouillon({
        updatedAt: MAJ0,
        offreSha256: "a".repeat(64),
        offre: { automatisations: [] },
      }),
    );
    const r = await num();
    expect("error" in r).toBe(true);
    expect(m.modifierClassique).not.toHaveBeenCalled();
    expect(m.creerClassique).not.toHaveBeenCalled();
  });

  it("refus de l'action de modification : le brouillon reste lié, verrou levé", async () => {
    lier(classique());
    m.devisFindUnique.mockResolvedValue(devisBrouillon({ updatedAt: MAJ0 }));
    m.modifierClassique.mockResolvedValue({ error: "Ce brouillon a été modifié ailleurs" });
    const r = await num();
    expect(r).toEqual({ error: "Ce brouillon a été modifié ailleurs" });
    expect(m.row).toMatchObject({ devisId: DEVIS, statut: "lie_au_devis", verrouDepuis: null });
  });

  it("deux appels simultanés sur un brouillon lié : une seule modification", async () => {
    lier(classique());
    m.devisFindUnique.mockResolvedValue(devisBrouillon({ updatedAt: MAJ0 }));
    m.modifierClassique.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { data: { id: DEVIS, majLe: MAJ1.toISOString() } };
    });
    await Promise.all([num(), num()]);
    expect(m.modifierClassique).toHaveBeenCalledTimes(1);
  });
});

describe("numerotation — validité, projet, vente", () => {
  it("date de validité posée par S10 avec la date de mise à jour du devis tout juste créé", async () => {
    const p = classique();
    const j = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    p.dateValidite = j;
    poser(p);
    await num();
    expect(m.fixerValidite).toHaveBeenCalledTimes(1);
    expect(m.fixerValidite.mock.calls[0]![0]).toMatchObject({
      id: DEVIS,
      attenduMajLe: MAJ1.toISOString(),
      dateValidite: j,
    });
  });

  it("sans date choisie : S10 n'est pas appelée (défaut du moteur)", async () => {
    poser(classique());
    await num();
    expect(m.fixerValidite).not.toHaveBeenCalled();
  });

  it("validité refusée par S10 : le devis est quand même lié (pas d'orphelin), l'erreur remonte", async () => {
    const p = classique();
    p.dateValidite = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    poser(p);
    m.fixerValidite.mockResolvedValue({ error: "Date de validité invalide." });
    const r = await num();
    expect(r).toMatchObject({ error: expect.stringContaining("AXI-DEV-2026-007") });
    expect(m.row).toMatchObject({ devisId: DEVIS, statut: "lie_au_devis", verrouDepuis: null });
  });

  it("projetId transmis seulement si le projet est celui du client", async () => {
    const p = classique();
    p.projetId = PROJET;
    poser(p);
    m.projetOuvrable.mockResolvedValue(true);
    await num();
    expect(m.projetOuvrable).toHaveBeenCalledWith(expect.anything(), PROJET, CLIENT);
    expect(m.creerClassique.mock.calls[0]![0].projetId).toBe(PROJET);
  });

  it("projet d'un autre client : projetId omis", async () => {
    const p = classique();
    p.projetId = PROJET;
    poser(p);
    m.projetOuvrable.mockResolvedValue(false);
    await num();
    expect(m.creerClassique.mock.calls[0]![0]).not.toHaveProperty("projetId");
  });

  it("lien VenteBrouillon : propriétaire seulement, jamais écrasé", async () => {
    const p = classique();
    p.venteBrouillonId = VENTE;
    poser(p);
    await num();
    expect(m.venteUpdateMany).toHaveBeenCalledTimes(1);
    expect(m.venteUpdateMany.mock.calls[0]![0]).toEqual({
      where: { id: VENTE, createdByAdminId: ADMIN, devisId: null },
      data: { devisId: DEVIS },
    });
  });

  it("venteBrouillonId d'un autre admin : l'écriture ne touche aucune ligne, la numérotation réussit", async () => {
    const p = classique();
    p.venteBrouillonId = VENTE;
    poser(p);
    m.venteUpdateMany.mockResolvedValue({ count: 0 });
    const r = await num();
    expect("data" in r).toBe(true);
  });

  it("sans venteBrouillonId : aucune écriture sur la vente", async () => {
    poser(classique());
    await num();
    expect(m.venteUpdateMany).not.toHaveBeenCalled();
  });
});

describe("envoyerDepuisAssistantAction", () => {
  const env = (r = 4) => envoyerDepuisAssistantAction({ brouillonId: ID, attenduRevision: r });

  it("synchronise (création) PUIS sendDevisAction(devisId), dans cet ordre", async () => {
    poser(classique());
    const ordre: string[] = [];
    m.creerClassique.mockImplementation(async () => {
      ordre.push("numeroter");
      return { data: { id: DEVIS, numero: "AXI-DEV-2026-007" } };
    });
    m.envoyer.mockImplementation(async () => {
      ordre.push("envoyer");
      return { data: { id: DEVIS, emailEnvoye: true, signatureCreee: true } };
    });
    const r = await env();
    expect(ordre).toEqual(["numeroter", "envoyer"]);
    expect(m.envoyer).toHaveBeenCalledWith(DEVIS);
    expect(r).toEqual({
      data: { devisId: DEVIS, emailEnvoye: true, signatureCreee: true },
    });
  });

  it("synchronise (mise à jour) PUIS envoie quand le devis est déjà numéroté", async () => {
    const p = classique();
    p.sync = { devisId: DEVIS, devisMajLe: MAJ0.toISOString() };
    poser(p, { devisId: DEVIS, statut: "lie_au_devis" });
    m.devisFindUnique.mockResolvedValue(devisBrouillon({ updatedAt: MAJ0 }));
    const ordre: string[] = [];
    m.modifierClassique.mockImplementation(async () => {
      ordre.push("modifier");
      return { data: { id: DEVIS, majLe: MAJ1.toISOString() } };
    });
    m.envoyer.mockImplementation(async () => {
      ordre.push("envoyer");
      return { data: { id: DEVIS, emailEnvoye: false, signatureCreee: false, note: "n" } };
    });
    await env();
    expect(ordre).toEqual(["modifier", "envoyer"]);
    expect(m.creerClassique).not.toHaveBeenCalled();
  });

  it("numérotation en erreur : rien n'est envoyé", async () => {
    poser(classique());
    m.creerClassique.mockResolvedValue({ error: "Données invalides" });
    expect(await env()).toEqual({ error: "Données invalides" });
    expect(m.envoyer).not.toHaveBeenCalled();
  });

  it("saisie modifiée pendant la numérotation : l'envoi est refusé (le devis porte l'ancienne version)", async () => {
    poser(classique());
    m.creerClassique.mockImplementation(async () => {
      m.row!["revision"] = (m.row!["revision"] as number) + 1;
      return { data: { id: DEVIS, numero: "AXI-DEV-2026-007" } };
    });
    const r = await env();
    expect("error" in r).toBe(true);
    expect(m.envoyer).not.toHaveBeenCalled();
  });

  it("2e appel APRÈS la fin de la numérotation du 1er : rejoue, jamais un 2e envoi", async () => {
    poser(classique());
    const a = await env();
    expect("data" in a).toBe(true);
    const b = await env();
    expect(b).toMatchObject({ error: expect.stringContaining("déjà demandé") });
    expect(m.envoyer).toHaveBeenCalledTimes(1);
    expect(m.creerClassique).toHaveBeenCalledTimes(1);
  });

  it("refus d'envoi (sendDevisAction) : le devis reste numéroté et lié, l'erreur remonte", async () => {
    poser(classique());
    m.envoyer.mockResolvedValue({ error: "Devis à 0,00 € HT" });
    const r = await env();
    expect(r).toEqual({ error: "Devis à 0,00 € HT" });
    expect(m.row).toMatchObject({ devisId: DEVIS, statut: "lie_au_devis" });
  });

  it("double clic sur « Envoyer » : une seule création et un seul envoi", async () => {
    poser(classique());
    m.creerClassique.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { data: { id: DEVIS, numero: "AXI-DEV-2026-007" } };
    });
    const [a, b] = await Promise.all([env(), env()]);
    expect(m.creerClassique).toHaveBeenCalledTimes(1);
    expect(m.envoyer).toHaveBeenCalledTimes(1);
    expect([a, b].filter((x) => "data" in x)).toHaveLength(1);
  });

  it("n'envoie aucun e-mail lui-même (seule la porte existante, qui passe par la corbeille de relecture)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(__dirname, "devis-assistant-finaliser.ts"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    expect(src).not.toMatch(/enqueueEmail|nodemailer|sendMail|sendTelegram/);
  });

  it("n'écrit jamais le statut d'un devis et ne supprime rien", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(__dirname, "devis-assistant-finaliser.ts"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    expect(src).not.toMatch(/prisma\.devis\.(update|updateMany|create|delete)/);
    expect(src).not.toMatch(/\.delete(Many)?\(/);
  });
});
