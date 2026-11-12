// Jeton d'opposition `op2` — opaque, déterministe, sans table (plan « jeton op2 », J1).
//
// Ce qui est gardé : rien dans le jeton ne laisse lire l'adresse ; même adresse, même
// jeton ; toute altération (iv, chiffré, tag, kid) est refusée ; un IV arbitraire est
// refusé même si le tag GCM tient ; sans secret dédié, aucun jeton `op2` n'est émis.

import { createCipheriv, createHash, createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { estJetonOpposition, jetonOppositionOp2, lireJetonOpposition } from "../opposition-jeton";

const SECRET = "secret-dedie-op2-suffisamment-long-0123456789";

beforeEach(() => {
  process.env["OPPOSITION_JETON_SECRET"] = SECRET;
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

function altererOctet(jeton: string, indexCorps: number): string {
  const [p, kid, corps] = jeton.split(".") as [string, string, string];
  const buf = Buffer.from(corps, "base64url");
  buf[indexCorps] = (buf[indexCorps] ?? 0) ^ 0x01;
  return `${p}.${kid}.${buf.toString("base64url")}`;
}

describe("jeton op2 — aller-retour et opacité", () => {
  it("se relit vers l'adresse normalisée", () => {
    const jeton = jetonOppositionOp2("A@B.fr ");
    expect(jeton).not.toBeNull();
    expect(jeton!.startsWith("op2.k1.")).toBe(true);
    expect(estJetonOpposition(jeton)).toBe(true);
    expect(lireJetonOpposition(jeton!)).toBe("a@b.fr");
  });

  it("🔴 ne contient ni l'adresse, ni son base64/base64url, ni sa partie locale", () => {
    const adresse = "jean.dupont@client-exemple.fr";
    const jeton = jetonOppositionOp2(adresse)!;
    const b64 = Buffer.from(adresse).toString("base64");
    const b64url = Buffer.from(adresse).toString("base64url");
    const local = Buffer.from("jean.dupont").toString("base64url");
    for (const interdit of [adresse, "jean.dupont", "client-exemple", b64, b64url, local]) {
      expect(jeton).not.toContain(interdit);
    }
    // Le corps décodé ne contient pas l'adresse non plus (c'est du chiffré).
    const corps = Buffer.from(jeton.split(".")[2]!, "base64url").toString("latin1");
    expect(corps).not.toContain("dupont");
  });

  it("est stable : même adresse, même jeton ; deux adresses, deux jetons", () => {
    expect(jetonOppositionOp2("x@y.fr")).toBe(jetonOppositionOp2(" X@Y.fr "));
    expect(jetonOppositionOp2("x@y.fr")).not.toBe(jetonOppositionOp2("z@y.fr"));
  });
});

describe("jeton op2 — refus", () => {
  it("🔴 un octet altéré (iv, chiffré, tag) → null", () => {
    const jeton = jetonOppositionOp2("jean@client.fr")!;
    const longueur = Buffer.from(jeton.split(".")[2]!, "base64url").length;
    for (const i of [0, 11, 12, longueur - 17, longueur - 16, longueur - 1]) {
      expect(lireJetonOpposition(altererOctet(jeton, i))).toBeNull();
    }
  });

  it("kid altéré ou inconnu → null", () => {
    const jeton = jetonOppositionOp2("jean@client.fr")!;
    expect(lireJetonOpposition(jeton.replace(".k1.", ".k2."))).toBeNull();
    expect(lireJetonOpposition(jeton.replace(".k1.", ".K1."))).toBeNull();
    expect(lireJetonOpposition(jeton.replace(".k1.", ".."))).toBeNull();
  });

  it("🔴 un IV remplacé par celui d'une autre adresse (tag recalculé) → null", () => {
    // Jeton fabriqué avec la bonne clé de chiffrement mais un IV qui n'est pas
    // celui de l'adresse : le tag GCM tient, la règle de l'IV synthétique non.
    const cleEnc = createHash("sha256").update(`axion-opposition-op2-enc|k1|${SECRET}`).digest();
    const cleIv = createHash("sha256").update(`axion-opposition-op2-iv|k1|${SECRET}`).digest();
    const ivAutre = createHmac("sha256", cleIv).update("autre@client.fr").digest().subarray(0, 12);
    const c = createCipheriv("aes-256-gcm", cleEnc, ivAutre);
    c.setAAD(Buffer.from("op2|k1"));
    const chiffre = Buffer.concat([c.update("jean@client.fr", "utf8"), c.final()]);
    const forge = `op2.k1.${Buffer.concat([ivAutre, chiffre, c.getAuthTag()]).toString("base64url")}`;
    expect(lireJetonOpposition(forge)).toBeNull();
  });

  it("plus de 512 caractères → null, sans calcul", () => {
    expect(lireJetonOpposition(`op2.k1.${"A".repeat(520)}`)).toBeNull();
  });

  it("autre secret → null", () => {
    const jeton = jetonOppositionOp2("jean@client.fr")!;
    process.env["OPPOSITION_JETON_SECRET"] = "un-autre-secret-dedie-tout-aussi-long-9876543210";
    expect(lireJetonOpposition(jeton)).toBeNull();
  });

  it("secret absent ou trop court → jetonOppositionOp2 rend null, et la lecture aussi", () => {
    const jeton = jetonOppositionOp2("jean@client.fr")!;
    delete process.env["OPPOSITION_JETON_SECRET"];
    expect(jetonOppositionOp2("jean@client.fr")).toBeNull();
    expect(lireJetonOpposition(jeton)).toBeNull();
    process.env["OPPOSITION_JETON_SECRET"] = "trop-court";
    expect(jetonOppositionOp2("jean@client.fr")).toBeNull();
  });

  it("jetons mal formés → null, sans lever", () => {
    for (const t of [
      "op2",
      "op2.",
      "op2.k1",
      "op2.k1.",
      "op2.k1.!!!",
      "op2.k1.AAAA",
      "op3.k1.AAAA",
    ]) {
      expect(lireJetonOpposition(t)).toBeNull();
    }
  });
});

describe("jeton op2 — lecture sans secret : l'échec ne reste pas muet", () => {
  it("🔴 un op2 bien formé lu sans secret alerte UNE fois, sans valeur, et rend null", async () => {
    const jeton = jetonOppositionOp2("personne@example.test")!;
    delete process.env["OPPOSITION_JETON_SECRET"];
    vi.resetModules();
    const m = await import("../opposition-jeton");
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(m.lireJetonOpposition(jeton)).toBeNull();
    expect(m.lireJetonOpposition(jeton)).toBeNull();
    expect(erreur).toHaveBeenCalledTimes(1);
    const sortie = String(erreur.mock.calls[0]![0]);
    expect(sortie).toContain("opposition_jeton_op2_illisible_sans_secret");
    expect(sortie).toContain("k1");
    expect(sortie).not.toContain(jeton);
    expect(sortie).not.toContain("personne@example.test");
    erreur.mockRestore();
  });
});
