/**
 * INT-T65-A — les server actions admin de la condition suspensive OPCO.
 *
 * Lentille sécurité (une server action admin change) :
 *   - le contrôle d'accès admin est CONSERVÉ : `requireAdminWrite` est appelé
 *     avant toute lecture, et son refus arrête l'action ;
 *   - l'entrée est validée par zod, en mode STRICT : aucun flottant (points de
 *     base ou centimes ENTIERS), exactement un seuil, une date limite qui est
 *     un vrai jour et qui n'est pas passée, aucune clé inattendue ;
 *   - une transition n'est écrite que depuis `en_attente`, avec son journal.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: null }),
}));

const requireAdminWrite = vi.fn();
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => requireAdminWrite(),
  requireHabilitation: vi.fn(),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
  donneesJournalQualiopi: vi.fn(async (i: { action: string; changes: unknown }) => ({
    adminUserId: "admin-1",
    action: i.action,
    targetType: "DocumentGenere",
    targetId: "doc-1",
    changes: i.changes,
    ipAddress: null,
    userAgent: null,
  })),
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
}));

const produireConvention = vi.fn();
const produireConventionTripartite = vi.fn();
vi.mock("@/server/qualiopi/documents/production/producteurs", async (importOriginal) => {
  const reel = await importOriginal<Record<string, unknown>>();
  return {
    ...reel,
    produireConvention: (...a: unknown[]) => produireConvention(...a),
    produireConventionTripartite: (...a: unknown[]) => produireConventionTripartite(...a),
  };
});

const lireConditionSuspensive = vi.fn();
const appliquerTransition = vi.fn();
vi.mock("@/server/qualiopi/financements/condition-suspensive-service", async (importOriginal) => {
  const reel = await importOriginal<Record<string, unknown>>();
  return {
    ...reel,
    lireConditionSuspensive: (...a: unknown[]) => lireConditionSuspensive(...a),
    appliquerTransition: (...a: unknown[]) => appliquerTransition(...a),
  };
});

import {
  constaterConditionSuspensiveAction,
  genererConventionAction,
  genererConventionTripartiteAction,
  renoncerConditionSuspensiveAction,
} from "../documents";
import { debutDuJourDeParis } from "@/server/qualiopi/financements/condition-suspensive";

const SESSION = "5f1d7d4a-0a8e-4c55-9a43-6a4c6e2f9b11";
const DOC = "0b6f0d55-6c1d-4d0e-9f73-0d2a1b7c3e44";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
  requireAdminWrite.mockReset().mockResolvedValue({ userId: "admin-1", role: "super_admin" });
  produireConvention.mockReset().mockResolvedValue({ ok: true, documentId: DOC, numero: "N-1" });
  produireConventionTripartite
    .mockReset()
    .mockResolvedValue({ ok: true, documentId: DOC, numero: "N-2" });
  lireConditionSuspensive.mockReset();
  appliquerTransition.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  vi.useRealTimers();
});

const VALIDE = { seuilConditionBps: 5000, seuilConditionCents: null, dateLimite: "2026-12-15" };

describe("génération sous condition — contrôle d'accès", () => {
  it("🔴 le refus de requireAdminWrite arrête les QUATRE actions avant toute lecture", async () => {
    requireAdminWrite.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(
      genererConventionAction({ sessionId: SESSION, conditionSuspensiveOpco: VALIDE }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      genererConventionTripartiteAction({ sessionId: SESSION, conditionSuspensiveOpco: VALIDE }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(constaterConditionSuspensiveAction({ documentId: DOC })).rejects.toThrow(
      "FORBIDDEN",
    );
    await expect(
      renoncerConditionSuspensiveAction({ documentId: DOC, recueLe: "2026-11-01" }),
    ).rejects.toThrow("FORBIDDEN");
    expect(produireConvention).not.toHaveBeenCalled();
    expect(produireConventionTripartite).not.toHaveBeenCalled();
    expect(lireConditionSuspensive).not.toHaveBeenCalled();
  });
});

describe("génération sous condition — entrée validée par zod, aucun flottant", () => {
  const REFUSEES: ReadonlyArray<[string, unknown]> = [
    ["points de base flottants", { ...VALIDE, seuilConditionBps: 5000.5 }],
    ["centimes flottants", { ...VALIDE, seuilConditionBps: null, seuilConditionCents: 1500.5 }],
    ["deux seuils", { ...VALIDE, seuilConditionCents: 100 }],
    ["aucun seuil", { ...VALIDE, seuilConditionBps: null }],
    ["0 point de base", { ...VALIDE, seuilConditionBps: 0 }],
    ["10 001 points de base", { ...VALIDE, seuilConditionBps: 10_001 }],
    ["0 centime", { ...VALIDE, seuilConditionBps: null, seuilConditionCents: 0 }],
    ["date qui n'existe pas", { ...VALIDE, dateLimite: "2026-02-30" }],
    ["date sans format", { ...VALIDE, dateLimite: "15/12/2026" }],
    ["clé inattendue", { ...VALIDE, etatConditionSuspensive: "active" }],
  ];

  for (const [nom, condition] of REFUSEES) {
    it(`refuse : ${nom}`, async () => {
      const r = await genererConventionAction({
        sessionId: SESSION,
        conditionSuspensiveOpco: condition as never,
      });
      expect(r).toEqual({ error: "Données invalides" });
      const t = await genererConventionTripartiteAction({
        sessionId: SESSION,
        conditionSuspensiveOpco: condition as never,
      });
      expect(t).toEqual({ error: "Données invalides" });
      expect(produireConvention).not.toHaveBeenCalled();
      expect(produireConventionTripartite).not.toHaveBeenCalled();
    });
  }

  it("refuse une date limite déjà passée (jour de Paris)", async () => {
    const r = await genererConventionAction({
      sessionId: SESSION,
      conditionSuspensiveOpco: { ...VALIDE, dateLimite: "2026-10-31" },
    });
    expect(r).toEqual({ error: "La date limite de la condition suspensive est déjà passée." });
    expect(produireConvention).not.toHaveBeenCalled();
  });

  it("transmet un seuil ENTIER au producteur, bipartite comme tripartite", async () => {
    await genererConventionAction({ sessionId: SESSION, conditionSuspensiveOpco: VALIDE });
    expect(produireConvention).toHaveBeenCalledWith(SESSION, {
      conditionSuspensiveOpco: {
        seuil: { type: "pourcentage", bps: 5000 },
        jourLimite: "2026-12-15",
      },
    });
    await genererConventionTripartiteAction({
      sessionId: SESSION,
      conditionSuspensiveOpco: {
        seuilConditionBps: null,
        seuilConditionCents: 150_050,
        dateLimite: "2026-12-15",
      },
    });
    expect(produireConventionTripartite).toHaveBeenCalledWith(SESSION, {
      conditionSuspensiveOpco: {
        seuil: { type: "montant", cents: 150_050 },
        jourLimite: "2026-12-15",
      },
    });
  });

  it("case non cochée : rien ne part vers le producteur", async () => {
    await genererConventionAction({ sessionId: SESSION });
    expect(produireConvention).toHaveBeenCalledWith(SESSION, {});
  });
});

/** Lecture d'une convention à 12 000 € TTC, seuil 50 %, limite le 15/12/2026. */
function lecture(etat: string, evenements: unknown[] = []) {
  return {
    document: {
      id: DOC,
      numero: "AXI-DOC-2026-900",
      sessionId: SESSION,
      clientId: null,
      etat,
      annulee: false,
    },
    condition: {
      seuil: { type: "pourcentage", bps: 5000 },
      prixHtCents: 1_200_000,
      dateLimite: debutDuJourDeParis("2026-12-15"),
      signeeLe: new Date("2026-10-05T09:00:00Z"),
    },
    evenements,
  };
}

