/**
 * Lot S1 « page Recevoir le guide » — jeton signé du lien /guide-reseau?j=<jeton>.
 * Module pur : aucune base, aucun réseau. Valeurs 100 % fictives (example.test).
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DUREE_JETON_SECONDES,
  TAILLE_MAX_JETON,
  creerJeton,
  empreinteJeton,
  verifierJeton,
  verifierSecretsDistincts,
} from "../lien-page-guide";

const SECRET = "secret-fictif-example-test-0123456789-abcdef";
const T0 = Date.UTC(2026, 10, 1, 12, 0, 0);
const DONNEES = {
  conv: "conv_example_0001",
  mot: "GUIDE",
  reseau: "linkedin",
  guide: "guide-reseau-exemple",
  compte: "compte_example_01",
  post_ref: "post_example_01",
  version_m1: "m1.2",
} as const;

const b64u = (s: string | Buffer) => Buffer.from(s).toString("base64url");
/** Fabrique un jeton correctement signé autour d'une charge arbitraire. */
function signer(charge: unknown, secret = SECRET): string {
  const p = b64u(JSON.stringify(charge));
  return `${p}.${createHmac("sha256", secret).update(p).digest("base64url")}`;
}
const chargeValide = () => ({
  v: 1,
  ...DONNEES,
  exp: Math.floor(T0 / 1000) + DUREE_JETON_SECONDES,
});

describe("lien-page-guide — aller-retour", () => {
  it("crée puis vérifie un jeton, sans aucune adresse ni pseudo dedans", () => {
    const jeton = creerJeton(DONNEES, SECRET, T0);
    expect(jeton.length).toBeLessThanOrEqual(TAILLE_MAX_JETON);
    const r = verifierJeton(jeton, SECRET, T0 + 1000);
    expect(r).toEqual({ ok: true, donnees: chargeValide() });
    expect(Buffer.from(jeton.split(".")[0]!, "base64url").toString()).not.toContain("@");
  });

  it("post_ref est facultatif", () => {
    const { post_ref: _omis, ...sans } = DONNEES;
    const r = verifierJeton(creerJeton(sans, SECRET, T0), SECRET, T0);
    expect(r.ok).toBe(true);
  });

  it("la durée est de 7 jours", () => {
    expect(DUREE_JETON_SECONDES).toBe(7 * 24 * 3600);
  });
});

