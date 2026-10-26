/**
 * Le jeton de la 1re validation de la suppression manuelle (26/10/2026) : signé, valable 5
 * minutes, lié à la cible et à l'acteur ; l'empreinte du bilan change dès qu'un compteur change.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  creerJetonSuppression,
  DUREE_JETON_SUPPRESSION_MS,
  empreinteBilan,
  lireJetonSuppression,
  MOTIF_JETON_INVALIDE,
  normaliserCode,
} from "../suppression-jeton";

const CID = "11111111-1111-4111-8111-111111111111";
const ADMIN = "44444444-4444-4444-8444-444444444444";
const T0 = 1_800_000_000_000;

const jeton = () =>
  creerJetonSuppression({ type: "client", id: CID, acteurId: ADMIN, empreinte: "abc" }, T0) ?? "";

afterEach(() => vi.unstubAllEnvs());

describe("le jeton de suppression", () => {
  it("aller-retour : le contenu est rendu tel quel avant l'échéance", () => {
    const r = lireJetonSuppression(jeton(), T0 + 1000);
    expect(r).toEqual({
      ok: true,
      contenu: { t: "client", i: CID, a: ADMIN, b: "abc", e: T0 + DUREE_JETON_SUPPRESSION_MS },
    });
  });

  it("expire au bout de 5 minutes", () => {
    const r = lireJetonSuppression(jeton(), T0 + DUREE_JETON_SUPPRESSION_MS + 1);
    expect(r).toEqual({
      ok: false,
      motif: "La première validation a expiré (5 minutes) : recommencez.",
    });
  });

  it("une signature ou un corps modifié est refusé", () => {
    const j = jeton();
    const [corps = "", signature = ""] = j.split(".");
    const derniere = signature.endsWith("A") ? "B" : "A";
    expect(lireJetonSuppression(`${corps}.${signature.slice(0, -1)}${derniere}`, T0)).toEqual({
      ok: false,
      motif: MOTIF_JETON_INVALIDE,
    });
    const autre = Buffer.from(
      JSON.stringify({ t: "rencontre", i: CID, a: ADMIN, b: "abc", e: T0 + 60_000 }),
    ).toString("base64url");
    expect(lireJetonSuppression(`${autre}.${signature}`, T0)).toEqual({
      ok: false,
      motif: MOTIF_JETON_INVALIDE,
    });
  });

  it("vide ou mal formé : refusé", () => {
    for (const j of ["", "abc", "a.b", `${"x".repeat(900)}.${"y".repeat(43)}`]) {
      expect(lireJetonSuppression(j, T0).ok).toBe(false);
    }
  });

  it("en production sans AUTH_SECRET : ni création ni lecture", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(
      creerJetonSuppression({ type: "client", id: CID, acteurId: ADMIN, empreinte: "abc" }, T0),
    ).toBeNull();
    expect(lireJetonSuppression("abc.def", T0).ok).toBe(false);
  });

  it("l'empreinte ne dépend pas de l'ordre des compteurs, mais change avec un compteur", () => {
    const a = {
      type: "client",
      id: CID,
      compteurs: [
        { libelle: "x", n: 1 },
        { libelle: "y", n: 2 },
      ],
    };
    const b = {
      type: "client",
      id: CID,
      compteurs: [
        { libelle: "y", n: 2 },
        { libelle: "x", n: 1 },
      ],
    };
    const c = {
      type: "client",
      id: CID,
      compteurs: [
        { libelle: "x", n: 1 },
        { libelle: "y", n: 3 },
      ],
    };
    expect(empreinteBilan(a)).toBe(empreinteBilan(b));
    expect(empreinteBilan(a)).not.toBe(empreinteBilan(c));
    expect(empreinteBilan(a)).toHaveLength(22);
  });

  it("le numéro recopié : casse et espaces ne comptent pas", () => {
    expect(normaliserCode(" axi-cli- 005 ")).toBe("AXI-CLI-005");
  });
});
