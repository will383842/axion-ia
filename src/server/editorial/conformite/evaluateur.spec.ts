/**
 * Console éditoriale — tests de l'évaluateur de conformité (lot 1).
 *
 * Le protocole impose, pour **chaque** règle de conformité, « deux cas :
 * passe et refuse ». Une règle sans cas négatif ne garde rien : elle
 * resterait verte si on la supprimait.
 *
 * Les règles viennent du REGISTRE D'AMORÇAGE — c'est-à-dire exactement ce
 * que le seed écrit en base. Tester l'évaluateur contre des règles inventées
 * pour l'occasion prouverait que l'évaluateur sait évaluer des règles
 * inventées, ce qui n'intéresse personne.
 */

import { describe, it, expect } from "vitest";
import {
  evaluerRegle,
  evaluerConformite,
  type RegleEvaluable,
  type PublicationAControler,
} from "./evaluateur";
import { ED_REGLES_CONFORMITE } from "@/server/editorial/referentiels/conformite";

/** Rend une règle du registre sous la forme qu'aurait la base. */
function regle(code: string): RegleEvaluable {
  const r = ED_REGLES_CONFORMITE.find((x) => x.code === code);
  if (!r) throw new Error(`Règle « ${code} » absente du registre.`);
  return { ...r, actif: true };
}

/** Une publication saine, que chaque test dégrade sur un seul point. */
function publication(patch: Partial<PublicationAControler> = {}): PublicationAControler {
  return {
    accroche: "Trois signaux qu'un processus vous coûte plus qu'il ne rapporte",
    corps: "Automatiser une relance client, sans y passer la journée.",
    premierCommentaire: "Le détail est ici, et les questions sont bienvenues.",
    tags: ["IAPourPME", "GainDeTemps", "ProcessusMetier"],
    lienUrl: null,
    ...patch,
  };
}

const LIEN_COMPLET =
  "https://axion-ia.com/fr/appel?utm_source=linkedin&utm_medium=social" +
  "&utm_campaign=q4-2026&utm_content=linkedin-2026-q4-04";

describe("règle « geo »", () => {
  it("PASSE sur un texte sans toponyme", () => {
    expect(evaluerRegle(regle("geo"), publication()).etat).toBe("conforme");
  });

  it("🔴 REFUSE « Grenoble » — critère 14 du lot 1", () => {
    const c = evaluerRegle(
      regle("geo"),
      publication({ corps: "Nos ateliers se tiennent à Grenoble chaque mois." }),
    );
    expect(c.etat).toBe("enfreinte");
    expect(c.gravite).toBe("bloquant");
    // Le §7 exige « le motif ET l'extrait fautif ».
    expect(c.message).toContain("« geo »");
    expect(c.extrait).toContain("Grenoble");
  });

  it("cite un extrait court, pas le corps entier", () => {
    const corps = `${"a".repeat(400)} Grenoble ${"b".repeat(400)}`;
    const c = evaluerRegle(regle("geo"), publication({ corps }));
    expect(c.extrait).toBeTruthy();
    expect((c.extrait as string).length).toBeLessThan(120);
  });

  it("inspecte aussi le premier commentaire et les tags", () => {
    expect(
      evaluerRegle(regle("geo"), publication({ premierCommentaire: "On en parle à Lyon." })).etat,
    ).toBe("enfreinte");
  });
});

describe("règle « financier »", () => {
  it("PASSE sur un propos financier neutre", () => {
    expect(
      evaluerRegle(regle("financier"), publication({ corps: "Le coût se mesure en heures." })).etat,
    ).toBe("conforme");
  });

  it("REFUSE « jusqu'à 100 % » et « sans avance de frais »", () => {
    for (const corps of [
      "Formation financée jusqu'à 100 % par votre OPCO.",
      "Sans avance de frais.",
      "Prise en charge à 100 %.",
    ]) {
      expect(evaluerRegle(regle("financier"), publication({ corps })).etat, corps).toBe(
        "enfreinte",
      );
    }
  });
});