describe("lien-page-guide — refus", () => {
  it("signature falsifiée", () => {
    const [p, s] = creerJeton(DONNEES, SECRET, T0).split(".");
    const faux = `${p}.${s!.slice(0, -2)}${s!.endsWith("AA") ? "BB" : "AA"}`;
    expect(verifierJeton(faux, SECRET, T0)).toEqual({ ok: false, motif: "signature" });
  });

  it("charge modifiée, signature d'origine conservée", () => {
    const [, s] = creerJeton(DONNEES, SECRET, T0).split(".");
    const p = b64u(JSON.stringify({ ...chargeValide(), mot: "AUTRE" }));
    expect(verifierJeton(`${p}.${s}`, SECRET, T0)).toEqual({ ok: false, motif: "signature" });
  });

  it("autre secret", () => {
    const jeton = creerJeton(DONNEES, SECRET, T0);
    expect(verifierJeton(jeton, `${SECRET}-autre`, T0)).toEqual({ ok: false, motif: "signature" });
  });

  it("expiré : valable jusqu'à exp exclu, refusé à la seconde exacte", () => {
    const jeton = creerJeton(DONNEES, SECRET, T0);
    const finMs = T0 + DUREE_JETON_SECONDES * 1000;
    expect(verifierJeton(jeton, SECRET, finMs - 1).ok).toBe(true);
    expect(verifierJeton(jeton, SECRET, finMs)).toEqual({ ok: false, motif: "expire" });
    expect(verifierJeton(jeton, SECRET, finMs + 1)).toEqual({ ok: false, motif: "expire" });
  });

  it("champ en trop (signé correctement) → champs", () => {
    const j = signer({ ...chargeValide(), email: "x" });
    expect(verifierJeton(j, SECRET, T0)).toEqual({ ok: false, motif: "champs" });
  });

  it.each(["conv", "mot", "reseau", "guide", "compte", "version_m1", "exp", "v"])(
    "champ manquant %s → champs",
    (cle) => {
      const c: Record<string, unknown> = chargeValide();
      delete c[cle];
      expect(verifierJeton(signer(c), SECRET, T0)).toEqual({ ok: false, motif: "champs" });
    },
  );

  it.each([
    ["v", 2],
    ["conv", "court"],
    ["mot", "minuscule"],
    ["mot", "A".repeat(31)], // colonne VarChar(30)
    ["reseau", "tiktok"],
    ["guide", "Guide Majuscule"],
    ["compte", ""],
    ["post_ref", "x".repeat(65)],
    ["exp", "123"],
  ])("valeur invalide %s → champs", (cle, valeur) => {
    expect(verifierJeton(signer({ ...chargeValide(), [cle]: valeur }), SECRET, T0)).toEqual({
      ok: false,
      motif: "champs",
    });
  });

  it.each(["conv", "mot", "guide", "compte", "post_ref", "version_m1"])(
    "aucune adresse e-mail ne passe (%s contenant @)",
    (cle) => {
      const c = { ...chargeValide(), [cle]: "jean@example.test" };
      expect(verifierJeton(signer(c), SECRET, T0)).toEqual({ ok: false, motif: "champs" });
      const { v: _v, exp: _e, ...d } = c;
      expect(() => creerJeton(d as never, SECRET, T0)).toThrow();
    },
  );

  it("jeton tronqué", () => {
    const jeton = creerJeton(DONNEES, SECRET, T0);
    expect(verifierJeton(jeton.slice(0, 20), SECRET, T0)).toEqual({ ok: false, motif: "format" });
    expect(verifierJeton(jeton.split(".")[0]!, SECRET, T0)).toEqual({ ok: false, motif: "format" });
  });

  it("base64 invalide / vide / trop long / trois morceaux", () => {
    for (const j of ["", "!!!.???", "a b.c d", "a.b.c", "é.é"]) {
      expect(verifierJeton(j, SECRET, T0)).toEqual({ ok: false, motif: "format" });
    }
    const long = `${"A".repeat(TAILLE_MAX_JETON)}.AAAA`;
    expect(verifierJeton(long, SECRET, T0)).toEqual({ ok: false, motif: "format" });
  });

  it("charge signée mais pas du JSON → champs", () => {
    expect(verifierJeton(signer("pas un objet"), SECRET, T0)).toEqual({
      ok: false,
      motif: "champs",
    });
    const p = b64u("{pas json");
    const s = createHmac("sha256", SECRET).update(p).digest("base64url");
    expect(verifierJeton(`${p}.${s}`, SECRET, T0)).toEqual({ ok: false, motif: "champs" });
  });

  it("entrée non textuelle → format", () => {
    expect(verifierJeton(undefined as never, SECRET, T0)).toEqual({ ok: false, motif: "format" });
  });
});

describe("lien-page-guide — secret", () => {
  it.each([undefined, null, "", "trop-court-31-caracteres-012345", "x".repeat(31)])(
    "secret absent ou court (%s) → erreur explicite",
    (secret) => {
      expect(() => creerJeton(DONNEES, secret as never, T0)).toThrow(/GUIDES_RESEAU_LIEN_SECRET/);
      expect(() => verifierJeton("a.b", secret as never, T0)).toThrow(/GUIDES_RESEAU_LIEN_SECRET/);
    },
  );

  it("32 caractères suffisent", () => {
    expect(() => creerJeton(DONNEES, "x".repeat(32), T0)).not.toThrow();
  });
});

describe("lien-page-guide — empreinte et fixture", () => {
  it("empreinte stable : sha256 hexadécimal de 64 caractères", () => {
    const jeton = creerJeton(DONNEES, SECRET, T0);
    expect(empreinteJeton(jeton)).toMatch(/^[0-9a-f]{64}$/);
    expect(empreinteJeton(jeton)).toBe(empreinteJeton(jeton));
    expect(empreinteJeton(jeton)).not.toBe(empreinteJeton(`${jeton}x`));
  });

  it("fixture commune : déterministe et relisible", () => {
    const f = JSON.parse(
      readFileSync(join(__dirname, "fixtures", "lien-page-guide.v1.json"), "utf8"),
    ) as {
      secret: string;
      maintenant_ms: number;
      donnees: Parameters<typeof creerJeton>[0];
      jeton: string;
      empreinte: string;
    };
    expect(f.secret).toHaveLength(40);
    expect(creerJeton(f.donnees, f.secret, f.maintenant_ms)).toBe(f.jeton);
    expect(empreinteJeton(f.jeton)).toBe(f.empreinte);
    expect(verifierJeton(f.jeton, f.secret, f.maintenant_ms).ok).toBe(true);
    expect(JSON.stringify(f)).not.toContain("@");
  });
});

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

