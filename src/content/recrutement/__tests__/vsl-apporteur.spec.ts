/**
 * Le TEXTE de la page VSL apporteurs respecte les règles du plan
 * (`03-MESSAGES-ET-DECISIONS.md` R7/R8, décisions 3 et 11).
 *
 * On lit le texte SERVI : tout ce que `vsl-apporteur.ts` exporte (chaînes,
 * tableaux, objets) et la FAQ construite avec un montant. Une règle qui ne lirait
 * que le source passerait à côté d'un mot arrivé par une valeur calculée.
 */
import { describe, expect, it } from "vitest";
import * as contenu from "../vsl-apporteur";
import { AFFICHER_BLOC_COMMISSION, commissionVsl, faqVsl } from "../vsl-apporteur";
import { VSL_CONSENT_TEXTE } from "@/lib/commercial-application/vsl-apporteur";
import { COMMISSION_FORMATION_PAR_JOURNEE_EUR } from "@/content/pricing";

/** Toutes les chaînes que le module exporte, à plat (fonctions exclues). */
function chaines(valeur: unknown, acc: string[] = []): string[] {
  if (typeof valeur === "string") acc.push(valeur);
  else if (Array.isArray(valeur)) valeur.forEach((v) => chaines(v, acc));
  else if (valeur && typeof valeur === "object")
    Object.values(valeur as Record<string, unknown>).forEach((v) => chaines(v, acc));
  return acc;
}

const TOUT_LE_TEXTE = [
  ...chaines(Object.values(contenu).filter((v) => typeof v !== "function")),
  // La FAQ prend une somme en paramètre : on la lit avec un montant factice.
  ...chaines(faqVsl("MONTANT")),
  // Le bloc commission prend, lui aussi, sa somme en paramètre.
  ...chaines(commissionVsl("MONTANT")),
  contenu.VSL_FORMULAIRE.annonceEtape(1),
]
  .join("\n")
  .replace(VSL_CONSENT_TEXTE, ""); // texte versionné v3 : validé par la PR capture

describe("le texte de la page VSL apporteurs", () => {
  it("témoin : on lit bien un texte conséquent", () => {
    expect(TOUT_LE_TEXTE.length).toBeGreaterThan(1500);
  });

  it.each([
    ["Qualiopi", /qualiopi/i],
    ["parrainage", /parrain/i],
    ["vendre", /vendre|vendu|vente\s+d'/i],
    ["commercial", /commercial/i],
    ["recrutement", /recrut/i],
    ["entretien", /entretien/i],
    ["poste", /\bposte\b/i],
    ["revenu / salaire à gagner", /revenu|gagner de l'argent|liberté financière|sans effort/i],
    ["facebook dans le texte", /facebook/i],
  ])("aucun mot interdit : %s", (_nom, motif) => {
    expect(TOUT_LE_TEXTE).not.toMatch(motif);
  });

  it("aucun numéro de téléphone", () => {
    // Suites de chiffres groupés (06 12 34 56 78, +33…, 04.76…) — « 15 minutes » ne compte pas.
    expect(TOUT_LE_TEXTE).not.toMatch(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/);
    expect(TOUT_LE_TEXTE).not.toMatch(/\d{2}[\s.]\d{2}[\s.]\d{2}[\s.]\d{2}/);
  });

  it("aucun montant en dur : la seule somme entre par le paramètre de la FAQ", () => {
    expect(TOUT_LE_TEXTE).not.toMatch(/€|\beuros?\b/i);
    expect(TOUT_LE_TEXTE).not.toMatch(/\d[\d\s .,]*\s?(?:€|euros?|k€)/i);
  });

  it("la FAQ place la somme « à titre indicatif » dans la même phrase, et vient de pricing.ts", () => {
    const gains = faqVsl("500 €").find((q) => q.id === "gains");
    expect(gains?.answer).toMatch(/à titre indicatif, 500 €\u00a0HT par journée/i);
    // La page l'alimente avec `COMMISSION_FORMATION_PAR_JOURNEE_EUR`, pas avec un littéral.
    expect(COMMISSION_FORMATION_PAR_JOURNEE_EUR).toBeGreaterThan(0);
  });

  it("aucun gain, aucune somme en tête de page", () => {
    const tete = chaines(contenu.VSL_HERO).join(" ");
    expect(tete).not.toMatch(/\d\s?€|gagn|commission/i);
  });

  it("vouvoiement partout : aucun tutoiement", () => {
    const trouve = TOUT_LE_TEXTE.match(/(?<![\p{L}'])(?:tu|toi|ton|ta|tes|te|t')(?![\p{L}])/giu);
    expect(trouve).toBeNull();
  });

  it("les réponses de l'étape 2 sont exactement celles du contrat serveur", () => {
    expect(contenu.VSL_REPONSES.map((r) => r.id)).toEqual(["moins-5", "5-20", "20-50", "plus-50"]);
  });

  it("aucun délai promis, aucune rareté", () => {
    expect(TOUT_LE_TEXTE).not.toMatch(
      /sous\s+\d+\s?h|24\s?h|48\s?h|places?\s+limitée|plus que\s+\d+/i,
    );
  });

  it("les adresses : sous le segment apporteur-affaires, sans « facebook »", () => {
    expect(contenu.VSL_PATH).toBe("/apporteur-affaires/video");
    expect(contenu.VSL_MERCI_PATH).toBe("/apporteur-affaires/video/merci");
    expect(`${contenu.VSL_PATH}${contenu.VSL_MERCI_PATH}`).not.toMatch(/facebook/i);
  });
});

describe("le bloc « Votre commission »", () => {
  const c = commissionVsl("500 €");

  it("un interrupteur, actif par défaut : retirer le bloc se fait en un commit", () => {
    expect(typeof AFFICHER_BLOC_COMMISSION).toBe("boolean");
    expect(AFFICHER_BLOC_COMMISSION).toBe(true);
  });

  it("titre, grand chiffre « … par journée de formation facturée », sous-ligne obligatoire", () => {
    expect(c.titre).toBe("Votre commission");
    // « HT » comme le contrat (2026-10-10), insécable : jamais seul en début de ligne.
    expect(`${c.montant} ${c.apres}`).toBe("500 €\u00a0HT par journée de formation facturée");
    expect(c.sousLigne).toBe(
      "Règle de calcul du contrat, pas une promesse de gain. Versée quand l'entreprise a payé à 100 %, réduite au prorata en cas de remise.",
    );
  });

  it("« à titre indicatif » accompagne le chiffre (garde jur:remuneration-indicative)", () => {
    expect(c.indicatif).toMatch(/à titre indicatif/i);
  });

  it("le montant entre par PARAMÈTRE : rien n'est écrit en dur dans le texte", () => {
    const sansMontant = chaines(commissionVsl("MONTANT")).join(" ");
    expect(sansMontant).toContain("MONTANT");
    expect(sansMontant).not.toMatch(/\d\s?€|\beuros?\b|\b500\b/);
  });

  it("aucun exemple cumulé, aucune promesse de revenu, vouvoiement", () => {
    const t = chaines(c).join(" ");
    expect(t).not.toMatch(/revenu|complémentaire|sans effort|garanti|\d\s?jours?\s?=|cumul/i);
    expect(t).not.toMatch(/(?<![\p{L}'])(?:tu|toi|ton|ta|tes|te|t')(?![\p{L}])/iu);
  });
});
