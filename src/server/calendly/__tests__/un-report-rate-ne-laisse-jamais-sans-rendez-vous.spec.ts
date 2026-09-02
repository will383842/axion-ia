// @vitest-environment node

/**
 * Verrou — un report raté ne laisse JAMAIS le prospect sans rendez-vous.
 *
 * ## La propriété, et pourquoi elle tient à un ordre
 *
 * Reporter, c'est deux opérations : réserver le nouveau créneau, annuler
 * l'ancien. Chacune peut échouer seule. L'ordre décide donc de ce que le
 * prospect perd quand ça casse — et il n'y a pas de symétrie entre les deux
 * états dégradés possibles :
 *
 * | ordre | panne | état final |
 * |---|---|---|
 * | annuler puis réserver | la réservation échoue | **plus rien** |
 * | réserver puis annuler | l'annulation échoue | deux rendez-vous |
 *
 * « Deux rendez-vous » se voit immédiatement dans l'agenda et se répare en un
 * clic. « Plus rien » ne se répare pas : la personne a cliqué pour DÉPLACER un
 * rendez-vous, elle se retrouve sans rien, son ancien créneau est déjà repris,
 * et on ne sait même pas qu'il faut la prévenir.
 *
 * L'ordre inverse est pourtant celui qu'on écrit spontanément — « je libère ma
 * place, j'en prends une autre ». Ce fichier existe pour qu'il rougisse.
 *
 * ## Ce qui se mesure ici
 *
 * Que l'annulation ne parte QU'APRÈS une réservation confirmée, sur chacune des
 * sept issues possibles de la réservation. C'est vérifiable sans réseau : on
 * observe si le second appel a lieu.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import {
  reporterRendezVous,
  demandeDepuisLaSource,
  reponsesDuPayload,
  type RendezVousSource,
} from "../report";

const EVENT_TYPE = "https://api.calendly.com/event_types/7315f013";
const ANCIEN = "https://api.calendly.com/scheduled_events/aaaaaaaa-1111-2222-3333-444444444444";
const NOUVEAU_DEBUT = new Date("2026-09-25T09:30:00.000Z");

function source(over: Partial<RendezVousSource> = {}): RendezVousSource {
  return {
    id: "clx9k2m4a0001qw8h7yz3n5vb",
    eventUri: ANCIEN,
    inviteeName: "Camille Prospect",
    inviteeEmail: "camille@exemple.fr",
    inviteePhone: null,
    timezone: "Europe/Paris",
    location: null,
    rawPayload: { event: { location: { type: "google_conference" } } },
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    ...over,
  };
}

/**
 * Un `fetch` qui distingue les appels et les COMPTE.
 *
 * ⚠️ `mockImplementation`, jamais `mockResolvedValue` : le corps d'une
 * `Response` ne se lit qu'une fois, et rendre le même objet ferait tomber les
 * relectures dans leur branche d'échec sans qu'aucun test ne s'en aperçoive.
 */
function reseau(reservation: { status: number; corps: unknown }) {
  const appels: string[] = [];
  const f = vi.fn((url: string, init?: RequestInit) => {
    const methode = init?.method ?? "GET";
    appels.push(`${methode} ${url}`);

    if (methode === "POST" && url.endsWith("/invitees")) {
      return Promise.resolve(
        new Response(JSON.stringify(reservation.corps), { status: reservation.status }),
      );
    }
    if (methode === "POST" && url.endsWith("/cancellation")) {
      return Promise.resolve(
        new Response(JSON.stringify({ resource: { canceler_type: "host" } }), { status: 201 }),
      );
    }
    // Relectures : le nouveau est une visio conforme, l'ancien est annulé.
    if (url.includes("/scheduled_events/")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            resource: { status: "canceled", location: { type: "google_conference" } },
          }),
          { status: 200 },
        ),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  return { f, appels };
}

const CREEE = {
  status: 201,
  corps: {
    resource: {
      event: "https://api.calendly.com/scheduled_events/bbbbbbbb-5555-6666-7777-888888888888",
      cancel_url: "https://calendly.com/cancellations/xyz",
    },
  },
};

