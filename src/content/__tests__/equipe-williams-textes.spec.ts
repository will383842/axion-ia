/**
 * Textes de la fiche `/fr/equipe/williams` : ce qui est interdit, ce qui est obligatoire.
 * Le test lit le contenu tel qu'il est rendu (adaptateur), pas les constantes une à une.
 */
import { describe, expect, it } from "vitest";
import { ficheDepuisWilliams } from "@/lib/equipe";
import {
  CONDITION_GARANTIE,
  DELAI_RAPPORT_JOURS_OUVRES,
  GARANTIE_PHRASE,
} from "@/content/journee-ia-commun";

function texteComplet(financementPublic = false): string {
  const { fiche, contenu } = ficheDepuisWilliams({ financementPublic });
  return JSON.stringify({ fiche, contenu });
}

describe("fiche Williams — vocabulaire interdit", () => {
  const INTERDITS: ReadonlyArray<[RegExp, string]> = [
    [/Grenoble/i, "Grenoble"],
    [/freelance|indépendant/i, "freelance / indépendant"],
    [/\bagence\b/i, "agence"],
    [/restructuration/i, "restructuration"],
    [/restaurant|restauration/i, "restauration"],
    [/grandes?\s+écoles?/i, "grandes écoles"],
    [/top\s*1\s*%|CAC\s*40/i, "formulations interdites"],
    [/€|\$/, "symbole monétaire"],
    [/\btarifs?\b|\bprix\b(?!\s+HT de la journée)/i, "prix / tarif"],
    [/\bcommission/i, "commission"],
    [/frais de déplacement/i, "frais de déplacement"],
    [/garantit|garantissons|garantie de résultat|aucun gain garanti/i, "promesse de résultat"],
    [/propriétaire|code source|cédés?\b|no-code|lock-in/i, "propriété du code"],
    [/formations? animées? par lui/i, "formations animées par lui-même"],
    [/\b\d+\s*(collaborateurs|salariés|personnes dirigées)/i, "nombre de collaborateurs"],
    [/\bbleu\b/i, "bleu"],
  ];

  it.each(INTERDITS)("aucun %s", (motif, nom) => {
    // La garantie de la Journée IA est citée mot pour mot : elle est la seule à parler de « prix HT ».
    const texte = texteComplet(true).replace(GARANTIE_PHRASE, "").replace(CONDITION_GARANTIE, "");
    expect(texte, nom).not.toMatch(motif);
  });

  it("la méthode est « Chiffrer, Essayer, Trancher », jamais l'ancienne", () => {
    const texte = texteComplet();
    expect(texte).toContain("Chiffrer, Essayer, Trancher");
    expect(texte).not.toMatch(/Cadrer|Prouver|Déployer|Transmettre/);
  });

  it("la cible est « TPE et PME », jamais « PME et TPE » ni « TPE/PME »", () => {
    const texte = texteComplet();
    expect(texte).toContain("TPE et PME");
    expect(texte).not.toMatch(/PME et (les )?TPE|TPE\s?\/\s?PME/);
  });

  it("« startup » est employé aux trois endroits clés : réponse de tête, fiche, FAQ 1", () => {
    const { fiche, contenu } = ficheDepuisWilliams();
    expect(fiche.reponseQui).toMatch(/startup/);
    expect(contenu.identite.find((l) => l.terme === "Entreprise")?.valeur).toMatch(/startup/);
    expect(contenu.faq[0]?.answer).toMatch(/startup/);
  });

  it("aucune ville, aucun point sur la carte", () => {
    const { fiche } = ficheDepuisWilliams();
    expect(fiche.ville).toBeUndefined();
    expect(fiche.departement).toBeUndefined();
    expect(fiche.afficherSurCarte).toBe(false);
  });
});

describe("fiche Williams — contenu v4", () => {
  const { contenu } = ficheDepuisWilliams();

  it("titre SEO de 57 caractères, meta description ≤ 160", () => {
    expect(contenu.titreSeo).toBe("Williams Jullin · Plus de chiffre d'affaires, même équipe");
    expect(contenu.titreSeo).toHaveLength(57);
    expect(contenu.metaDescription.length).toBeLessThanOrEqual(160);
    expect(contenu.metaDescription).toMatch(/^Williams Jullin dirige Axion-IA/);
  });

  it("le délai du rapport, la garantie et sa condition sont injectés, jamais retapés", () => {
    const j = JSON.stringify(contenu.porteEntree);
    expect(j).toContain(JSON.stringify(GARANTIE_PHRASE).slice(1, -1));
    expect(j).toContain(JSON.stringify(CONDITION_GARANTIE).slice(1, -1));
    expect(j).toContain(`Sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés`);
    expect(contenu.porteEntree?.points.map((p) => p.titre)).toContain(
      "Ensuite : vous avez vos chiffres.",
    );
  });

  it("le coaching ne renvoie pas vers la page des formats et tarifs", () => {
    const hrefs = contenu.services?.items.flatMap((s) => s.liens.map((l) => l.href)) ?? [];
    expect(hrefs).not.toContain("/interventions/individuel");
  });

  it("le Diagnostic IA dure 45 minutes", () => {
    expect(JSON.stringify(contenu)).toContain("45 minutes");
  });

  it("plus de trente ans de direction, sans nombre de collaborateurs", () => {
    expect(JSON.stringify(contenu.parcours)).toMatch(/plus de trente ans/i);
    expect(JSON.stringify(contenu.parcours)).toMatch(/plusieurs entités/);
  });

  it("cinq citations de terrain, huit questions sans financement", () => {
    expect(contenu.citations?.items).toHaveLength(5);
    expect(contenu.faq).toHaveLength(8);
  });

  it("la date visible est la date de révision", () => {
    expect(contenu.dateMiseAJour).toBe("2026-11-27T00:00:00.000Z");
  });
});
