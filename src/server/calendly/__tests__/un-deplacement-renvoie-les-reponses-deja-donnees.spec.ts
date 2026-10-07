// @vitest-environment node

/**
 * Verrou — un déplacement renvoie les réponses déjà données.
 *
 * ## Le défaut mesuré en prod le 2026-10-07
 *
 * Déplacer un Diagnostic IA depuis « Choisir un autre créneau » (/appel/reporter)
 * échouait À CHAQUE FOIS (`echec=refus`). `reponsesDuPayload` ne lisait les
 * réponses qu'à la racine du contenu brut (ou sous `payload`), alors que
 * `enrich.ts` le réécrit sous la forme `{ ..._clésPrivées, invitee, event,
 * _refreshedAt }` : les réponses vivent dans `invitee.questions_and_answers`. Le
 * report partait sans aucune réponse, et Calendly refusait une réservation à
 * laquelle manquaient les questions OBLIGATOIRES.
 *
 * Les charges brutes ci-dessous ont la forme RÉELLE écrite par `enrich.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  alignerSurLesQuestions,
  demandeDepuisLaSource,
  reponsesDuPayload,
  reporterRendezVous,
  type RendezVousSource,
} from "../report";
import type { QuestionEventType } from "../questions";

const EVENT_TYPE = "https://api.calendly.com/event_types/diag-ia";
const ANCIEN = "https://api.calendly.com/scheduled_events/aaaaaaaa-1111-2222-3333-444444444444";
const DEBUT = new Date("2026-10-20T08:00:00.000Z");

const CONNU = "Comment nous avez-vous connu ?";
const SECTEUR = "Secteur d'activité";
const TAILLE = "Taille de l'entreprise";

/** La forme réelle d'une ligne après `enrich.ts`. */
function brutEnrichi(qa: unknown[]): Record<string, unknown> {
  return {
    _ipHash: "abc",
    invitee: {
      uri: "https://api.calendly.com/scheduled_events/x/invitees/y",
      questions_and_answers: qa,
    },
    event: { location: { type: "google_conference" } },
    _refreshedAt: "2026-10-07T08:00:00.000Z",
  };
}

const REPONSES_REELLES = [
  { question: SECTEUR, answer: "Industrie", position: 0 },
  { question: TAILLE, answer: "11 à 50", position: 1 },
  { question: CONNU, answer: "LinkedIn", position: 2 },
];

function question(over: Partial<QuestionEventType>): QuestionEventType {
  return {
    libelle: "?",
    type: "string",
    position: 0,
    requise: true,
    choix: [],
    autreAutorise: false,
    champ: "q0",
    ...over,
  };
}

const QUESTIONS_DESTINATION: QuestionEventType[] = [
  question({ libelle: SECTEUR, position: 0, champ: "q0" }),
  question({
    libelle: TAILLE,
    type: "single_select",
    position: 1,
    choix: ["1 à 10", "11 à 50", "51 et plus"],
    champ: "q1",
  }),
  question({
    libelle: CONNU,
    type: "single_select",
    position: 2,
    choix: ["LinkedIn", "Bouche-à-oreille", "Autre"],
    champ: "q2",
  }),
];

function source(over: Partial<RendezVousSource> = {}): RendezVousSource {
  return {
    id: "clx9k2m4a0001qw8h7yz3n5vb",
    eventUri: ANCIEN,
    inviteeName: "Camille Prospect",
    inviteeEmail: "camille@exemple.fr",
    inviteePhone: "+33612345678",
    timezone: "Europe/Paris",
    location: null,
    rawPayload: brutEnrichi(REPONSES_REELLES),
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    ...over,
  };
}

describe("un déplacement renvoie les réponses déjà données", () => {
  it("🔴 lit les réponses dans `invitee.questions_and_answers` (forme écrite par enrich.ts)", () => {
    const rep = reponsesDuPayload(brutEnrichi(REPONSES_REELLES));
    expect(
      rep.map((r) => r.question),
      "les réponses de la forme enrichie ne sont pas lues : le report part vide et Calendly refuse",
    ).toEqual([SECTEUR, TAILLE, CONNU]);
  });

  it("contre-témoin : les anciennes formes (racine, `payload`) restent lues", () => {
    expect(reponsesDuPayload({ questions_and_answers: REPONSES_REELLES })).toHaveLength(3);
    expect(
      reponsesDuPayload({ payload: { questions_and_answers: REPONSES_REELLES } }),
    ).toHaveLength(3);
    expect(reponsesDuPayload({ event: {} })).toEqual([]);
    expect(reponsesDuPayload(null)).toEqual([]);
  });

  it("🔴 la DEMANDE envoyée à Calendly porte les réponses, avec la position de DESTINATION", () => {
    // Les questions ont été réordonnées chez Calendly depuis la réservation :
    // la position qui part est celle d'aujourd'hui, pas celle d'hier.
    const reordonnees = [
      { ...QUESTIONS_DESTINATION[2]!, position: 0 },
      { ...QUESTIONS_DESTINATION[0]!, position: 1 },
      { ...QUESTIONS_DESTINATION[1]!, position: 2 },
    ];
    const d = demandeDepuisLaSource(source(), EVENT_TYPE, DEBUT, reordonnees);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.demande.reponses).toEqual([
      { question: CONNU, reponse: "LinkedIn", position: 0 },
      { question: SECTEUR, reponse: "Industrie", position: 1 },
      { question: TAILLE, reponse: "11 à 50", position: 2 },
    ]);
  });

  it("sans questions de destination, les réponses repartent telles quelles", () => {
    const d = demandeDepuisLaSource(source(), EVENT_TYPE, DEBUT);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.demande.reponses).toHaveLength(3);
  });
});

