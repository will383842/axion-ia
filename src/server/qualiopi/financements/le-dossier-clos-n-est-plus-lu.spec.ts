/**
 * #1112 — un dossier `clos` n'est plus le dossier d'une session.
 *
 * Le retour opco → direct referme désormais le dossier `a_monter` ; un
 * aller-retour opco → direct → opco laisse donc un dossier clos (le plus ancien)
 * ET un dossier actif. Les règles de facture automatique lisent « le plus ancien »
 * — exactement comme l'émission, qu'elles doivent imiter — : sans exclure `clos`,
 * elles décideraient sur la créance d'un dossier fermé.
 */

import { describe, expect, it } from "vitest";
import { SESSION_FACTURE_AUTO_SELECT } from "./facture-auto-regles";

describe("les règles de facture automatique ne lisent pas un dossier clos", () => {
  it("le `select` du dossier exclut `clos`", () => {
    expect(SESSION_FACTURE_AUTO_SELECT.dossiersFinancement).toMatchObject({
      where: { statut: { not: "clos" } },
    });
  });
});
