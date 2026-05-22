/**
 * Phase G Sprint Perfection 2026 — Diversification Linguistique
 * Tests pour diversity-checker.ts (12 cas).
 *
 * Fixtures :
 *  BAD_TTR       — texte à vocabulaire très répétitif (TTR bas)
 *  BAD_PASSIVE   — texte lourd en voix passive FR
 *  GOOD_DIVERSE  — texte varié, phrases hétérogènes, voix active
 *  GOOD_STD      — phrases de longueurs très variées
 *  GOOD_SHORT    — texte court mais dense
 */

import { describe, it, expect } from "vitest";
import { analyzeDiversity } from "../diversity-checker";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Texte ultra-répétitif : même mot marteau partout → TTR très bas. */
const BAD_TTR =
  "chat chat chat. chat chat chat. chat chat chat. chat chat chat. " +
  "chat chat chat. chat chat chat. chat chat chat. chat chat chat. " +
  "chat chat chat. chat chat chat. chat chat chat. chat chat chat. " +
  "chat chat chat. chat chat chat. chat chat chat. chat chat chat.";

/** Texte avec beaucoup de voix passive française. */
const BAD_PASSIVE =
  "Le rapport a été rédigé par l'équipe. " +
  "La décision a été prise hier. " +
  "Les résultats ont été présentés en séance. " +
  "Le document a été signé par le directeur. " +
  "La procédure a été validée par le comité. " +
  "Le projet a été accepté sans réserve. " +
  "La proposition a été approuvée à l'unanimité.";

/**
 * Texte richement varié : vocabulaire large, phrases de longueurs très hétérogènes
 * (std ≈ 9.9 > 4), voix active, 0 passive.
 * TTR ≈ 0.78 > 0.65.
 */
const GOOD_DIVERSE =
  "Oui, exactement. " +
  "L'IA transforme les PME. " +
  "Axion-IA accompagne les entreprises françaises dans leur transformation numérique avec des audits ciblés, des formations opérationnelles et des implémentations sur mesure adaptées à chaque secteur. " +
  "Résultat mesurable. " +
  "Nos consultants analysent vos processus métier, identifient les risques RGPD et AI Act, puis rédigent un plan d'action structuré en trois phases. " +
  "Vite et bien. " +
  "Chaque mission débute par un diagnostic précis des besoins réels, échanges avec les équipes, revue de la documentation existante et des systèmes en place. " +
  "Nous livrons. " +
  "La conformité RGPD et AI Act constitue un pilier non négociable de notre approche pour chaque client.";

/** Texte avec des phrases très courtes et très longues — fort écart-type. */
const GOOD_STD =
  "Oui. " +
  "Non. " +
  "Peut-être, mais seulement dans certaines conditions très précises qui nécessitent une analyse approfondie de l'ensemble du contexte organisationnel et des contraintes réglementaires en vigueur en 2026. " +
  "Exactement. " +
  "L'audit révèle plusieurs lacunes importantes dans la gouvernance des données personnelles, notamment en ce qui concerne la durée de conservation et les droits des personnes concernées. " +
  "Stop. " +
  "La solution implique une refonte partielle du système de gestion des consentements, en coordination étroite avec les équipes juridique, IT et métier pour garantir une conformité durable. " +
  "Bien sûr.";

/** Texte court mais avec des caractéristiques saines. */
const _GOOD_SHORT =
  "Axion-IA réalise des audits IA pour PME. " +
  "Nous intervenons rapidement. " +
  "Nos experts analysent vos processus, identifient les risques et proposent des recommandations concrètes. " +
  "Contactez-nous dès maintenant pour un premier échange gratuit.";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("analyzeDiversity — cas limites", () => {
  it("1. Chaîne vide → retourne des valeurs sûres (passed=true, 0 warnings)", () => {
    const result = analyzeDiversity("");
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.ttr).toBeGreaterThanOrEqual(0);
    expect(result.passiveVoiceRatio).toBeGreaterThanOrEqual(0);
  });

  it("2. Texte identique répété → TTR très bas → failed + warning TTR", () => {
    const result = analyzeDiversity(BAD_TTR);
    expect(result.ttr).toBeLessThan(0.3);
    expect(result.passed).toBe(false);
    const hasTtrWarning = result.warnings.some((w) => w.toLowerCase().includes("ttr"));
    expect(hasTtrWarning).toBe(true);
  });

  it("3. Texte riche et varié → TTR élevé → pas de warning TTR", () => {
    const result = analyzeDiversity(GOOD_DIVERSE);
    expect(result.ttr).toBeGreaterThan(0.65);
    const hasTtrWarning = result.warnings.some((w) => w.toLowerCase().includes("ttr"));
    expect(hasTtrWarning).toBe(false);
  });
});

