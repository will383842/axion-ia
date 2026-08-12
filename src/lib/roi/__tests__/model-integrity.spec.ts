// Intégrité du modèle du simulateur v2.
//
// Ces tests ne vérifient pas un calcul : ils verrouillent les INVARIANTS du
// référentiel. Une tâche mal câblée (grandeur inexistante, taux aberrant,
// fonction incohérente) ne produit pas d'erreur à l'exécution — elle produit
// silencieusement un chiffre faux dans un rapport envoyé à un prospect. C'est
// exactement le genre de défaut qu'aucune revue de code ne rattrape.

import { describe, it, expect } from "vitest";
import { AUTOMATABLE_TASKS } from "@/content/roi/model/tasks";
import { NON_AUTOMATABLE_TASKS } from "@/content/roi/model/non-automatable";
import { VOLUME_DEFS, BUSINESS_FUNCTIONS } from "@/content/roi/model/functions";
import { VOLUME_QUESTIONS, selectVolumeQuestions } from "@/content/roi/model/questions";
import {
  HEADCOUNT_BANDS,
  MATURITY_LEVELS,
  type BusinessFunction,
  type VolumeKey,
} from "@/content/roi/model/types";
import {
  FUNCTION_CODES,
  HEADCOUNT_CODES,
  MATURITY_CODES,
  SECTOR_CODES,
  VOLUME_CODES,
} from "@/lib/roi/encode";
import { CLIENT_SECTOR_SLUGS } from "@/content/sectors";

const VOLUME_KEYS = new Set<string>(VOLUME_DEFS.map((v) => v.key));
const FUNCTION_IDS = new Set<string>(BUSINESS_FUNCTIONS.map((f) => f.id));

describe("référentiel de tâches", () => {
  it("n'a aucun identifiant en double", () => {
    const ids = AUTOMATABLE_TASKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ne référence que des grandeurs déclarées", () => {
    for (const task of AUTOMATABLE_TASKS) {
      expect(VOLUME_KEYS.has(task.volumeKey), `tâche ${task.id}`).toBe(true);
    }
  });

  it("rattache chaque tâche à la fonction de sa grandeur", () => {
    // Une tâche classée « commercial » mais adossée à une grandeur
    // « administratif » fausserait la ventilation par fonction du rapport, et
    // ferait poser la question au mauvais moment dans le wizard.
    const fnByVolume = new Map(VOLUME_DEFS.map((v) => [v.key, v.fn]));
    for (const task of AUTOMATABLE_TASKS) {
      expect(task.fn, `tâche ${task.id}`).toBe(fnByVolume.get(task.volumeKey));
    }
  });

  it("garde des taux d'automatisation strictement entre 0 et 0,9", () => {
    // 0 signifierait que la tâche appartient à `non-automatable.ts` ; au-delà de
    // 0,9 on prétendrait supprimer la relecture humaine, ce qui est faux et
    // juridiquement intenable dans un argumentaire commercial.
    for (const task of AUTOMATABLE_TASKS) {
      expect(task.automationRate, `tâche ${task.id}`).toBeGreaterThan(0);
      expect(task.automationRate, `tâche ${task.id}`).toBeLessThanOrEqual(0.9);
    }
  });

  it("donne un temps unitaire et un délai plausibles", () => {
    for (const task of AUTOMATABLE_TASKS) {
      expect(task.minutesPerUnit, `tâche ${task.id}`).toBeGreaterThan(0);
      expect(task.minutesPerUnit, `tâche ${task.id}`).toBeLessThanOrEqual(480);
      expect(task.weeksToValue, `tâche ${task.id}`).toBeGreaterThan(0);
      expect(task.weeksToValue, `tâche ${task.id}`).toBeLessThanOrEqual(26);
    }
  });

  it("documente chaque tâche : comment on l'automatise, et pourquoi ce taux", () => {
    // Le `proofFr` est ce qui permet à un dirigeant de contester une ligne. Une
    // tâche sans preuve est une affirmation gratuite dans un document commercial.
    for (const task of AUTOMATABLE_TASKS) {
      expect(task.howFr.length, `tâche ${task.id}`).toBeGreaterThan(40);
      expect(task.proofFr.length, `tâche ${task.id}`).toBeGreaterThan(40);
    }
  });

  it("ne cite que des secteurs canoniques", () => {
    const known = new Set<string>(CLIENT_SECTOR_SLUGS);
    for (const task of AUTOMATABLE_TASKS) {
      for (const s of task.sectors ?? []) {
        expect(known.has(s), `tâche ${task.id}`).toBe(true);
      }
      for (const s of Object.keys(task.sectorMinutesFactor ?? {})) {
        expect(known.has(s), `tâche ${task.id}`).toBe(true);
      }
    }
  });

  it("couvre chaque fonction interrogée par au moins une tâche", () => {
    // `direction` est la seule exception assumée : elle n'a aucune question de
    // volume (son temps est compté via comptes-rendus et reportings).
    const covered = new Set(AUTOMATABLE_TASKS.map((t) => t.fn));
    for (const fn of BUSINESS_FUNCTIONS) {
      if (fn.id === "direction") continue;
      expect(covered.has(fn.id), `fonction ${fn.id}`).toBe(true);
    }
  });
});

