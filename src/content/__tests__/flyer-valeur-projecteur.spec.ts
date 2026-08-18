/**
 * Garde-fou « le flyer annonce-t-il encore le bon prix barré ? » — 2026-08-18.
 *
 * CE QUI S'EST PASSÉ, ET POURQUOI CE TEST EXISTE
 * ----------------------------------------------
 * Le flyer A5 imprime « 650 € 0 € » face au bloc « Un coup de projecteur,
 * offert — podcast avec votre dirigeant, interviews de vos équipes, page
 * dédiée ». Le 650 € est le prix de référence barré de ce bloc.
 *
 * Il a longtemps vécu en dur dans une seule chaîne de `content/imprimes.ts`,
 * sous un marqueur `price-exempt`. Ce marqueur est réservé aux prix qui ne sont
 * PAS des tarifs Axion-IA — coût d'un concurrent, seuil légal, budget client
 * cité. Ici c'en était un, et l'exemption éteignait le seul capteur capable de
 * signaler une dérive.
 *
 * La suite montre ce que coûte un montant non sourcé. N'en trouvant la trace
 * nulle part dans le dépôt, une révision a conclu que ce prix de référence
 * n'existait pas et l'a retiré — du texte ET du PDF, réimprimé pour l'occasion.
 * La déduction était raisonnable à partir du code seul ; elle était fausse
 * (décision Will 2026-08-18 : le montant est celui du podcast, il reste, barré,
 * avec l'offre à 0 € en regard). Une valeur qu'aucun fichier ne peut confirmer
 * finit par être supprimée par quelqu'un d'honnête.
 *
 * CE QUE CE TEST VERROUILLE
 * -------------------------
 *   - `VALEUR_REFERENCE_COUP_DE_PROJECTEUR_EUR` (pricing.ts) — la référence ;
 *   - `VALEUR_PROJECTEUR_SUR_LE_FLYER` (imprimes.ts) — ce qui est ENCRÉ sur le
 *     tirage en cours.
 *
 * Deux constantes, pas une. Un imprimé ne se redéploie pas : le jour où la
 * référence bouge, le papier déjà distribué annonce encore l'ancien montant.
 * Les fusionner ferait mentir la console sur l'objet qu'elle décrit.
 *
 * QUE FAIRE SI CE TEST ÉCHOUE
 * ---------------------------
 * Vous venez de changer la référence. Le flyer est devenu FAUX :
 *   1. refaire le tirage (`fichiersHorsLigne` dit où vit le CMJN) ;
 *   2. republier `public/imprimes/flyer-a5-axion-ia.pdf` ;
 *   3. réaligner `VALEUR_PROJECTEUR_SUR_LE_FLYER`.
 * Réaligner la constante SEULE ferait mentir la console sur un papier qui, lui,
 * dit toujours l'ancien prix.
 *
 * CE QUE CE TEST NE FAIT PAS
 * --------------------------
 * Il ne relit pas le PDF. Deux tentatives ont été écrites puis jetées : un
 * `includes("650")` sur les octets bruts passait aussi pour « 700 », « 999 » et
 * « 1234 », tous présents par hasard dans les flux compressés ; une extraction
 * maison des flux `FlateDecode` rendait 234 469 caractères de tables de polices
 * identiques d'un tirage à l'autre, donc aveugle au changement. Un garde-fou
 * qui certifie ce qu'il ne lit pas est pire que pas de garde-fou. Le contenu du
 * PDF se vérifie à la main (`pypdf` le fait très bien) au moment du retirage ;
 * ici, c'est `VALEUR_PROJECTEUR_SUR_LE_FLYER` qui déclare le tirage.
 */

import { describe, it, expect } from "vitest";
import { VALEUR_REFERENCE_COUP_DE_PROJECTEUR_EUR } from "@/content/pricing";
import { IMPRIMES, VALEUR_PROJECTEUR_SUR_LE_FLYER } from "@/content/imprimes";

describe("prix barré du coup de projecteur", () => {
  it("le tirage en cours du flyer annonce la valeur de référence", () => {
    expect(
      VALEUR_PROJECTEUR_SUR_LE_FLYER,
      `Le flyer A5 imprime ${VALEUR_PROJECTEUR_SUR_LE_FLYER} €, la référence est passée à ` +
        `${VALEUR_REFERENCE_COUP_DE_PROJECTEUR_EUR} €. Le papier déjà distribué est FAUX : ` +
        `refaire le tirage et republier le PDF, PUIS réaligner VALEUR_PROJECTEUR_SUR_LE_FLYER.`,
    ).toBe(VALEUR_REFERENCE_COUP_DE_PROJECTEUR_EUR);
  });

  it("le résumé de la console porte le montant barré ET l'offre à 0 €", () => {
    const flyer = IMPRIMES.find((i) => i.id === "flyer-a5");
    expect(flyer, "l'imprimé `flyer-a5` a disparu du SSOT").toBeDefined();
    const resume = flyer?.resume ?? "";
    // Espace insécable fine possible : `formatAmount` passe par `fmtNumber(…, "fr")`.
    expect(resume).toMatch(new RegExp(`${VALEUR_PROJECTEUR_SUR_LE_FLYER}\\s*€\\s*barré`));
    expect(resume).toMatch(/0\s*€/);
  });
});
