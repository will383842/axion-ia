/**
 * Tests — contenu pédagogique d'un module (Standard Axion-IA du 5 août 2026).
 *
 * Le cas de référence est le module RÉEL de « IA pour les RH » relevé en
 * production le 2026-08-05 : c'est exactement ce que le diagnostic doit savoir
 * lire sans échouer, tout en disant qu'il manque les cinq blocs.
 */

import { describe, it, expect } from "vitest";
import {
  modulePedagogiqueSchema,
  notesAnimateurSchema,
  blocDemonstrationSchema,
  blocSyntheseSchema,
  diagnostiquerModule,
  BLOCS_REQUIS,
} from "./module-pedagogique";

/** Module tel qu'il existe en production aujourd'hui — titres seuls. */
const MODULE_PROD = {
  titre: "Module 1 — L'IA appliquée à la fonction RH",
  moduleId: "mod-1",
  sequences: [
    { id: "seq-1-1", titre: "Ce que l'IA change pour la fonction RH" },
    { id: "seq-1-2", titre: "La méthode CRFE appliquée aux écrits RH" },
  ],
};

const NOTES_OK = {
  script:
    "Ne cherchez pas le poste le plus compliqué : prenez le dernier publié, on veut comparer avec du connu.",
  faq: [
    {
      question: "Le candidat verra-t-il que c'est écrit par une IA ?",
      reponse: "Ce qui se voit, c'est le vide, pas l'outil.",
    },
  ],
  blocages: [
    {
      situation: "Le stagiaire cherche le prompt parfait",
      parade: "Faire envoyer une première version imparfaite.",
    },
  ],
  planB: "Quota atteint : basculer sur la capture d'écran page 12 et faire l'exercice à l'oral.",
};

const MODULE_COMPLET = {
  moduleId: "mod-1",
  titre: "Module 1 — L'IA appliquée à la fonction RH",
  dureeMin: 90,
  objectif: {
    enonce: "Vous saurez rédiger une offre d'emploi complète à partir d'une fiche de poste.",
    objectifGlobalId: "obj-1",
    dureeMin: 5,
    notes: NOTES_OK,
  },
  demonstration: {
    avant: "On reprend l'offre du poste d'à côté et on remplace les phrases une à une.",
    apres: "La fiche de poste devient une offre complète en une passe, le fond reste vôtre.",
    prompt:
      "Contexte : PME de 40 personnes. Rôle : responsable RH, ton direct. Format : 300 mots. Exigence : aucun superlatif.",
    outil: "Claude",
    gain: { avant: "40 min", apres: "10 min" },
    verifieLe: "2026-08-01",
    dureeMin: 20,
    notes: NOTES_OK,
  },
  pratique: {
    consigne: "Prenez une offre publiée cette année et réécrivez-la avec la structure vue.",
    aEmporter: "Fiche mémo des quatre lignes du prompt, à garder.",
    dureeMin: 55,
    notes: NOTES_OK,
  },
  verification: {
    question: "Quelle partie du prompt évite le « dynamique et motivé » ?",
    reponseAttendue: "La ligne Exigence.",
    dureeMin: 5,
    notes: NOTES_OK,
  },
  synthese: {
    acquis: [
      "Vous savez transformer une fiche de poste en offre publiable.",
      "Vous savez faire retirer le jargon par une contrainte explicite.",
    ],
    dureeMin: 5,
    notes: NOTES_OK,
  },
  sequences: [],
};

describe("modulePedagogiqueSchema", () => {
  it("accepte un module conforme au Standard", () => {
    expect(modulePedagogiqueSchema.safeParse(MODULE_COMPLET).success).toBe(true);
  });

  it("refuse un module sans durée réelle — sinon le minutage est inventé", () => {
    const { dureeMin, ...sansDuree } = MODULE_COMPLET;
    expect(dureeMin).toBe(90);
    expect(modulePedagogiqueSchema.safeParse(sansDuree).success).toBe(false);
  });

  it("refuse un module auquel il manque un seul des cinq blocs", () => {
    for (const bloc of BLOCS_REQUIS) {
      const ampute: Record<string, unknown> = { ...MODULE_COMPLET };
      delete ampute[bloc];
      expect(modulePedagogiqueSchema.safeParse(ampute).success).toBe(false);
    }
  });
});

