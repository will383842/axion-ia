// @vitest-environment node

/**
 * Verrou — un rendez-vous dont l'heure est passée cesse d'être « Planifié »,
 * sans jamais recouvrir une décision humaine.
 *
 * ## Ce qui était mesuré avant
 *
 * Le 2026-09-01 en production : **10 rendez-vous terminés étaient encore
 * affichés « Planifié »**, dont certains depuis juillet. La console montrait un
 * agenda qui ne se vidait jamais.
 *
 * La cause n'était pas un bug mais un manque : Calendly ne fournit AUCUN état
 * « a eu lieu » — chez lui un rendez-vous est `active` ou `canceled`, et le
 * `no_show` n'existe que si l'hôte le coche. Le statut `completed` figurait dans
 * le vocabulaire, `enrich.ts` refusait même de le rétrograder… mais **aucune
 * ligne de code ne l'écrivait jamais**. Un producteur manquait.
 *
 * ## Pourquoi « Passé » et pas « Terminé »
 *
 * On sait que l'heure est écoulée. On ne sait PAS que l'échange a eu lieu : un
 * rendez-vous manqué dont personne n'a coché l'absence est indistinguable d'un
 * rendez-vous honoré. « Terminé » affirmerait ce qu'on n'a pas mesuré.
 *
 * ## La propriété qui compte le plus
 *
 * La dérivation ne part QUE de `scheduled`. Une annulation, une absence cochée —
 * toute décision posée par un humain — l'emporte et n'est jamais recouverte par
 * le temps qui passe. C'est ce qu'exercent les contre-témoins ci-dessous, et
 * c'est ce qui distingue une dérivation utile d'un écrasement silencieux.
 */

import { describe, expect, it } from "vitest";

import { estTermine, statutAffiche, fromCalendly, MARGE_SANS_FIN_MINUTES } from "../normalize";

const MAINTENANT = new Date("2026-09-01T12:00:00.000Z");
const IL_Y_A_UNE_HEURE = new Date("2026-09-01T11:00:00.000Z");
const DANS_UNE_HEURE = new Date("2026-09-01T13:00:00.000Z");

describe("estTermine — la borne temporelle", () => {
  it("🔴 un rendez-vous dont la fin est passée est terminé", () => {
    expect(estTermine(new Date("2026-09-01T10:15:00Z"), IL_Y_A_UNE_HEURE, MAINTENANT)).toBe(true);
  });

  it("🔴 un rendez-vous EN COURS ne l'est pas", () => {
    // Commencé il y a une heure, se termine dans une heure. L'annoncer « passé »
    // pendant qu'il se déroule serait faux au pire moment.
    expect(estTermine(IL_Y_A_UNE_HEURE, DANS_UNE_HEURE, MAINTENANT)).toBe(false);
  });

  it("un rendez-vous à venir ne l'est pas", () => {
    expect(estTermine(DANS_UNE_HEURE, new Date("2026-09-01T13:45:00Z"), MAINTENANT)).toBe(false);
  });

  it("🔑 la borne est STRICTE : à l'instant exact de la fin, ce n'est pas encore passé", () => {
    // Un `<=` ferait basculer le statut à la seconde où le rendez-vous se
    // termine, alors qu'on se dit encore au revoir.
    expect(estTermine(null, MAINTENANT, MAINTENANT)).toBe(false);
    expect(estTermine(null, new Date(MAINTENANT.getTime() - 1), MAINTENANT)).toBe(true);
  });

  describe("sans heure de fin", () => {
    it("applique la marge, et pas l'heure de début", () => {
      const debut = new Date(MAINTENANT.getTime() - (MARGE_SANS_FIN_MINUTES - 10) * 60_000);
      expect(estTermine(debut, null, MAINTENANT), "encore dans la marge").toBe(false);

      const plusVieux = new Date(MAINTENANT.getTime() - (MARGE_SANS_FIN_MINUTES + 10) * 60_000);
      expect(estTermine(plusVieux, null, MAINTENANT), "au-delà de la marge").toBe(true);
    });

    it("🔑 la marge est GÉNÉREUSE au regard de la durée réelle", () => {
      // Un premier contact dure 45 minutes. Une marge plus courte annoncerait
      // « passé » alors que l'échange se poursuit.
      expect(MARGE_SANS_FIN_MINUTES).toBeGreaterThanOrEqual(90);
    });
  });

  it("sans horaire du tout, jamais terminé", () => {
    // Le cas existe : une ligne sur 21 en production n'a ni début ni fin.
    // Inventer une réponse serait pire que l'absence de réponse.
    expect(estTermine(null, null, MAINTENANT)).toBe(false);
  });
});

