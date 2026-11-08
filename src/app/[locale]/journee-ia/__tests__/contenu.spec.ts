import { describe, expect, it } from "vitest";
import { CONTENU, GARANTIE, JETON_PRIX, LIBELLE_CTA } from "../contenu";

/** Tous les textes visibles de la page, à plat. */
function textes(valeur: unknown): string[] {
  if (typeof valeur === "string") return [valeur];
  if (Array.isArray(valeur)) return valeur.flatMap(textes);
  if (valeur && typeof valeur === "object") {
    return Object.values(valeur).flatMap(textes);
  }
  return [];
}

const mots = (t: string) => t.split(/\s+/).filter((m) => /[\p{L}\d]/u.test(m));
const compte = (liste: string[]) => liste.reduce((n, t) => n + mots(t).length, 0);

const { accroche } = CONTENU;
// « titreAccent » est un sous-ensemble du titre : on ne le compte pas deux fois.
const { titreAccent: _accent, ...accrocheVisible } = accroche;
const toutLeTexte = textes({ ...CONTENU, accroche: accrocheVisible });
const auDessusDeLaFlottaison = textes(accrocheVisible);

describe("Journée IA — contenu.ts", () => {
  it("tient en 300 à 350 mots (336 environ)", () => {
    const n = compte(toutLeTexte);
    expect(n).toBeGreaterThanOrEqual(300);
    expect(n).toBeLessThanOrEqual(350);
  });

  it("porte 40 à 60 mots au-dessus de la ligne de flottaison", () => {
    const n = compte(auDessusDeLaFlottaison);
    expect(n).toBeGreaterThanOrEqual(40);
    expect(n).toBeLessThanOrEqual(60);
  });

  it("n'a qu'un seul libellé de bouton : « Prendre rendez-vous »", () => {
    expect(LIBELLE_CTA).toBe("Prendre rendez-vous");
    expect(CONTENU.accroche.cta).toBe(LIBELLE_CTA);
    expect(CONTENU.rendezVous.cta).toBe(LIBELLE_CTA);
    const cles = JSON.stringify(CONTENU).match(/"cta":"[^"]*"/g) ?? [];
    expect(new Set(cles).size).toBe(1);
  });

  it("a six sections", () => {
    expect(Object.keys(CONTENU)).toHaveLength(6);
  });

  it("ne contient aucun mot interdit", () => {
    const tout = toutLeTexte.join("\n");
    expect(tout).not.toMatch(/\bWill\b/);
    for (const interdit of [
      "Qualiopi",
      "certifi",
      "intégrateur",
      "Grenoble",
      "Aucun gain garanti",
    ]) {
      expect(tout.toLowerCase()).not.toContain(interdit.toLowerCase());
    }
  });

  it("n'écrit aucun montant : ni symbole €, ni chiffre de prix", () => {
    const tout = toutLeTexte.join("\n");
    expect(tout).not.toContain("€");
    expect(tout).not.toMatch(/\b(euros?|eur)\b/i);
    // Aucun nombre de 3 chiffres ou plus (hors n° de déclaration d'activité),
    // aucun séparateur de milliers.
    const sansDeclaration = tout.replace(/n° \d{11}/, "");
    expect(sansDeclaration).not.toMatch(/\d{3,}/);
    expect(sansDeclaration).not.toMatch(/\d[  .]\d{3}\b/);
  });

  it("utilise un jeton de prix, une seule fois", () => {
    const occurrences = toutLeTexte.join("\n").split(JETON_PRIX).length - 1;
    expect(occurrences).toBe(1);
    expect(CONTENU.livrables.derniereLigne).toContain(JETON_PRIX);
  });

  it("reprend la garantie mot pour mot du plan", () => {
    expect(GARANTIE).toBe(
      "À la fin de la journée, vous recevez votre rapport complet : vos gains chiffrés, les tâches à automatiser classées par rentabilité, et votre plan d’action sur 90 jours. Si les gains identifiés ne dépassent pas 3 fois le prix de la journée, nous vous remboursons, sans discussion, sous 30 jours.",
    );
    expect(CONTENU.intervenant.garantie).toBe(GARANTIE);
  });
});