describe("lien-page-guide — forme canonique (D1)", () => {
  it("les 3 variantes du dernier caractère de la signature sont refusées", () => {
    const jeton = creerJeton(DONNEES, SECRET, T0);
    const dernier = jeton.slice(-1);
    const base = jeton.slice(0, -1);
    // Les 3 autres caractères partageant les 4 bits de tête (2 bits de queue ignorés).
    const idx = ALPHABET.indexOf(dernier);
    const variantes = [0, 1, 2, 3]
      .map((k) => ALPHABET[(idx & ~3) | k]!)
      .filter((c) => c !== dernier);
    expect(variantes).toHaveLength(3);
    for (const c of variantes) {
      expect(verifierJeton(base + c, SECRET, T0)).toEqual({ ok: false, motif: "signature" });
    }
    expect(verifierJeton(jeton, SECRET, T0).ok).toBe(true);
  });

  it("charge non canonique (bits de queue non nuls), signée correctement → refusée", () => {
    // Charge de longueur ≡ 1 (mod 3) ou 2 : le dernier caractère base64url porte des bits ignorés.
    const json = JSON.stringify(chargeValide());
    let canon = b64u(json);
    let n = json;
    while (canon.length % 4 === 0) {
      n += " ";
      canon = b64u(n);
    }
    const idx = ALPHABET.indexOf(canon.slice(-1));
    const altere = canon.slice(0, -1) + ALPHABET[idx ^ 1]!;
    expect(Buffer.from(altere, "base64url").equals(Buffer.from(canon, "base64url"))).toBe(true);
    const sig = (p: string) => createHmac("sha256", SECRET).update(p).digest("base64url");
    expect(verifierJeton(`${canon}.${sig(canon)}`, SECRET, T0).ok).toBe(true);
    const r = verifierJeton(`${altere}.${sig(altere)}`, SECRET, T0);
    expect(r.ok).toBe(false);
  });

  it("une seule empreinte par jeton valide, quelle que soit l'écriture reçue", () => {
    const jeton = creerJeton(DONNEES, SECRET, T0);
    const base = jeton.slice(0, -1);
    const idx = ALPHABET.indexOf(jeton.slice(-1));
    const empreintes = new Set(
      [0, 1, 2, 3].map((k) => empreinteJeton(base + ALPHABET[(idx & ~3) | k]!)),
    );
    expect(empreintes.size).toBe(1);
    expect(empreintes.has(empreinteJeton(jeton))).toBe(true);
  });
});

describe("lien-page-guide — temps non fini (D2)", () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "maintenantMs = %s → refus",
    (ms) => {
      const jeton = creerJeton(DONNEES, SECRET, T0);
      expect(verifierJeton(jeton, SECRET, ms)).toEqual({ ok: false, motif: "expire" });
      expect(() => creerJeton(DONNEES, SECRET, ms)).toThrow();
    },
  );
});

describe("lien-page-guide — secrets distincts (D3)", () => {
  const A = "a".repeat(32);
  const B = "b".repeat(32);
  it("deux secrets distincts de ≥ 32 caractères passent", () => {
    expect(() => verifierSecretsDistincts(A, B)).not.toThrow();
  });
  it("secrets identiques → erreur explicite", () => {
    expect(() => verifierSecretsDistincts(A, A)).toThrow(/distincts/);
  });
  it.each([
    ["court", "x".repeat(31), B],
    ["court", A, "x".repeat(31)],
    ["absent", undefined, B],
    ["absent", A, null],
  ])("secret %s → erreur explicite", (_n, a, b) => {
    expect(() => verifierSecretsDistincts(a as never, b as never)).toThrow(/32 caractères/);
  });
});

describe("M2 — le mot tient dans la colonne (30 caractères au plus)", () => {
  it("un mot de 30 caractères est accepté, un mot de 31 est refusé par creerJeton", () => {
    expect(() => creerJeton({ ...DONNEES, mot: "A".repeat(30) }, SECRET, T0)).not.toThrow();
    expect(() => creerJeton({ ...DONNEES, mot: "A".repeat(31) }, SECRET, T0)).toThrow();
  });
});
