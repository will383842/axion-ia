// @vitest-environment node

/**
 * L'UTM d'ARRIVÉE survit au choix (chantier « Types de rendez-vous », L5a).
 *
 * Avant : un visiteur arrivé sur `/appel?utm_source=linkedin&utm_campaign=x`
 * perdait ses paramètres au premier clic — les liens des cartes, le lien
 * « Changer de rendez-vous » et le lien vers le formulaire ne recopiaient que
 * `rdv` et `depuis`. La page du calendrier, qui lit les UTM dans SON URL pour
 * la capture de la réservation, ne les voyait donc jamais.
 *
 * Ce qui doit tenir :
 *   1. les quatre paramètres déjà lus par la page sur main (`utm_source`,
 *      `utm_medium`, `utm_campaign`, `ref`) sont recopiés, bornés et nettoyés
 *      comme le fait `parseUtmFromUrl` (≤ 200, caractères sûrs seulement) ;
 *   2. tout autre paramètre est ignoré ;
 *   3. chaque lien du parcours (carte, « changer », formulaire, retour du
 *      formulaire, renvoi de l'action) les porte.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  lireSuiviArrivee,
  parametresDuChoix,
  parametresDuRetour,
  provenanceEnBloc,
} from "../choix-rendez-vous";
import { urlDuFormulaire } from "../formulaire-reservation";

function lire(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin), "utf8");
}

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const ARRIVEE = {
  utm_source: "linkedin",
  utm_medium: "social",
  utm_campaign: "x",
  ref: "partenaire-42",
  utm_content: "ecrase-par-le-choix",
  debut: "2026-10-20T08:00:00.000Z",
  autre: "rien",
};

describe("🔑 l'UTM d'arrivée survit au choix", () => {
  it("les quatre paramètres de suivi sont lus, et eux seuls", () => {
    expect(lireSuiviArrivee(ARRIVEE)).toEqual({
      utm_source: "linkedin",
      utm_medium: "social",
      utm_campaign: "x",
      ref: "partenaire-42",
    });
  });

  it("valeurs bornées et nettoyées comme ailleurs", () => {
    expect(
      lireSuiviArrivee({
        utm_source: "<script>alert(1)</script>",
        utm_campaign: "a".repeat(201),
        utm_medium: ["liste"],
        ref: "   ",
      }),
    ).toEqual({ utm_source: "scriptalert1/script" });
  });

  it("la carte recopie le choix, l'emplacement ET l'arrivée", () => {
    const p = new URLSearchParams(
      parametresDuChoix("diagnostic", "accueil-hero", lireSuiviArrivee(ARRIVEE)),
    );
    expect(p.get("rdv")).toBe("diagnostic");
    expect(p.get("depuis")).toBe("accueil-hero");
    expect(p.get("utm_source")).toBe("linkedin");
    expect(p.get("utm_medium")).toBe("social");
    expect(p.get("utm_campaign")).toBe("x");
    expect(p.get("ref")).toBe("partenaire-42");
    // `utm_content` reste celui du BOUTON, jamais celui de l'arrivée.
    expect(p.get("utm_content")).toBeNull();
  });

  it("sans arrivée : les paramètres d'avant, inchangés", () => {
    expect(parametresDuChoix("projet")).toBe("rdv=projet");
    expect(parametresDuChoix("projet", null, {})).toBe("rdv=projet");
  });

  it("le lien « changer » garde l'emplacement et l'arrivée, sans choix", () => {
    const p = new URLSearchParams(parametresDuRetour("faq", { utm_source: "linkedin" }));
    expect(p.get("rdv")).toBeNull();
    expect(p.get("depuis")).toBe("faq");
    expect(p.get("utm_source")).toBe("linkedin");
    expect(parametresDuRetour(null, {})).toBe("");
  });

  it("le lien vers le formulaire porte l'arrivée", () => {
    const url = urlDuFormulaire(
      "fr",
      "2026-10-20T08:00:00.000Z",
      parametresDuChoix("projet", null, { utm_source: "linkedin", utm_campaign: "x" }),
    );
    expect(url).toContain("utm_source=linkedin");
    expect(url).toContain("utm_campaign=x");
  });
});

describe("🔑 la provenance d'une réservation directe se prend en BLOC", () => {
  const COOKIE = { utm_source: "google", utm_medium: "cpc", utm_campaign: "printemps" };

  it("l'arrivée porte une UTM : tout le bloc d'arrivée, rien du cookie", () => {
    expect(provenanceEnBloc({ utm_source: "linkedin" }, COOKIE)).toEqual({
      utmSource: "linkedin",
      utmMedium: null,
      utmCampaign: null,
    });
  });

  it("aucune UTM d'arrivée (`ref` seul ne compte pas) : tout le bloc du cookie", () => {
    expect(provenanceEnBloc({ ref: "p-42" }, COOKIE)).toEqual({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "printemps",
    });
    expect(provenanceEnBloc({}, {})).toEqual({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });
  });
});

describe("🔴 chaque lien du parcours porte l'arrivée", () => {
  const page = sansCommentaires(lire("src/app/[locale]/appel/page.tsx"));
  const reserver = sansCommentaires(lire("src/app/[locale]/appel/reserver/page.tsx"));
  const actions = sansCommentaires(lire("src/app/[locale]/appel/reserver/actions.ts"));

  it("/appel lit l'arrivée une fois et la passe aux cartes, au « changer », au widget", () => {
    expect(page).toContain("const suivi = lireSuiviArrivee(sp)");
    expect(page).toContain("parametresDuChoix(choix, depuis, suivi)");
    expect(page).toContain("parametresDuRetour(depuis, suivi)");
    // Le jeton apporteur (?j=, page vidéo) s'ajoute APRÈS les paramètres du choix :
    // l'arrivée reste portée par `parametresDuChoix(choix, depuis, suivi)`.
    expect(page).toContain("parametresDuChoix(choix, depuis, suivi) +");
    expect(page).toContain("parametresDuChoix={parametresCreneau}");
    expect(page).toContain("suivi={suivi}");
    // L'adresse de la page, pour l'attribution : celle du calendrier DU TYPE
    // (`lienDuCalendrier`), qui recopie le choix, l'emplacement ET l'arrivée.
    expect(page).toContain("lienDuCalendrier(locale, choix, depuis, suivi)");
  });

  it("/appel/reserver : retour au calendrier et champs cachés", () => {
    expect(reserver).toContain("const suivi = lireSuiviArrivee(sp)");
    expect(reserver).toContain("lienDuCalendrier(locale, choix, depuis, suivi)");
    expect(reserver).toContain("...suivi");
  });

  it("l'action relit l'arrivée des champs cachés pour ses renvois", () => {
    expect(actions).toContain("lireSuiviArrivee(");
    expect(actions).toContain("parametresDuChoix(choix, depuis, suivi)");
    expect(actions).toContain("lienDuCalendrier(locale, choix, depuis, suivi)");
    // La provenance de la réservation directe se prend en BLOC.
    expect(actions).toContain("...provenanceEnBloc(suivi, utm)");
  });
});
