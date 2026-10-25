// Interblocage Postgres (40P01) et conflit de sérialisation (40001) sur les transactions du
// questionnaire avant audit : nouvel essai BORNÉ de la transaction entière (annulée en bloc par
// Postgres), jamais de ligne ni d'envoi en double.

import { beforeEach, describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => {
  const lignes: string[] = [];
  return {
    lignes,
    essais: 0,
    pannes: [] as unknown[],
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    // Comme Postgres : une transaction qui échoue est ANNULÉE, ses écritures disparaissent.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      base.essais += 1;
      const avant = base.lignes.length;
      try {
        return await fn(client);
      } catch (e) {
        base.lignes.length = avant;
        throw e;
      }
    },
  },
}));

const client = {
  $queryRaw: async () => {
    const panne = base.pannes.shift();
    if (panne !== undefined) throw panne;
    return [{ id: "q1" }];
  },
  questionnaireAvantAudit: {
    findUnique: async () => ({
      envoyeLe: new Date(Date.now() - 1000),
      closLe: null,
      expireLe: new Date(Date.now() + 86_400_000),
    }),
    update: async () => ({}),
  },
  questionnaireAvantAuditEnvoi: {
    findMany: async () => [],
    count: async () => 0,
    create: async () => {
      base.lignes.push("reponse");
      return {};
    },
  },
  questionnaireAvantAuditBrouillon: { deleteMany: async () => ({ count: 0 }) },
};

vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class MessagePourWill extends Error {},
}));
vi.mock("@/lib/chiffrer-parole", () => ({
  chiffrerParole: (s: string) => s,
  dechiffrerParole: (s: string) => s,
}));
vi.mock("@/server/visio/questionnaire-en-ligne/jeton", () => ({
  codeDirigeantPreauditValide: () => false,
  jetonPreauditValide: () => true,
}));

import { enregistrerReponse } from "../serveur";

const charge = {
  mode: "main",
  membre: null,
  envoyeLe: null,
  infosEmail: null,
  json: "{}",
} as never;

const interblocage = Object.assign(new Error("deadlock detected"), { code: "40P01" });

describe("transactions du questionnaire : interblocage et conflit", () => {
  beforeEach(() => {
    base.lignes.length = 0;
    base.essais = 0;
    base.pannes = [];
  });

  it("40P01 puis succès : la réponse est écrite UNE seule fois", async () => {
    base.pannes = [interblocage];
    expect(await enregistrerReponse({ id: "q1" }, charge)).toBe("ok");
    expect(base.essais).toBe(2);
    expect(base.lignes).toEqual(["reponse"]);
  });

  it("40001 (dans meta) est repris aussi", async () => {
    base.pannes = [Object.assign(new Error("x"), { meta: { code: "40001" } })];
    expect(await enregistrerReponse({ id: "q1" }, charge)).toBe("ok");
    expect(base.essais).toBe(2);
  });

  it("l'essai est borné : l'erreur remonte après le dernier", async () => {
    base.pannes = [interblocage, interblocage, interblocage, interblocage, interblocage];
    await expect(enregistrerReponse({ id: "q1" }, charge)).rejects.toBe(interblocage);
    expect(base.essais).toBe(3);
    expect(base.lignes).toEqual([]);
  });

  it("une autre erreur n'est jamais rejouée", async () => {
    const autre = new Error("connexion perdue");
    base.pannes = [autre];
    await expect(enregistrerReponse({ id: "q1" }, charge)).rejects.toBe(autre);
    expect(base.essais).toBe(1);
  });
});
