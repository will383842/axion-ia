/**
 * 🔴 `D5-5-01` — la purge de prospection ne supprimait RIEN, et disait « 0 ».
 *
 * Les trois `deleteMany` de prospection filtrent sur
 * `retentionUntil: { not: null, lt: now }`. Or **aucune ligne de ce dépôt
 * n'écrit cette colonne** pour ces modèles : recherche exhaustive sur `src/` le
 * 2026-08-20, le seul code qui touche ces tables est le `deleteMany` lui-même.
 * Elles sont alimentées par Axion CRM Pro, un dépôt séparé.
 *
 * Le prédicat ne peut donc matcher aucune ligne. La purge supprimait zéro
 * enregistrement, pour toujours, sur les tables qui portent les millions de
 * fiches entreprises et personnes — **rétention illimitée de données
 * nominatives**, RGPD art. 5.1.e.
 *
 * 🔑 C'est la famille de défaut la plus coûteuse de cet audit : une garde qui a
 * l'air de garder. Le worker tournait, journalisait « companies=0 persons=0 »,
 * et ce zéro se lisait « rien à purger » alors qu'il signifiait « la requête ne
 * peut rien trouver ». Un témoin négatif ne vaut que si on a vérifié qu'il
 * DEVRAIT être positif.
 *
 * ## Ce que ce fichier garde
 *
 * 1. le comptage voit les fiches SANS horizon et inactives ;
 * 2. il ne double PAS la purge nominale (disjonction sur `retentionUntil`) ;
 * 3. une alerte porte le NOMBRE — sans quoi la décision reste impossible ;
 * 4. **rien n'est supprimé sans le drapeau** — c'est le cœur : autoriser un
 *    effacement de masse irréversible est une décision humaine ;
 * 5. avec le drapeau, la suppression a bien lieu.
 *
 * ⚠️ Premier test de ce worker. Il supprime dans vingt et une tables de
 * production et n'était couvert par aucune suite : sa fonction de traitement
 * vivait en littéral inline dans `new Worker(...)`, hors de portée de tout
 * harnais. Elle est désormais exportée.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const creerOuDedup = vi.fn(async (_i: unknown) => null);

vi.mock("bullmq", () => ({ Worker: vi.fn() }));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: vi.fn() }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/server/careers/cv-storage", () => ({ deleteCv: vi.fn() }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (i: unknown) => creerOuDedup(i),
}));

/**
 * Prisma mocké par un Proxy : ce worker touche 21 modèles, et les énumérer un
 * par un ferait de ce fichier une liste à maintenir plutôt qu'une garde. Tout
 * modèle non nommé rend des compteurs à zéro ; seuls les trois modèles de
 * prospection portent un comportement.
 */
const compte = vi.fn(async (_a: unknown) => 0);
const supprPerson = vi.fn(async (_a: unknown) => ({ count: 0 }));
const supprPract = vi.fn(async (_a: unknown) => ({ count: 0 }));
const supprCompany = vi.fn(async (_a: unknown) => ({ count: 0 }));

vi.mock("@/lib/prisma", () => {
  const parDefaut = {
    deleteMany: async () => ({ count: 0 }),
    count: async () => 0,
    findMany: async () => [],
    updateMany: async () => ({ count: 0 }),
    update: async () => ({}),
    findUnique: async () => null,
  };
  const specifiques: Record<string, unknown> = {
    prospectionCompany: {
      ...parDefaut,
      count: (a: unknown) => compte(a),
      deleteMany: (a: unknown) => supprCompany(a),
    },
    prospectionPerson: {
      ...parDefaut,
      count: (a: unknown) => compte(a),
      deleteMany: (a: unknown) => supprPerson(a),
    },
    prospectionHealthPractitioner: {
      ...parDefaut,
      count: (a: unknown) => compte(a),
      deleteMany: (a: unknown) => supprPract(a),
    },
  };
  return {
    prisma: new Proxy(
      {},
      {
        get: (_c, modele: string) => specifiques[modele] ?? parDefaut,
      },
    ),
  };
});

import { executerPurgeRetention } from "../retention-purge-worker";

const DRAPEAU = "RETENTION_PROSPECTION_PURGE_ENABLED";
const ORIGINE = process.env[DRAPEAU];

