/**
 * 🔴 L'ANGLE MORT : LES LIENS SONT PARTIS, ET PERSONNE N'A SIGNÉ.
 *
 * ## Comment il s'ouvrait
 *
 * Trois règles surveillaient l'émargement, et aucune ne voyait ce cas :
 *
 *   · `emargement_manquant` exige `statut = "realisee"` — or la clôture
 *     automatique REFUSE de passer en `realisee` une session sans trace de
 *     présence. Elle reste `en_cours`, et la règle ne la voit jamais ;
 *   · `session_bloquee_en_cours` attend J+3 — soit **un jour après**
 *     l'expiration des jetons (48 h après la fin) ;
 *   · `session_sans_dispositif_emargement` exige qu'**aucun lien vivant**
 *     n'existe. Or le cron de 06:00 vient précisément d'en créer : elle est
 *     éteinte **par construction** sur les sessions qu'il a servies.
 *
 * Résultat : une session servie par le cron mais jamais signée restait muette
 * jusqu'à J+3. **Le dispositif était en place, et c'est justement ce qui
 * empêchait de voir que personne ne s'en servait.**
 *
 * ## Ce que cette règle mesure
 *
 * ⚠️ L'ÉTAT réel — `emargementSigneAt` sur les inscriptions —, pas l'existence
 * du dispositif. Avoir posé le dispositif n'est pas avoir émargé, et c'est
 * exactement la confusion qui rendait la session invisible.
 */

import { describe, expect, it } from "vitest";
import { ALERTE_CATALOGUE } from "./catalogue";

describe("🔴 le code existe au catalogue, avec le bon guichet", () => {
  const entree = ALERTE_CATALOGUE["emargement_aucune_signature"];

  it("il est déclaré", () => {
    expect(entree).toBeDefined();
  });

  it("niveau CRITIQUE — le geste est encore possible, mais plus pour longtemps", () => {
    // ⚠️ Critique et non « important » : au-delà de 48 h après la fin, les
    // jetons expirent et l'émargement devient irrattrapable. Une alerte qui
    // arrive après ne prévient plus, elle constate.
    expect(entree?.niveau).toBe("critique");
  });

  it("guichet administratif — c'est lui qui relance, pas la direction", () => {
    expect(entree?.guichet).toBe("administratif");
  });

  it("résolution automatique : la première signature l'éteint", () => {
    // Une alerte qu'il faut fermer à la main survit à sa cause et fabrique du
    // bruit — le moteur la retire dès que la condition tombe.
    expect(entree?.resolutionAuto).toBe(true);
  });

  it("🔴 son titre ne se confond pas avec celui de sa jumelle", () => {
    // Les deux règles sont voisines et opposées : l'une dit « aucun
    // dispositif », l'autre « dispositif en place, personne ne s'en sert ».
    // Deux titres proches feraient chercher au mauvais endroit.
    const jumelle = ALERTE_CATALOGUE["session_sans_dispositif_emargement"];
    expect(entree?.titre).not.toBe(jumelle?.titre);
    expect(entree?.titre).toContain("aucune signature");
    expect(jumelle?.titre).toContain("sans dispositif");
  });
});
