// @vitest-environment node

/**
 * Le bloc « Formule retenue par le client » ne doit JAMAIS être dans un cadre insécable
 * (`wrap={false}`) : un choix long (automatisations, lignes récurrentes) dépasserait la page
 * et serait rogné. Le « Bon pour accord » + signatures, eux, restent insécables.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/server/qualiopi/documents/templates/devis.tsx"),
  "utf8",
);

describe("devis.tsx — mise en page du choix retenu", () => {
  it("le bloc « Formule retenue » est dans un cadre SÉCABLE (choixBox), hors du cadre insécable", () => {
    const titre = source.indexOf("Formule retenue par le client</Text>");
    const debutChoix = source.lastIndexOf("styles.choixBox", titre);
    const debutAccord = source.indexOf("styles.accordBox,", titre);
    const sansChoix = source.indexOf(": styles.accordBox", titre);
    expect(titre).toBeGreaterThan(0);
    expect(debutChoix).toBeGreaterThan(0);
    // Le cadre du choix ne porte pas `wrap={false}` : aucune occurrence entre son ouverture et le titre.
    expect(source.slice(debutChoix, titre)).not.toContain("wrap={false}");
    // Le cadre insécable vient APRÈS le choix et s'ouvre après la fin du bloc choix.
    expect(debutAccord).toBeGreaterThan(titre);
    expect(sansChoix).toBeGreaterThan(titre);
    const accordBloc = source.slice(sansChoix, sansChoix + 80);
    expect(accordBloc).toContain("wrap={false}");
    // Le titre du choix n'est PAS à l'intérieur du cadre insécable.
    const dernierWrapFalseAvant = source.lastIndexOf("wrap={false}", titre);
    const dernierChoixBoxAvant = debutChoix;
    expect(dernierWrapFalseAvant).toBeLessThan(dernierChoixBoxAvant);
  });

  it("un devis classique garde le cadre « Bon pour accord » inchangé (style accordBox seul)", () => {
    expect(source).toContain(": styles.accordBox");
    expect(source).toContain("<Text style={styles.accordTitle}>Bon pour accord</Text>");
  });
});
