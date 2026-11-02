// @vitest-environment node
//
// Champ `mot` : lettres (accentuées) et chiffres Unicode, 2 à 30, normalisé en MAJUSCULES.
// Secrets de la route : propre d'abord, repli documenté sur celui des vidéos.
import { describe, it, expect } from "vitest";
import { SchemaDemandeGuideReseau } from "../contrat";
import { secretsGuidesReseau } from "../config";

const base = {
  schemaVersion: 1,
  cleIdempotence: "run_zernio_0001",
  email: "personne@exemple.test",
  reseau: "instagram",
  guide: "guide-ia",
  accord: "non_demande",
  versionTexteM1: "m1-brouillon-v1",
};
const mot = (m: string) => SchemaDemandeGuideReseau.safeParse({ ...base, mot: m });

describe("mot", () => {
  it.each([
    ["guide", "GUIDE"],
    ["éco", "ÉCO"],
    ["Ça", "ÇA"],
    ["été2026", "ÉTÉ2026"],
    ["٣٤", "٣٤"],
    ["ab", "AB"],
    ["a".repeat(30), "A".repeat(30)],
  ])("« %s » accepté → %s", (entree, attendu) => {
    const r = mot(entree);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mot).toBe(attendu);
  });

  it.each([
    "a",
    "a".repeat(31),
    "",
    "mot clé",
    "guide!",
    "a-b",
    "a_b",
    "é\u0301co ",
    "💡idee",
    "<b>",
  ])("« %s » refusé", (entree) => {
    expect(mot(entree).success).toBe(false);
  });
});

describe("secretsGuidesReseau", () => {
  const A = "a".repeat(32);
  const B = "b".repeat(32);
  it("le secret propre prime, avec son précédent", () => {
    expect(
      secretsGuidesReseau({
        GUIDES_RESEAU_HMAC_SECRET: A,
        GUIDES_RESEAU_HMAC_SECRET_PRECEDENT: B,
        VIDEOS_STUDIO_HMAC_SECRET: "v".repeat(40),
      }),
    ).toEqual({ courant: A, precedent: B });
  });
  it("repli sur le secret des vidéos si le propre manque ou est trop court", () => {
    expect(secretsGuidesReseau({ VIDEOS_STUDIO_HMAC_SECRET: B })).toEqual({
      courant: B,
      precedent: null,
    });
    expect(
      secretsGuidesReseau({ GUIDES_RESEAU_HMAC_SECRET: "court", VIDEOS_STUDIO_HMAC_SECRET: B }),
    ).toEqual({ courant: B, precedent: null });
  });
  it("aucun secret → null", () => {
    expect(secretsGuidesReseau({})).toBeNull();
  });
});
