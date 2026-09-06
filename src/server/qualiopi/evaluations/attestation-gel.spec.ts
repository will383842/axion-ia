/**
 * 🔴 Le recensement des attestations GELÉES, et sa condition de relâche.
 *
 * L'enjeu est asymétrique, et c'est pour ça que ce témoin existe :
 *
 * - **manquer un gel** ⇒ un stagiaire n'a jamais reçu l'attestation que la loi
 *   lui doit (L.6353-1), et personne ne le sait — le symptôme est une ABSENCE ;
 * - **relâcher à tort** ⇒ le cron reprend un dossier qu'il ne peut pas traiter,
 *   échoue à chaque passage, et on a remplacé un gel silencieux par une boucle
 *   d'échecs. C'est plus bruyant, ce n'est pas réparé.
 *
 * La condition de relâche reprend donc EXACTEMENT les gardes du service, pas une
 * version affaiblie « pour en rattraper plus ».
 */

import { describe, it, expect } from "vitest";

import {
  estGelee,
  motifNonRelachable,
  peutRelacher,
  type EtatGelAttestation,
} from "@/server/qualiopi/evaluations/attestation-gel";

/** Un dossier complet et sain : attesté, avec sa pièce. */
const SAIN: EtatGelAttestation = {
  marqueeAttestee: true,
  documentPresent: true,
  tauxPresencePct: 100,
  signaturesNonRevoquees: 3,
  creneauxImportes: 0,
};

/** Le gel typique : « attesté », aucune pièce, mais tout est là pour reprendre. */
const GELE_REPARABLE: EtatGelAttestation = {
  ...SAIN,
  documentPresent: false,
};

describe("🔴 attestations gelées — recensement et relâche", () => {
  it("un dossier avec sa pièce n'est PAS gelé", () => {
    expect(estGelee(SAIN)).toBe(false);
    expect(peutRelacher(SAIN)).toBe(false);
  });

  it("une inscription jamais attestée n'est PAS gelée", () => {
    // Le cron la reprendra tout seul : elle n'a aucun verrou.
    expect(estGelee({ ...GELE_REPARABLE, marqueeAttestee: false })).toBe(false);
  });

  it("🔑 TÉMOIN POSITIF — un gel réparable est bien DÉTECTÉ et RELÂCHABLE", () => {
    // Sans cette ligne, tous les autres témoins pourraient passer sur un
    // prédicat qui rend toujours `false` : « aucun gel » et « je ne détecte
    // rien » auraient la même sortie. C'est le piège des dix zéros.
    expect(estGelee(GELE_REPARABLE)).toBe(true);
    expect(peutRelacher(GELE_REPARABLE)).toBe(true);
    expect(motifNonRelachable(GELE_REPARABLE)).toBeNull();
  });

  it("🔴 un taux NON MESURÉ interdit la relâche — un inconnu n'est pas un zéro", () => {
    // C'est le gel le plus fréquent : `tauxPresencePct ?? 0` classait « aucune »
    // et verrouillait. Le relâcher sans mesurer la présence ferait lever
    // `AttestationTauxNonMesureError` au cron, à chaque passage.
    const e = { ...GELE_REPARABLE, tauxPresencePct: null };
    expect(estGelee(e)).toBe(true);
    expect(peutRelacher(e)).toBe(false);
    expect(motifNonRelachable(e)).toMatch(/NON MESURÉ/);
  });

  it("🔴 aucune trace d'assiduité interdit la relâche", () => {
    const e = { ...GELE_REPARABLE, signaturesNonRevoquees: 0, creneauxImportes: 0 };
    expect(estGelee(e)).toBe(true);
    expect(peutRelacher(e)).toBe(false);
    expect(motifNonRelachable(e)).toMatch(/trace d'assiduité/);
  });

  it("un relevé de connexion IMPORTÉ vaut trace, comme une signature", () => {
    // Le distanciel n'a pas de feuille papier. Exiger une signature y rendrait
    // toute session à distance non réparable — un refus qui viserait la
    // modalité, pas la preuve.
    const e = { ...GELE_REPARABLE, signaturesNonRevoquees: 0, creneauxImportes: 4 };
    expect(peutRelacher(e)).toBe(true);
  });

  it("un taux de 0 % MESURÉ n'est pas un taux absent", () => {
    // 0 % constaté est un fait : la personne ne s'est pas présentée. La ligne
    // reste relâchable — c'est au cron de conclure « aucune attestation », et
    // il le fera cette fois AVEC sa pièce de décision, pas par accident.
    const e = { ...GELE_REPARABLE, tauxPresencePct: 0 };
    expect(peutRelacher(e)).toBe(true);
    expect(motifNonRelachable(e)).toBeNull();
  });

  it("le motif est NULL sur un dossier qui n'est pas gelé du tout", () => {
    // Sinon l'écran afficherait une explication de blocage sur un dossier sain.
    expect(motifNonRelachable(SAIN)).toBeNull();
  });
});
