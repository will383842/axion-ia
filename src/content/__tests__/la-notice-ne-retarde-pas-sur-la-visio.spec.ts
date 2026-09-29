// @vitest-environment node

/**
 * Verrou — la notice publique ne doit ni retarder sur la visioconférence, ni
 * affirmer une absence d'enregistrement qui aurait cessé d'être vraie.
 *
 * ## Le motif qu'il ferme, et qui s'est déjà produit deux fois
 *
 * Ce dépôt a deux précédents documentés, tous deux dans `subprocessors.ts` :
 *
 * - **Calendly** n'a figuré dans la liste publique que quatorze mois après sa
 *   mise en service. Rien ne forçait la mise à jour.
 * - **Google Agenda** y était déclaré « aucune donnée nouvelle ne lui est
 *   transmise » alors que la console y écrivait déjà le nom et le téléphone des
 *   contacts. Une notice publiée qui minimise un flux réel est plus grave
 *   qu'une notice absente : elle affirme.
 *
 * Les deux fois, le code a changé et le texte est resté. La parade n'est pas
 * une note de vigilance — il en existait déjà — mais un contrôle qui refuse
 * l'incohérence.
 *
 * ## 🔴 POURQUOI CE FICHIER A ÉTÉ RÉÉCRIT LE 2026-09-01
 *
 * Sa première version cherchait la PRÉSENCE des mots « visioconf » et
 * « transcri ». Elle cherchait aussi `"visio"`, qui apparaît dans « proVISIOn »
 * (verte d'avance), et une garde de PRÉSENCE ne distingue pas une affirmation
 * de sa négation (« ni enregistrés ni transcrits » contient « transcri »).
 * D'où la formulation, qui vise le fait redouté et non un vocabulaire : **une
 * notice qui promet l'absence d'enregistrement pendant qu'on enregistre.**
 *
 * ## 🔴 RÉÉCRIT LE 2026-09-29 (chantier visio, PR 8) — PAS SUPPRIMÉ
 *
 * L'enregistrement revient, par une autre voie que le Notetaker : l'extension
 * interne et l'entrée « OpenAI, LLC (comptes rendus de rendez-vous) ». La règle
 * suit désormais CETTE entrée, et vise la SECTION « Rendez-vous de découverte »
 * (FR) / « Discovery appointments » (EN), plus toute la prose : le règlement
 * intérieur des stagiaires et la ligne Zoom parlent aussi de visio, et
 * pouvaient rendre un test de prose entière vert ou rouge pour une autre
 * raison.
 *
 * - entrée ACTIVE : la section ne contient AUCUNE promesse de
 *   non-enregistrement, et contient « accord », « retirer », « OpenAI »,
 *   « États-Unis », « 30 jours » ;
 * - entrée absente ou non activée : la promesse actuelle reste EXIGÉE.
 *
 * Le texte « après » est vérifié aussi quand il n'est pas publié (il est
 * construit par `sectionRendezVousDecouverte(locale, true)`) : le jour de la
 * bascule, il ne sera pas relu pour la première fois.
 *
 * ## Contre-témoin et angle mort
 *
 * Contre-témoin : l'ANCIENNE notice (« ni enregistrés ni transcrits »), soumise
 * à la règle de l'entrée active, rougit (dernier test). Angle mort : cette
 * garde vérifie des présences et des absences de formules, pas la qualité de
 * la rédaction — celle-ci est lue par Will (point d'arrêt, LOTS-EXECUTION §8).
 */

import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "../legal";
import { SUBPROCESSORS } from "../subprocessors";
import {
  ANNONCE_VISIO_ACTIVE,
  NOM_ENTREE_COMPTES_RENDUS_VISIO,
  sectionRendezVousDecouverte,
} from "../visio-annonce";

/** Toute la prose des pages légales, mise à plat et en minuscules. */
function proseLegale(): string {
  return JSON.stringify(LEGAL_PAGES).toLowerCase();
}

function sectionPubliee(locale: "fr" | "en"): string | undefined {
  const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
  const titre = locale === "fr" ? "Rendez-vous de découverte" : "Discovery appointments";
  return page?.[locale].sections.find((s) => s.title === titre)?.body;
}

const MEET = SUBPROCESSORS.find((s) => s.name.includes("Google Meet"));
const NOTETAKER = SUBPROCESSORS.find((s) => s.name.includes("Notetaker"));
const COMPTES_RENDUS = SUBPROCESSORS.find((s) => s.name === NOM_ENTREE_COMPTES_RENDUS_VISIO);

/** Les formules par lesquelles la notice PROMET qu'il n'y a pas d'enregistrement. */
const PROMESSES_DE_NON_ENREGISTREMENT = [
  "ni enregistrés",
  "ne sont pas enregistrés",
  "aucun enregistrement",
  "aucune captation",
  "neither recorded",
  "are not recorded",
  "no recording",
  "no audio or video capture",
];