describe("règle « ai-act »", () => {
  it("PASSE sur l'énoncé de l'obligation", () => {
    expect(
      evaluerRegle(
        regle("ai-act"),
        publication({ corps: "L'AI Act impose de documenter les usages à risque." }),
      ).etat,
    ).toBe("conforme");
  });

  it("REFUSE l'affirmation de sanction", () => {
    for (const corps of [
      "Un manquement vous expose à une sanction.",
      "Vous risquez une amende.",
      "Vous êtes passible d'une amende.",
    ]) {
      expect(evaluerRegle(regle("ai-act"), publication({ corps })).etat, corps).toBe("enfreinte");
    }
  });
});

describe("règle « sujets »", () => {
  it("PASSE sur un sujet autorisé", () => {
    expect(evaluerRegle(regle("sujets"), publication()).etat).toBe("conforme");
  });

  it("REFUSE les quatre sujets non délivrés", () => {
    for (const corps of [
      "Notre chatbot répond à vos clients.",
      "Le paiement en ligne arrive bientôt.",
      "La version anglaise du site.",
      "Le volume de base est configurable.",
    ]) {
      expect(evaluerRegle(regle("sujets"), publication({ corps })).etat, corps).toBe("enfreinte");
    }
  });
});

describe("règle « tags-nombre »", () => {
  it("PASSE à 3 et à 4 tags — les deux bornes incluses", () => {
    expect(evaluerRegle(regle("tags-nombre"), publication({ tags: ["A", "B", "C"] })).etat).toBe(
      "conforme",
    );
    expect(
      evaluerRegle(regle("tags-nombre"), publication({ tags: ["A", "B", "C", "D"] })).etat,
    ).toBe("conforme");
  });

  it("🔴 REFUSE JUSTE sous et JUSTE au-dessus — c'est la limite qui casse", () => {
    const sous = evaluerRegle(regle("tags-nombre"), publication({ tags: ["A", "B"] }));
    expect(sous.etat).toBe("enfreinte");
    expect(sous.message).toContain("2");

    const dessus = evaluerRegle(
      regle("tags-nombre"),
      publication({ tags: ["A", "B", "C", "D", "E"] }),
    );
    expect(dessus.etat).toBe("enfreinte");
    expect(dessus.message).toContain("5");
  });

  it("annonce la fourchette lue EN BASE, pas une constante du code", () => {
    const c = evaluerRegle(regle("tags-nombre"), publication({ tags: [] }));
    expect(c.message).toContain("3");
    expect(c.message).toContain("4");
  });
});

describe("règle « tags-liste »", () => {
  it("PASSE sur des tags de la liste fermée", () => {
    expect(
      evaluerRegle(regle("tags-liste"), publication({ tags: ["RGPD", "AIAct", "IAPourPME"] })).etat,
    ).toBe("conforme");
  });

  it("REFUSE un tag hors liste, et le NOMME", () => {
    const c = evaluerRegle(
      regle("tags-liste"),
      publication({ tags: ["RGPD", "InventéDeToutePièce", "AIAct"] }),
    );
    expect(c.etat).toBe("enfreinte");
    expect(c.extrait).toContain("InventéDeToutePièce");
  });

  it("tolère la casse — `rgpd` et `RGPD` sont le même sujet", () => {
    expect(
      evaluerRegle(regle("tags-liste"), publication({ tags: ["rgpd", "aiact", "iapourpme"] })).etat,
    ).toBe("conforme");
  });
});

describe("règle « tags-accent »", () => {
  it("PASSE sur des tags sans accent", () => {
    expect(evaluerRegle(regle("tags-accent"), publication()).etat).toBe("conforme");
  });

  it("REFUSE un tag accentué, que LinkedIn tronquerait", () => {
    const c = evaluerRegle(
      regle("tags-accent"),
      publication({ tags: ["ConformitéIA", "RGPD", "AIAct"] }),
    );
    expect(c.etat).toBe("enfreinte");
  });

  it("🔴 IGNORE les accents du corps — la règle ne vise que les tags", () => {
    // Sans le filtrage par `champs`, tout texte français serait refusé.
    expect(
      evaluerRegle(
        regle("tags-accent"),
        publication({ corps: "Un été à préparer sérieusement, déjà." }),
      ).etat,
    ).toBe("conforme");
  });
});