describe("blocDemonstrationSchema — le prompt", () => {
  /**
   * 🔴 La règle qui compte : un prompt tronqué rend la démonstration
   * irreproductible. Le stagiaire repart avec un tour de magie.
   */
  it("refuse un prompt tronqué par des points de suspension", () => {
    for (const fin of ["...", "…", "... "]) {
      const demo = {
        ...MODULE_COMPLET.demonstration,
        prompt: "Contexte : PME de 40 personnes" + fin,
      };
      const r = blocDemonstrationSchema.safeParse(demo);
      expect(r.success).toBe(false);
    }
  });

  it("accepte des points de suspension AILLEURS que dans la troncature finale", () => {
    const demo = {
      ...MODULE_COMPLET.demonstration,
      prompt: "Contexte : PME… peu importe la taille. Format : 300 mots, sans superlatif.",
    };
    expect(blocDemonstrationSchema.safeParse(demo).success).toBe(true);
  });

  it("le gain chiffré est optionnel — toutes les démos n'en ont pas", () => {
    const { gain, ...sansGain } = MODULE_COMPLET.demonstration;
    expect(gain).toBeDefined();
    expect(blocDemonstrationSchema.safeParse(sansGain).success).toBe(true);
  });
});

describe("blocSyntheseSchema", () => {
  it("exige au moins deux acquis et en refuse plus de trois", () => {
    const base = MODULE_COMPLET.synthese.notes;
    const acquis = (n: number) =>
      blocSyntheseSchema.safeParse({
        acquis: Array.from(
          { length: n },
          (_, i) => `Vous savez maintenant faire la chose ${i + 1}.`,
        ),
        dureeMin: 5,
        notes: base,
      }).success;
    expect(acquis(1)).toBe(false);
    expect(acquis(2)).toBe(true);
    expect(acquis(3)).toBe(true);
    // Au-delà, ce n'est plus une synthèse mais un résumé de cours.
    expect(acquis(4)).toBe(false);
  });
});

describe("notesAnimateurSchema", () => {
  /**
   * 🔴 Le plan B est obligatoire, et c'est le point le plus contre-intuitif du
   * Standard : en formation IA, la démo échoue régulièrement. Sans repli écrit,
   * le formateur est seul devant la salle.
   */
  it("refuse des notes sans plan B", () => {
    const { planB, ...sansPlanB } = NOTES_OK;
    expect(planB).toBeTruthy();
    expect(notesAnimateurSchema.safeParse(sansPlanB).success).toBe(false);
  });

  it("refuse un script réduit à un mot-clé", () => {
    expect(notesAnimateurSchema.safeParse({ ...NOTES_OK, script: "intro" }).success).toBe(false);
  });

  it("FAQ et blocages peuvent être vides — ils se remplissent avec l'expérience", () => {
    const r = notesAnimateurSchema.safeParse({ ...NOTES_OK, faq: [], blocages: [] });
    expect(r.success).toBe(true);
  });
});

