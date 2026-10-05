// @req REQ-INT-012
// @req REQ-SEC-010
/**
 * Chantier Axion Partners — INT-T72-A : la réponse de la RELECTURE est signée sur la chaîne
 * CANONIQUE que Partners vérifie (INT-T74-P ; condition 3 de la sécurité, forme d'A02) :
 * `<horodatage>.<after_sequence>.<limit>.<x-axionia-derniere-sequence>.<x-axionia-suite>.<corps>`.
 *
 * La chaîne est construite par la fonction PARTAGÉE, copiée À L'OCTET depuis Partners
 * (`src/server/partners/contrat/signature-relecture.ts`, sous l'empreinte de `contracts.sha256`) ;
 * chaque côté calcule son HMAC avec son propre module. Ce fichier garde : les vecteurs figés,
 * calculés hors du code par openssl, rejoués ici ; la copie identique à ce que Partners publie ; la
 * page rejouée sur une autre `after_sequence` ou une autre `limit`, qui ne vérifie plus.
 */
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import vecteurs from "@/server/partners/contrat/fixtures/signature-relecture.vecteurs.json";
import { chaineCanoniqueDeRelecture } from "@/server/partners/contrat/signature-relecture";

import {
  ENTETE_HORODATAGE_RELECTURE,
  ENTETE_SIGNATURE_RELECTURE,
  repondreRelecture,
  signerCibleRelecture,
} from "../relecture";

const RACINE = path.resolve(process.cwd(), "src", "server", "partners", "contrat");
const hmac = (secret: string, chaine: string) =>
  createHmac("sha256", secret).update(chaine, "utf8").digest("hex");

describe("REQ-INT-012 — la chaîne canonique, rejouée sur les vecteurs openssl de Partners", () => {
  it("REQ-INT-012 : TÉMOIN — chaque vecteur : la même chaîne, et le même HMAC que celui calculé hors du code", () => {
    expect(vecteurs.vecteurs.length).toBeGreaterThan(0);
    for (const v of vecteurs.vecteurs) {
      expect(chaineCanoniqueDeRelecture(v.entrees), v.nom).toBe(v.chaine);
      expect(hmac(vecteurs.secret, v.chaine), v.nom).toBe(v.hmacSha256);
    }
  });

  it("REQ-INT-012 : TÉMOIN — une autre after_sequence, ou une autre limit, donne une autre signature", () => {
    const v = vecteurs.vecteurs[0]!;
    const juste = hmac(vecteurs.secret, chaineCanoniqueDeRelecture(v.entrees));
    for (const autre of [
      { ...v.entrees, afterSequence: "4" },
      { ...v.entrees, limit: "50" },
    ]) {
      expect(hmac(vecteurs.secret, chaineCanoniqueDeRelecture(autre))).not.toBe(juste);
    }
  });

  it("REQ-INT-012 : la copie est IDENTIQUE à celle que Partners publie : chaque fichier a sa ligne, APRÈS celle du contrat", () => {
    const lignes = readFileSync(path.join(RACINE, "contracts.sha256"), "utf8")
      .trimEnd()
      .split("\n");
    expect(lignes[0]).toMatch(/^[0-9a-f]{64} {2}contracts\.v\d+\.json$/);
    const sha = (f: string) =>
      createHash("sha256")
        .update(readFileSync(path.join(RACINE, f)))
        .digest("hex");
    expect(lignes.slice(1)).toEqual(
      ["signature-relecture.ts", "fixtures/signature-relecture.vecteurs.json"].map(
        (f) => `${sha(f)}  ${f}`,
      ),
    );
  });
});