/** Ce qu'une section qui annonce l'enregistrement doit dire. */
const OBLIGATOIRES = {
  fr: ["accord", "retirer", "OpenAI", "États-Unis", "30 jours"],
  en: ["consent", "withdraw", "OpenAI", "United States", "30 days"],
} as const;

function promessesDans(texte: string): string[] {
  const t = texte.toLowerCase();
  return PROMESSES_DE_NON_ENREGISTREMENT.filter((f) => t.includes(f));
}

function manquantes(texte: string, locale: "fr" | "en"): string[] {
  return OBLIGATOIRES[locale].filter((f) => !texte.includes(f));
}

describe("la notice publique suit ce que fait vraiment le rendez-vous", () => {
  it("🔑 les lignes Meet et Notetaker existent, et les deux sections sont publiées", () => {
    expect(MEET, "la ligne Google Meet a disparu de la SSOT sous-traitants").toBeDefined();
    expect(NOTETAKER, "la ligne Notetaker a disparu de la SSOT sous-traitants").toBeDefined();
    expect(sectionPubliee("fr"), "section « Rendez-vous de découverte » introuvable").toBeTruthy();
    expect(sectionPubliee("en"), "section « Discovery appointments » introuvable").toBeTruthy();
  });

  it("🔴 l'annonce suit l'état de l'entrée « comptes rendus de rendez-vous »", () => {
    // Une entrée active pendant que la notice promet encore « ni enregistrés »,
    // ou l'inverse : les deux documents publics se contrediraient.
    const active = COMPTES_RENDUS?.activationStatus === "active";
    expect(
      ANNONCE_VISIO_ACTIVE,
      `l'entrée « ${NOM_ENTREE_COMPTES_RENDUS_VISIO} » est ${active ? "active" : "absente ou non activée"} ` +
        `mais l'interrupteur de la notice dit ${String(ANNONCE_VISIO_ACTIVE)}.`,
    ).toBe(active);
  });

  for (const locale of ["fr", "en"] as const) {
    it(`🔴 ${locale} : la section publiée ne promet PAS l'absence d'enregistrement pendant qu'on enregistre`, () => {
      const section = sectionPubliee(locale) ?? "";
      if (COMPTES_RENDUS?.activationStatus === "active") {
        expect(
          promessesDans(section),
          "l'entrée est active et la section promet le contraire",
        ).toEqual([]);
        expect(manquantes(section, locale), "formules obligatoires absentes").toEqual([]);
        return;
      }
      // Rien n'est enregistré : la promesse est vraie, et elle doit être écrite
      // — c'est un engagement public, pas un simple silence.
      expect(
        promessesDans(section).length,
        "aucune formule ne dit au visiteur que le rendez-vous n'est pas enregistré",
      ).toBeGreaterThan(0);
    });

    it(`🔴 ${locale} : le texte PRÊT à publier dit tout, et ne promet rien de faux`, () => {
      const apres = sectionRendezVousDecouverte(locale, true);
      expect(promessesDans(apres)).toEqual([]);
      expect(manquantes(apres, locale)).toEqual([]);
    });
  }

  it("🔴 si Google Meet est ACTIF, la notice parle de visioconférence", () => {
    const prose = proseLegale();
    if (MEET?.activationStatus !== "active") {
      expect(prose.includes("visioconf")).toBe(false);
      return;
    }
    expect(prose.includes("visioconf") || prose.includes("google meet")).toBe(true);
  });

  it("🔑 réactiver le Notetaker se décide, ne se configure pas", () => {
    // Tenir un rendez-vous relève des mesures précontractuelles ; l'enregistrer
    // n'en relève pas. Et le robot Calendly reste désactivé : l'enregistrement
    // passe par l'extension interne, pas par lui.
    expect(NOTETAKER?.legalBasis).toBe("6.1.a_consent");
    expect(
      NOTETAKER?.activationStatus,
      "le Notetaker est repassé en actif : c'est la décision du 2026-09-01 à rouvrir, pas un champ.",
    ).toBe("pending_activation");
  });

  it("🔑 CONTRE-TÉMOIN : la prose légale est bien lisible par ce test", () => {
    const prose = proseLegale();
    expect(prose.length).toBeGreaterThan(10_000);
    expect(prose, "le sujet des rendez-vous doit y figurer").toContain("calendly");
  });

  it("🔑 CONTRE-TÉMOIN : « visio » seul ne sert PAS de motif — c'est un sous-mot", () => {
    const prose = proseLegale();
    const total = (prose.match(/visio/g) ?? []).length;
    const provisions = (prose.match(/provision/g) ?? []).length;
    expect(provisions).toBeGreaterThan(0);
    expect(total).toBeGreaterThanOrEqual(provisions);
  });

  it("🔑 CONTRE-TÉMOIN : l'ancienne notice, sous la règle de l'entrée active, rougirait", () => {
    const ancienne = sectionRendezVousDecouverte("fr", false);
    expect(promessesDans(ancienne).length).toBeGreaterThan(0);
    expect(manquantes(ancienne, "fr").length).toBeGreaterThan(0);
  });
});
