/**
 * Contre-audit v4 de la PR #2194 (`geo/relectures/AUDIT-PR-RETRAIT-CORRECTIFS-v4.md`, dépôt
 * axion-plans-prive), points 1 à 5. Les phrases sont TIRÉES du vrai rapport
 * `geo/retrait/dry-run-2026-11-20/rapport.md` (numéros de ligne en commentaire).
 */
import { describe, expect, it } from "vitest";
import { INTERDITS_PUBLICS, normaliserPourPorte2 } from "./plan";

const refuse = (s: string) => INTERDITS_PUBLICS.test(s);

describe("v4 point 1 — la famille « aide(s) » au sens financement est fermée", () => {
  it.each([
    "…souhaitant se former à l'IA, l'Aide Individuelle à la Formation", // l. 159, 199, 444, 474
    "Aides régionales Hauts-de-France : des dispositifs spécifiques existent pour la montée en compétences numériques des PME régionales", // l. 552
    "…pour les entreprises locales souhaitant accéder à des aides.", // l. 1896, 1922
    "Les aides France Num", // l. 2512
    "…avec des dispositifs d'aide au diagnostic et à la formation.", // l. 2513
    "Aides spécifiques disponibles", // l. 14900
    "Ces aides permettent aux entreprises de Stains de former leurs équipes sans impacter lourdement leur budget.", // l. 16638
    "Il est conseillé de planifier le budget formation en tenant compte des aides disponibles pour maximiser l'investissement dans les compétences IA.", // l. 16642
    "…dans l'identification des aides disponibles pour la montée en compétences numériques.", // l. 20093
    "…pour connaître les dispositifs d'aide disponibles localement.", // l. 20725
    "…vous orienter vers les dispositifs d'aide locaux.", // l. 22436
    "…orienter les entreprises locales vers les dispositifs d'aide disponibles.", // l. 22706
    "L’aide de l’État à la formation.",
    "Une aide au financement possible.",
  ])("refuse : %s", (s) => expect(refuse(s)).toBe(true));

  it.each([
    "Copilot Microsoft 365 aide à automatiser les tâches.",
    "Axion-IA aide les entreprises à identifier leurs cas d'usage.",
    "L'IA aide à gagner du temps.",
  ])("accepte le verbe : %s", (s) => expect(refuse(s)).toBe(false));
});

describe("v4 point 2 — reprises indirectes de prise en charge des coûts", () => {
  it.each([
    "Ces dispositifs couvrent tout ou partie des frais selon la taille de la structure et le secteur d'activité.", // l. 18326
    "…bénéficier de ces dispositifs pour alléger le coût des formations.", // l. 3571
    "Ces dispositifs permettent de réduire le coût initial de la formation.", // l. 4244
    "Ces options permettent de réduire le coût des formations.",
    "Ces options permettent de réduire les coûts liés à la formation.",
    "Ces options permettent de réduire les coûts associés à la formation.",
    "Ces options permettent de réduire le coût des audits pour les PME et ETI.",
    "Les leviers disponibles couvrent les frais de la formation.",
    "L'entreprise règle tout ou partie du coût.", // motif « tout ou partie » seul
    "Une structure reçoit tout ou partie des frais.",
  ])("refuse : %s", (s) => expect(refuse(s)).toBe(true));

  it.each([
    "L'adoption de l'IA permet de réduire les coûts opérationnels.", // le \b devant « options » est indispensable
    "Ces tarifs couvrent l'ensemble de la prestation.",
  ])("accepte : %s", (s) => expect(refuse(s)).toBe(false));
});

describe("v4 point 3 — faux positifs du corpus levés", () => {
  it.each([
    "…les secteurs de l'assurance, banque et finance à Tremblay-en-France.", // l. 13752
    "Les secteurs de l'assurance, banque et finance sont parmi les plus avancés en matière de formation IA.", // l. 13753
    "Finance et IA", // l. 3565
    "Non. Axion-IA intervient en mode cabinet externe et prend en charge l'intégralité de la partie technique.", // l. 1801
    "Un chatbot IA métier prend en charge les demandes répétitives et les questions fréquentes.", // l. 21870
    "Un évaluateur ne doit pas avoir d'intérêt financier à recommander une solution.",
  ])("accepte : %s", (s) => expect(refuse(s)).toBe(false));

  it.each([
    "Votre employeur finance à 100 % la formation.",
    "L'État finance sa formation.",
    "Il finance les frais.",
    "Il prend en charge les demandes et les frais de formation.",
    "Un chatbot prend en charge les demandes et la formation.",
  ])("garde le refus : %s", (s) => expect(refuse(s)).toBe(true));
});

describe("v4 point 4 — formes typographiques et variantes", () => {
  it.each([
    "prise‐en‐charge totale", // U+2010
    "prise–en–charge totale", // U+2013
    "France‑Travail", // U+2011
    "France Travail", // espace insécable
    "compte personnel de formation", // espaces insécables
    "Opérateurs de compétences",
    "Un reste-à-charge nul.",
    "Les prises en charges varient.",
    "L'employeur prend la formation à sa charge.",
    "Une formation à votre charge.",
    "L'autofinancement de la formation.",
    "Mon compte-formation",
    "L'OPCA de branche.",
  ])("refuse : %s", (s) => expect(refuse(normaliserPourPorte2(s))).toBe(true));
});

describe("v4 point 5 — le tiret de PRISE_EN_CHARGE est verrouillé", () => {
  it.each(["Prise-en-charge intégrale.", "100 % pris-en-charge par l'État."])("refuse : %s", (s) =>
    expect(refuse(s)).toBe(true),
  );
});