describe("statutAffiche — une décision humaine l'emporte toujours", () => {
  const passe = { debut: new Date("2026-09-01T10:15:00Z"), fin: IL_Y_A_UNE_HEURE };

  it("🔴 « planifié » + heure écoulée devient « passé »", () => {
    expect(statutAffiche("scheduled", passe.debut, passe.fin, MAINTENANT)).toBe("past");
  });

  it("🔑 CONTRE-TÉMOIN : une ANNULATION passée reste une annulation", () => {
    // C'est la propriété la plus importante du fichier. Recouvrir « annulé »
    // par « passé » effacerait l'information la plus utile : ce rendez-vous
    // n'a pas eu lieu, et on sait pourquoi.
    expect(statutAffiche("canceled", passe.debut, passe.fin, MAINTENANT)).toBe("canceled");
  });

  it("🔑 CONTRE-TÉMOIN : une ABSENCE cochée reste une absence", () => {
    expect(statutAffiche("no_show", passe.debut, passe.fin, MAINTENANT)).toBe("no_show");
  });

  it("🔑 CONTRE-TÉMOIN : un « terminé » posé à la main survit", () => {
    // Personne ne l'écrit aujourd'hui, mais le vocabulaire l'admet et
    // `enrich.ts` refuse déjà de le rétrograder. La dérivation doit s'aligner.
    expect(statutAffiche("completed", passe.debut, passe.fin, MAINTENANT)).toBe("completed");
  });

  it("un rendez-vous à venir reste planifié", () => {
    expect(
      statutAffiche("scheduled", DANS_UNE_HEURE, new Date("2026-09-01T13:45:00Z"), MAINTENANT),
    ).toBe("scheduled");
  });
});

describe("la dérivation traverse fromCalendly", () => {
  function ligne(over: Record<string, unknown> = {}) {
    return {
      id: "evt_1",
      eventTypeName: "Discutons de votre projet IA",
      status: "scheduled",
      startTime: new Date("2026-07-23T09:30:00Z"),
      endTime: new Date("2026-07-23T10:15:00Z"),
      inviteeName: "Camille",
      inviteeEmail: "c@exemple.test",
      inviteePhone: null,
      location: "+33 6 11 22 33 44",
      rawPayload: { event: { location: { type: "outbound_call" } } },
      notes: null,
      capturedAt: new Date("2026-07-23T09:00:00Z"),
      ...over,
    } as never;
  }

  it("🔴 un rendez-vous de juillet ne s'affiche plus « planifié »", () => {
    // Reproduit une des 10 lignes réellement observées en production.
    expect(fromCalendly(ligne()).status).toBe("past");
  });

  it("🔑 CONTRE-TÉMOIN : le harnais produit bien un rendez-vous complet", () => {
    // Sans cela, `status` pourrait valoir « past » parce que la ligne est vide
    // plutôt que parce que la dérivation fonctionne.
    const r = fromCalendly(ligne());
    expect(r.contactName).toBe("Camille");
    expect(r.format, "le format doit continuer de se dériver").toBe("telephone");
    expect(r.key).toBe("cal_evt_1");
  });

  it("un rendez-vous annulé de juillet reste annulé", () => {
    expect(fromCalendly(ligne({ status: "canceled" })).status).toBe("canceled");
  });
});