describe("ce qui ne s'automatise pas", () => {
  it("n'a aucun identifiant en double et cite des fonctions connues", () => {
    const ids = NON_AUTOMATABLE_TASKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of NON_AUTOMATABLE_TASKS) {
      expect(FUNCTION_IDS.has(t.fn), `garde-fou ${t.id}`).toBe(true);
    }
  });

  it("donne une raison substantielle pour chacune", () => {
    for (const t of NON_AUTOMATABLE_TASKS) {
      expect(t.reasonFr.length, `garde-fou ${t.id}`).toBeGreaterThan(40);
    }
  });

  it("propose au moins trois mises en garde transversales", () => {
    // Le rapport en affiche trois. Sans ce plancher, un profil générique
    // afficherait un bloc « ce qui ne s'automatise pas » incomplet.
    expect(NON_AUTOMATABLE_TASKS.filter((t) => !t.sectors).length).toBeGreaterThanOrEqual(3);
  });
});

describe("questionnaire", () => {
  it("ne pose de question que sur des grandeurs déclarées, sans doublon", () => {
    const keys = VOLUME_QUESTIONS.map((q) => q.volumeKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const q of VOLUME_QUESTIONS) {
      expect(VOLUME_KEYS.has(q.volumeKey), `question ${q.volumeKey}`).toBe(true);
    }
  });

  it("propose partout une sortie « je ne sais pas »", () => {
    // C'est la contrepartie de la promesse de sérieux : une grandeur non
    // mesurée est exclue du total, jamais devinée.
    for (const q of VOLUME_QUESTIONS) {
      const unknowns = q.choices.filter((c) => c.value === null);
      expect(unknowns.length, `question ${q.volumeKey}`).toBe(1);
    }
  });

  it("offre au moins trois tranches chiffrées par question", () => {
    for (const q of VOLUME_QUESTIONS) {
      const numeric = q.choices.filter((c) => c.value !== null);
      expect(numeric.length, `question ${q.volumeKey}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("propose des tranches strictement croissantes", () => {
    // Des tranches désordonnées rendraient le choix illisible au pouce.
    for (const q of VOLUME_QUESTIONS) {
      const values = q.choices.filter((c) => c.value !== null).map((c) => c.value as number);
      const sorted = [...values].sort((a, b) => a - b);
      expect(values, `question ${q.volumeKey}`).toEqual(sorted);
    }
  });

  it("plafonne le questionnaire même si les huit fonctions sont cochées", () => {
    const all = BUSINESS_FUNCTIONS.map((f) => f.id);
    const selected = selectVolumeQuestions(all);
    expect(selected.length).toBeLessThanOrEqual(12);
    // Et il reste dans la fourchette annoncée : 4 questions de cadrage + volumes.
    expect(selected.length + 4).toBeLessThanOrEqual(16);
  });

  it("couvre toutes les fonctions avant d'approfondir l'une d'elles", () => {
    // Garantit qu'un abandon à mi-parcours produit un rapport large plutôt que
    // profond sur une seule fonction.
    const fns: BusinessFunction[] = ["administratif", "commercial", "production"];
    const selected = selectVolumeQuestions(fns);
    expect(selected.slice(0, 3).map((q) => q.fn)).toEqual(fns);
  });

  it("ne pose aucune question à la fonction direction", () => {
    expect(selectVolumeQuestions(["direction"])).toHaveLength(0);
  });
});

describe("codes d'URL", () => {
  it("couvre toutes les grandeurs, sans collision", () => {
    const keys = VOLUME_DEFS.map((v) => v.key as VolumeKey);
    for (const k of keys) {
      expect(VOLUME_CODES[k], `grandeur ${k}`).toBeTruthy();
    }
    const codes = Object.values(VOLUME_CODES);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("couvre secteurs, effectifs, maturités et fonctions, sans collision", () => {
    for (const s of CLIENT_SECTOR_SLUGS) expect(SECTOR_CODES[s], `secteur ${s}`).toBeTruthy();
    expect(SECTOR_CODES.generique).toBeTruthy();

    for (const b of HEADCOUNT_BANDS) expect(HEADCOUNT_CODES[b.id], `tranche ${b.id}`).toBeTruthy();
    for (const m of MATURITY_LEVELS) expect(MATURITY_CODES[m.id], `maturité ${m.id}`).toBeTruthy();
    for (const f of BUSINESS_FUNCTIONS)
      expect(FUNCTION_CODES[f.id], `fonction ${f.id}`).toBeTruthy();

    for (const table of [SECTOR_CODES, HEADCOUNT_CODES, MATURITY_CODES, FUNCTION_CODES]) {
      const codes = Object.values(table);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it("garde les codes de fonction sur un seul caractère", () => {
    // Les fonctions sont concaténées sans séparateur dans l'URL : un code à
    // deux caractères casserait le décodage de TOUS les liens déjà partagés.
    for (const code of Object.values(FUNCTION_CODES)) {
      expect(code).toHaveLength(1);
    }
  });

  it("garde les codes de grandeur sur exactement deux caractères", () => {
    // Le décodeur lit `token.slice(0, 2)` : toute autre longueur désaligne la
    // lecture de la valeur numérique qui suit.
    for (const code of Object.values(VOLUME_CODES)) {
      expect(code).toHaveLength(2);
    }
  });
});