beforeEach(() => {
  vi.clearAllMocks();
  compte.mockResolvedValue(0);
  supprPerson.mockResolvedValue({ count: 0 });
  supprPract.mockResolvedValue({ count: 0 });
  supprCompany.mockResolvedValue({ count: 0 });
  delete process.env[DRAPEAU];
});

afterEach(() => {
  if (ORIGINE === undefined) delete process.env[DRAPEAU];
  else process.env[DRAPEAU] = ORIGINE;
});

describe("🔴 D5-5-01 — les fiches sans horizon de conservation", () => {
  it("le comptage cible `retentionUntil: null` ET une inactivité — jamais l'un seul", async () => {
    // La disjonction est tout le correctif. Compter sur la seule inactivité
    // engloberait les lignes que la purge nominale traite déjà (double
    // comptage) ; compter sur le seul `null` compterait des fiches actives.
    await executerPurgeRetention();

    expect(compte).toHaveBeenCalledTimes(3);
    const arg = compte.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where["retentionUntil"]).toBeNull();
    expect(arg.where["updatedAt"]).toHaveProperty("lt");
    expect((arg.where["updatedAt"] as { lt: Date }).lt).toBeInstanceOf(Date);
  });

  it("🔴 alerte AVEC LE NOMBRE quand des fiches sont sur-conservées", async () => {
    // Une alerte qui dirait « des fiches sont sur-conservées » sans chiffre ne
    // permettrait pas de décider — et c'est une décision qu'elle appelle.
    compte.mockResolvedValue(7);

    await executerPurgeRetention();

    expect(creerOuDedup).toHaveBeenCalledTimes(1);
    const a = creerOuDedup.mock.calls[0]?.[0] as { code: string; message: string };
    expect(a.code).toBe("retention_prospection_sans_horizon");
    expect(a.message).toContain("21"); // 7 entreprises + 7 personnes + 7 praticiens
    expect(a.message).toContain("RETENTION_PROSPECTION_PURGE_ENABLED");
  });

  it("se tait quand il n'y a rien à signaler", async () => {
    // Témoin de non-vacuité : sans lui, une alerte inconditionnelle ferait
    // passer le cas précédent sans rien prouver de sa condition.
    compte.mockResolvedValue(0);

    await executerPurgeRetention();

    expect(creerOuDedup).not.toHaveBeenCalled();
  });

  it("🔴 NE SUPPRIME RIEN sans le drapeau — même avec des fiches à purger", async () => {
    // LE point du chantier. Réparer `D5-5-01` consiste à faire supprimer des
    // lignes à un `deleteMany` qui n'en a jamais supprimé aucune, sur des
    // millions d'enregistrements dont ce dépôt ne connaît pas la distribution
    // des dates. Une erreur d'horizon est irréversible. L'activation appartient
    // à un humain qui a lu le nombre.
    compte.mockResolvedValue(1_000_000);

    await executerPurgeRetention();

    for (const suppr of [supprPerson, supprPract, supprCompany]) {
      const appelsSansHorizon = suppr.mock.calls.filter(
        (c) => (c[0] as { where: Record<string, unknown> }).where["retentionUntil"] === null,
      );
      expect(appelsSansHorizon, "une suppression a eu lieu sans autorisation").toHaveLength(0);
    }
  });

  it("supprime quand le drapeau est explicitement posé", async () => {
    // Témoin inverse : sans lui, un `deleteMany` mort ferait passer le cas
    // ci-dessus — on prouverait l'absence de suppression par l'absence de code.
    process.env[DRAPEAU] = "true";
    compte.mockResolvedValue(3);

    await executerPurgeRetention();

    for (const suppr of [supprPerson, supprPract, supprCompany]) {
      const appelsSansHorizon = suppr.mock.calls.filter(
        (c) => (c[0] as { where: Record<string, unknown> }).where["retentionUntil"] === null,
      );
      expect(appelsSansHorizon).toHaveLength(1);
    }
  });

  it("le drapeau à `true` ne suffit pas : encore faut-il qu'il y ait quelque chose", async () => {
    process.env[DRAPEAU] = "true";
    compte.mockResolvedValue(0);

    await executerPurgeRetention();

    for (const suppr of [supprPerson, supprPract, supprCompany]) {
      const appelsSansHorizon = suppr.mock.calls.filter(
        (c) => (c[0] as { where: Record<string, unknown> }).where["retentionUntil"] === null,
      );
      expect(appelsSansHorizon).toHaveLength(0);
    }
  });
});
