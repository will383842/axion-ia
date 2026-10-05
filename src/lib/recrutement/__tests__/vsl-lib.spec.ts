/**
 * Les petites règles pures de la page VSL apporteurs : validation sans zod,
 * choix de la page de merci, prélèvement du fbclid SOUS CONSENTEMENT, état de
 * reprise.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canalDepuisQuery, cheminDeMerci, validerEtape1, validerEtape2 } from "../vsl-validation";
import { extraireFbclid, lireFbclid, memoriserFbclid } from "../vsl-attribution";
import {
  __reinitialiserEtatVslPourTests,
  lireEtatVsl,
  lireIdentitePourMerci,
  majEtatVsl,
} from "../vsl-etat";

describe("validation de l'étape 1", () => {
  it("accepte un prénom, un e-mail plausible et la case cochée", () => {
    expect(validerEtape1({ prenom: "Léa", email: "lea@exemple.fr", consent: true })).toEqual({});
  });

  it("nomme chaque champ en faute, avec le message simple du plan", () => {
    const e = validerEtape1({ prenom: " ", email: "lea@exemple", consent: false });
    expect(e.prenom).toBeTruthy();
    expect(e.email).toBe("Cette adresse semble incomplète.");
    expect(e.consent).toBeTruthy();
    expect(validerEtape1({ prenom: "L", email: "", consent: true }).email).toMatch(/e-mail/i);
  });
});

describe("validation de l'étape 2", () => {
  it("exige un téléphone plausible ET une réponse de la liste fermée", () => {
    expect(validerEtape2({ telephone: "06 12 34 56 78", reponse: "5-20" })).toEqual({});
    expect(validerEtape2({ telephone: "+33 6 12 34 56 78", reponse: "plus-50" })).toEqual({});
    const e = validerEtape2({ telephone: "abc", reponse: "beaucoup" });
    expect(e.telephone).toBeTruthy();
    expect(e.reponse).toBeTruthy();
    expect(validerEtape2({ telephone: "", reponse: "moins-5" }).telephone).toBeTruthy();
  });
});

describe("le module de validation n'embarque pas zod", () => {
  it.each(["vsl-validation.ts", "vsl-attribution.ts", "vsl-etat.ts"])("%s", (fichier) => {
    const source = readFileSync(join(__dirname, "..", fichier), "utf8");
    expect(source).not.toMatch(/from\s+["']zod["']/);
    // Pas non plus le fichier qui l'importe : `lead-apporteur.ts` porte zod.
    expect(source).not.toMatch(/commercial-application\/lead-apporteur["']/);
  });
});

describe("cheminDeMerci", () => {
  const origine = "https://axion-ia.com";
  const repli = "/apporteur-affaires/video/merci";

  it("retire le préfixe de langue (le routeur le repose)", () => {
    expect(cheminDeMerci("/fr/apporteur-affaires/video/merci?x=1", repli, origine)).toBe(
      "/apporteur-affaires/video/merci?x=1",
    );
    expect(cheminDeMerci("/apporteur-affaires/video/merci", repli, origine)).toBe(repli);
  });

  it("accepte l'URL absolue du MÊME site, refuse un autre domaine", () => {
    expect(
      cheminDeMerci("https://axion-ia.com/fr/apporteur-affaires/video/merci", repli, origine),
    ).toBe(repli);
    expect(cheminDeMerci("https://autre-site.example/phishing", repli, origine)).toBe(repli);
    expect(cheminDeMerci("//autre-site.example/x", repli, origine)).toBe(repli);
  });
});

describe("canalDepuisQuery", () => {
  it("lit utm_source parmi trois canaux connus, sinon facebook", () => {
    expect(canalDepuisQuery("?utm_source=instagram&utm_medium=paid")).toBe("instagram");
    expect(canalDepuisQuery("?utm_source=LinkedIn")).toBe("linkedin");
    expect(canalDepuisQuery("?utm_source=n-importe-quoi")).toBe("facebook");
    expect(canalDepuisQuery("")).toBe("facebook");
  });
});

describe("fbclid : retenu SEULEMENT si le consentement est accepté", () => {
  const FBCLID = "IwAR0abcdefghijklmnop_-123";

  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => window.sessionStorage.clear());

  it("extrait un fbclid plausible et refuse le reste", () => {
    expect(extraireFbclid(`?utm_source=facebook&fbclid=${FBCLID}`)).toBe(FBCLID);
    expect(extraireFbclid("?fbclid=<script>")).toBeNull();
    expect(extraireFbclid("?fbclid=court")).toBeNull();
    expect(extraireFbclid("")).toBeNull();
  });

  it("sans consentement, RIEN n'est écrit", () => {
    memoriserFbclid(`?fbclid=${FBCLID}`, false, 1000);
    expect(lireFbclid()).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("avec consentement : le fbclid et l'heure d'arrivée sont retenus, le premier clic est gardé", () => {
    memoriserFbclid(`?fbclid=${FBCLID}`, true, 1000);
    expect(lireFbclid()).toEqual({ fbclid: FBCLID, at: 1000 });
    memoriserFbclid(`?fbclid=${FBCLID}`, true, 9999);
    expect(lireFbclid()?.at).toBe(1000);
  });

  it("sans fbclid dans l'adresse, rien n'est retenu même avec consentement", () => {
    memoriserFbclid("?utm_source=facebook", true, 1000);
    expect(lireFbclid()).toBeNull();
  });
});

describe("état de reprise (mémoire + sessionStorage)", () => {
  beforeEach(() => __reinitialiserEtatVslPourTests());
  afterEach(() => __reinitialiserEtatVslPourTests());

  it("ne garde JAMAIS le téléphone ni la réponse dans sessionStorage", () => {
    majEtatVsl({
      prenom: "Léa",
      email: "lea@exemple.fr",
      consent: true,
      jeton: "j1",
      leadId: "l1",
      etape: 2,
      telephone: "0612345678",
      reponse: "5-20",
    });
    const brut = window.sessionStorage.getItem("axion-vsl-apporteur-v1") ?? "";
    expect(brut).toContain("lea@exemple.fr");
    expect(brut).not.toContain("0612345678");
    expect(brut).not.toContain("5-20");
    // Mais l'état en mémoire les garde pour l'onglet.
    expect(lireEtatVsl().telephone).toBe("0612345678");
    expect(lireIdentitePourMerci()).toEqual({ prenom: "Léa", email: "lea@exemple.fr" });
  });

  it("sans jeton, l'étape 2 d'une sauvegarde retombe sur l'étape 1", () => {
    __reinitialiserEtatVslPourTests();
    window.sessionStorage.setItem(
      "axion-vsl-apporteur-v1",
      JSON.stringify({ etape: 2, prenom: "A", email: "a@b.cd", consent: true }),
    );
    expect(lireEtatVsl().etape).toBe(1);
  });
});