describe("diagnostiquerModule", () => {
  it("lit un module de production SANS échouer, et dit que les 5 blocs manquent", () => {
    const d = diagnostiquerModule(MODULE_PROD);
    expect(d.moduleId).toBe("mod-1");
    expect(d.titre).toContain("fonction RH");
    expect(d.complet).toBe(false);
    expect(d.blocsManquants).toEqual([...BLOCS_REQUIS]);
    expect(d.dureeManquante).toBe(true);
  });

  it("déclare complet un module conforme", () => {
    const d = diagnostiquerModule(MODULE_COMPLET);
    expect(d.complet).toBe(true);
    expect(d.blocsManquants).toEqual([]);
    expect(d.notesIncompletes).toEqual([]);
    expect(d.dureeManquante).toBe(false);
  });

  /**
   * La distinction qui évite de faire réécrire ce qui est déjà écrit : un bloc
   * dont le CORPS est bon mais dont le plan B manque n'est pas « absent ».
   */
  it("distingue un bloc absent d'un bloc dont les notes sont incomplètes", () => {
    const { planB, ...notesSansPlanB } = NOTES_OK;
    expect(planB).toBeTruthy();
    const d = diagnostiquerModule({
      ...MODULE_COMPLET,
      pratique: { ...MODULE_COMPLET.pratique, notes: notesSansPlanB },
    });
    expect(d.blocsManquants).toEqual([]);
    expect(d.notesIncompletes).toEqual(["pratique"]);
    expect(d.complet).toBe(false);
  });

  it("un bloc au corps invalide compte comme manquant, pas comme note incomplète", () => {
    const d = diagnostiquerModule({
      ...MODULE_COMPLET,
      demonstration: { ...MODULE_COMPLET.demonstration, prompt: "trop court…" },
    });
    expect(d.blocsManquants).toEqual(["demonstration"]);
    expect(d.notesIncompletes).toEqual([]);
  });

  it("ne lève jamais, même sur une entrée aberrante", () => {
    for (const entree of [null, undefined, 42, "texte", {}, { moduleId: 7 }, []]) {
      expect(() => diagnostiquerModule(entree)).not.toThrow();
      expect(diagnostiquerModule(entree).complet).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Niveau FORMATION — ce qu'aucun module ne peut vérifier seul
// ─────────────────────────────────────────────────────────────────────────────

import {
  diagnostiquerFormation,
  demonstrationPerimee,
  RATIO_PRATIQUE_MINIMUM_PCT,
} from "./module-pedagogique";

/** Deux modules complets couvrant obj-1 et obj-2, 90 min chacun, 50 min de pratique. */
function formationSaine() {
  const m2 = {
    ...MODULE_COMPLET,
    moduleId: "mod-2",
    objectif: { ...MODULE_COMPLET.objectif, objectifGlobalId: "obj-2" },
  };
  return {
    modules: [MODULE_COMPLET, m2],
    objectifsIds: ["obj-1", "obj-2"],
    dureeHeures: 3,
  };
}

describe("diagnostiquerFormation — couverture des objectifs (indicateur 11)", () => {
  it("signale un objectif VENDU que plus aucun module ne couvre", () => {
    const d = diagnostiquerFormation({
      ...formationSaine(),
      objectifsIds: ["obj-1", "obj-2", "obj-3"],
    });
    expect(d.objectifsNonCouverts).toEqual(["obj-3"]);
    expect(d.publiable).toBe(false);
  });

  /**
   * 🔴 Le trou que le schéma seul ne voit pas : un module peut déclarer servir
   * un objectif qui n'existe nulle part. Le module est « valide », et la
   * promesse de couverture est vide.
   */
  it("signale un module qui renvoie vers un objectif inexistant", () => {
    const orphelin = {
      ...MODULE_COMPLET,
      moduleId: "mod-9",
      objectif: { ...MODULE_COMPLET.objectif, objectifGlobalId: "obj-42" },
    };
    const d = diagnostiquerFormation({
      modules: [orphelin],
      objectifsIds: ["obj-1"],
      dureeHeures: 1.5,
    });
    expect(d.renvoisOrphelins).toEqual([{ moduleId: "mod-9", objectifGlobalId: "obj-42" }]);
    expect(d.publiable).toBe(false);
  });

  it("une formation dont tous les objectifs sont couverts est publiable", () => {
    const d = diagnostiquerFormation(formationSaine());
    expect(d.objectifsNonCouverts).toEqual([]);
    expect(d.renvoisOrphelins).toEqual([]);
    expect(d.modulesComplets).toBe(2);
    expect(d.publiable).toBe(true);
  });
});

describe("diagnostiquerFormation — durée vendue contre durée réelle", () => {
  it("détecte un contenu plus court que ce qui est vendu", () => {
    // 2 modules × 90 min = 180 min, vendus 7 h = 420 min.
    const d = diagnostiquerFormation({ ...formationSaine(), dureeHeures: 7 });
    expect(d.dureeContenuMin).toBe(180);
    expect(d.dureeVendueMin).toBe(420);
    expect(d.ecartDureeMin).toBe(-240);
    expect(d.publiable).toBe(false);
  });

  it("tolère un écart de quelques minutes — pas une heure", () => {
    const d = diagnostiquerFormation({ ...formationSaine(), dureeHeures: 3.1 });
    expect(Math.abs(d.ecartDureeMin)).toBeLessThanOrEqual(15);
    expect(d.publiable).toBe(true);
  });
});

describe("diagnostiquerFormation — ratio de pratique", () => {
  it("calcule la part de pratique et refuse sous le seuil du Standard", () => {
    // 45 min de pratique sur 90 min de module = 50 %, sous les 60 % exigés.
    const d = diagnostiquerFormation(formationSaine());
    expect(d.ratioPratiquePct).toBe(61);
    expect(d.ratioPratiquePct).toBeGreaterThanOrEqual(RATIO_PRATIQUE_MINIMUM_PCT);
    expect(d.publiable).toBe(true);
  });

  it("une formation sans pratique tombe à 0 % et n'est pas publiable", () => {
    const sansPratique = {
      ...MODULE_COMPLET,
      pratique: { ...MODULE_COMPLET.pratique, dureeMin: 0 },
    };
    const d = diagnostiquerFormation({
      modules: [sansPratique],
      objectifsIds: ["obj-1"],
      dureeHeures: 1.5,
    });
    expect(d.ratioPratiquePct).toBe(0);
    expect(d.publiable).toBe(false);
  });
});

describe("diagnostiquerFormation — robustesse", () => {
  it("ne lève jamais et déclare non publiable sur une entrée aberrante", () => {
    for (const modules of [[], [null], [42], ["texte"], [{}]]) {
      const d = diagnostiquerFormation({ modules, objectifsIds: [], dureeHeures: 1 });
      expect(d.publiable).toBe(false);
    }
  });
});

describe("demonstrationPerimee", () => {
  const maintenant = new Date("2026-08-06T10:00:00Z");

  it("une vérification de la semaine est fraîche", () => {
    expect(demonstrationPerimee("2026-08-01", maintenant)).toBe(false);
  });

  /** Revue trimestrielle du Standard : au-delà de 90 jours, à revoir. */
  it("une vérification de plus de trois mois est périmée", () => {
    expect(demonstrationPerimee("2026-04-01", maintenant)).toBe(true);
  });

  it("une date illisible est traitée comme périmée — jamais comme fraîche", () => {
    for (const d of ["", "hier", "2026-13-45", "01/08/2026"]) {
      expect(demonstrationPerimee(d, maintenant)).toBe(true);
    }
  });
});

describe("diagnostiquerModule — cohérence des durées", () => {
  /**
   * 🔴 Défaut révélé en écrivant les tests du niveau formation : un module
   * pouvait annoncer 90 minutes et contenir 100 minutes de blocs. Le programme
   * minuté projeté en ouverture devenait faux dès le premier module.
   */
  it("signale une somme de blocs qui contredit la durée annoncée", () => {
    const d = diagnostiquerModule({ ...MODULE_COMPLET, dureeMin: 60 });
    expect(d.dureeBlocsMin).toBe(90);
    expect(d.dureeIncoherente).toBe(true);
    expect(d.complet).toBe(false);
    // Les blocs eux-mêmes sont bons : ce n'est pas eux qu'il faut réécrire.
    expect(d.blocsManquants).toEqual([]);
  });

  it("tolère quelques minutes d'arrondi", () => {
    const d = diagnostiquerModule({ ...MODULE_COMPLET, dureeMin: 93 });
    expect(d.dureeIncoherente).toBe(false);
    expect(d.complet).toBe(true);
  });

  it("un module conforme a des durées cohérentes", () => {
    const d = diagnostiquerModule(MODULE_COMPLET);
    expect(d.dureeBlocsMin).toBe(90);
    expect(d.dureeIncoherente).toBe(false);
  });
});