describe("règle « lien-corps »", () => {
  it("PASSE quand le corps ne porte aucun lien", () => {
    expect(evaluerRegle(regle("lien-corps"), publication()).etat).toBe("conforme");
  });

  it("REFUSE un lien dans le corps", () => {
    const c = evaluerRegle(
      regle("lien-corps"),
      publication({ corps: "Tout est là : https://axion-ia.com/fr/appel" }),
    );
    expect(c.etat).toBe("enfreinte");
  });

  it("🔴 AUTORISE un lien en premier commentaire — c'est la pratique", () => {
    // L'interdire serait un bug : c'est précisément là qu'un lien doit être
    // placé pour ne pas casser la portée organique.
    expect(
      evaluerRegle(
        regle("lien-corps"),
        publication({ premierCommentaire: "Le détail : https://axion-ia.com/fr/appel" }),
      ).etat,
    ).toBe("conforme");
  });
});

describe("règle « utm »", () => {
  it("PASSE sur un lien portant les quatre marqueurs", () => {
    expect(evaluerRegle(regle("utm"), publication({ lienUrl: LIEN_COMPLET })).etat).toBe(
      "conforme",
    );
  });

  it("🔴 REFUSE un lien SANS utm_content — critère 15 du lot 1", () => {
    const c = evaluerRegle(
      regle("utm"),
      publication({
        lienUrl:
          "https://axion-ia.com/fr/appel?utm_source=linkedin&utm_medium=social&utm_campaign=q4-2026",
      }),
    );
    expect(c.etat).toBe("enfreinte");
    expect(c.gravite).toBe("bloquant");
    expect(c.extrait).toContain("utm_content");
  });

  it("REFUSE un lien sans aucun marqueur", () => {
    const c = evaluerRegle(regle("utm"), publication({ lienUrl: "https://axion-ia.com/fr/appel" }));
    expect(c.etat).toBe("enfreinte");
    expect(c.extrait).toContain("utm_source");
  });

  it("🔴 PASSE quand il n'y a PAS de lien — sinon tout serait bloqué", () => {
    // Exiger des UTM sur une publication sans lien bloquerait la quasi-
    // totalité du dossier importé.
    expect(evaluerRegle(regle("utm"), publication({ lienUrl: null })).etat).toBe("conforme");
    expect(evaluerRegle(regle("utm"), publication({ lienUrl: "" })).etat).toBe("conforme");
  });

  it("REFUSE une URL illisible plutôt que de la laisser passer", () => {
    expect(evaluerRegle(regle("utm"), publication({ lienUrl: "pas une url" })).etat).toBe(
      "enfreinte",
    );
  });
});

describe("règle « mentions »", () => {
  it("PASSE à deux mentions — la borne est incluse", () => {
    expect(
      evaluerRegle(regle("mentions"), publication({ corps: "Merci @alice et @bob." })).etat,
    ).toBe("conforme");
  });

  it("REFUSE à trois, juste au-dessus du seuil", () => {
    const c = evaluerRegle(
      regle("mentions"),
      publication({ corps: "Merci @alice, @bob et @carole." }),
    );
    expect(c.etat).toBe("enfreinte");
    expect(c.gravite).toBe("avertissement");
    expect(c.message).toContain("3");
  });

  it("🔴 ne compte PAS une adresse e-mail comme une mention", () => {
    expect(
      evaluerRegle(
        regle("mentions"),
        publication({ corps: "Écrivez à contact@axion-ia.com ou à bonjour@axion-ia.com." }),
      ).etat,
    ).toBe("conforme");
  });
});

