// Le consentement est exigé à l'ÉCRAN 1, pas au dernier.
//
// ── Pourquoi cette garde ──────────────────────────────────────────────────
// Depuis le 2026-09-04, la sortie de l'écran 1 ENREGISTRE le contact côté
// serveur, pour qu'un abandon à l'écran 5 laisse une personne rappelable au
// lieu de rien.
//
// Cette écriture n'est licite que si l'accord la précède. Redescendre la case
// au dernier écran — par souci de « ne pas alourdir le premier », ce qui est
// une bonne intention — rendrait la capture sans base, sans que rien ne casse
// ni ne s'affiche. C'est exactement le genre de régression qu'une revue laisse
// passer et qu'une garde attrape.
//
// 🔑 Ce fichier teste l'ORDRE, pas le fond : `capture-ecran-1.spec.ts` prouve
// déjà que l'action refuse d'écrire sans accord. Ici on vérifie que la personne
// a bien eu l'occasion de le donner AVANT que l'écriture ne parte.

import { describe, expect, it } from "vitest";
import { emptyAnswers, validateStep } from "../wizard-state";

/** Réponses valides pour l'écran 1, consentement mis à part. */
function identiteValide(consent: boolean) {
  return {
    ...emptyAnswers(),
    prenom: "Camille",
    nom: "Durand",
    email: "camille.durand@example.com",
    telephone: "0612345678",
    ville: "Grenoble",
    codePostal: "38000",
    consent,
  };
}

describe("le consentement précède l'écriture", () => {
  it("l'écran 1 REFUSE d'avancer sans consentement", () => {
    const erreurs = validateStep(1, identiteValide(false));
    expect(
      erreurs.consent,
      "sans cette erreur, la capture de l'écran 1 partirait sans accord",
    ).toBeTruthy();
  });

  it("l'écran 1 accepte d'avancer une fois le consentement donné", () => {
    // Contre-témoin : sans lui, une validation qui refuserait TOUT ferait passer
    // le test précédent sans rien prouver.
    const erreurs = validateStep(1, identiteValide(true));
    expect(erreurs.consent).toBeUndefined();
    expect(
      Object.keys(erreurs),
      "une identité complète et consentie doit passer l'écran 1",
    ).toEqual([]);
  });

  it("le DERNIER écran ne redemande plus le consentement", () => {
    // Le redemander ne serait pas faux, mais le laisser SEULEMENT là-bas le
    // serait. Ce test dit où il vit désormais ; s'il remonte un jour aux deux
    // endroits, c'est ce test qu'il faudra changer sciemment.
    const dernier = { ...emptyAnswers(), consent: false };
    const erreurs = validateStep(9, dernier);
    expect(erreurs.consent).toBeUndefined();
  });

  it("aucun autre écran n'exige le consentement à la place de l'écran 1", () => {
    // Balayage : si la validation du consentement se déplaçait vers un écran
    // intermédiaire, la capture de l'écran 1 partirait toujours sans accord —
    // et les deux premiers tests resteraient verts.
    const ecransQuiExigent = [];
    for (let ecran = 0; ecran <= 9; ecran += 1) {
      const erreurs = validateStep(ecran, { ...emptyAnswers(), consent: false });
      if (erreurs.consent) ecransQuiExigent.push(ecran);
    }
    expect(
      ecransQuiExigent,
      "le consentement doit être exigé à l'écran 1, et là seulement",
    ).toEqual([1]);
  });
});
