/**
 * INT-T70-A (REQ-INT-012) — la réponse de la route de relecture, jugée par la copie v3 du contrat
 * que tient axion-ia (`contracts.v3.json`, vérifiée par empreinte).
 *
 * CE QU'IL PROUVE :
 *   — chaque ligne NDJSON rendue, et la page entière, passent `api_relecture_reponse` ;
 *   — les en-têtes passent `api_relecture_reponse_entetes` ;
 *   — TÉMOIN ROUGE : une ligne qui porte un champ hors contrat est refusée par le même juge.
 * La FORME seulement : la signature sur l'ordre canonique du contrat vient en lockstep avec le
 * client de Partners qui la vérifie, par une tâche à part.
 */
import { createHmac, randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import fixtures from "@/server/partners/contrat/fixtures.v3.json";

import { fautes, resoudre } from "../../partners/__tests__/contrat-schema";
import { finaliserCorps } from "../outbox";
import {
  ENTETE_HORODATAGE_RELECTURE,
  ENTETE_SIGNATURE_RELECTURE,
  repondreRelecture,
  type LecteurRelecture,
} from "../relecture";

const BASE = "https://axion-ia.com";
const EVENEMENTS = fixtures.evenements as unknown as Record<string, unknown>[];

let SECRET = "";
let SECRET_RELECTURE = "";
const VARIABLES = [
  "PARTNERS_SYNC_ENABLED",
  "PARTNERS_SYNC_SECRET",
  "PARTNERS_SYNC_URL",
  "PARTNERS_RELECTURE_SECRET",
] as const;
const avant: Partial<Record<(typeof VARIABLES)[number], string | undefined>> = {};

beforeEach(() => {
  for (const v of VARIABLES) avant[v] = process.env[v];
  SECRET = randomBytes(32).toString("hex");
  SECRET_RELECTURE = randomBytes(32).toString("hex");
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.PARTNERS_SYNC_SECRET = SECRET;
  process.env.PARTNERS_SYNC_URL = "https://partners.exemple.test/api/webhooks/axionia";
  process.env.PARTNERS_RELECTURE_SECRET = SECRET_RELECTURE;
});

afterEach(() => {
  for (const v of VARIABLES) {
    if (avant[v] === undefined) delete process.env[v];
    else process.env[v] = avant[v];
  }
});

/**
 * Un lecteur de la file : les enveloppes GÉNÉRÉES de la fixture v3, numérotées 1, 2, 3…, et
 * finalisées par la vraie `finaliserCorps`, comme le relais les stocke — jamais complétées à la main.
 */
function lecteur(): LecteurRelecture {
  const lignes = EVENEMENTS.map((e, i) => ({
    sequence: BigInt(i + 1),
    corps: finaliserCorps(
      JSON.stringify({ ...e, emitted_at: null }),
      BigInt(i + 1),
      new Date(e["occurred_at"] as string),
    ),
  }));
  return {
    partnersSyncOutbox: {
      findMany: async ({ where, take }) =>
        lignes.filter((l) => l.sequence > where.sequence.gt).slice(0, take),
    },
  };
}

function requeteSignee(cible: string, maintenantMs: number): Request {
  const t = String(Math.floor(maintenantMs / 1000));
  return new Request(`${BASE}${cible}`, {
    headers: {
      [ENTETE_HORODATAGE_RELECTURE]: t,
      [ENTETE_SIGNATURE_RELECTURE]: createHmac("sha256", SECRET_RELECTURE)
        .update(`${t}.${cible}`)
        .digest("hex"),
    },
  });
}

async function unePage(apres: number, limite: number) {
  const maintenant = Date.now();
  const r = await repondreRelecture(
    requeteSignee(`/api/partners/evenements?after_sequence=${apres}&limit=${limite}`, maintenant),
    { prisma: lecteur(), maintenantMs: maintenant },
  );
  expect(r.status).toBe(200);
  const corps = await r.text();
  const entetes = Object.fromEntries(
    [...r.headers.entries()].filter(([k]) => k.startsWith("x-axionia-")),
  );
  return {
    corps,
    entetes,
    lignes: corps === "" ? [] : corps.split("\n").map((l) => JSON.parse(l)),
  };
}

describe("REQ-INT-012 — la réponse de la relecture passe la copie v3 du contrat", () => {
  it("REQ-INT-012 : chaque ligne, et la page entière, passent api_relecture_reponse", async () => {
    const { lignes } = await unePage(1, 3);
    expect(lignes).toHaveLength(3);
    expect(fautes(resoudre("#/$defs/api_relecture_reponse"), lignes)).toEqual([]);
  });

  it("REQ-INT-012 : les en-têtes passent api_relecture_reponse_entetes, page pleine ou vide", async () => {
    const pleine = await unePage(0, 2);
    expect(fautes(resoudre("#/$defs/api_relecture_reponse_entetes"), pleine.entetes)).toEqual([]);
    const vide = await unePage(EVENEMENTS.length, 2);
    expect(vide.lignes).toEqual([]);
    expect(fautes(resoudre("#/$defs/api_relecture_reponse_entetes"), vide.entetes)).toEqual([]);
  });

  it("REQ-INT-012 : TÉMOIN ROUGE — une ligne qui porte un champ hors contrat est refusée", async () => {
    const { lignes } = await unePage(0, 1);
    const fautive = [{ ...lignes[0], champ_hors_contrat: true }];
    expect(fautes(resoudre("#/$defs/api_relecture_reponse"), fautive).join("\n")).toMatch(
      /champ_hors_contrat : hors contrat/,
    );
  });
});