describe("le filet : une question obligatoire sans réponse", () => {
  it("🔴 n'invente JAMAIS « Comment nous avez-vous connu ? »", () => {
    // Rendez-vous pris avant l'ajout de la question.
    const r = alignerSurLesQuestions(
      reponsesDuPayload(brutEnrichi(REPONSES_REELLES.slice(0, 2))),
      QUESTIONS_DESTINATION,
      "+33612345678",
    );
    expect(r).toEqual({ ok: false, manquantes: [CONNU] });
  });

  it("un choix qui n'existe plus compte comme absent", () => {
    const r = alignerSurLesQuestions(
      [
        { question: SECTEUR, reponse: "Industrie", position: 0 },
        { question: TAILLE, reponse: "250 et plus", position: 1 },
        { question: CONNU, reponse: "LinkedIn", position: 2 },
      ],
      QUESTIONS_DESTINATION,
      null,
    );
    expect(r).toEqual({ ok: false, manquantes: [TAILLE] });
  });

  it("seule complétion admise : un champ téléphone, rempli avec le numéro déjà en base", () => {
    const r = alignerSurLesQuestions(
      [],
      [question({ libelle: "Votre numéro", type: "phone_number", position: 0 })],
      "+33612345678",
    );
    expect(r).toEqual({
      ok: true,
      reponses: [{ question: "Votre numéro", reponse: "+33612345678", position: 0 }],
    });
  });

  it("une question FACULTATIVE sans réponse ne bloque rien et ne part pas", () => {
    const r = alignerSurLesQuestions(
      [],
      [question({ libelle: "Un commentaire ?", requise: false })],
      null,
    );
    expect(r).toEqual({ ok: true, reponses: [] });
  });

  describe("au niveau du report", () => {
    beforeEach(() => {
      process.env.CALENDLY_API_TOKEN = "jeton-de-test";
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      delete process.env.CALENDLY_API_TOKEN;
    });

    it("🔴 raison explicite, AUCUN appel à Calendly, l'ancien rendez-vous intact", async () => {
      const f = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
      vi.stubGlobal("fetch", f);
      const r = await reporterRendezVous(
        source({ rawPayload: brutEnrichi(REPONSES_REELLES.slice(0, 2)) }),
        EVENT_TYPE,
        DEBUT,
        undefined,
        QUESTIONS_DESTINATION,
      );
      expect(r).toEqual({ ok: false, raison: "reponses_manquantes", questions: [CONNU] });
      expect(
        f,
        "rien ne doit partir chez Calendly : ni réservation, ni annulation",
      ).not.toHaveBeenCalled();
    });

    it("🔴 avec toutes les réponses, la requête envoyée à Calendly les porte", async () => {
      const corps: unknown[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string, init?: RequestInit) => {
          const methode = init?.method ?? "GET";
          if (methode === "POST" && url.endsWith("/invitees")) {
            corps.push(JSON.parse(String(init?.body)));
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  resource: { event: "https://api.calendly.com/scheduled_events/nouveau" },
                }),
                { status: 201 },
              ),
            );
          }
          if (methode === "POST" && url.endsWith("/cancellation")) {
            return Promise.resolve(new Response("{}", { status: 201 }));
          }
          return Promise.resolve(
            new Response(
              JSON.stringify({ resource: { location: { type: "google_conference" } } }),
              {
                status: 200,
              },
            ),
          );
        }),
      );
      const r = await reporterRendezVous(
        source(),
        EVENT_TYPE,
        DEBUT,
        undefined,
        QUESTIONS_DESTINATION,
      );
      expect(r.ok).toBe(true);
      expect((corps[0] as Record<string, unknown>)["questions_and_answers"]).toEqual([
        { question: SECTEUR, answer: "Industrie", position: 0 },
        { question: TAILLE, answer: "11 à 50", position: 1 },
        { question: CONNU, answer: "LinkedIn", position: 2 },
      ]);
    });
  });
});
