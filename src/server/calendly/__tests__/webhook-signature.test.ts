// Tests de la vérification de signature des webhooks Calendly (2026-08-09).
//
// Ce module est la seule barrière entre un endpoint public et le déclenchement
// d'alertes : chaque cas de rejet mérite son test, y compris ceux qui ne se
// produiront « jamais ».

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyCalendlySignature, TOLERANCE_SECONDS } from "../webhook-signature";

const KEY = "clé-de-signature-de-test";
const BODY = JSON.stringify({ event: "invitee.created", payload: { uri: "https://x/y" } });

function sign(body: string, timestampSec: number, key = KEY): string {
  const v1 = crypto
    .createHmac("sha256", key)
    .update(`${timestampSec}.${body}`, "utf8")
    .digest("hex");
  return `t=${timestampSec},v1=${v1}`;
}

const NOW_MS = 1_760_000_000_000;
const NOW_SEC = Math.floor(NOW_MS / 1000);

describe("verifyCalendlySignature", () => {
  it("accepte une signature valide", () => {
    expect(verifyCalendlySignature(BODY, sign(BODY, NOW_SEC), KEY, NOW_MS)).toEqual({ ok: true });
  });

  it("accepte un ordre de champs inversé (v1 avant t)", () => {
    const header = sign(BODY, NOW_SEC);
    const [t, v1] = header.split(",");
    expect(verifyCalendlySignature(BODY, `${v1},${t}`, KEY, NOW_MS)).toEqual({ ok: true });
  });

  it("refuse un en-tête absent", () => {
    expect(verifyCalendlySignature(BODY, null, KEY, NOW_MS)).toEqual({
      ok: false,
      reason: "missing_header",
    });
  });

  it("refuse un en-tête malformé", () => {
    for (const header of ["", "n'importe quoi", "t=123", "v1=abc", "t=pas-un-nombre,v1=abc"]) {
      expect(verifyCalendlySignature(BODY, header, KEY, NOW_MS).ok, header).toBe(false);
    }
  });

  it("refuse un corps modifié d'un seul caractère", () => {
    const header = sign(BODY, NOW_SEC);
    expect(verifyCalendlySignature(`${BODY} `, header, KEY, NOW_MS)).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("refuse une signature produite avec une autre clé", () => {
    const header = sign(BODY, NOW_SEC, "mauvaise-clé");
    expect(verifyCalendlySignature(BODY, header, KEY, NOW_MS)).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  // Rejeu : une requête authentique capturée puis renvoyée plus tard.
  it("refuse une livraison trop ancienne (rejeu)", () => {
    const old = NOW_SEC - TOLERANCE_SECONDS - 1;
    expect(verifyCalendlySignature(BODY, sign(BODY, old), KEY, NOW_MS)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("accepte à la limite exacte de la tolérance", () => {
    const edge = NOW_SEC - TOLERANCE_SECONDS;
    expect(verifyCalendlySignature(BODY, sign(BODY, edge), KEY, NOW_MS)).toEqual({ ok: true });
  });

  // Sans `Math.abs`, une date dans le futur passerait le contrôle de fraîcheur.
  it("refuse une livraison datée dans le futur", () => {
    const future = NOW_SEC + TOLERANCE_SECONDS + 1;
    expect(verifyCalendlySignature(BODY, sign(BODY, future), KEY, NOW_MS)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  // `timingSafeEqual` lève une exception si les tampons n'ont pas la même
  // longueur : sans la garde, une signature tronquée ferait un 500 au lieu d'un 401.
  it("refuse une signature tronquée sans lever d'exception", () => {
    const header = sign(BODY, NOW_SEC).slice(0, -10);
    expect(() => verifyCalendlySignature(BODY, header, KEY, NOW_MS)).not.toThrow();
    expect(verifyCalendlySignature(BODY, header, KEY, NOW_MS).ok).toBe(false);
  });

  it("refuse une signature non hexadécimale sans lever d'exception", () => {
    const header = `t=${NOW_SEC},v1=${"z".repeat(64)}`;
    expect(() => verifyCalendlySignature(BODY, header, KEY, NOW_MS)).not.toThrow();
    expect(verifyCalendlySignature(BODY, header, KEY, NOW_MS).ok).toBe(false);
  });
});
