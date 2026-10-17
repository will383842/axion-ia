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
  avecUtmContent,
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
  it("les paramètres de suivi sont lus, et eux seuls (`utm_content` tel que reçu)", () => {
    expect(lireSuiviArrivee(ARRIVEE)).toEqual({
      utm_source: "linkedin",
      utm_medium: "social",
      utm_campaign: "x",
      utm_content: "ecrase-par-le-choix",
      ref: "partenaire-42",
    });
  });

  it("valeur non conforme : abandonnée seule, jamais réécrite", () => {
    expect(
      lireSuiviArrivee({
        utm_source: "<script>alert(1)</script>",
        utm_campaign: "a".repeat(61),
        utm_medium: ["liste"],
        utm_content: "clients",
        ref: "   ",
      }),
    ).toEqual({ utm_content: "clients" });
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
    // `utm_content` d'arrivée est recopié tel quel (ADR 0002), jamais remplacé.
    expect(p.get("utm_content")).toBe("ecrase-par-le-choix");
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
    expect(provenanceEnBloc({ utm_source: "linkedin", depuis: "video-instagram" }, COOKIE)).toEqual(
      {
        utmSource: "linkedin",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: "video-instagram",
      },
    );
  });

  it("aucune UTM d'arrivée (`ref` seul ne compte pas) : tout le bloc du cookie", () => {
    expect(provenanceEnBloc({ ref: "p-42" }, COOKIE)).toEqual({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "printemps",
      utmContent: null,
      utmTerm: null,
    });
    expect(provenanceEnBloc({}, {})).toEqual({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
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

/** ADR 0002 (fixtures A01-A08) : ce qui part chez Calendly pour une URL d'arrivée. */
describe("🔑 L2-09 · `utm_content` conservé, `depuis` dans `utm_term`", () => {
  const CAS: ReadonlyArray<[string, string, Record<string, string | null>]> = [
    [
      "A01 conforme",
      "utm_source=instagram&utm_medium=video&utm_campaign=0042-TB-IG&utm_content=clients&depuis=video-instagram",
      {
        utm_source: "instagram",
        utm_medium: "video",
        utm_campaign: "0042-TB-IG",
        utm_content: "clients",
        utm_term: "video-instagram",
      },
    ],
    [
      "A02 ancien lien du studio",
      "utm_source=instagram&utm_medium=video&utm_campaign=0042-TB-IG&utm_content=0042-TB-IG",
      {
        utm_source: "instagram",
        utm_medium: "video",
        utm_campaign: "0042-TB-IG",
        utm_content: "0042-TB-IG",
        utm_term: null,
      },
    ],
    ["A03 en-tête du site", "depuis=entete", { utm_content: null, utm_term: "entete" }],
    [
      "A04 utm_content trop long",
      `utm_source=instagram&utm_content=${"c".repeat(61)}&depuis=video-instagram`,
      { utm_source: "instagram", utm_content: null, utm_term: "video-instagram" },
    ],
    [
      "A05 « : » et majuscules abandonnés",
      "utm_source=instagram&utm_campaign=usine:L12-3&utm_content=clients&depuis=Video-Instagram",
      { utm_source: "instagram", utm_campaign: null, utm_content: "clients", utm_term: null },
    ],
    [
      "A06 espace",
      "utm_campaign=0042-TB-IG&utm_content=clients%20test",
      {
        utm_campaign: "0042-TB-IG",
        utm_content: null,
      },
    ],
    [
      "A07 valeurs inconnues bien formées",
      "utm_source=newsletter&utm_medium=email&utm_campaign=lettre-12&utm_content=haut",
      { utm_source: "newsletter", utm_campaign: "lettre-12", utm_content: "haut" },
    ],
    ["A08 aucune valeur", "", { utm_source: null, utm_content: null, utm_term: null }],
  ];

  it.each(CAS)("%s", (_nom, requete, attendu) => {
    const sp = Object.fromEntries(new URLSearchParams(requete));
    const u = new URL(avecUtmContent("https://calendly.com/axion-ia/x", lireSuiviArrivee(sp)));
    for (const [cle, valeur] of Object.entries(attendu)) {
      expect(u.searchParams.get(cle)).toBe(valeur);
    }
  });
});
