/**
 * Contre-audit v3 de la PR #2194 (`geo/relectures/AUDIT-PR-RETRAIT-CORRECTIFS-v3.md`, dépôt
 * axion-plans-prive), points 1 à 4 : la porte 2 ferme les FAMILLES (« prise en charge », « financ… »,
 * « rembours… », « éligib… »), pas seulement les exemples cités. Logique inversée : tout est refusé, sauf
 * une courte liste d'emplois NON financiers, chacun avec son test.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INTERDITS_PUBLICS, appliquerOverrides, empreinte, type Proposition } from "./plan";
import { PHRASE_FR, QUESTION_FR } from "./regles";

const refuse = (s: string) => INTERDITS_PUBLICS.test(s);

describe("v3 point 1 — « prise(s) en charge » : toutes les formes refusées", () => {
  it.each([
    "Votre employeur prendrait en charge la formation.",
    "Les employeurs prendraient en charge le coût.",
    "Je prends en charge vos démarches.",
    "Il faut qu'il prenne en charge la formation.",
    "Nous prenions en charge les frais.",
    "La formation est prise intégralement en charge.",
    "La formation est totalement prise en charge par l'État.",
    "Formation 100 % prise-en-charge.",
    "Une prise en charge rapide de vos frais de formation.",
    "Une prise en charge immédiate du coût de la formation.",
    "La prise en charge du projet de formation par l'employeur.",
    "La prise en charge d'un projet de formation est possible.",
    "La prise en charge de la demande de formation est assurée.",
    "La prise en charge des clients de la formation professionnelle.",
    "La formation est à la charge de l'employeur.",
    "Le reste à charge est nul.",
    "L'employeur assume la charge de la formation.",
    "Les frais sont pris en charge.",
    "Une prise en charge totale par l'organisme",
    // Sujet avant « pris en charge » : on ne peut pas prouver l'absence de sens financier, donc refusé.
    "Les incidents sont pris en charge par l'équipe.",
    "Les patients sont pris en charge, puis orientés.",
    "Les prises en charge varient selon le dossier.",
    "Des prises en charge possibles.",
    // en charge de + terme budgétaire dans la même phrase
    "Le budget est pris en charge des appels.",
  ])("« %s » est refusé", (s) => expect(refuse(s)).toBe(true));

  it.each([
    "La prise en charge des appels est rapide.",
    "La prise en charge des projets web est rapide.",
    "Une prise en charge technique du projet.",
    "La prise en charge des demandes clients se fait en une heure.",
    "La prise en charge des tickets se fait par l'équipe support.",
    "La prise en charge rapide.",
    "La prise en charge des requêtes est immédiate.",
  ])("emploi non financier explicite « %s » est accepté", (s) => expect(refuse(s)).toBe(false));
});

describe("v3 point 2 — « financ… » : refusé sauf emplois de secteur listés", () => {
  it.each([
    "Votre employeur finance 100 % de la formation.",
    "Votre employeur finance intégralement votre parcours.",
    "L'entreprise finance en partie la formation.",
    "L'entreprise finance à hauteur de 50 % la formation.",
    "Tu finances ta formation.",
    "L'État finançait la formation.",
    "Les entreprises finançaient leurs parcours.",
    "L'État vous accompagne financièrement.",
    "Une participation financière de l'employeur.",
    "Une contribution financière de l'entreprise.",
    "Des solutions financières existent pour votre formation.",
    "Des ressources financières pour investir.",
    "Sans contrainte financière excessive.",
    "Cela réduit la barrière financière.",
    "Une enveloppe financière dédiée.",
    "Des moyens financiers existent.",
    "Un cofinancement est possible.",
    "ouvre des droits à financement",
    "Oui (cofinancé)",
    "Le financement est possible.",
    "Quels soutiens financiers sont disponibles ?",
    "Les finances de l'entreprise couvrent la formation.",
  ])("« %s » est refusé", (s) => expect(refuse(s)).toBe(true));

  it.each([
    "L'IA dans la finance progresse.",
    "La finance et les RH adoptent l'IA.",
    "Dans la finance, l'IA automatise le reporting.",
    "Les banques et la finance adoptent l'IA.",
    "Les équipes finance utilisent l'IA.",
    "Le secteur financier recrute.",
    "Le reporting financier est automatisé.",
    "L'IA améliore l'analyse financière.",
    "Les analyses financières gagnent du temps.",
    "Les données financières sont mieux contrôlées.",
    "Les prévisions financières sont affinées.",
    "Un directeur financier valide le budget IA.",
    "Une directrice financière pilote le projet.",
    "La finance d'entreprise évolue avec l'IA.",
    "Des bénéfices non financiers apparaissent.",
    "L'impact financier de l'IA est mesuré.",
  ])("emploi de secteur « %s » est accepté", (s) => expect(refuse(s)).toBe(false));
});

describe("v3 point 3 — remboursement, éligibilité, plan de développement des compétences", () => {
  it.each([
    "BPI France propose également des avances remboursables pour les projets d'innovation numérique.",
    "Conservez tous les justificatifs pour faciliter le remboursement.",
    "Formation 100 % en ligne, certifiante, éligible.",
    "Vérifiez l'éligibilité avant de constituer votre dossier.",
    "Toutes les formations IA ne sont pas éligibles.",
    "Le plan de développement des compétences de l'entreprise.",
    "Vous serez remboursé.",
  ])("« %s » est refusé", (s) => expect(refuse(s)).toBe(true));
});

describe("v3 point 3 — phrases RÉELLES du rapport dry-run-2026-11-20 citées au §3 de l'audit", () => {
  // Tirées de geo/retrait/dry-run-2026-11-20/rapport.md (lignes indiquées).
  const PHRASES_REELLES = [
    // l. 13371 et 13413 (Grigny)
    "Ces options permettent aux entreprises de Grigny d'accéder à des ressources financières pour investir dans le développement des compétences de leurs dirigeants.",
    // l. 17296 et 17336 (Noisy-le-Sec)
    "Le coaching reste accessible sans contrainte financière excessive.",
    // l. 17805 sq.
    "Cela réduit la barrière financière et facilite l'accès à des formations.",
    "BPI France propose également des avances remboursables pour les projets d'innovation numérique.",
    // l. 20233, une fois « OPCO » retiré
    "Conservez tous les justificatifs pour faciliter le remboursement.",
    "Formation 100 % en ligne, certifiante, éligible.",
    "Vérifiez l'éligibilité avant de constituer votre dossier.",
    "Toutes les formations IA ne sont pas éligibles.",
    "Le financement du coaching IA peut être assuré via les OPCO, France Travail ou le plan de développement des compétences de l'entreprise.",
  ];
  it.each(PHRASES_REELLES)("« %s » est refusée par la porte 2", (s) =>
    expect(refuse(s)).toBe(true),
  );

  it.each(PHRASES_REELLES)("« %s » est ignorée comme override", (valeur) => {
    const original = "Texte d'origine.";
    const proposition: Proposition = {
      cle: "article_translation:x",
      table: "article_translation",
      id: "x",
      avant: { excerpt: original },
      apres: {},
      ambigus: ["article_translation:x.excerpt : ambigu"],
      conserves: [],
    };
    const r = appliquerOverrides(
      proposition,
      { excerpt: original },
      { "article_translation:x": { excerpt: { origine: empreinte(original), valeur } } },
    );
    expect(r.proposition.apres.excerpt).toBeUndefined();
    expect(r.ignores.join("\n")).toMatch(/interdit public/);
  });
});

describe("v3 point 3 — rejeu de la porte 2 sur TOUT le texte de remplacement du rapport", () => {
  const remplacements: { ligne: number; texte: string }[] = JSON.parse(
    readFileSync(
      join(__dirname, "__fixtures__/rapport-dry-run-2026-11-20-remplacements.json"),
      "utf8",
    ),
  );
  // Autonome : indépendant de INTERDITS_PUBLICS, pour qu'un trou du motif ne cache pas le trou du texte.
  const FAMILLE =
    /financ|prise?s? en charge|\bOPCO|\bCPF\b|qualiopi|france travail|subvention|rembours|[ée]ligib|\bAIF\b/i;
  // Résidus du rapport (essai à blanc du 20/11 : le retrait n'a enlevé que « (OPCO) » et laissé le
  // financement autour). Ils survivent : ESCALADE dans coordination/JOURNAL-SESSIONS.md, à trancher.
  const SURVIVANTS_CONNUS = new Set([71, 91, 476, 536]);

  it("la fixture est bien tirée du rapport (57 remplacements non vides)", () => {
    expect(remplacements).toHaveLength(57);
  });
  it("aucun terme de la famille financement ne survit, hors survivants connus et escaladés", () => {
    const survivants = remplacements.filter((r) => FAMILLE.test(r.texte)).map((r) => r.ligne);
    expect(new Set(survivants)).toEqual(SURVIVANTS_CONNUS);
  });
  it("tout survivant est vu par la porte 2 (pas de trou du motif)", () => {
    for (const r of remplacements.filter((r) => FAMILLE.test(r.texte)))
      expect(refuse(r.texte), `l. ${r.ligne}`).toBe(true);
  });
  it("les remplacements sans terme de la famille ne sont pas refusés à tort", () => {
    for (const r of remplacements.filter((r) => !FAMILLE.test(r.texte)))
      expect(refuse(r.texte), `l. ${r.ligne}`).toBe(false);
  });
});

describe("v3 — phrase standard validée inchangée", () => {
  it("phrase et question exactes, non refusées", () => {
    expect(PHRASE_FR).toBe(
      "Tarifs : sur devis, établi après un Diagnostic IA gratuit de 45 minutes.",
    );
    expect(refuse(PHRASE_FR)).toBe(false);
    expect(refuse(QUESTION_FR)).toBe(false);
  });
});