describe("REQ-SEC-010 — la route de relecture signe la forme canonique, liée à SA requête", () => {
  const ENV = { ...process.env };
  const SECRET_EMISSION = "e".repeat(40);
  const SECRET_RELECTURE = "r".repeat(40);
  const MAINTENANT_MS = Date.UTC(2026, 9, 5, 12, 0, 0);
  const T = String(Math.floor(MAINTENANT_MS / 1000));
  const LIGNES = [
    { sequence: 4n, corps: '{"event_id":"a","sequence":4}' },
    { sequence: 5n, corps: '{"event_id":"b","sequence":5}' },
    { sequence: 6n, corps: '{"event_id":"c","sequence":6}' },
  ];
  beforeEach(() => {
    process.env.PARTNERS_SYNC_ENABLED = "true";
    process.env.PARTNERS_SYNC_SECRET = SECRET_EMISSION;
    process.env.PARTNERS_RELECTURE_SECRET = SECRET_RELECTURE;
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });
  afterEach(() => {
    process.env = { ...ENV };
  });

  function lire(cible: string): Promise<Response> {
    return repondreRelecture(
      new Request(`https://axion-ia.com${cible}`, {
        headers: {
          [ENTETE_HORODATAGE_RELECTURE]: T,
          [ENTETE_SIGNATURE_RELECTURE]: signerCibleRelecture(SECRET_RELECTURE, T, cible),
        },
      }),
      {
        prisma: {
          partnersSyncOutbox: {
            findMany: async ({ take }) => LIGNES.slice(0, take),
          },
        },
        maintenantMs: MAINTENANT_MS,
      },
    );
  }

  it("REQ-SEC-010 : TÉMOIN — la signature est celle de la chaîne canonique, pas de la forme courte « t.corps »", async () => {
    const r = await lire("/api/partners/evenements?after_sequence=3&limit=2");
    const corps = await r.text();
    const t = r.headers.get("x-axionia-timestamp")!;
    expect([
      r.headers.get("x-axionia-derniere-sequence"),
      r.headers.get("x-axionia-suite"),
    ]).toEqual(["5", "1"]);
    const attendue = hmac(
      SECRET_EMISSION,
      chaineCanoniqueDeRelecture({
        horodatage: t,
        afterSequence: "3",
        limit: "2",
        derniereSequence: "5",
        suite: "1",
        corps,
      }),
    );
    expect(r.headers.get("x-axionia-signature")).toBe(attendue);
    expect(r.headers.get("x-axionia-signature")).not.toBe(hmac(SECRET_EMISSION, `${t}.${corps}`));
  });

  it("REQ-SEC-010 : TÉMOIN — une page authentique, rejouée sur une requête d'une autre after_sequence ou d'une autre limit, ne vérifie pas", async () => {
    const r = await lire("/api/partners/evenements?after_sequence=3&limit=2");
    const corps = await r.text();
    const signature = r.headers.get("x-axionia-signature");
    const t = r.headers.get("x-axionia-timestamp")!;
    for (const [afterSequence, limit] of [
      ["2", "2"],
      ["3", "3"],
    ] as const) {
      const chaine = chaineCanoniqueDeRelecture({
        horodatage: t,
        afterSequence,
        limit,
        derniereSequence: "5",
        suite: "1",
        corps,
      });
      expect(hmac(SECRET_EMISSION, chaine)).not.toBe(signature);
    }
  });

  it("REQ-SEC-010 : la page vide d'une lecture au-delà de la file reste signée, sa dernière séquence est celle demandée", async () => {
    const r = await repondreRelecture(
      new Request("https://axion-ia.com/api/partners/evenements?after_sequence=9&limit=100", {
        headers: {
          [ENTETE_HORODATAGE_RELECTURE]: T,
          [ENTETE_SIGNATURE_RELECTURE]: signerCibleRelecture(
            SECRET_RELECTURE,
            T,
            "/api/partners/evenements?after_sequence=9&limit=100",
          ),
        },
      }),
      { prisma: { partnersSyncOutbox: { findMany: async () => [] } }, maintenantMs: MAINTENANT_MS },
    );
    const t = r.headers.get("x-axionia-timestamp")!;
    expect(await r.text()).toBe("");
    expect(r.headers.get("x-axionia-signature")).toBe(
      hmac(
        SECRET_EMISSION,
        chaineCanoniqueDeRelecture({
          horodatage: t,
          afterSequence: "9",
          limit: "100",
          derniereSequence: "9",
          suite: "0",
          corps: "",
        }),
      ),
    );
  });
});
