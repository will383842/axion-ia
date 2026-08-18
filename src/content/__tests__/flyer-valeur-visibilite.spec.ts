/**
 * Garde-fou « le flyer dit-il encore le bon montant ? » — 2026-08-18.
 *
 * POURQUOI CE TEST EXISTE
 * -----------------------
 * Le flyer A5 imprime « la visibilité offerte à 0 € au lieu de 650 € ». Ce
 * « 650 € » est une affirmation tarifaire d'Axion-IA, mais il ne correspond à
 * aucun tier : la visibilité ne se vend pas, elle est toujours servie à 0 €.
 * Faute de tier, il a longtemps vécu en dur dans une seule chaîne de
 * `content/imprimes.ts`, sous un marqueur `price-exempt`.
 *
 * L'exemption était le vrai défaut. `price-exempt` est documenté pour les prix
 * de MARCHÉ — coût d'un concurrent, seuil légal, budget client cité — c'est-à-
 * dire ce qui n'est pas un tarif Axion-IA. Ici c'en était un. Le marqueur
 * éteignait le seul capteur qui aurait signalé une dérive, et il l'éteignait
 * DANS LES DEUX SENS : ni la valeur de référence ni le tirage ne pouvaient
 * plus rougir.
 *
 * CE QUE CE TEST VERROUILLE
 * -------------------------
 * Deux constantes, volontairement distinctes :
 *
 *   - `VISIBILITE_OFFERTE_VALEUR_EUR` (pricing.ts) — la valeur de référence,
 *     celle qu'on sert aujourd'hui ;
 *   - `VALEUR_VISIBILITE_SUR_LE_FLYER` (imprimes.ts) — ce qui est ENCRÉ sur le
 *     tirage en cours.
 *
 * Un imprimé ne se redéploie pas. Le jour où la référence bouge, le PDF déjà
 * distribué continue d'annoncer l'ancien montant — et c'est précisément cet
 * écart qu'il faut voir, pas masquer. Ce test le nomme et dit quoi faire.
 *
 * QUE FAIRE SI CE TEST ÉCHOUE
 * ---------------------------
 * Vous venez de changer la valeur de référence. Le flyer est devenu FAUX :
 *   1. refaire le tirage (`fichiersHorsLigne` dit où vit le CMJN) ;
 *   2. republier `public/imprimes/flyer-a5-axion-ia.pdf` ;
 *   3. réaligner `VALEUR_VISIBILITE_SUR_LE_FLYER`.
 * Réaligner la constante SEULE ferait mentir la console sur un papier qui, lui,
 * dit toujours l'ancien prix.
 *
 * CE QUE CE TEST NE FAIT PAS
 * --------------------------
 * Il ne relit pas le PDF. Un `readFileSync(...).includes("650")` a été écrit,
 * puis retiré : les flux du PDF sont compressés, et « 700 », « 999 », « 1234 »
 * s'y trouvent tous par pur hasard. Le contrôle passait pour à peu près
 * n'importe quel montant — il aurait certifié un tirage qu'il ne lisait pas.
 * Décompresser les flux ferait de ce garde-fou un parseur PDF fragile pour un
 * gain nul : c'est `VALEUR_VISIBILITE_SUR_LE_FLYER` qui déclare le tirage, et
 * c'est la revue humaine qui répond d'elle.
 */

import { describe, it, expect } from "vitest";
import { VISIBILITE_OFFERTE_VALEUR_EUR } from "@/content/pricing";
import { IMPRIMES, VALEUR_VISIBILITE_SUR_LE_FLYER } from "@/content/imprimes";

describe("valeur de la visibilité offerte", () => {
  it("le tirage en cours du flyer annonce la valeur de référence", () => {
    expect(
      VALEUR_VISIBILITE_SUR_LE_FLYER,
      `Le flyer A5 imprime ${VALEUR_VISIBILITE_SUR_LE_FLYER} €, la référence est passée à ` +
        `${VISIBILITE_OFFERTE_VALEUR_EUR} €. Le papier déjà distribué est FAUX : refaire le ` +
        `tirage et republier le PDF, PUIS réaligner VALEUR_VISIBILITE_SUR_LE_FLYER.`,
    ).toBe(VISIBILITE_OFFERTE_VALEUR_EUR);
  });

  it("le résumé affiché en console porte bien ce montant", () => {
    const flyer = IMPRIMES.find((i) => i.id === "flyer-a5");
    expect(flyer, "l'imprimé `flyer-a5` a disparu du SSOT").toBeDefined();
    // Espace insécable fine : `formatAmount` passe par `fmtNumber(…, "fr")`.
    const attendu = new RegExp(`au lieu de ${VALEUR_VISIBILITE_SUR_LE_FLYER}\\s*€`);
    expect(flyer?.resume ?? "").toMatch(attendu);
  });
});
