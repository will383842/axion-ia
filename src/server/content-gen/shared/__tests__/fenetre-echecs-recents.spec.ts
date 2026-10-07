import { describe, expect, it } from "vitest";

import { FENETRE_ECHECS_RECENTS_JOURS, debutFenetreEchecsRecents } from "../fenetre-echecs-recents";

describe("fenêtre du badge « jobs en échec »", () => {
  it("couvre les 30 derniers jours", () => {
    expect(FENETRE_ECHECS_RECENTS_JOURS).toBe(30);
    const maintenant = new Date("2026-10-07T12:00:00Z");
    expect(debutFenetreEchecsRecents(maintenant).toISOString()).toBe("2026-09-07T12:00:00.000Z");
  });

  it("un échec de juillet sort de la fenêtre, un échec d'hier y reste", () => {
    const debut = debutFenetreEchecsRecents(new Date("2026-10-07T12:00:00Z"));
    expect(new Date("2026-07-15T00:00:00Z") >= debut).toBe(false);
    expect(new Date("2026-10-06T00:00:00Z") >= debut).toBe(true);
  });
});
