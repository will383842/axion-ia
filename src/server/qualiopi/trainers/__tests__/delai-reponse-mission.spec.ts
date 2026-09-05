/**
 * Le délai de réponse d'un formateur — les quatre régimes, et les bornes.
 *
 * Ce que ces tests protègent : le défaut d'origine n'était pas une valeur
 * fausse, c'était une valeur FIXE. Trois jours, quelle que soit la date de la
 * session. Chaque cas ci-dessous rougit si quelqu'un remet une constante.
 */

import { describe, it, expect } from "vitest";

import {
  accordRequis,
  echeanceReponse,
  instantRelance,
  libelleEcheance,
  libelleInfosPratiques,
  DELAI_REPONSE_MAX_MS,
  DELAI_REPONSE_MIN_MS,
} from "@/server/qualiopi/trainers/delai-reponse-mission";

const NOW = new Date("2026-09-04T16:30:00.000Z");
const HEURE = 60 * 60 * 1000;
const JOUR = 24 * HEURE;

function dans(ms: number): Date {
  return new Date(NOW.getTime() + ms);
}

describe("accordRequis — qui doit accepter", () => {
  it("le sous-traitant doit accepter : son accord EST le contrat", () => {
    expect(accordRequis("sous_traitant")).toBe(true);
  });

  it("le salarié n'a pas à accepter — son contrat de travail règle la question", () => {
    expect(accordRequis("salarie")).toBe(false);
  });

  it("le dirigeant-formateur non plus : il EST l'organisme qui demande", () => {
    // Le cas réellement survenu le 2026-09-04 : Williams Jullin, `dirigeant`,
    // a reçu un e-mail lui demandant s'il acceptait d'animer la session de sa
    // propre société.
    expect(accordRequis("dirigeant")).toBe(false);
  });
});

describe("echeanceReponse — proportionnelle, jamais fixe", () => {
  it("session lointaine : le plafond de 48 h s'applique", () => {
    expect(echeanceReponse(dans(30 * JOUR), NOW).getTime()).toBe(
      NOW.getTime() + DELAI_REPONSE_MAX_MS,
    );
  });

  it("session dans 4 jours : on coupe à J-3 pour garder de quoi réaffecter", () => {
    const debut = dans(4 * JOUR);
    expect(echeanceReponse(debut, NOW).getTime()).toBe(debut.getTime() - 3 * JOUR);
  });

  it("session dans 2 jours : J-3 est déjà passé, le plancher de 2 h prend le relais", () => {
    // Sans le plancher, l'échéance serait ANTÉRIEURE à l'envoi du message.
    expect(echeanceReponse(dans(2 * JOUR), NOW).getTime()).toBe(
      NOW.getTime() + DELAI_REPONSE_MIN_MS,
    );
  });

  it("session le lendemain matin : réponse attendue le soir même, pas dans trois jours", () => {
    // LE cas d'AXI-SESS-2026-001. L'ancienne règle ne relançait jamais.
    const echeance = echeanceReponse(dans(16.5 * HEURE), NOW);
    expect(echeance.getTime()).toBe(NOW.getTime() + DELAI_REPONSE_MIN_MS);
    expect(echeance.getTime()).toBeLessThan(NOW.getTime() + JOUR);
  });

  it("session dans une heure : le démarrage rabat le plancher, jamais l'inverse", () => {
    const debut = dans(1 * HEURE);
    expect(echeanceReponse(debut, NOW).getTime()).toBe(debut.getTime());
  });

  it("l'échéance ne dépasse JAMAIS le démarrage, quel que soit le régime", () => {
    for (const ms of [0.5 * HEURE, 2 * HEURE, JOUR, 3 * JOUR, 10 * JOUR, 90 * JOUR]) {
      const debut = dans(ms);
      expect(echeanceReponse(debut, NOW).getTime()).toBeLessThanOrEqual(debut.getTime());
    }
  });
});

describe("instantRelance — à mi-délai, pas à J+3", () => {
  it("tombe au milieu de l'intervalle sollicitation → échéance", () => {
    const echeance = dans(48 * HEURE);
    expect(instantRelance(NOW, echeance).getTime()).toBe(NOW.getTime() + 24 * HEURE);
  });

  it("sur une session du lendemain, la relance tombe AVANT la session", () => {
    // Contre-témoin du défaut : la relance fixe à J+3 tombait deux jours APRÈS
    // la formation.
    const debut = dans(16.5 * HEURE);
    const relance = instantRelance(NOW, echeanceReponse(debut, NOW));
    expect(relance.getTime()).toBeLessThan(debut.getTime());
    expect(relance.getTime()).toBeGreaterThan(NOW.getTime());
  });
});

describe("libelleEcheance — ce que le formateur lit", () => {
  it("dit les heures quand il en reste moins d'un jour", () => {
    expect(libelleEcheance(dans(5 * HEURE), NOW)).toBe("sous 5 heures");
  });

  it("dit les jours au-delà", () => {
    expect(libelleEcheance(dans(48 * HEURE), NOW)).toBe("sous 2 jours");
  });

  it("accorde le singulier", () => {
    expect(libelleEcheance(dans(1.5 * HEURE), NOW)).toBe("sous 1 heure");
    expect(libelleEcheance(dans(30 * HEURE), NOW)).toBe("sous 1 jour");
  });

  it("ne prétend pas qu'il reste du temps quand l'échéance est passée", () => {
    expect(libelleEcheance(dans(-HEURE), NOW)).toBe("le délai est dépassé");
  });
});

describe("libelleInfosPratiques — la phrase qui mentait", () => {
  it("session lointaine : la promesse d'origine reste vraie", () => {
    expect(libelleInfosPratiques(dans(30 * JOUR), NOW)).toContain("une semaine avant");
  });

  it("🔴 session le lendemain : ne promet PLUS « une semaine avant »", () => {
    // Le défaut exact remonté par Will le 2026-09-04 : le formateur a lu
    // « une semaine avant le démarrage » pour une formation le lendemain, puis
    // « votre session de demain » dix minutes plus tard.
    const phrase = libelleInfosPratiques(dans(16.5 * HEURE), NOW);
    expect(phrase).not.toContain("semaine");
    expect(phrase).toContain("dans la foulée");
  });

  it("session dans 3 jours : annonce la veille, pas la semaine", () => {
    const phrase = libelleInfosPratiques(dans(3 * JOUR), NOW);
    expect(phrase).not.toContain("semaine");
    expect(phrase).toContain("veille");
  });

  it("aucune formulation ne promet un délai plus long que le temps restant", () => {
    // Témoin transverse : quelle que soit la date, la phrase ne doit jamais
    // annoncer « une semaine » s'il reste moins d'une semaine.
    for (const jours of [0.2, 1, 2, 5, 6.9]) {
      expect(libelleInfosPratiques(dans(jours * JOUR), NOW)).not.toContain("semaine");
    }
  });
});
