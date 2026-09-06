/**
 * 🔴 Les deux refus d'attestation doivent rester DISTINGUABLES par l'écran.
 *
 * La console lit une chaîne — la Server Action ne transporte rien d'autre — et
 * doit en déduire s'il faut proposer un champ de motif. Se tromper coûte des
 * deux côtés :
 *
 * - ne PAS reconnaître un refus rattrapable ⇒ le champ n'apparaît jamais, et la
 *   pièce due au stagiaire (L.6353-1) devient impossible à produire ;
 * - reconnaître à tort le refus DUR ⇒ on propose d'écrire un motif qui ne lèvera
 *   rien. Un motif qu'on saisit sans effet est pire qu'un refus : il fait croire
 *   qu'on a agi.
 *
 * Ce témoin est le seul point où les deux messages se rencontrent. Il exige que
 * le prédicat les sépare, et il rougirait si l'un des deux textes dérivait vers
 * l'autre.
 */

import { describe, it, expect } from "vitest";

import {
  MARQUEUR_REFUS_RATTRAPABLE,
  MESSAGE_REFUS_TAUX_NON_MESURE,
  MOTIF_PREUVES_MIN,
  messageRefusPreuvesManquantes,
  refusEstRattrapableParMotif,
} from "@/server/qualiopi/evaluations/refus-attestation";

const MANQUES = [
  "aucune trace d'assiduité vérifiable : ni signature d'émargement au registre, ni créneau issu d'un relevé de connexion importé",
  "aucune évaluation finale des acquis",
];

describe("🔴 les deux refus d'attestation se distinguent", () => {
  it("le refus RATTRAPABLE est reconnu comme tel", () => {
    expect(refusEstRattrapableParMotif(messageRefusPreuvesManquantes(MANQUES))).toBe(true);
  });

  it("🔴 le refus DUR n'est PAS reconnu — sinon on proposerait un motif inopérant", () => {
    expect(refusEstRattrapableParMotif(MESSAGE_REFUS_TAUX_NON_MESURE)).toBe(false);
  });

  it("le prédicat ne dit pas OUI à n'importe quoi", () => {
    // Contre-témoin : un prédicat qui rendrait toujours `true` passerait les
    // deux premiers témoins si le second était écrit à l'envers. Celui-ci
    // interdit la version « tout est rattrapable ».
    expect(refusEstRattrapableParMotif("Erreur lors de la génération de l'attestation")).toBe(
      false,
    );
    expect(refusEstRattrapableParMotif("")).toBe(false);
  });

  it("le message rattrapable NOMME tout ce qui manque, pas seulement le premier", () => {
    const m = messageRefusPreuvesManquantes(MANQUES);
    for (const manque of MANQUES) expect(m).toContain(manque);
  });

  it("le message rattrapable dit COMBIEN de caractères, et le chiffre est dérivé", () => {
    // Sans cette ligne, le message pourrait annoncer « 10 caractères » pendant
    // que le schéma serveur en exige 20 : l'utilisateur saisirait un motif
    // refusé sans comprendre pourquoi.
    expect(messageRefusPreuvesManquantes(MANQUES)).toContain(`${MOTIF_PREUVES_MIN} caractères`);
  });

  it("le marqueur est réellement PRÉSENT dans le message qu'il signe", () => {
    // Témoin positif du marqueur lui-même : s'il devenait une chaîne absente des
    // deux messages, le prédicat rendrait `false` partout et les deux premiers
    // témoins… passeraient quand même à moitié. Celui-ci l'interdit.
    expect(messageRefusPreuvesManquantes(MANQUES)).toContain(MARQUEUR_REFUS_RATTRAPABLE);
    expect(MESSAGE_REFUS_TAUX_NON_MESURE).not.toContain(MARQUEUR_REFUS_RATTRAPABLE);
  });

  it("les deux messages commencent tous deux par « Attestation refusée »", () => {
    // Ils doivent se ressembler pour l'humain — c'est le même verdict — et ne
    // se distinguer que par la SORTIE proposée. Si l'un cessait de commencer
    // ainsi, un écran qui filtre les refus sur ce préfixe cesserait de le voir.
    expect(messageRefusPreuvesManquantes(MANQUES)).toMatch(/^Attestation refusée/);
    expect(MESSAGE_REFUS_TAUX_NON_MESURE).toMatch(/^Attestation refusée/);
  });
});
