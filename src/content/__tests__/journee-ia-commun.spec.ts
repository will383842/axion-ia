/**
 * Module commun de La Journée IA : aucun montant écrit, jetons résolus depuis
 * `pricing.ts`, garantie déplacée sans changer un caractère.
 */

import { describe, it, expect } from "vitest";

import {
  CONDITION_GARANTIE,
  DATE_MISE_A_JOUR_JOURNEE_IA,
  DESCRIPTION_SERVICE_JOURNEE_IA,
  EN_BREF_ACCUEIL,
  EN_BREF_JOURNEE_IA,
  EN_BREF_JOURNEE_IA_PARAGRAPHES,
  EXEMPLE_TYPE,
  GARANTIE,
  GARANTIE_PHRASE,
  JETON_PRIX,
  MENTION_DECLARATION_OF,
  NUMERO_DECLARATION_ACTIVITE,
  RAPPORT_COMPLET,
  gainExempleEur,
  remplacerJetons,
} from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER, formatAmount, formatTierPrice } from "@/content/pricing";

/** Le littéral actuel de la garantie, recopié tel qu'il était dans `contenu.ts`. */
const GARANTIE_ACTUELLE =
  "À la fin de la journée, vous recevez votre rapport complet : vos gains chiffrés, les tâches à automatiser classées par rentabilité, et votre plan d’action sur 90 jours. Si les gains identifiés ne dépassent pas 3 fois le prix de la journée, nous vous remboursons, sans discussion, sous 30 jours.";

const TEXTES_AVEC_JETONS = {
  EN_BREF_ACCUEIL,
  EN_BREF_JOURNEE_IA,
  DESCRIPTION_SERVICE_JOURNEE_IA,
};

const TOUS_LES_TEXTES: Record<string, string> = {
  ...TEXTES_AVEC_JETONS,
  GARANTIE,
  GARANTIE_PHRASE,
  CONDITION_GARANTIE,
  RAPPORT_COMPLET,
  MENTION_DECLARATION_OF,
  ...Object.fromEntries(
    EN_BREF_JOURNEE_IA_PARAGRAPHES.map((p, i) => [`EN_BREF_PARAGRAPHE_${i}`, p]),
  ),
};

describe("journee-ia-commun : aucun montant écrit à la main", () => {
  it.each(Object.entries(TOUS_LES_TEXTES))(
    "%s : ni « € », ni « euro », ni 1 490",
    (_nom, texte) => {
      expect(texte).not.toMatch(/€/);
      // « en euros » (sans chiffre devant) est un mot, pas un montant : on cherche un nombre + euro(s).
      expect(texte).not.toMatch(/\d[\s  ]*euros?\b/i);
      expect(texte).not.toMatch(/1[\s  .]?490/);
    },
  );

  it("les textes à prix portent le jeton, jamais le montant", () => {
    expect(EN_BREF_ACCUEIL).toContain(JETON_PRIX);
    expect(EN_BREF_JOURNEE_IA).toContain(JETON_PRIX);
    expect(DESCRIPTION_SERVICE_JOURNEE_IA).toContain(JETON_PRIX);
  });
});

describe("remplacerJetons", () => {
  it("résout tout et met le prix de pricing.ts à la place du jeton", () => {
    for (const [nom, texte] of Object.entries(TEXTES_AVEC_JETONS)) {
      const resolu = remplacerJetons(texte);
      expect(resolu, nom).not.toContain("{{");
      expect(resolu, nom).toContain(formatTierPrice(JOURNEE_IA_TIER, "fr"));
    }
  });

  it("résout les jetons de l'exemple chiffré", () => {
    const resolu = remplacerJetons("{{GAIN_EXEMPLE}} | {{TAUX_HORAIRE}} | {{HEURES_EXEMPLE}}");
    const gain = formatAmount(gainExempleEur(), "fr", { compact: true });
    const taux = formatAmount(EXEMPLE_TYPE.tauxHoraireEur, "fr", { compact: true });
    expect(resolu).toBe(`${gain} | ${taux} | 6 h`);
  });

  it("lève une erreur si un jeton inconnu subsiste", () => {
    expect(() => remplacerJetons("Bonjour {{INCONNU}}")).toThrow(/INCONNU/);
  });

  it("un texte sans jeton passe inchangé", () => {
    expect(remplacerJetons("Rien à remplacer.")).toBe("Rien à remplacer.");
  });
});

describe("l'exemple chiffré", () => {
  it("6 h × 45 semaines × 35 € de l'heure = 9 450, calculé", () => {
    expect(EXEMPLE_TYPE).toStrictEqual({
      heuresParSemaine: 6,
      semainesTravaillees: 45,
      tauxHoraireEur: 35,
    });
    expect(gainExempleEur()).toBe(9450);
  });
});

describe("la garantie", () => {
  it("GARANTIE égale le littéral actuel, caractère pour caractère", () => {
    expect(GARANTIE).toBe(GARANTIE_ACTUELLE);
  });

  it("GARANTIE finit par GARANTIE_PHRASE, qui est la phrase de remboursement", () => {
    expect(GARANTIE.endsWith(GARANTIE_PHRASE)).toBe(true);
    expect(GARANTIE_PHRASE).toBe(
      "Si les gains identifiés ne dépassent pas 3 fois le prix de la journée, nous vous remboursons, sans discussion, sous 30 jours.",
    );
  });

  it("la condition et le rapport sont ceux décidés", () => {
    expect(CONDITION_GARANTIE).toBe(
      "Condition : votre équipe est disponible pendant la journée et nous fournit les chiffres demandés.",
    );
    expect(RAPPORT_COMPLET.startsWith("Sous 3 jours ouvrés après la journée")).toBe(true);
  });
});

describe("mention de déclaration d'activité et date", () => {
  it("dit « enregistré », jamais « préfet »", () => {
    expect(NUMERO_DECLARATION_ACTIVITE).toBe("84381100438");
    expect(MENTION_DECLARATION_OF).toBe(
      "Enregistré sous le numéro 84381100438. Cet enregistrement ne vaut pas agrément de l’État.",
    );
    expect(MENTION_DECLARATION_OF).not.toMatch(/préfet/i);
  });

  it("la date de mise à jour est une date ISO", () => {
    expect(DATE_MISE_A_JOUR_JOURNEE_IA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("textes publics : mots interdits", () => {
  it.each(Object.entries(TOUS_LES_TEXTES))("%s", (_nom, texte) => {
    expect(texte).not.toMatch(
      /conforme|certifi|qualiopi|\bCPF\b|\bOPCO\b|offert|\bETI\b|TPE\/PME|financement|amende|valeur de|satisfait|intégrateur|SaaS|no-code|Grenoble|même prix pour tous|Vous êtes remboursé|3 à 4\s?h/i,
    );
  });
});
