/**
 * Tests — plan d'actions d'amélioration continue (indicateur 32 ⭐).
 *
 * Le cas central est le premier : **une revue de direction validée et VIDE ne
 * couvre pas off.32**. C'était exactement le contraire jusqu'au 2026-08-23
 * (`nbRevues > 0`), sur un super-indicateur, et aucun test ne le disait.
 *
 * Les autres cas gardent la mécanique du suivi : une action sans responsable ou
 * sans échéance n'est pas une mesure mise en œuvre, une action close n'est jamais
 * « en retard », et les entrées écrites AVANT ce module (chaînes nues, objets
 * `{ action, source, ajouteAt }` posés par `reporterConstatRevue`) se relisent
 * sans perte — sinon la correction effacerait le plan existant au premier
 * enregistrement.
 */

import { describe, expect, it } from "vitest";

import {
  evaluerCouvertureOff32,
  normaliserActionAmelioration,
  normaliserPlanActions,
  resumerPlanActions,
  type ActionAmelioration,
  type RevueAnnuelleLue,
} from "./plan-actions";

const MAINTENANT = new Date("2026-08-23T10:00:00.000Z");

function action(over: Partial<ActionAmelioration> = {}): ActionAmelioration {
  return {
    action: "Refondre le questionnaire de satisfaction",
    source: "saisie manuelle",
    ajouteAt: "2026-02-01T00:00:00.000Z",
    responsable: "Williams Jullin",
    echeance: "2026-12-31",
    statut: "a_faire",
    clotureAt: null,
    ...over,
  };
}

