import { describe, expect, it } from "vitest";
import { creerJeton } from "@/features/commercial-application/jeton-lead";
import { DUREE_JETON_DEMANDE_MS, creerJetonDemande, lireJetonDemande } from "../jeton-demande";

const ID = "3f2b8c1e-5d4a-4b7e-9c1d-0a1b2c3d4e5f";
const T0 = 1_800_000_000_000;

describe("jeton de la demande", () => {
  it("un jeton valide rend l'identifiant", () => {
    expect(lireJetonDemande(creerJetonDemande(ID, T0), T0 + 1000)).toEqual({ id: ID });
  });

  it("un jeton expiré est refusé", () => {
    const jeton = creerJetonDemande(ID, T0);
    expect(lireJetonDemande(jeton, T0 + DUREE_JETON_DEMANDE_MS + 1)).toBeNull();
  });

  it("un jeton falsifié (corps changé) est refusé", () => {
    const [corps, sig] = creerJetonDemande(ID, T0).split(".");
    const autre = Buffer.from(
      JSON.stringify({ id: "00000000-0000-4000-8000-000000000000", iat: T0, exp: T0 + 1e9 }),
    ).toString("base64url");
    expect(lireJetonDemande(`${autre}.${sig}`, T0)).toBeNull();
    expect(lireJetonDemande(`${corps}.${"0".repeat(64)}`, T0)).toBeNull();
  });

  it("un jeton du tunnel apporteurs (même forme, autre clé) est refusé", () => {
    expect(lireJetonDemande(creerJeton({ lead: ID, maintenant: T0 }), T0)).toBeNull();
  });

  it("tout ce qui n'est pas un jeton est refusé sans lever", () => {
    for (const x of [undefined, null, 42, "", "abc", "a.b.c", "a.b", "x".repeat(2000)]) {
      expect(lireJetonDemande(x, T0)).toBeNull();
    }
  });

  it("n'accepte qu'un identifiant de forme UUID", () => {
    expect(lireJetonDemande(creerJetonDemande("pas-un-uuid", T0), T0)).toBeNull();
  });
});
