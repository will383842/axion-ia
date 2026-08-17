/**
 * Les valeurs par défaut du panneau de report.
 *
 * Les deux champs `datetime-local` s'ouvraient vides : on reporte pourtant
 * presque toujours une journée entière, et il fallait saisir quatre fois la
 * même information au clavier dans un widget natif peu commode.
 */

import { describe, expect, it } from "vitest";
import { datesParDefautReport, pourChampDateHeure, HEURE_DEBUT, HEURE_FIN } from "./report-defauts";

describe("🔴 pourChampDateHeure formate en LOCAL, jamais en UTC", () => {
  it("il rend les composantes locales de la date", () => {
    // ⚠️ Le piège : `toISOString()` convertit en UTC. Une proposition à 09:00
    // heure de Paris s'afficherait « 07:00 » en été, et l'utilisateur
    // corrigerait à la main une valeur que le code croyait juste.
    const d = new Date(2026, 8, 3, 9, 0, 0);
    expect(pourChampDateHeure(d)).toBe("2026-09-03T09:00");
  });

  it("il complète les zéros — le champ refuse « 2026-9-3T9:0 »", () => {
    const d = new Date(2026, 0, 5, 7, 5, 0);
    expect(pourChampDateHeure(d)).toBe("2026-01-05T07:05");
  });

  it("il ne porte jamais le marqueur UTC", () => {
    const d = new Date(2026, 8, 3, 9, 0, 0);
    expect(pourChampDateHeure(d)).not.toContain("Z");
  });

  it("🔴 il DIFFÈRE de toISOString — sauf sous un fuseau UTC", () => {
    // ⚠️ Cette assertion était écrite sans condition, et elle a ROUGI en CI :
    // le runner tourne en UTC, où le formatage local et `toISOString` coïncident
    // par construction. Un test qui ne peut passer que sur le poste de son
    // auteur ne garde rien — il apprend juste à ignorer le rouge.
    //
    // On dit donc explicitement quand elle ne mesure rien, plutôt que de la
    // laisser réussir à vide : lancée avec `TZ=Europe/Paris`, elle mord.
    const d = new Date(2026, 8, 3, 9, 0, 0);
    if (d.getTimezoneOffset() === 0) {
      expect(pourChampDateHeure(d)).toBe(d.toISOString().slice(0, 16));
      return;
    }
    expect(pourChampDateHeure(d)).not.toBe(d.toISOString().slice(0, 16));
  });
});

describe("datesParDefautReport", () => {
  const midi = new Date(2026, 7, 17, 12, 30, 0);

  it("propose LE LENDEMAIN, pas le jour même", () => {
    // On ne reporte pas une session au jour même : si c'était possible, la
    // date d'origine conviendrait encore.
    expect(datesParDefautReport(midi).debut).toBe("2026-08-18T09:00");
  });

  it("propose une journée 09:00 → 17:00", () => {
    const d = datesParDefautReport(midi);
    expect(d.debut.endsWith(`T0${HEURE_DEBUT}:00`)).toBe(true);
    expect(d.fin.endsWith(`T${HEURE_FIN}:00`)).toBe(true);
  });

  it("la fin est APRÈS le début — sinon le serveur refuse", () => {
    const d = datesParDefautReport(midi);
    expect(d.fin > d.debut).toBe(true);
  });

  it("franchit correctement une fin de mois", () => {
    // Un `setDate(+1)` naïf sur le 31 donnerait le 32 ; l'objet Date reporte,
    // mais autant le prouver plutôt que le supposer.
    expect(datesParDefautReport(new Date(2026, 7, 31, 8, 0, 0)).debut).toBe("2026-09-01T09:00");
  });

  it("franchit correctement un 29 février", () => {
    expect(datesParDefautReport(new Date(2028, 1, 28, 8, 0, 0)).debut).toBe("2028-02-29T09:00");
  });
});
