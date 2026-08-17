/**
 * 🔴 ANNULER UNE SESSION EXIGE UN MOTIF — l'asymétrie qui n'avait pas de raison
 * d'être.
 *
 * Reporter en exigeait un, côté écran ET côté serveur. Annuler n'en exigeait
 * aucun : un clic sur un bouton rouge, et c'était fait. Or annuler est **plus**
 * engageant — l'état est terminal, et la transition révoque en cascade les
 * jetons d'émargement de la session.
 *
 * Un auditeur qui demande « pourquoi cette session a-t-elle été annulée ? »
 * n'obtenait aucune réponse : la donnée n'avait jamais été demandée.
 */

import { describe, expect, it } from "vitest";
import {
  exigeUnMotif,
  refusMotif,
  MOTIF_MIN,
  TRANSITIONS_EXIGEANT_MOTIF,
} from "./transition-motif";

describe("🔴 annuler exige un motif", () => {
  it("le vide est refusé", () => {
    expect(refusMotif("annulee", "")).not.toBeNull();
    expect(refusMotif("annulee", null)).not.toBeNull();
    expect(refusMotif("annulee", undefined)).not.toBeNull();
  });

  it("les espaces seuls ne comptent pas pour un motif", () => {
    // Sinon la contrainte se contourne en tapant une espace, et le registre
    // porte une justification vide qui a l'air d'en être une.
    expect(refusMotif("annulee", "   ")).not.toBeNull();
  });

  it("un motif d'un caractère ne trace rien", () => {
    expect(refusMotif("annulee", "x")).toContain(`${MOTIF_MIN}`);
  });

  it("un vrai motif passe", () => {
    expect(refusMotif("annulee", "Effectif insuffisant, 1 inscrit sur 6.")).toBeNull();
  });

  it("le refus DIT la conséquence, pas seulement l'obligation", () => {
    // « Motif obligatoire » ne fait pas comprendre pourquoi. Le message nomme
    // ce qui va être détruit — c'est ce qui fait écrire une vraie phrase.
    const m = refusMotif("annulee", "");
    expect(m).toContain("définitif");
    expect(m).toContain("émargement");
  });
});

describe("🔴 les autres transitions n'exigent RIEN", () => {
  // ⚠️ Le contre-test qui compte. Exiger une phrase à chaque fin de session
  // ferait taper « ok » vingt fois : un champ obligatoire qu'on remplit de
  // bruit ne trace rien, il fabrique de la friction et discrédite le motif là
  // où il compte vraiment.
  it.each([["planifiee"], ["en_cours"], ["realisee"], ["reportee"]] as const)(
    "%s : aucun motif requis",
    (statut) => {
      expect(exigeUnMotif(statut)).toBe(false);
      expect(refusMotif(statut, "")).toBeNull();
      expect(refusMotif(statut, null)).toBeNull();
    },
  );

  it("la liste ne contient QUE les transitions terminales destructrices", () => {
    // Fige le périmètre : élargir la règle est une décision, pas un glissement.
    expect([...TRANSITIONS_EXIGEANT_MOTIF]).toEqual(["annulee"]);
  });
});