describe("constat de la condition — états fermés, transitions journalisées", () => {
  it("accord écrit ≥ seuil → en_attente → active, journalisé dans la même écriture", async () => {
    lireConditionSuspensive.mockResolvedValue(
      lecture("en_attente", [
        {
          type: "accord_ecrit",
          le: new Date("2026-10-20T00:00:00Z"),
          montantAccordeCents: 600_000,
        },
      ]),
    );
    const r = await constaterConditionSuspensiveAction({ documentId: DOC });
    expect(r).toMatchObject({ data: { etat: "active" } });
    expect(appliquerTransition).toHaveBeenCalledTimes(1);
    const arg = appliquerTransition.mock.calls[0]?.[0] as {
      vers: string;
      journal: { action: string; changes: Record<string, unknown> };
    };
    expect(arg.vers).toBe("active");
    expect(arg.journal.action).toBe("qualiopi.convention.condition_suspensive.active");
    expect(arg.journal.changes).toMatchObject({
      de: "en_attente",
      vers: "active",
      cause: "accord_ecrit",
    });
  });

  it("rien n'a décidé et la date limite n'est pas passée : aucune écriture", async () => {
    lireConditionSuspensive.mockResolvedValue(lecture("en_attente"));
    const r = await constaterConditionSuspensiveAction({ documentId: DOC });
    expect(r).toMatchObject({ data: { etat: "en_attente" } });
    expect(appliquerTransition).not.toHaveBeenCalled();
  });

  it("une convention caduque ne revit pas, même avec un accord : aucune écriture", async () => {
    lireConditionSuspensive.mockResolvedValue(
      lecture("caduque", [
        {
          type: "accord_ecrit",
          le: new Date("2026-10-20T00:00:00Z"),
          montantAccordeCents: 1_200_000,
        },
      ]),
    );
    const r = await constaterConditionSuspensiveAction({ documentId: DOC });
    expect(r).toMatchObject({ data: { etat: "caduque" } });
    expect(appliquerTransition).not.toHaveBeenCalled();
  });
});