describe("règles contextuelles", () => {
  it("🔴 « droit-image » sans contexte est NON ÉVALUÉE, jamais conforme", () => {
    // Confondre « je n'ai pas su vérifier » et « c'est conforme » est
    // exactement la gate verte qui ne garde rien.
    const c = evaluerRegle(regle("droit-image"), publication());
    expect(c.etat).toBe("non_evaluee");
    expect(c.raisonNonEvaluee).toBeTruthy();
  });

  it("« droit-image » PASSE sur une autorisation signée", () => {
    const c = evaluerRegle(regle("droit-image"), publication(), {
      autorisationStatut: "signee",
      autorisationInvite: "Mme Durand",
    });
    expect(c.etat).toBe("conforme");
  });

  it("🔴 « droit-image » REFUSE une autorisation seulement ENVOYÉE", () => {
    const c = evaluerRegle(regle("droit-image"), publication(), {
      autorisationStatut: "envoyee",
      autorisationInvite: "Mme Durand",
    });
    expect(c.etat).toBe("enfreinte");
    expect(c.message).toContain("Mme Durand");
    expect(c.message).toContain("envoyee");
  });

  it("« spec-plateforme » REFUSE un asset qui dépasse de deux secondes", () => {
    const c = evaluerRegle(regle("spec-plateforme"), publication(), {
      assets: [
        { libelle: "Short — épisode 3", dureeSec: 62, specDureeMinSec: 1, specDureeMaxSec: 60 },
      ],
    });
    expect(c.etat).toBe("enfreinte");
    expect(c.extrait).toContain("Short");
  });

  it("« spec-plateforme » PASSE pile à la borne", () => {
    const c = evaluerRegle(regle("spec-plateforme"), publication(), {
      assets: [{ libelle: "Short", dureeSec: 60, specDureeMinSec: 1, specDureeMaxSec: 60 }],
    });
    expect(c.etat).toBe("conforme");
  });
});

describe("evaluerConformite — la synthèse", () => {
  const toutes = ED_REGLES_CONFORMITE.map((r) => ({ ...r, actif: true }));

  it("déclare validable une publication saine", () => {
    const r = evaluerConformite(toutes, publication({ lienUrl: LIEN_COMPLET }));
    expect(r.bloquantes).toHaveLength(0);
    expect(r.validable).toBe(true);
  });

  it("🔴 REFUSE la validation dès UNE enfreinte bloquante", () => {
    const r = evaluerConformite(
      toutes,
      publication({ corps: "Nos ateliers à Grenoble.", lienUrl: LIEN_COMPLET }),
    );
    expect(r.validable).toBe(false);
    expect(r.bloquantes.map((c) => c.code)).toContain("geo");
  });

  it("un avertissement seul ne bloque PAS la validation", () => {
    const r = evaluerConformite(
      toutes,
      publication({ corps: "Merci @a, @b et @c.", lienUrl: LIEN_COMPLET }),
    );
    expect(r.avertissements.map((c) => c.code)).toContain("mentions");
    expect(r.validable).toBe(true);
  });

  it("range à part les règles non évaluées, sans les compter conformes", () => {
    const r = evaluerConformite(toutes, publication({ lienUrl: LIEN_COMPLET }));
    expect(r.nonEvaluees.map((c) => c.code)).toContain("droit-image");
    expect(r.nonEvaluees.map((c) => c.code)).toContain("spec-plateforme");
    // Et elles ne bloquent pas pour autant.
    expect(r.validable).toBe(true);
  });

  it("🔴 une règle DÉSACTIVÉE ne bloque plus — le réglage vit en base", () => {
    const sansGeo = toutes.map((r) => (r.code === "geo" ? { ...r, actif: false } : r));
    const r = evaluerConformite(
      sansGeo,
      publication({ corps: "Nos ateliers à Grenoble.", lienUrl: LIEN_COMPLET }),
    );
    expect(r.validable).toBe(true);
  });

  it("évalue les douze règles, sans en perdre une en route", () => {
    const r = evaluerConformite(toutes, publication());
    expect(r.constats).toHaveLength(12);
    expect(new Set(r.constats.map((c) => c.code)).size).toBe(12);
  });

  it("🔴 ne laisse AUCUN jeton `{…}` dans un message rendu", () => {
    // Un « il faut de {min} à {max} tags » affiché tel quel ferait passer la
    // console pour cassée.
    const r = evaluerConformite(
      toutes,
      publication({ corps: "Grenoble, @a @b @c", tags: ["Inventé"], lienUrl: "https://x.fr" }),
    );
    for (const c of r.constats.filter((x) => x.etat === "enfreinte")) {
      expect(c.message, `règle ${c.code}`).not.toMatch(/\{[a-z]+\}/i);
      expect(c.message.length, `règle ${c.code}`).toBeGreaterThan(10);
    }
  });
});