function revue(over: Partial<RevueAnnuelleLue> = {}): RevueAnnuelleLue {
  return {
    annee: 2026,
    participants: ["Williams Jullin — dirigeant"],
    decisions: ["Renforcer le recueil des appréciations entreprise"],
    planActions: [action()],
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Couverture off.32
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerCouvertureOff32 — le contenu de la revue, pas son existence", () => {
  it("🔴 une revue VALIDÉE mais VIDE ne couvre pas off.32", () => {
    // Le faux positif d'origine : `nbRevues > 0` rendait CECI « couvert ».
    const r = evaluerCouvertureOff32(
      revue({ participants: [], decisions: [], planActions: [] }),
      MAINTENANT,
    );

    expect(r.couvert).toBe(false);
    expect(r.preuves.join(" | ")).toContain("Plan d'actions VIDE");
  });

  it("aucune revue validée pour l'année courante → non couvert, et la preuve le dit", () => {
    const r = evaluerCouvertureOff32(null, MAINTENANT);

    expect(r.couvert).toBe(false);
    expect(r.preuves.join(" | ")).toContain("Aucune revue de direction VALIDÉE pour 2026");
    expect(r.resume.total).toBe(0);
  });

  it("une revue complète, dont chaque action porte responsable ET échéance, couvre off.32", () => {
    const r = evaluerCouvertureOff32(revue(), MAINTENANT);

    expect(r.couvert).toBe(true);
    expect(r.resume.total).toBe(1);
    expect(r.resume.suivies).toBe(1);
  });

  it("🔴 une action SANS RESPONSABLE ne couvre pas — et la preuve nomme le manque", () => {
    const r = evaluerCouvertureOff32(
      revue({ planActions: [action(), action({ responsable: "" })] }),
      MAINTENANT,
    );

    expect(r.couvert).toBe(false);
    expect(r.preuves.join(" | ")).toContain("1 action sans responsable désigné");
  });

  it("🔴 une action SANS ÉCHÉANCE ne couvre pas — le suivi jusqu'à clôture n'est pas démontrable", () => {
    const r = evaluerCouvertureOff32(
      revue({ planActions: [action({ echeance: null })] }),
      MAINTENANT,
    );

    expect(r.couvert).toBe(false);
    expect(r.preuves.join(" | ")).toContain("sans échéance");
  });

  it("une revue sans participant ne couvre pas : elle n'est pas opposable", () => {
    const r = evaluerCouvertureOff32(revue({ participants: [] }), MAINTENANT);

    expect(r.couvert).toBe(false);
    expect(r.preuves.join(" | ")).toContain("Aucun participant nommé");
  });

  it("une revue sans décision ne couvre pas", () => {
    const r = evaluerCouvertureOff32(revue({ decisions: [] }), MAINTENANT);

    expect(r.couvert).toBe(false);
    expect(r.preuves.join(" | ")).toContain("Aucune décision consignée");
  });

  it("une action EN RETARD est signalée mais ne retire PAS la couverture", () => {
    // Un plan tenu dont une action a glissé reste un plan tenu : l'outil le dit,
    // il ne le maquille pas — et il ne rougit pas un super-indicateur pour ça.
    const r = evaluerCouvertureOff32(
      revue({ planActions: [action({ echeance: "2026-03-01" })] }),
      MAINTENANT,
    );

    expect(r.couvert).toBe(true);
    expect(r.resume.enRetard).toBe(1);
    expect(r.preuves.join(" | ")).toContain("1 action en retard");
  });

  it("une revue tenue en janvier, plan entièrement ouvert, couvre quand même", () => {
    // Exiger une action DÉJÀ close rendrait l'indicateur impossible à couvrir
    // en début d'année. Ce qui est exigé, c'est le suivi, pas la clôture.
    const r = evaluerCouvertureOff32(
      revue({ planActions: [action({ statut: "a_faire" }), action({ statut: "en_cours" })] }),
      MAINTENANT,
    );

    expect(r.couvert).toBe(true);
    expect(r.resume.closes).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Résumé du suivi
// ─────────────────────────────────────────────────────────────────────────────

describe("resumerPlanActions", () => {
  it("compte séparément responsable manquant, échéance manquante et suivi complet", () => {
    const r = resumerPlanActions(
      [
        action(),
        action({ responsable: "" }),
        action({ echeance: null }),
        action({ responsable: "", echeance: null }),
      ],
      MAINTENANT,
    );

    expect(r).toMatchObject({ total: 4, suivies: 1, sansResponsable: 2, sansEcheance: 2 });
  });

  it("une action CLOSE n'est jamais en retard, même échéance dépassée", () => {
    const r = resumerPlanActions(
      [
        action({ statut: "faite", echeance: "2026-01-01", clotureAt: "2026-01-15" }),
        action({ statut: "abandonnee", echeance: "2026-01-01", clotureAt: "2026-02-01" }),
      ],
      MAINTENANT,
    );

    expect(r.closes).toBe(2);
    expect(r.enRetard).toBe(0);
    expect(r.closesSansDate).toBe(0);
  });

  it("une action close SANS date de clôture est comptée, pas inventée", () => {
    const r = resumerPlanActions([action({ statut: "faite", clotureAt: null })], MAINTENANT);

    expect(r.closes).toBe(1);
    expect(r.closesSansDate).toBe(1);
  });

  it("une échéance AU JOUR MÊME n'est pas en retard", () => {
    const r = resumerPlanActions([action({ echeance: "2026-08-23" })], MAINTENANT);

    expect(r.enRetard).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation — les entrées d'avant ce module
// ─────────────────────────────────────────────────────────────────────────────

describe("normalisation des entrées héritées", () => {
  it("une chaîne nue devient une action non suivie, jamais une action fantôme", () => {
    const a = normaliserActionAmelioration("Revoir le délai d'accès");

    expect(a).not.toBeNull();
    expect(a?.action).toBe("Revoir le délai d'accès");
    expect(a?.responsable).toBe("");
    expect(a?.echeance).toBeNull();
    expect(a?.statut).toBe("a_faire");
  });

  it("un constat reporté `{ action, source, ajouteAt }` garde sa PROVENANCE", () => {
    // La provenance est ce que l'auditeur vérifie : d'où vient cette action ?
    const a = normaliserActionAmelioration({
      action: "Traiter le verbatim « salle trop petite »",
      source: "Verbatim satisfaction — session F2026-012",
      ajouteAt: "2026-06-01T09:00:00.000Z",
    });

    expect(a?.source).toBe("Verbatim satisfaction — session F2026-012");
    expect(a?.ajouteAt).toBe("2026-06-01T09:00:00.000Z");
  });

  it("les clés de libellé sont les MÊMES que celles de l'écran et du PDF", () => {
    for (const cle of ["action", "libelle", "titre", "nom", "decision"]) {
      expect(normaliserActionAmelioration({ [cle]: "X" })?.action, `clé ${cle}`).toBe("X");
    }
  });

  it("une entrée sans libellé est ÉCARTÉE — la compter fabriquerait une action", () => {
    expect(normaliserActionAmelioration({ responsable: "Williams Jullin" })).toBeNull();
    expect(normaliserActionAmelioration("   ")).toBeNull();
    expect(normaliserActionAmelioration(null)).toBeNull();
    expect(normaliserPlanActions([" ", {}, null, "Vraie action"])).toHaveLength(1);
  });

  it("un statut inconnu retombe sur `a_faire`, il n'ouvre pas une porte", () => {
    expect(normaliserActionAmelioration({ action: "X", statut: "close" })?.statut).toBe("a_faire");
    expect(normaliserActionAmelioration({ action: "X", statut: "faite" })?.statut).toBe("faite");
  });

  it("une échéance illisible vaut « non datée », pas une date d'aujourd'hui", () => {
    expect(normaliserActionAmelioration({ action: "X", echeance: "bientôt" })?.echeance).toBeNull();
    expect(normaliserActionAmelioration({ action: "X", echeance: "2026-12-31" })?.echeance).toBe(
      "2026-12-31",
    );
    expect(
      normaliserActionAmelioration({ action: "X", echeance: "2026-12-31T00:00:00.000Z" })?.echeance,
    ).toBe("2026-12-31");
  });

  it("`planActions` qui n'est pas un tableau vaut plan vide, jamais une exception", () => {
    expect(normaliserPlanActions(null)).toEqual([]);
    expect(normaliserPlanActions({})).toEqual([]);
    expect(normaliserPlanActions("texte")).toEqual([]);
  });
});