describe("renonciation du client (C. civ. 1304-4)", () => {
  it("avant la date limite → active, effets à la date de signature", async () => {
    lireConditionSuspensive.mockResolvedValue(lecture("en_attente"));
    const r = await renoncerConditionSuspensiveAction({ documentId: DOC, recueLe: "2026-10-30" });
    expect(r).toMatchObject({ data: { etat: "active" } });
    const arg = appliquerTransition.mock.calls[0]?.[0] as {
      vers: string;
      journal: { action: string; changes: Record<string, unknown> };
    };
    expect(arg.vers).toBe("active");
    expect(arg.journal.action).toBe("qualiopi.convention.condition_suspensive.renonciation");
    expect(arg.journal.changes).toMatchObject({
      cause: "renonciation",
      effetLe: "2026-10-05T09:00:00.000Z",
      renonciationRecueLe: "2026-10-30",
    });
  });

  it("après un refus de l'OPCO : sans objet, aucune écriture", async () => {
    lireConditionSuspensive.mockResolvedValue(
      lecture("en_attente", [{ type: "refus", le: new Date("2026-10-20T10:00:00Z") }]),
    );
    const r = await renoncerConditionSuspensiveAction({ documentId: DOC, recueLe: "2026-10-30" });
    expect("error" in r).toBe(true);
    expect(appliquerTransition).not.toHaveBeenCalled();
  });

  it("refuse une renonciation datée dans le futur", async () => {
    const r = await renoncerConditionSuspensiveAction({ documentId: DOC, recueLe: "2026-11-02" });
    expect(r).toEqual({ error: "La renonciation ne peut pas être datée dans le futur." });
    expect(lireConditionSuspensive).not.toHaveBeenCalled();
  });

  it("refuse une entrée non stricte", async () => {
    const r = await renoncerConditionSuspensiveAction({
      documentId: DOC,
      recueLe: "2026-10-30",
      vers: "active",
    } as never);
    expect(r).toEqual({ error: "Données invalides" });
  });
});
