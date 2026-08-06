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
  timingMin: 9,
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
    notes: NOTES_OK,
  },
  demonstration: {
    avant: "On reprend l'offre du poste d'à côté et on remplace les phrases une à une.",
    apres: "La fiche de poste devient une offre complète en une passe, le fond reste vôtre.",
    prompt:
      "Contexte : PME de 40 personnes. Rôle : responsable RH, ton direct. Format : 300 mots. Exigence : aucun superlatif.",
    outil: "Claude",
    gain: { avant: "40 min", apres: "10 min" },
    notes: NOTES_OK,
  },
  pratique: {
    consigne: "Prenez une offre publiée cette année et réécrivez-la avec la structure vue.",
    dureeMin: 5,
    notes: NOTES_OK,
  },
  verification: {
    question: "Quelle partie du prompt évite le « dynamique et motivé » ?",
    reponseAttendue: "La ligne Exigence.",
    notes: NOTES_OK,
  },
  synthese: {
    acquis: [
      "Vous savez transformer une fiche de poste en offre publiable.",
      "Vous savez faire retirer le jargon par une contrainte explicite.",
    ],
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