beforeEach(() => {
  process.env.CALENDLY_API_TOKEN = "jeton-de-test";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CALENDLY_API_TOKEN;
});

/** Y a-t-il eu une tentative d'annulation ? */
function aAnnule(appels: readonly string[]): boolean {
  return appels.some((a) => a.startsWith("POST ") && a.endsWith("/cancellation"));
}

describe("🔑 CONTRE-TÉMOIN — un report qui réussit annule bien l'ancien", () => {
  it("le nouveau est créé, PUIS l'ancien est libéré", async () => {
    // Sans lui, un code qui n'annulerait JAMAIS ferait passer tous les tests
    // « n'annule pas » de ce fichier pour la bonne raison apparente.
    const { f, appels } = reseau(CREEE);
    vi.stubGlobal("fetch", f);
    const r = await reporterRendezVous(source(), EVENT_TYPE, NOUVEAU_DEBUT);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ancienLibere).toBe(true);
    expect(aAnnule(appels)).toBe(true);

    // 🔑 L'ORDRE, mesuré : la réservation précède l'annulation.
    const iReservation = appels.findIndex((a) => a.endsWith("/invitees"));
    const iAnnulation = appels.findIndex((a) => a.endsWith("/cancellation"));
    expect(iReservation).toBeGreaterThanOrEqual(0);
    expect(
      iAnnulation,
      "l'annulation part AVANT la réservation : une réservation en échec " +
        "laisserait alors le prospect sans aucun rendez-vous",
    ).toBeGreaterThan(iReservation);
  });
});

describe("🔴 quand la réservation échoue, l'ancien rendez-vous est INTACT", () => {
  const echecs: ReadonlyArray<readonly [string, { status: number; corps: unknown }, string]> = [
    [
      "le créneau vient d'être pris",
      { status: 400, corps: { message: "This time is no longer available" } },
      "creneau_pris",
    ],
    ["un refus explicite", { status: 400, corps: { message: "Invalid event type" } }, "refus"],
    [
      "le jeton n'a pas le droit d'écrire",
      { status: 403, corps: { message: "Insufficient scope" } },
      "portee_manquante",
    ],
    ["une panne serveur", { status: 502, corps: {} }, "silence"],
  ];

  for (const [nom, reponse, raisonAttendue] of echecs) {
    it(`« ${nom} » : aucune annulation n'est tentée`, async () => {
      const { f, appels } = reseau(reponse);
      vi.stubGlobal("fetch", f);
      const r = await reporterRendezVous(source(), EVENT_TYPE, NOUVEAU_DEBUT);

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.raison).toBe(raisonAttendue);
      expect(
        aAnnule(appels),
        `« ${nom} » a déclenché une annulation alors que la réservation avait ` +
          `échoué : le prospect se retrouve SANS AUCUN rendez-vous, et son ancien ` +
          `créneau est déjà repris.`,
      ).toBe(false);
    });
  }

  it("🔴 le SILENCE surtout : on ne sait pas, donc on ne touche à rien", async () => {
    // Le cas qui justifie la règle. Si l'on annulait « au cas où », une
    // réservation qui avait en fait abouti donnerait deux rendez-vous ; une qui
    // avait échoué donnerait zéro. Une fois sur deux, la pire des deux.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("aborted")));
    const r = await reporterRendezVous(source(), EVENT_TYPE, NOUVEAU_DEBUT);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("silence");
  });
});

describe("🔑 quand l'ANNULATION échoue, le visiteur reste confirmé", () => {
  it("son but est atteint — le doublon est notre problème, pas le sien", async () => {
    const { f } = reseau(CREEE);
    // L'annulation refuse ; la réservation, elle, a réussi.
    const g = vi.fn((url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST" && url.endsWith("/cancellation")) {
        return Promise.resolve(new Response(JSON.stringify({ message: "nope" }), { status: 400 }));
      }
      return f(url, init);
    });
    vi.stubGlobal("fetch", g);

    const r = await reporterRendezVous(source(), EVENT_TYPE, NOUVEAU_DEBUT);
    expect(
      r.ok,
      "le nouveau rendez-vous EXISTE : afficher un échec inquiéterait le " +
        "visiteur pour un problème qui n'est pas le sien",
    ).toBe(true);
    if (!r.ok) return;
    expect(
      r.ancienLibere,
      "mais on SAIT que l'ancien traîne — c'est ce qui déclenche l'alerte",
    ).toBe(false);
  });
});

