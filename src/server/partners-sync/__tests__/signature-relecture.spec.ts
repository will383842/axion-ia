// @req REQ-INT-012
// @req REQ-QA-030
/**
 * INT-T72-A — la réponse de relecture signée sur la CHAÎNE CANONIQUE du contrat v3
 * (`api_relecture_reponse_entetes`) : `<horodatage>.<after_sequence>.<limit>.<dernière séquence>.
 * <suite>.<corps exact>`, construite par la fonction partagée avec Partners
 * (`contrat/signature-relecture.ts`), sur le vecteur calculé HORS DU CODE à l'openssl.
 *
 * CE QU'IL PROUVE :
 *   — chaque vecteur donne la chaîne et le HMAC attendus ;
 *   — un nombre à zéro de tête, signé, décimal ou vide, et une suite hors {0, 1}, sont REFUSÉS ;
 *   — la route signe la chaîne canonique, et porte le kid de la clé qui signe ;
 *   — TÉMOIN : une page authentique rejouée sur une autre `after_sequence` ou une autre `limit`
 *     ne vérifie pas — la signature lie la page à SA requête.
 */
import { createHmac, randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { chaineCanoniqueDeRelecture } from "@/server/partners/contrat/signature-relecture";
import vecteurs from "@/server/partners/contrat/fixtures/signature-relecture.vecteurs.json";
import { ENTETE_KID, kidDe } from "@/server/partners/enveloppe";

import {
  ENTETE_HORODATAGE_RELECTURE,
  ENTETE_SIGNATURE_RELECTURE,
  repondreRelecture,
  type LecteurRelecture,
} from "../relecture";

type Entrees = Parameters<typeof chaineCanoniqueDeRelecture>[0];
const hmac = (secret: string, chaine: string) =>
  createHmac("sha256", secret).update(chaine).digest("hex");

describe("REQ-INT-012 — la chaîne canonique, sur le vecteur openssl", () => {
  it.each(vecteurs.vecteurs)("REQ-INT-012 : $cas — la chaîne et le HMAC attendus", (v) => {
    const chaine = chaineCanoniqueDeRelecture(v.entrees as Entrees);
    expect(chaine).toBe(v.chaine);
    expect(hmac(vecteurs.secret, chaine)).toBe(v.hmac);
  });

  const BASE: Entrees = {
    horodatage: "1790000000",
    afterSequence: "1",
    limit: "2",
    derniereSequence: "3",
    suite: "1",
    corps: "x",
  };

  it("REQ-INT-012 : l'horodatage passe TEL QUE reçu dans l'en-tête, sans reformatage", () => {
    expect(chaineCanoniqueDeRelecture({ ...BASE, horodatage: "01790000000" })).toBe(
      "01790000000.1.2.3.1.x",
    );
  });

  it.each([
    ["afterSequence", "01"],
    ["afterSequence", "-1"],
    ["limit", "2.0"],
    ["limit", ""],
    ["derniereSequence", " 3"],
    ["derniereSequence", "3n"],
  ] as const)("REQ-INT-012 : %s = %j est REFUSÉ, jamais normalisé", (champ, valeur) => {
    expect(() => chaineCanoniqueDeRelecture({ ...BASE, [champ]: valeur })).toThrow();
  });

  it.each(["", "2", "01", "true"])("REQ-INT-012 : suite = %j est REFUSÉE", (suite) => {
    expect(() => chaineCanoniqueDeRelecture({ ...BASE, suite })).toThrow();
  });

  it("REQ-INT-012 : zéro s'écrit « 0 », et le corps passe à l'octet, points compris", () => {
    expect(chaineCanoniqueDeRelecture({ ...BASE, afterSequence: "0", corps: "a.b\nc" })).toBe(
      "1790000000.0.2.3.1.a.b\nc",
    );
  });
});

// ── la route ────────────────────────────────────────────────────────────────────────────────

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

function lecteur(n: number): LecteurRelecture {
  const lignes = Array.from({ length: n }, (_, i) => ({
    sequence: BigInt(i + 1),
    corps: JSON.stringify({ n: i + 1 }),
  }));
  return {
    partnersSyncOutbox: {
      findMany: async ({ where, take }) =>
        lignes.filter((l) => l.sequence > where.sequence.gt).slice(0, take),
    },
  };
}

async function page(requete: string) {
  const maintenant = Date.now();
  const cible = `/api/partners/evenements?${requete}`;
  const t = String(Math.floor(maintenant / 1000));
  const r = await repondreRelecture(
    new Request(`https://axion-ia.com${cible}`, {
      headers: {
        [ENTETE_HORODATAGE_RELECTURE]: t,
        [ENTETE_SIGNATURE_RELECTURE]: hmac(SECRET_RELECTURE, `${t}.${cible}`),
      },
    }),
    { prisma: lecteur(5), maintenantMs: maintenant },
  );
  expect(r.status).toBe(200);
  return { corps: await r.text(), h: (k: string) => r.headers.get(k) ?? "" };
}

/** Ce que Partners vérifie : la page, sous les paramètres de SA requête. */
function verifie(p: Awaited<ReturnType<typeof page>>, afterSequence: string, limit: string) {
  const chaine = chaineCanoniqueDeRelecture({
    horodatage: p.h("x-axionia-timestamp"),
    afterSequence,
    limit,
    derniereSequence: p.h("x-axionia-derniere-sequence"),
    suite: p.h("x-axionia-suite"),
    corps: p.corps,
  });
  return p.h("x-axionia-signature") === hmac(SECRET, chaine);
}

describe("REQ-INT-012 — la route signe la chaîne canonique, liée à SA requête", () => {
  it("REQ-INT-012 : page pleine, page vide — la signature est celle de la chaîne canonique", async () => {
    expect(verifie(await page("after_sequence=1&limit=2"), "1", "2")).toBe(true);
    expect(verifie(await page("after_sequence=5&limit=2"), "5", "2")).toBe(true);
  });

  it("REQ-INT-012 : des paramètres à zéro de tête sont signés sous leur forme sans zéro", async () => {
    expect(verifie(await page("after_sequence=001&limit=02"), "1", "2")).toBe(true);
  });

  it("REQ-INT-012 : TÉMOIN — rejouée sur une autre after_sequence ou une autre limit, la page ne vérifie pas", async () => {
    const p = await page("after_sequence=1&limit=2");
    expect(verifie(p, "2", "2")).toBe(false);
    expect(verifie(p, "1", "3")).toBe(false);
    expect(verifie(p, "0", "2")).toBe(false);
  });

  it("REQ-QA-030 : la réponse porte le kid de la clé qui signe", async () => {
    const p = await page("after_sequence=1&limit=2");
    expect(p.h(ENTETE_KID.toLowerCase())).toBe(kidDe(SECRET));
  });
});
