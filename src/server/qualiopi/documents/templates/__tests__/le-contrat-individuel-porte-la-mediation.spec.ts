/**
 * CLIQUET — le contrat individuel imprime la médiation dès qu'un médiateur
 * existe, et RIEN tant qu'il n'existe pas.
 *
 * ## Le défaut (2026-08-25)
 *
 * `documents.ts` lisait déjà `mediateur_consommation_nom` / `_url`, avertissait
 * l'admin quand elles étaient vides et traçait l'émission au journal d'audit.
 * Mais **le gabarit n'imprimait rien, même une fois les clés renseignées**.
 *
 * Renseigner la configuration éteignait donc l'avertissement **sans mettre la
 * clause au contrat** : une conformité de façade, où le seul signal disponible
 * s'éteint au moment précis où il cesse de dire la vérité.
 *
 * 🔑 Le dépôt le savait et l'avait écrit, dans `documents.ts` même : *« il
 * faudra aussi modifier le gabarit, sous peine de croire le contrat en règle
 * alors qu'il ne l'est pas. Ne pas retirer ce commentaire avant que le gabarit
 * l'imprime. »* Le commentaire a tenu onze jours ; ce fichier prend le relais,
 * parce qu'un commentaire ne rougit pas.
 *
 * ## Les DEUX sens, et le second compte autant
 *
 * Imprimer une clause qui nomme un médiateur inexistant serait **pire que le
 * silence** : elle donnerait au consommateur un recours qui échoue, donc un
 * grief supplémentaire, sur un support contractuel. La garde vérifie donc aussi
 * que rien ne s'imprime en l'absence d'adhésion.
 *
 * ## Ce qui n'est PAS gardé ici, et pourquoi
 *
 * L'adhésion elle-même. `L.612-1` impose au professionnel de garantir au
 * consommateur le recours effectif et gratuit à un médiateur agréé CECMC —
 * amende administrative jusqu'à 15 000 € pour une personne morale
 * (art. L.641-1). **Aucun test ne peut adhérer à un médiateur.** Le logiciel
 * est prêt ; l'acte ne s'écrit pas.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const GABARIT = readFileSync(
  join(
    process.cwd(),
    "src",
    "server",
    "qualiopi",
    "documents",
    "templates",
    "contrat-formation.tsx",
  ),
  "utf8",
);

const SOUS_TRAITANCE = readFileSync(
  join(
    process.cwd(),
    "src",
    "server",
    "qualiopi",
    "documents",
    "templates",
    "contrat-sous-traitance.tsx",
  ),
  "utf8",
);

const ACTIONS = readFileSync(
  join(process.cwd(), "src", "server", "actions", "qualiopi", "documents.ts"),
  "utf8",
);

/** Le code seul — un test statique trouve sinon ses propres commentaires. */
function codeSeul(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const GABARIT_CODE = codeSeul(GABARIT);
const ACTIONS_CODE = codeSeul(ACTIONS);

describe("le contrat individuel porte la médiation de la consommation", () => {
  it("🔑 CONTRE-TÉMOIN : le dépouillement des commentaires n'a pas tout vidé", () => {
    // Sans ceci, une expression régulière trop gourmande viderait les sources
    // et chaque assertion ci-dessous passerait au vert en ne lisant rien.
    expect(GABARIT_CODE.length).toBeGreaterThan(3000);
    expect(ACTIONS_CODE.length).toBeGreaterThan(50000);
    expect(GABARIT_CODE).toContain("ContratFormationData");
  });

  it("le gabarit accepte un médiateur, et RIEN ne s'imprime sans lui", () => {
    expect(
      /mediation\?:\s*\{\s*nom:\s*string;\s*url:\s*string;?\s*\}/.test(GABARIT_CODE),
      "le gabarit n'accepte plus de médiateur : la clause ne peut plus être imprimée",
    ).toBe(true);

    // Le rendu est CONDITIONNÉ. Une clause inconditionnelle nommerait un
    // médiateur inexistant tant qu'aucune adhésion n'a eu lieu.
    expect(
      /\{data\.mediation\s*\?/.test(GABARIT_CODE),
      "la clause n'est plus conditionnée à la présence d'un médiateur : un contrat " +
        "émis avant l'adhésion annoncerait un recours qui n'existe pas",
    ).toBe(true);

    expect(GABARIT_CODE).toContain("Médiation de la consommation");
    expect(GABARIT_CODE).toContain("L.612-1");
  });

  it("🔴 la numérotation ne saute pas quand la clause est absente", () => {
    // Un numéro FIXE sur les signatures ferait passer le contrat de 6 à 8 sur
    // tous les contrats émis avant l'adhésion. Un trou dans la numérotation
    // d'une pièce contractuelle se lit comme une page manquante.
    expect(
      /data\.mediation\s*\?\s*8\s*:\s*7/.test(GABARIT_CODE),
      "les signatures portent un numéro figé : vérifier qu'aucun numéro de " +
        "section ne saute quand la médiation n'est pas imprimée",
    ).toBe(true);
  });

  it("l'action transmet le médiateur au gabarit, pas seulement à l'avertissement", () => {
    // C'est EXACTEMENT le défaut d'origine : la valeur était lue, servait à
    // décider d'un avertissement, et n'atteignait jamais le document.
    expect(ACTIONS_CODE).toContain("mediateur_consommation_nom");
    expect(
      /mediation:\s*\{/.test(ACTIONS_CODE),
      "la configuration est lue mais n'est plus transmise au gabarit : " +
        "l'avertissement s'éteindrait sans que la clause soit imprimée",
    ).toBe(true);
  });

  it("🔑 le CONTRAT DE SOUS-TRAITANCE, lui, n'en porte pas — et c'est voulu", () => {
    // La médiation de la consommation vise le professionnel face à un
    // CONSOMMATEUR. Un contrat de sous-traitance lie deux professionnels.
    //
    // Ce témoin existe parce que la faute a réellement été commise le
    // 2026-08-25 : le motif de recherche qui a servi à câbler le contrat
    // individuel touchait aussi ce gabarit, et l'insertion y a été faite avant
    // d'être retirée. « Une règle juste appliquée au pluriel dispense
    // d'examiner le voisin » — sauf que le voisin n'avait pas le même client.
    expect(
      codeSeul(SOUS_TRAITANCE).includes("mediation"),
      "le contrat de sous-traitance porte une clause de médiation de la " +
        "consommation : il lie deux professionnels, aucun consommateur n'y figure",
    ).toBe(false);
  });
});