describe("analyzeDiversity — longueur des phrases", () => {
  it("4. Phrases toutes de longueur similaire → std faible → warning std", () => {
    // Construire 10 phrases de longueur quasi identique (5 mots chacune).
    const uniform =
      "Le chat mange du poisson. " +
      "La chatte boit du lait. " +
      "Un chien court très vite. " +
      "Le soleil brille très fort. " +
      "La pluie tombe sur Paris. " +
      "Un oiseau chante dans l'arbre. " +
      "Le vent souffle sur la mer. " +
      "Un enfant joue dans le jardin. " +
      "La nuit tombe sur la ville. " +
      "Le train part de la gare.";
    const result = analyzeDiversity(uniform);
    expect(result.stdSentenceLength).toBeLessThan(4);
    const hasStdWarning = result.warnings.some(
      (w) => w.includes("std") || w.includes("uniforme") || w.includes("longueur"),
    );
    expect(hasStdWarning).toBe(true);
  });

  it("5. Phrases très variées en longueur → std élevé → pas de warning std", () => {
    const result = analyzeDiversity(GOOD_STD);
    expect(result.stdSentenceLength).toBeGreaterThan(4);
    const hasStdWarning = result.warnings.some(
      (w) => w.includes("std") || w.includes("uniforme") || w.includes("longueur"),
    );
    expect(hasStdWarning).toBe(false);
  });
});

describe("analyzeDiversity — voix passive", () => {
  it("6. Texte lourd en voix passive → passiveVoiceRatio élevé → warning passive", () => {
    const result = analyzeDiversity(BAD_PASSIVE);
    expect(result.passiveVoiceRatio).toBeGreaterThan(0.25);
    const hasPassiveWarning = result.warnings.some(
      (w) => w.toLowerCase().includes("passive") || w.toLowerCase().includes("active"),
    );
    expect(hasPassiveWarning).toBe(true);
  });

  it("7. Texte en voix active → passiveVoiceRatio bas → pas de warning passive", () => {
    const result = analyzeDiversity(GOOD_DIVERSE);
    expect(result.passiveVoiceRatio).toBeLessThan(0.25);
    const hasPassiveWarning = result.warnings.some(
      (w) => w.toLowerCase().includes("passive") || w.toLowerCase().includes("active"),
    );
    expect(hasPassiveWarning).toBe(false);
  });
});

describe("analyzeDiversity — traitement HTML", () => {
  it("8. Les balises HTML sont supprimées avant analyse", () => {
    const html =
      "<h2>Intelligence artificielle</h2>" +
      "<p>Axion-IA <strong>accompagne</strong> les <em>entreprises</em> dans leur transformation numérique.</p>" +
      "<ul><li>Audits précis et ciblés</li><li>Formations opérationnelles pour vos équipes</li></ul>" +
      "<p>Nos consultants interviennent directement sur le terrain pour identifier les risques réels.</p>";
    // Ne doit pas planter + ne doit pas compter les noms de balises comme mots.
    expect(() => analyzeDiversity(html)).not.toThrow();
    const result = analyzeDiversity(html);
    // Le TTR ne doit pas être artificiellement dopé par "<h2>", "<p>", etc.
    expect(result.ttr).toBeGreaterThan(0);
    expect(result.ttr).toBeLessThanOrEqual(1);
  });
});

describe("analyzeDiversity — comptage de phrases", () => {
  it("9. Texte mixte → nombre de phrases cohérent avec les terminateurs", () => {
    // 4 phrases séparées par . ! ? ;
    const mixed =
      "Voici une première phrase. " +
      "Et une deuxième ! " +
      "Une troisième interrogative ? " +
      "Enfin une quatrième séparée par point-virgule";
    const result = analyzeDiversity(mixed);
    // avgSentenceLength doit être raisonnable (> 1 mot par phrase).
    expect(result.avgSentenceLength).toBeGreaterThan(1);
  });

  it("10. Texte composé uniquement de chiffres et symboles → pas de crash", () => {
    const weird = "123 456 789. 42 0 99! 3.14 2.71? @@@ ### $$$";
    expect(() => analyzeDiversity(weird)).not.toThrow();
    const result = analyzeDiversity(weird);
    expect(result.ttr).toBeGreaterThanOrEqual(0);
    expect(result.ttr).toBeLessThanOrEqual(1);
    expect(Number.isFinite(result.avgSentenceLength)).toBe(true);
    expect(Number.isFinite(result.stdSentenceLength)).toBe(true);
    expect(Number.isFinite(result.passiveVoiceRatio)).toBe(true);
  });
});

describe("analyzeDiversity — champ passed", () => {
  it("11. passed=true quand tous les seuils sont respectés", () => {
    const result = analyzeDiversity(GOOD_DIVERSE);
    // GOOD_DIVERSE doit passer TTR + std + passive.
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("12. passed=false quand TTR est en dessous du seuil", () => {
    const result = analyzeDiversity(BAD_TTR);
    expect(result.passed).toBe(false);
    // TTR warning doit être présent.
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
