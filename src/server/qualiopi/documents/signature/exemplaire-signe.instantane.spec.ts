/**
 * L'instantané de rendu doit reconduire la VERSION DU GABARIT.
 *
 * ## Le défaut, vécu en production le 2026-09-05
 *
 * Convention `AXI-DOC-2026-039`, générée le 04/09 avec le gabarit courant,
 * signée par la cliente à 23:15, contresignée à 23:33. « Ouvrir l'exemplaire
 * signé (PDF) » rendait :
 *
 *     « Le modèle de cette pièce a évolué depuis sa signature […] »
 *
 * Faux : le modèle n'avait pas bougé depuis le 16/08, et la pièce datait du
 * 04/09. Le refus venait d'un champ perdu en chemin.
 *
 * `documents-service.ts` écrit `gabaritVersion` DANS `renderData` à la
 * génération. `instantane()` relit `renderData` et reconstruit un objet neuf
 * **champ par champ** — il en énumérait deux (`data`, `identite`) et laissait
 * tomber le troisième. `versionGabaritInstantane()` ne trouvait donc jamais
 * rien et retombait sur son défaut prudent, 1, face à `convention: 2`.
 *
 * Les deux moitiés sont nées dans le MÊME commit (#639, 16/08) : celui-ci a
 * ajouté l'écriture et la garde, sans ajouter la reconduction entre les deux.
 *
 * ## Pourquoi trois semaines sans que rien ne rougisse
 *
 * Deux raisons qui se cumulent, et qui sont l'objet même de ce fichier :
 *
 *  1. **Le témoin existant fabrique son instantané à la main.**
 *     `gabarit-versions.spec.ts` écrit `{ data: {}, gabaritVersion: courante }`
 *     et le passe directement à `versionGabaritInstantane()`. Il n'emprunte
 *     JAMAIS `instantane()` — la fonction qui perd le champ. Son test nommé
 *     « une convention générée APRÈS la retouche reste reproductible » était
 *     donc vert pendant que ce cas échouait à chaque appel réel.
 *
 *  2. **Cinq pièces signables sur sept sont restées en version 1.** Pour elles,
 *     le défaut se compense : la valeur perdue vaut le défaut de repli, `1 ===
 *     1`, et l'exemplaire sort. Seules les deux conventions ont été bumpées à
 *     2 — et elles seules étaient refusées. Un défaut qui n'atteint que le
 *     sous-ensemble qu'on ne teste pas ressemble à un cas particulier.
 *
 * Ce fichier tient donc la moitié manquante : il part du bloc tel que le
 * PRODUCTEUR l'écrit et le fait traverser `instantane()`.
 */

import { describe, expect, it } from "vitest";

import { instantane } from "./exemplaire-signe";
import {
  versionGabaritCourante,
  versionGabaritInstantane,
} from "@/server/qualiopi/documents/templates/gabarit-versions";

/**
 * Reproduit la construction de `renderData` faite par le producteur réel.
 *
 * ⚠️ Miroir de `documents-service.ts` (« 🔴 La VERSION DU GABARIT, à côté des
 * données ») : mêmes clés, même appel à `versionGabaritCourante(type)`, même
 * aller-retour JSON. Écrire ici un littéral figé — `gabaritVersion: 2` — ferait
 * de la fixture la source de vérité à la place du producteur, et le test
 * survivrait à un bump du gabarit qu'il est censé suivre.
 */
function metadataCommeALaGeneration(
  type: string,
  data: Record<string, unknown>,
  identite?: Record<string, unknown>,
): unknown {
  const version = versionGabaritCourante(type);
  return {
    renderData: JSON.parse(
      JSON.stringify({
        data,
        ...(identite !== undefined ? { identite } : {}),
        ...(version !== null ? { gabaritVersion: version } : {}),
      }),
    ) as unknown,
  };
}

describe("l'instantané reconduit la version du gabarit", () => {
  /**
   * LE TÉMOIN DU DÉFAUT. Il rougit sur la version d'avant le correctif — c'est
   * la seule assertion de ce fichier qui traverse les deux moitiés de la chaîne.
   */
  it("une convention générée avec le gabarit courant reste reproductible", () => {
    const metadata = metadataCommeALaGeneration(
      "convention",
      { numero: "AXI-DOC-2026-039" },
      { raisonSociale: "SCI Invest Sun" },
    );

    const snap = instantane(metadata);
    expect(snap).not.toBeNull();

    // La question posée par `rendreExemplaireSigne` avant de refuser.
    expect(versionGabaritInstantane(snap)).toBe(versionGabaritCourante("convention"));
  });

  /**
   * CONTRE-TÉMOIN. Sans lui, reconduire n'importe quoi ferait passer le test
   * ci-dessus : il faut aussi prouver que la garde REFUSE encore ce qu'elle
   * doit refuser. C'est le cas qui a motivé le mécanisme — une pièce d'avant
   * le 16/08, dont l'instantané ne porte aucune version.
   */
  it("une pièce d'avant le mécanisme reste, elle, non reproductible", () => {
    const metadata = { renderData: { data: { numero: "AXI-DOC-2026-030" } } };

    const snap = instantane(metadata);
    expect(snap).not.toBeNull();
    expect(versionGabaritInstantane(snap)).not.toBe(versionGabaritCourante("convention"));
  });

  /**
   * Le défaut n'était visible que sur les pièces bumpées. On vérifie donc les
   * DEUX familles : celles en version 1, qui passaient par compensation, et
   * les conventions, qui étaient refusées. Sans cette boucle, un futur bump
   * d'une pièce aujourd'hui en version 1 rouvrirait le défaut en silence.
   */
  it("chaque type signable traverse l'instantané avec SA version", () => {
    for (const type of [
      "devis",
      "convention",
      "convention_tripartite",
      "contrat_formation",
      "contrat_sous_traitance",
      "releve_connexion",
      "lettre_mission",
    ]) {
      const snap = instantane(metadataCommeALaGeneration(type, { numero: "X" }));
      expect(versionGabaritInstantane(snap), `type « ${type} »`).toBe(versionGabaritCourante(type));
    }
  });

  it("ne reconduit pas une version que le producteur n'a pas écrite", () => {
    // Une pièce non signable n'en porte pas : la question ne se pose pas, et en
    // inventer une laisserait croire qu'elle se pose.
    const snap = instantane({ renderData: { data: {} } });
    expect(snap).not.toBeNull();
    expect(snap && "gabaritVersion" in snap).toBe(false);
  });

  it("reconduit toujours data et identite — les deux champs d'origine", () => {
    const snap = instantane(
      metadataCommeALaGeneration("convention", { numero: "N" }, { raisonSociale: "R" }),
    );
    expect(snap?.data).toEqual({ numero: "N" });
    expect(snap?.identite).toEqual({ raisonSociale: "R" });
  });
});
