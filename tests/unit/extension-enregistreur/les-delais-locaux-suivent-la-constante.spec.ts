/**
 * ⛔ LES DÉLAIS LOCAUX SUIVENT LA CONSTANTE (PR 5).
 *
 * `extensions/enregistreur-meet/lib/constantes.js` recopie le contrat (les
 * modules de l'extension ne peuvent pas importer le Zod). Chaque valeur est
 * comparée au contrat GÉNÉRÉ, et le contrat au Zod
 * (`le-contrat-genere-suit-le-zod`) : un délai changé d'un seul côté rougit.
 *
 * Mutation qui rougit : passer `accordMaxMs` à 240000 dans `constantes.js`.
 * Contre-témoin : la comparaison porte sur TOUTES les clés (aucune oubliée).
 */

import { describe, expect, it } from "vitest";

import * as c from "../../../extensions/enregistreur-meet/lib/constantes.js";
import { lireContrat } from "./outils";

describe("⛔ les délais locaux suivent la constante", () => {
  const contrat = lireContrat();

  it("DELAIS_LOCAUX = contrat.constantes.delaisLocaux, clé pour clé", () => {
    expect(c.DELAIS_LOCAUX).toEqual(contrat.constantes.delaisLocaux);
  });

  it("son, en-têtes, tailles, version, chemin : identiques au contrat", () => {
    expect(c.CONSTANTES_AUDIO).toEqual(contrat.constantes.audio);
    expect(c.ENTETES_MORCEAU).toEqual(contrat.constantes.entetesMorceau);
    expect(c.TAILLE_MAX_MORCEAU_OCTETS).toBe(contrat.constantes.tailleMaxMorceauOctets);
    expect(c.VERSION_CONTRAT).toBe(contrat.version);
    expect(c.ENTETE_CONTRAT).toBe(contrat.entete);
    expect(c.BASE_API).toBe(`https://axion-ia.com${contrat.cheminApi}`);
  });

  it("la version de l'extension est celle du manifeste", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const manifeste = JSON.parse(
      readFileSync(join(process.cwd(), "extensions", "enregistreur-meet", "manifest.json"), "utf8"),
    );
    expect(c.VERSION_EXTENSION).toBe(manifeste.version);
  });
});
