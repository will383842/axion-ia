/**
 * Tests — createClientAction / updateClientAction (F5 SIRET + F6 OPCO).
 *
 * Il n'existait AUCUN test sur ces deux actions : le schéma client n'avait
 * jamais été exercé. Stratégie : mocker Prisma et les guards, laisser tourner
 * pour de vrai le Zod, l'inférence OPCO (module pur) et la numérotation.
 *
 * Volontairement AUCUNE assertion sur la valeur du numéro alloué : le format
 * relève de `NUMBERING_PREFIX` (chantier V19) et le MÉCANISME d'allocation de
 * V20, ce test ne doit se coupler ni à l'un ni à l'autre.
 *
 * 🔴 CONSIGNE À L'INTÉGRATEUR — dépendance d'ordre avec V20 (étape 7).
 * Sur l'arbre où ce fichier a été écrit, `createClientAction` alloue son numéro
 * via `prisma.client.count()` (vérifié : `src/server/qualiopi/numbering/` ne
 * contient que `formats.ts` et `retry.ts`). V20 remplace ce mécanisme par
 * `allocateNumero(tx, "client", "clients")` DANS une transaction. Si V20 a déjà
 * été appliqué quand vous lancez ce spec, les 6 tests `createClientAction`
 * échoueront sur le mock — remplacez alors le mock `count` par un `vi.mock` du
 * module d'allocation introduit par V20 (le `$transaction` passthrough est déjà
 * en place ci-dessous). Aucune assertion F5/F6 ne dépend de la numérotation :
 * seul le mock est à adapter, jamais les attentes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdminWrite = vi.fn();
const mockLog = vi.fn();
const mockCount = vi.fn();
// 🔴 V20/L7 : l'allocateur est passé de `count()` à `findMany()` + MAX(seq).
// Le commentaire de tête de ce fichier annonçait exactement ce changement.
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => {
  const client = {
    count: (...a: unknown[]) => mockCount(...a),
    findMany: (...a: unknown[]) => mockFindMany(...a),
    create: (...a: unknown[]) => mockCreate(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
    findUnique: (...a: unknown[]) => mockFindUnique(...a),
  };
  const prisma = {
    client,
    // Porte unique de création (chantier visio, PR 3) : verrou consultatif,
    // personne de la fiche et son adresse, journal de « créer quand même ».
    $executeRaw: async () => 1,
    clientContact: {
      findFirst: async () => null,
      create: async (a: {
        data: { nom: string; telephone?: string | null; fonction?: string | null };
      }) => ({
        id: "contact-1",
        nom: a.data.nom,
        telephone: a.data.telephone ?? null,
        fonction: a.data.fonction ?? null,
      }),
      update: async () => ({ id: "contact-1", nom: "", telephone: null, fonction: null }),
    },
    clientContactAdresse: {
      findFirst: async () => null,
      create: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
    },
    activityLog: { create: async () => ({}) },
    // Passthrough : inoffensif aujourd'hui (l'action n'ouvre pas de
    // transaction), nécessaire dès que V20 enveloppera l'allocation.
    $transaction: async (fn: unknown) =>
      typeof fn === "function" ? (fn as (tx: unknown) => unknown)(prisma) : fn,
  };
  return { prisma };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => mockRequireAdminWrite(),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));

// Lot OPCO A7d : le relevé INSEE est simulé ; sa logique a son propre spec
// (`src/server/qualiopi/crm/__tests__/effectif-insee.spec.ts`).
const mockRafraichirEffectif = vi.fn();
vi.mock("@/server/qualiopi/crm/effectif-insee", () => ({
  rafraichirEffectifInsee: (...a: unknown[]) => mockRafraichirEffectif(...a),
}));

import { createClientAction, rafraichirEffectifInseeAction, updateClientAction } from "./clients";

const ID = "550e8400-e29b-41d4-a716-446655440099";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminWrite.mockResolvedValue({ userId: "u1", role: "admin" });
  mockLog.mockResolvedValue(undefined);
  mockCount.mockResolvedValue(0);
  mockRafraichirEffectif.mockResolvedValue({ statut: "indisponible" });
  // Aucun numéro existant → la série démarre à 001.
  mockFindMany.mockResolvedValue([]);
  mockCreate.mockResolvedValue({ id: ID, numero: "AXI-CLI-001" });
  mockUpdate.mockResolvedValue({ id: ID });
  mockFindUnique.mockResolvedValue({ nafCode: null, idcc: null, opcoIdentifie: null });
});

describe("createClientAction — SIRET (F5)", () => {
  it("refuse 00000000000000 et n'écrit RIEN en base", async () => {
    const r = await createClientAction({ raisonSociale: "X", siret: "00000000000000" });

    expect("error" in r).toBe(true);
    if (!("error" in r)) return;
    expect(r.error).toContain("SIRET");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("le message n'est plus le littéral générique « Données invalides »", async () => {
    const r = await createClientAction({ raisonSociale: "X", siret: "00000000000000" });
    expect("error" in r && r.error).not.toBe("Données invalides");
  });

  it("reste facultatif : sans SIRET la création passe, sans clé siret", async () => {
    const r = await createClientAction({ raisonSociale: "Prospect Calendly" });

    expect("data" in r).toBe(true);
    expect(mockCreate).toHaveBeenCalledOnce();
    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("siret" in data).toBe(false);
  });

  it("normalise la forme espacée à 14 caractères avant écriture", async () => {
    await createClientAction({ raisonSociale: "X", siret: "732 829 320 00074" });

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.siret).toBe("73282932000074");
  });
});

describe("createClientAction — OPCO (F6)", () => {
  it("NAF 8559A donne akto et le log d'audit porte akto, plus null", async () => {
    await createClientAction({ raisonSociale: "OF Client", nafCode: "8559A" });

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
    expect(mockLog.mock.calls[0]?.[0]?.changes?.opcoIdentifie).toBe("akto");
  });

  it("l'IDCC est autoritaire et l'emporte sur le NAF", async () => {
    await createClientAction({ raisonSociale: "X", idcc: "1516", nafCode: "6201Z" });

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
  });

  it("un OPCO saisi explicitement gagne sur l'inférence", async () => {
    await createClientAction({ raisonSociale: "X", opcoIdentifie: "opco_ep", nafCode: "8559A" });

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("opco_ep");
  });

  it("sans NAF ni IDCC, aucune clé opcoIdentifie n'est écrite", async () => {
    await createClientAction({ raisonSociale: "X" });

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("opcoIdentifie" in data).toBe(false);
  });
});

describe("updateClientAction — SIRET (F5)", () => {
  it("refuse 00000000000000 sur le chemin de MISE À JOUR aussi", async () => {
    const r = await updateClientAction({ id: ID, siret: "00000000000000" });

    expect("error" in r).toBe(true);
    if (!("error" in r)) return;
    expect(r.error).toContain("SIRET");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("`null` efface le SIRET (seul chemin de correction d'une fiche existante)", async () => {
    const r = await updateClientAction({ id: ID, siret: null });

    expect("data" in r).toBe(true);
    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.siret).toBeNull();
  });
});

describe("updateClientAction — ré-inférence OPCO (F6)", () => {
  it("renseigner le NAF a posteriori remplit l'OPCO resté vide", async () => {
    const r = await updateClientAction({ id: ID, nafCode: "8559A" });

    expect("data" in r).toBe(true);
    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
  });

  it("renseigner l'IDCC seul suffit (source autoritaire)", async () => {
    await updateClientAction({ id: ID, idcc: "1516" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
  });

  it("🔴 n'écrase JAMAIS un OPCO déjà saisi à la main", async () => {
    mockFindUnique.mockResolvedValue({ nafCode: null, idcc: null, opcoIdentifie: "atlas" });

    await updateClientAction({ id: ID, nafCode: "8559A" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("opcoIdentifie" in data).toBe(false);
  });

  it("une chaîne vide en base ne bloque pas la ré-inférence (garde trim)", async () => {
    mockFindUnique.mockResolvedValue({ nafCode: null, idcc: null, opcoIdentifie: "   " });

    await updateClientAction({ id: ID, idcc: "1516" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
  });

  it("un OPCO explicite gagne sur la ré-inférence", async () => {
    await updateClientAction({ id: ID, opcoIdentifie: "opco_ep", nafCode: "8559A" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("opco_ep");
  });

  it("aucune ré-inférence parasite quand ni NAF ni IDCC ne changent", async () => {
    await updateClientAction({ id: ID, notes: "rappel le 12" });

    expect(mockFindUnique).not.toHaveBeenCalled();
    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("opcoIdentifie" in data).toBe(false);
  });

  it("la chaîne vide est refusée en entrée (anti-briquage du select)", async () => {
    const r = await updateClientAction({ id: ID, opcoIdentifie: "" });

    expect("error" in r).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("🔴 `null` = « remettre en inféré » : écrase la saisie ET recalcule", async () => {
    // Sans ce chemin, un OPCO saisi par erreur serait définitif via l'interface.
    mockFindUnique.mockResolvedValue({ nafCode: "8559A", idcc: null, opcoIdentifie: "atlas" });

    await updateClientAction({ id: ID, opcoIdentifie: null });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
  });

  it("`null` sans NAF ni IDCC exploitables remet bien la colonne à NULL", async () => {
    mockFindUnique.mockResolvedValue({ nafCode: null, idcc: null, opcoIdentifie: "atlas" });

    await updateClientAction({ id: ID, opcoIdentifie: null });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("opcoIdentifie" in data).toBe(true);
    expect(data.opcoIdentifie).toBeNull();
  });
});

describe("🔴 updateClientAction — le CONTACT est corrigible (chantier V18)", () => {
  // Ces champs étaient acceptés par l'action depuis toujours, et AUCUNE
  // interface ne les lui envoyait : seul `ClientBrancheForm` l'appelait, avec
  // trois champs sans rapport. Une faute de frappe sur l'adresse de contact
  // bloquait donc tout le circuit commercial — `devis.ts` refuse d'émettre un
  // lien de signature sans `contactEmail` — sans moyen de la corriger.
  //
  // `ClientEditForm` ferme le manque. Ces tests garantissent que la porte
  // serveur reste ouverte.

  it("met à jour les champs de contact", async () => {
    const r = await updateClientAction({
      id: ID,
      contactNom: "Camille Durand",
      contactEmail: "camille@client.test",
      contactTelephone: "+33 6 12 34 56 78",
      contactFonction: "Directrice des ressources humaines",
    });

    expect("data" in r).toBe(true);
    // Chantier visio (PR 3) : la copie `contact*` est écrite par
    // `definirContactFacturation`, dans la même transaction, APRÈS le reste.
    const data = mockUpdate.mock.calls.at(-1)?.[0]?.data as Record<string, unknown>;
    expect(data.contactNom).toBe("Camille Durand");
    expect(data.contactEmail).toBe("camille@client.test");
    expect(data.contactFonction).toBe("Directrice des ressources humaines");
  });

  it("🔴 `null` efface une adresse fautive — sinon elle serait DÉFINITIVE", async () => {
    // Même motif que pour le SIRET, en plus lourd : c'est à cette adresse que
    // part le lien de signature du devis. Ne pas pouvoir la retirer laisserait
    // l'interface proposer d'envoyer un engagement contractuel à un
    // destinataire dont on sait qu'il est faux.
    const r = await updateClientAction({ id: ID, contactEmail: null });

    expect("data" in r).toBe(true);
    const data = mockUpdate.mock.calls.at(-1)?.[0]?.data as Record<string, unknown>;
    expect(data.contactEmail).toBeNull();
  });

  it("refuse une adresse malformée plutôt que de l'écrire", async () => {
    const r = await updateClientAction({ id: ID, contactEmail: "pas-une-adresse" });

    expect("error" in r).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("⚠️ un champ NON transmis n'est pas écrit — l'envoi différentiel en dépend", async () => {
    // `ClientEditForm` n'envoie que ce qui a changé, et ce n'est pas une
    // optimisation : transmettre `nafCode` à chaque enregistrement relancerait
    // la ré-inférence OPCO, dont la seule protection est « uniquement si l'OPCO
    // est vide en base ». Si l'action se mettait à écrire les clés absentes,
    // cette garde deviendrait le dernier rempart contre l'annulation
    // silencieuse d'une correction manuelle d'OPCO.
    await updateClientAction({ id: ID, contactNom: "Seul ce champ" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("contactEmail" in data).toBe(false);
    expect("raisonSociale" in data).toBe(false);
    expect("nafCode" in data).toBe(false);
    expect("siret" in data).toBe(false);
  });
});

describe("updateClientAction — effectif et OPCO typé (lot OPCO A1)", () => {
  it("refuse un effectif négatif (zod) et n'écrit rien", async () => {
    const r = await updateClientAction({ id: ID, effectif: -1 });

    expect("error" in r).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuse un effectif non entier", async () => {
    const r = await updateClientAction({ id: ID, effectif: 12.5 });

    expect("error" in r).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("enregistrer l'effectif pose source = saisie et la date du jour", async () => {
    const r = await updateClientAction({ id: ID, effectif: 12 });

    expect("data" in r).toBe(true);
    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.effectif).toBe(12);
    expect(data.effectifSource).toBe("saisie");
    // Colonne `@db.Date` : minuit UTC du jour civil de Paris.
    const releve = data.effectifReleveLe as Date;
    expect(releve).toBeInstanceOf(Date);
    expect(releve.toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    const jourParis = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(
      new Date(),
    );
    expect(releve.toISOString().slice(0, 10)).toBe(jourParis);
  });

  it("effacer l'effectif (null) efface aussi sa source et sa date", async () => {
    await updateClientAction({ id: ID, effectif: null });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.effectif).toBeNull();
    expect(data.effectifSource).toBeNull();
    expect(data.effectifReleveLe).toBeNull();
  });

  it("une mise à jour sans effectif ne touche ni l'effectif ni sa source", async () => {
    await updateClientAction({ id: ID, notes: "rappel" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("effectif" in data).toBe(false);
    expect("effectifSource" in data).toBe(false);
    expect("effectifReleveLe" in data).toBe(false);
  });

  it("l'OPCO typé s'écrit dans `opco` sans toucher au texte `opcoIdentifie`", async () => {
    mockFindUnique.mockResolvedValue({ nafCode: null, idcc: null, opcoIdentifie: "Atlas ?" });

    await updateClientAction({ id: ID, opco: "atlas" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opco).toBe("atlas");
    expect("opcoIdentifie" in data).toBe(false);
  });

  it("refuse un OPCO hors des 11 du référentiel", async () => {
    const r = await updateClientAction({ id: ID, opco: "opca_fantome" as never });

    expect("error" in r).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuse un effectif ou un OPCO typé quand la fiche EN BASE est un particulier (charge sans type)", async () => {
    mockFindUnique.mockResolvedValue({ type: "particulier" });
    const r1 = await updateClientAction({ id: ID, effectif: 3 });
    const r2 = await updateClientAction({ id: ID, opco: "akto" });
    expect("error" in r1).toBe(true);
    expect("error" in r2).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuse un effectif ou un OPCO typé sur un particulier", async () => {
    const r1 = await updateClientAction({ id: ID, type: "particulier", effectif: 3 });
    const r2 = await updateClientAction({ id: ID, type: "particulier", opco: "akto" });

    expect("error" in r1).toBe(true);
    expect("error" in r2).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("createClientAction — effectif relevé à l'INSEE (lot OPCO A7d)", () => {
  const SIRET_VALIDE = "73282932000074";

  it("SIREN connu → relevé demandé pour la fiche créée, et tracé quand il est posé", async () => {
    mockRafraichirEffectif.mockResolvedValue({ statut: "pose", effectif: 10, tranche: "11" });
    const r = await createClientAction({ raisonSociale: "ACME", siret: SIRET_VALIDE });
    expect("data" in r).toBe(true);
    expect(mockRafraichirEffectif).toHaveBeenCalledTimes(1);
    expect(mockRafraichirEffectif.mock.calls[0]![1]).toBe("data" in r ? r.data.id : "");
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "qualiopi.client.effectif_insee",
        changes: { effectif: 10, effectifSource: "insee", trancheInsee: "11" },
      }),
    );
  });

  it("🔴 annuaire en panne (exception) → la création réussit quand même", async () => {
    mockRafraichirEffectif.mockRejectedValue(new Error("ETIMEDOUT"));
    const r = await createClientAction({ raisonSociale: "ACME", siret: SIRET_VALIDE });
    expect("data" in r).toBe(true);
  });

  it("annuaire indisponible → création réussie, rien de tracé pour l'effectif", async () => {
    const r = await createClientAction({ raisonSociale: "ACME", siret: SIRET_VALIDE });
    expect("data" in r).toBe(true);
    expect(mockLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "qualiopi.client.effectif_insee" }),
    );
  });

  it("sans SIREN → aucun appel à l'annuaire", async () => {
    await createClientAction({ raisonSociale: "ACME" });
    expect(mockRafraichirEffectif).not.toHaveBeenCalled();
  });
});

describe("rafraichirEffectifInseeAction (lot OPCO A7d)", () => {
  it("saisie conservée → le message le dit", async () => {
    mockRafraichirEffectif.mockResolvedValue({ statut: "saisie_conservee" });
    const r = await rafraichirEffectifInseeAction(ID);
    expect(r).toEqual({
      data: { statut: "saisie_conservee", message: expect.stringContaining("conservé") },
    });
  });

  it("exception → message d'indisponibilité, jamais une erreur brute", async () => {
    mockRafraichirEffectif.mockRejectedValue(new Error("boom"));
    const r = await rafraichirEffectifInseeAction(ID);
    expect(r).toEqual({ error: expect.stringContaining("ne répond pas") });
  });

  it("identifiant invalide → refus sans appel", async () => {
    const r = await rafraichirEffectifInseeAction("pas-un-uuid");
    expect("error" in r).toBe(true);
    expect(mockRafraichirEffectif).not.toHaveBeenCalled();
  });
});

describe("🔴 l'inférence IDCC/NAF écrit aussi l'OPCO TYPÉ (lot OPCO A7a)", () => {
  it("création : NAF 8559A pose `opco = akto` à côté de `opcoIdentifie`", async () => {
    await createClientAction({ raisonSociale: "OF Client", nafCode: "8559A" });

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
    expect(data.opco).toBe("akto");
  });

  it("création : un OPCO saisi en texte n'est pas une inférence, `opco` n'est pas posé", async () => {
    await createClientAction({ raisonSociale: "X", opcoIdentifie: "opco_ep", nafCode: "8559A" });

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("opco" in data).toBe(false);
  });

  it("édition : renseigner le NAF remplit les deux champs quand ils sont vides", async () => {
    mockFindUnique.mockResolvedValue({
      nafCode: null,
      idcc: null,
      opcoIdentifie: null,
      opco: null,
    });

    await updateClientAction({ id: ID, nafCode: "8559A" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
    expect(data.opco).toBe("akto");
  });

  it("🔴 un OPCO typé saisi à la main n'est JAMAIS écrasé par l'inférence", async () => {
    mockFindUnique.mockResolvedValue({
      nafCode: null,
      idcc: null,
      opcoIdentifie: null,
      opco: "atlas",
    });

    await updateClientAction({ id: ID, nafCode: "8559A" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
    expect("opco" in data).toBe(false);
  });

  it("🔴 « remettre en inféré » ne touche pas non plus l'OPCO typé déjà posé", async () => {
    mockFindUnique.mockResolvedValue({
      nafCode: "8559A",
      idcc: null,
      opcoIdentifie: "atlas",
      opco: "atlas",
    });

    await updateClientAction({ id: ID, opcoIdentifie: null });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("opco" in data).toBe(false);
  });

  it("la saisie de l'OPCO typé dans la même charge l'emporte sur l'inférence", async () => {
    mockFindUnique.mockResolvedValue({
      nafCode: null,
      idcc: null,
      opcoIdentifie: null,
      opco: null,
    });

    await updateClientAction({ id: ID, nafCode: "8559A", opco: "opco_ep" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opco).toBe("opco_ep");
  });

  it("un texte libre saisi à la main empêche l'inférence d'écrire l'OPCO typé", async () => {
    mockFindUnique.mockResolvedValue({
      nafCode: null,
      idcc: null,
      opcoIdentifie: "atlas",
      opco: null,
    });

    await updateClientAction({ id: ID, nafCode: "8559A" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("opcoIdentifie" in data).toBe(false);
    expect("opco" in data).toBe(false);
  });
});