describe("le prospect ne retape rien", () => {
  it("🔴 le FORMAT est repris, jamais deviné", async () => {
    // Un rendez-vous téléphonique reporté doit rester téléphonique. Basculer en
    // visio ferait attendre le prospect devant un écran pendant qu'on compose
    // son numéro.
    const d = demandeDepuisLaSource(
      source({
        location: "+33 6 11 22 33 44",
        rawPayload: { event: { location: { type: "outbound_call" } } },
      }),
      EVENT_TYPE,
      NOUVEAU_DEBUT,
    );
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.demande.format).toBe("telephone");
    expect(d.demande.telephone).toBe("+33 6 11 22 33 44");
  });

  it("🔴 les RÉPONSES aux questions repartent, libellés exacts", () => {
    // Les perdre ferait arriver un rendez-vous sans contexte dans l'agenda, et
    // Will le découvrirait au moment de l'appel sans comprendre pourquoi
    // celui-là est vide.
    const rep = reponsesDuPayload({
      questions_and_answers: [
        { question: "Quel est votre besoin ?", answer: "Un audit.", position: 0 },
        { question: "Vide", answer: "   ", position: 1 },
      ],
    });
    expect(rep).toHaveLength(1);
    expect(rep[0]?.question).toBe("Quel est votre besoin ?");
  });

  it("🔴 la DEMANDE porte réellement ces réponses — pas seulement la fonction", () => {
    // ⚠️ GARDE AJOUTÉE APRÈS COUP, PARCE QUE LA PRÉCÉDENTE ÉTAIT MUETTE.
    //
    // Le test au-dessus éprouve `reponsesDuPayload` toute seule. Débrancher son
    // appel dans `demandeDepuisLaSource` — donc perdre les réponses à chaque
    // report — ne le faisait PAS rougir : la fonction restait juste, plus
    // personne ne l'appelait.
    //
    // C'est la deuxième fois de la journée, sur deux fichiers différents, et
    // après avoir nommé le motif : « une fonction correcte et débranchée est
    // indiscernable d'une fonction correcte et branchée, tant qu'on ne mesure
    // que la fonction ». Nommer un piège ne suffit pas à l'éviter — il faut
    // mesurer l'ASSEMBLAGE, ici la demande produite.
    const d = demandeDepuisLaSource(
      source({
        rawPayload: {
          event: { location: { type: "google_conference" } },
          questions_and_answers: [
            { question: "Quel est votre besoin ?", answer: "Un audit.", position: 0 },
          ],
        },
      }),
      EVENT_TYPE,
      NOUVEAU_DEBUT,
    );
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(
      d.demande.reponses,
      "la demande ne porte pas les réponses : le nouveau rendez-vous arriverait " +
        "SANS CONTEXTE dans l'agenda, et on le découvrirait au moment de l'appel",
    ).toHaveLength(1);
    expect(d.demande.reponses?.[0]?.question).toBe("Quel est votre besoin ?");
  });

  it("🔴 un format INDÉCIS refuse plutôt que de choisir à la place du prospect", () => {
    // Un report qui change le format sans le dire est pire qu'un report qui
    // échoue : le prospect attend un appel et reçoit un lien, ou l'inverse.
    const d = demandeDepuisLaSource(
      source({ location: null, rawPayload: {} }),
      EVENT_TYPE,
      NOUVEAU_DEBUT,
    );
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.manque).toContain("format");
  });

  it("un appel sans numéro refuse — on aurait un rendez-vous sans personne à appeler", () => {
    const d = demandeDepuisLaSource(
      source({
        location: null,
        inviteePhone: null,
        rawPayload: { event: { location: { type: "outbound_call" } } },
      }),
      EVENT_TYPE,
      NOUVEAU_DEBUT,
    );
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.manque).toContain("numéro");
  });
});
