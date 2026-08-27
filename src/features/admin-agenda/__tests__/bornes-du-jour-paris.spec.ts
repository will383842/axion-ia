// Bornes du jour civil parisien — régression de production (2026-08-27).
//
// CE QUE CES TESTS PROTÈGENT, ET POURQUOI
// ----------------------------------------
// `bornesDuJourParis` a renvoyé `Invalid Date` en production le jour même de la
// mise en service de l'onglet Agenda. La cause tenait en une ligne :
//
//     Number(Intl.DateTimeFormat("fr-FR", { hour: "2-digit", hour12: false })
//              .format(d))
//
// En français, une heure SEULE se rend « 14 h ». `Number("14 h")` vaut `NaN`,
// et toute la fenêtre de requête devenait invalide. Prisma refusait le
// `findMany` avec un `PrismaClientValidationError` et la page tombait sur son
// écran d'erreur — l'agenda n'a jamais pu s'afficher une seule fois.
//
// Aucun test ne couvrait cette fonction : les quatre gates de CI sont passées
// au vert sur du code qui ne pouvait pas fonctionner. Le premier test ci-dessous
// est donc celui qui aurait rougi.
//
// Le piège est sournois parce qu'il est LOCAL À UN FORMAT : le même appel avec
// les minutes rend « 14:30 », sans suffixe. `AgendaTimeline` faisait donc déjà
// exactement la même chose, sans jamais casser. On ne peut pas se fier à
// « ça marche à côté ».

import { describe, it, expect } from "vitest";

// `queries.ts` importe le client Prisma au chargement du module ; on le neutralise,
// ces tests ne parlent qu'à des dates.
import { vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { bornesDuJourParis } from "../queries";

describe("bornesDuJourParis", () => {
  it("🔴 RÉGRESSION 2026-08-27 — ne renvoie JAMAIS d'Invalid Date", () => {
    const { debut, fin } = bornesDuJourParis("2026-08-27");
    expect(Number.isNaN(debut.getTime())).toBe(false);
    expect(Number.isNaN(fin.getTime())).toBe(false);
  });

  it("cadre sur minuit heure de Paris, pas minuit UTC", () => {
    // Fin août, Paris est à UTC+2 : minuit local = 22:00 UTC la veille.
    const { debut } = bornesDuJourParis("2026-08-27");
    expect(debut.toISOString()).toBe("2026-08-26T22:00:00.000Z");
  });

  it("la borne de fin est le minuit du lendemain", () => {
    const { fin } = bornesDuJourParis("2026-08-27");
    expect(fin.toISOString()).toBe("2026-08-27T22:00:00.000Z");
  });

  it("un jour d'hiver est cadré à UTC+1", () => {
    const { debut, fin } = bornesDuJourParis("2026-01-15");
    expect(debut.toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-01-15T23:00:00.000Z");
  });

  it("le jour du passage à l'heure d'été dure 23 h, pas 24", () => {
    // 2026-03-29 : à 02:00 il est 03:00. Le jour civil ne compte que 23 heures.
    const { debut, fin } = bornesDuJourParis("2026-03-29");
    const heures = (fin.getTime() - debut.getTime()) / 3_600_000;
    expect(heures).toBe(23);
  });

  it("le jour du passage à l'heure d'hiver dure 25 h", () => {
    // 2026-10-25 : à 03:00 il est 02:00. Le jour civil compte 25 heures.
    const { debut, fin } = bornesDuJourParis("2026-10-25");
    const heures = (fin.getTime() - debut.getTime()) / 3_600_000;
    expect(heures).toBe(25);
  });

  it("une clé illisible retombe sur une fenêtre valide au lieu de casser la page", () => {
    for (const bidon of ["", "pas-une-date", "27/08/2026", "2026-8-7"]) {
      const { debut, fin } = bornesDuJourParis(bidon);
      expect(Number.isNaN(debut.getTime())).toBe(false);
      expect(Number.isNaN(fin.getTime())).toBe(false);
      expect(fin.getTime()).toBeGreaterThan(debut.getTime());
    }
  });

  it("les bornes sont toujours ordonnées et sérialisables pour Prisma", () => {
    for (const jour of ["2026-01-01", "2026-06-15", "2026-12-31"]) {
      const { debut, fin } = bornesDuJourParis(jour);
      expect(fin.getTime()).toBeGreaterThan(debut.getTime());
      // C'est exactement ce que Prisma refusait : une date non sérialisable.
      expect(() => debut.toISOString()).not.toThrow();
      expect(() => fin.toISOString()).not.toThrow();
    }
  });
});
