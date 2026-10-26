/**
 * Le cookie axion_utm rattache une campagne à un rendez-vous nominatif : il ne
 * peut pas être présenté comme « strictement nécessaire / sans consentement ».
 * Décision de Will (2026-10-26). La politique de cookies, en FR comme en EN, doit
 * le décrire dans sa propre section, avec la voie d'opposition.
 */
import { describe, expect, it } from "vitest";
import { LEGAL_PAGES } from "../legal";

const page = LEGAL_PAGES.find((p) => p.slug === "cookies");
const MOTS_INTERDITS = [
  /Grenoble/i,
  /certifi\S* Qualiopi/i,
  /obligatoire AI Act/i,
  /Aucun gain garanti/i,
  /devis/i,
  /prix/i,
  /Candidater/i,
  /R[ée]server/i,
];

describe.each([
  [
    "fr",
    "Cookies strictement nécessaires",
    "Cookie de provenance de campagne (axion_utm)",
    "Calendrier de réservation (Calendly)",
    /nom, terme et contenu/,
    /pas conservée en base de données/,
    /^Exception : /,
    /contenu/i,
  ],
  [
    "en",
    "Strictly necessary cookies",
    "Campaign-origin cookie (axion_utm)",
    "Booking calendar (Calendly)",
    /name, term and content/,
    /not stored in the database/,
    /^Exception: /,
    /content/i,
  ],
] as const)(
  "politique de cookies (%s)",
  (lang, titreNecessaires, titreUtm, titreCalendly, formule, sansBase, debutException, contenu) => {
    const sections = page![lang].sections;
    const necessaires = sections.find((s) => s.title === titreNecessaires);
    const utm = sections.find((s) => s.title === titreUtm);

    it("la section « strictement nécessaires » ne range plus axion_utm parmi ses cookies", () => {
      expect(necessaires).toBeDefined();
      expect(necessaires!.body).not.toMatch(/Technical axion_utm|Cookie technique axion_utm/);
      expect(necessaires!.body).toMatch(/n'en fait pas partie|is not one of them/);
    });

    it("une section dédiée décrit le cookie et l'opposition", () => {
      expect(utm).toBeDefined();
      expect(utm!.body).toMatch(/utm_\*/);
      expect(utm!.body).toMatch(/30/);
      expect(utm!.body).toMatch(/HttpOnly/);
      expect(utm!.body).toMatch(/SameSite Lax/);
      expect(utm!.body).toMatch(/contact@axion-ia\.com/);
      expect(utm!.body).toMatch(/navigateur|browser/);
    });

    it("aucune section ne dit plus du cookie qu'il est exempté de consentement", () => {
      const tout = sections.map((s) => s.body).join("\n");
      expect(tout).not.toMatch(/mesure d'audience exemptée de consentement/);
      expect(tout).not.toMatch(/This is an audience measurement exempt from consent/);
    });

    it("aucun mot interdit dans la section ajoutée", () => {
      for (const re of MOTS_INTERDITS) expect(`${utm!.title} ${utm!.body}`).not.toMatch(re);
    });

    it("le cookie garde cinq clés : la formule finale les nomme toutes", () => {
      expect(utm!.body).toMatch(formule);
    });

    it("la mesure d'affichage du Tour n'enregistre ni terme ni contenu et ne garde pas l'IP", () => {
      const calendly = sections.find((s) => s.title === titreCalendly);
      expect(calendly).toBeDefined();
      const exception = calendly!.body.split("\n\n").find((p) => debutException.test(p));
      expect(exception).toBeDefined();
      expect(exception).toMatch(sansBase);
      expect(exception).not.toMatch(contenu);
    });
  },
);
