import { describe, it, expect } from "vitest";
import {
  FENETRE_SECONDES,
  chaineASigner,
  sha256Hex,
  signerRequete,
  verifierRequete,
} from "../signature";

const SECRET = "s".repeat(40);
const PRECEDENT = "p".repeat(40);
const NONCE = "0123456789abcdef0123456789abcdef";
const T0 = 1_800_000_000;
const CORPS = JSON.stringify({ schemaVersion: 1, studioVideoId: "vs_abcdefgh" });

function demande(
  over: Partial<{
    horodatage: string;
    nonce: string;
    methode: string;
    chemin: string;
    corps: string;
    secret: string;
  }> = {},
) {
  const base = {
    horodatage: String(T0),
    nonce: NONCE,
    methode: "POST",
    chemin: "/api/interne/videos",
    corps: CORPS,
    secret: SECRET,
  };
  const d = { ...base, ...over };
  const signature = signerRequete({
    secret: d.secret,
    horodatage: base.horodatage,
    nonce: base.nonce,
    methode: base.methode,
    chemin: base.chemin,
    corps: base.corps,
  });
  return { signature, d };
}

function verifier(
  signature: string,
  d: { horodatage: string; nonce: string; methode: string; chemin: string; corps: string },
  maintenant = T0,
  secrets = { courant: SECRET, precedent: null as string | null },
) {
  return verifierRequete({
    secrets,
    entetes: { horodatage: d.horodatage, nonce: d.nonce, signature },
    methode: d.methode,
    chemin: d.chemin,
    corps: d.corps,
    maintenantSec: maintenant,
  });
}

describe("chaîne signée", () => {
  it("v1 \\n horodatage \\n nonce \\n METHODE \\n chemin \\n sha256(corps)", () => {
    expect(
      chaineASigner({
        horodatage: "1800000000",
        nonce: NONCE,
        methode: "post",
        chemin: "/a",
        corpsSha256: "ab",
      }),
    ).toBe(`v1\n1800000000\n${NONCE}\nPOST\n/a\nab`);
  });
});

describe("verifierRequete", () => {
  it("signature valide → ok, secret courant", () => {
    const { signature, d } = demande();
    expect(verifier(signature, d)).toEqual({ ok: true, secret: "courant" });
  });

  it("signature fausse (un caractère) → signature_invalide", () => {
    const { signature, d } = demande();
    const fausse = signature.slice(0, -1) + (signature.endsWith("0") ? "1" : "0");
    expect(verifier(fausse, d)).toEqual({ ok: false, raison: "signature_invalide" });
  });

  it("corps modifié d'un octet → refusé", () => {
    const { signature, d } = demande();
    expect(verifier(signature, { ...d, corps: CORPS + " " }).ok).toBe(false);
  });

  it("méthode changée → refusé", () => {
    const { signature, d } = demande();
    expect(verifier(signature, { ...d, methode: "DELETE" }).ok).toBe(false);
  });

  it("chemin changé → refusé (un GET réglages ne se rejoue pas en DELETE videos)", () => {
    const { signature, d } = demande({});
    expect(verifier(signature, { ...d, chemin: "/api/interne/reglages-publics" }).ok).toBe(false);
  });

  it("horodatage à +300 s accepté, +301 s refusé", () => {
    const { signature, d } = demande();
    expect(verifier(signature, d, T0 + FENETRE_SECONDES).ok).toBe(true);
    expect(verifier(signature, d, T0 + FENETRE_SECONDES + 1)).toEqual({
      ok: false,
      raison: "horodatage_hors_fenetre",
    });
  });

  it("horodatage à -299 s accepté, -301 s refusé", () => {
    const { signature, d } = demande();
    expect(verifier(signature, d, T0 - 299).ok).toBe(true);
    expect(verifier(signature, d, T0 - 301)).toEqual({
      ok: false,
      raison: "horodatage_hors_fenetre",
    });
  });

  it.each(["1800000000.5", "abcdefghij", "18000000", "18000000000", "1800000000 ", ""])(
    "horodatage mal formé %j → entetes_invalides",
    (h) => {
      const { signature, d } = demande();
      expect(verifier(signature, { ...d, horodatage: h })).toEqual({
        ok: false,
        raison: "entetes_invalides",
      });
    },
  );

  it.each([
    "",
    "ABCDEF0123456789ABCDEF0123456789",
    "0123456789abcdef",
    "0123456789abcdef0123456789abcdeg",
  ])("nonce mal formé %j → entetes_invalides", (n) => {
    const { signature, d } = demande();
    expect(verifier(signature, { ...d, nonce: n }).ok).toBe(false);
  });

  it.each([
    "",
    "v2=" + "a".repeat(64),
    "v1=" + "a".repeat(63),
    "v1=" + "A".repeat(64),
    "a".repeat(64),
  ])("signature mal formée %j → entetes_invalides", (s) => {
    const { d } = demande();
    expect(verifier(s, d)).toEqual({ ok: false, raison: "entetes_invalides" });
  });

  it("signé avec le secret précédent → accepté et signalé", () => {
    const { signature, d } = demande({ secret: PRECEDENT });
    expect(verifier(signature, d, T0, { courant: SECRET, precedent: PRECEDENT })).toEqual({
      ok: true,
      secret: "precedent",
    });
  });

  it("secret précédent absent → un ancien secret est refusé", () => {
    const { signature, d } = demande({ secret: PRECEDENT });
    expect(verifier(signature, d).ok).toBe(false);
  });

  it("corps vide (GET) : sha256 de la chaîne vide", () => {
    const signature = signerRequete({
      secret: SECRET,
      horodatage: String(T0),
      nonce: NONCE,
      methode: "GET",
      chemin: "/api/interne/reglages-publics",
      corps: "",
    });
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    const r = verifierRequete({
      secrets: { courant: SECRET, precedent: null },
      entetes: { horodatage: String(T0), nonce: NONCE, signature },
      methode: "GET",
      chemin: "/api/interne/reglages-publics",
      corps: "",
      maintenantSec: T0,
    });
    expect(r.ok).toBe(true);
  });
});
