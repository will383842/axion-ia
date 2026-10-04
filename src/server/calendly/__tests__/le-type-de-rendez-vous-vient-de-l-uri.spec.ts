/**
 * Le TYPE d'un rendez-vous vient de l'URI de son type Calendly, pas de son nom
 * (chantier « Types de rendez-vous », lot L1, 2026-10-04).
 *
 * Ce qui doit tenir :
 *   1. une URI connue (résolue depuis les URL de réservation configurées) fixe
 *      le type — RENOMMER le type dans Calendly n'y change rien ;
 *   2. URI inconnue, API en échec, jeton absent, build (`stub.invalid`) : repli
 *      sur le nom, avec les règles historiques — et aucune requête au build ;
 *   3. jamais d'exception ;
 *   4. la charge brute est lue dans ses deux formes réelles.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const listerMock = vi.fn();
vi.mock("@/server/calendly/availability", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listerTypesEvenementCalendly: (...a: unknown[]) => listerMock(...a),
}));

import {
  besoinDesReponses,
  besoinDuBrut,
  classerParNom,
  classerRendezVous,
  estColonneTypeRendezVousAbsente,
  eventTypeUriDuBrut,
  LIBELLES_TYPE_RENDEZ_VOUS,
  reinitialiserCacheTypesRendezVous,
  sansColonnesTypeRendezVous,
  tableDesTypesConnus,
  TYPES_RENDEZ_VOUS,
  utmDuTracking,
} from "../type-rendez-vous";

const URI_PROJET = "https://api.calendly.com/event_types/PROJET";
const URI_DIAG = "https://api.calendly.com/event_types/DIAG";
const URI_APPORTEUR = "https://api.calendly.com/event_types/APPORTEUR";
const URI_SALON = "https://api.calendly.com/event_types/SALON";
const URI_AUTRE = "https://api.calendly.com/event_types/AUTRE";

/** La liste `/event_types` telle que le compte réel la rend (forme API). */
const TYPES_DU_COMPTE = [
  { uri: URI_PROJET, scheduling_url: "https://calendly.com/axion-ia/premier-contact" },
  { uri: URI_DIAG, scheduling_url: "https://calendly.com/axion-ia/diagnostic-ia" },
  {
    uri: URI_APPORTEUR,
    scheduling_url: "https://calendly.com/axion-ia/echange-apporteur-affaires",
  },
  { uri: URI_SALON, scheduling_url: "https://calendly.com/axion-ia/rencontre-salon-gofab" },
  { uri: URI_AUTRE, scheduling_url: "https://calendly.com/axion-ia/entretien-libre" },
];

beforeEach(() => {
  vi.clearAllMocks();
  reinitialiserCacheTypesRendezVous();
  process.env.CALENDLY_API_TOKEN = "pat_test";
  delete process.env.NEXT_PUBLIC_CALENDLY_APPEL_URL;
  delete process.env.NEXT_PUBLIC_CALENDLY_DIAGNOSTIC_URL;
  delete process.env.CALENDLY_APPORTEUR_URL;
  listerMock.mockResolvedValue({ types: TYPES_DU_COMPTE });
});

afterEach(() => {
  delete process.env.CALENDLY_API_TOKEN;
  vi.unstubAllEnvs();
});

describe("le module est le miroir de l'enum Prisma", () => {
  it("cinq types, chacun avec son libellé français", () => {
    expect([...TYPES_RENDEZ_VOUS]).toEqual([
      "diagnostic",
      "echange_projet",
      "apporteur",
      "salon",
      "autre",
    ]);
    expect(LIBELLES_TYPE_RENDEZ_VOUS).toEqual({
      diagnostic: "Diagnostic IA",
      echange_projet: "Échange projet",
      apporteur: "Apporteur",
      salon: "Salon",
      autre: "Autre",
    });
  });
});

describe("classerParNom — le repli, mêmes règles que la reprise SQL", () => {
  it.each([
    ["Échange apporteur d'affaires (15 min)", "apporteur"],
    ["echange-apporteur-affaires", "apporteur"],
    ["Rencontre au salon GOFAB — 13 octobre", "salon"],
    ["Salon des apporteurs", "apporteur"],
    ["Diagnostic IA", "diagnostic"],
    ["diagnostic-ia", "diagnostic"],
    ["Discutons de votre projet IA (45 min)", "echange_projet"],
    ["Échange projet", "echange_projet"],
    ["ECHANGE  PROJET", "echange_projet"],
    ["premier-contact", "echange_projet"],
    ["Entretien d'embauche", "autre"],
    ["", "autre"],
    [null, "autre"],
    [undefined, "autre"],
  ] as const)("« %s » → %s", (nom, attendu) => {
    expect(classerParNom(nom)).toBe(attendu);
  });
});

describe("tableDesTypesConnus — les URL configurées résolues en URI", () => {
  it("défauts du compte réel : chaque URL configurée prend son type, salon par le slug", () => {
    const table = tableDesTypesConnus(TYPES_DU_COMPTE);
    expect(table.get(URI_PROJET)).toBe("echange_projet");
    expect(table.get(URI_DIAG)).toBe("diagnostic");
    expect(table.get(URI_APPORTEUR)).toBe("apporteur");
    expect(table.get(URI_SALON)).toBe("salon");
    expect(table.has(URI_AUTRE)).toBe(false);
  });

  it("les variables d'environnement l'emportent sur les défauts", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_CALENDLY_DIAGNOSTIC_URL",
      "https://calendly.com/axion-ia/entretien-libre/",
    );
    const table = tableDesTypesConnus(TYPES_DU_COMPTE);
    expect(table.get(URI_AUTRE)).toBe("diagnostic");
  });
});

describe("classerRendezVous — l'URI d'abord", () => {
  it("🔴 un type RENOMMÉ garde son type quand l'URI est connue", async () => {
    // Le nom ne contient plus aucun mot-clé : seul l'URI peut le classer.
    await expect(
      classerRendezVous({ eventTypeUri: URI_PROJET, eventTypeName: "Parlons de vous" }),
    ).resolves.toBe("echange_projet");
    await expect(
      classerRendezVous({ eventTypeUri: URI_DIAG, eventTypeName: "Bilan express" }),
    ).resolves.toBe("diagnostic");
  });

  it("🔴 l'URI l'emporte sur un nom trompeur", async () => {
    await expect(
      classerRendezVous({ eventTypeUri: URI_PROJET, eventTypeName: "Diagnostic apporteur" }),
    ).resolves.toBe("echange_projet");
  });

  it("URI inconnue : repli sur le nom", async () => {
    await expect(
      classerRendezVous({ eventTypeUri: URI_AUTRE, eventTypeName: "Échange projet" }),
    ).resolves.toBe("echange_projet");
  });

  it("API en échec : repli sur le nom, sans lever", async () => {
    listerMock.mockResolvedValue({ failure: { reason: "forbidden", status: 403 } });
    await expect(
      classerRendezVous({ eventTypeUri: URI_PROJET, eventTypeName: "Diagnostic IA" }),
    ).resolves.toBe("diagnostic");
  });

  it("API qui LÈVE : repli sur le nom, sans lever", async () => {
    listerMock.mockRejectedValue(new Error("boum"));
    await expect(
      classerRendezVous({ eventTypeUri: URI_PROJET, eventTypeName: "rien de parlant" }),
    ).resolves.toBe("autre");
  });

  it("la liste n'est lue qu'une fois (cache en mémoire, utile au worker)", async () => {
    await classerRendezVous({ eventTypeUri: URI_PROJET, eventTypeName: null });
    await classerRendezVous({ eventTypeUri: URI_DIAG, eventTypeName: null });
    expect(listerMock).toHaveBeenCalledTimes(1);
  });

  it("🔑 au build (`stub.invalid`) : AUCUN appel, repli sur le nom", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://stub:stub@stub.invalid:5432/stub");
    await expect(
      classerRendezVous({ eventTypeUri: URI_PROJET, eventTypeName: "Salon GOFAB" }),
    ).resolves.toBe("salon");
    expect(listerMock).not.toHaveBeenCalled();
  });

  it("sans jeton : AUCUN appel, repli sur le nom", async () => {
    delete process.env.CALENDLY_API_TOKEN;
    await expect(
      classerRendezVous({
        eventTypeUri: URI_PROJET,
        eventTypeName: "Discutons de votre projet IA",
      }),
    ).resolves.toBe("echange_projet");
    expect(listerMock).not.toHaveBeenCalled();
  });

  it("une URI hors api.calendly.com est ignorée (pas d'appel)", async () => {
    await expect(
      classerRendezVous({ eventTypeUri: "https://evil.test/event_types/X", eventTypeName: null }),
    ).resolves.toBe("autre");
    expect(listerMock).not.toHaveBeenCalled();
  });
});

describe("lecture de la charge brute", () => {
  it("URI du type : ligne enrichie `{ invitee, event }`", () => {
    expect(eventTypeUriDuBrut({ invitee: {}, event: { event_type: URI_DIAG } })).toBe(URI_DIAG);
  });
  it("URI du type : `scheduled_event` du sondage avant enrichissement", () => {
    expect(eventTypeUriDuBrut({ uri: "x", event_type: URI_PROJET })).toBe(URI_PROJET);
  });
  it("URI du type : iframe non enrichie et saisie manuelle → null", () => {
    expect(
      eventTypeUriDuBrut({ event: { uri: "https://api.calendly.com/scheduled_events/E" } }),
    ).toBe(null);
    expect(eventTypeUriDuBrut({ _manual: true })).toBe(null);
    expect(eventTypeUriDuBrut(null)).toBe(null);
  });

  it("besoin : la réponse à la question « service » ou « besoin »", () => {
    const qa = [
      { question: "Téléphone", answer: "+33 6" },
      { question: "Quel service vous intéresse ?", answer: "Formation" },
    ];
    expect(besoinDesReponses(qa)).toBe("Formation");
    expect(besoinDesReponses([{ question: "Votre BESOIN", answer: " Audit " }])).toBe("Audit");
    expect(besoinDesReponses([{ question: "Secteur", answer: "BTP" }])).toBe(null);
    // Une autre question qui cite « services » ou « besoin » n'est pas le besoin.
    expect(
      besoinDesReponses([
        { question: "Comment avez-vous connu nos services ?", answer: "LinkedIn" },
      ]),
    ).toBe(null);
    expect(besoinDesReponses(undefined)).toBe(null);
    expect(besoinDuBrut({ invitee: { questions_and_answers: qa } })).toBe("Formation");
  });

  it("UTM du `tracking` de l'invité", () => {
    expect(
      utmDuTracking({
        tracking: {
          utm_source: "linkedin",
          utm_medium: null,
          utm_campaign: "",
          utm_content: "diagnostic",
        },
      }),
    ).toEqual({
      utmSource: "linkedin",
      utmMedium: null,
      utmCampaign: null,
      utmContent: "diagnostic",
    });
    expect(utmDuTracking(null)).toEqual({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
    });
  });
});

describe("fenêtre app/worker", () => {
  it("reconnaît une colonne du lot absente, jamais un doublon", () => {
    expect(
      estColonneTypeRendezVousAbsente({
        code: "P2022",
        message: "The column `calendly_events.type_rendez_vous` does not exist",
      }),
    ).toBe(true);
    expect(estColonneTypeRendezVousAbsente({ code: "P2002", message: "event_type_uri" })).toBe(
      false,
    );
    expect(estColonneTypeRendezVousAbsente({ code: "P2022", message: "colonne `notes`" })).toBe(
      false,
    );
    expect(estColonneTypeRendezVousAbsente(null)).toBe(false);
  });

  it("retire les trois colonnes du lot, garde le reste", () => {
    expect(
      sansColonnesTypeRendezVous({
        a: 1,
        typeRendezVous: "autre",
        eventTypeUri: "u",
        utmContent: "c",
      }),
    ).toEqual({ a: 1 });
  });
});

describe("les réponses du questionnaire pour le CRM (L5b)", () => {
  it("lit les réponses de la charge enrichie, sans le téléphone", async () => {
    const { reponsesDuBrut } = await import("@/server/calendly/type-rendez-vous");
    expect(
      reponsesDuBrut({
        invitee: {
          questions_and_answers: [
            { question: "Secteur", answer: "BTP" },
            { question: "Téléphone", answer: "+33 6 00 00 00 00" },
          ],
        },
      }),
    ).toEqual([{ question: "Secteur", reponse: "BTP" }]);
  });

  it("rien de lisible : tableau vide", async () => {
    const { reponsesDesQuestions } = await import("@/server/calendly/type-rendez-vous");
    expect(reponsesDesQuestions(undefined)).toEqual([]);
    expect(reponsesDesQuestions("n'importe quoi")).toEqual([]);
  });
});

describe("🔴 les coupes ne cassent jamais un emoji (relecture A09)", () => {
  const SURROGATE_ISOLE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
  // `JSON.stringify` écrit un surrogate isolé en `\udXXX` (6 caractères
  // ASCII) : on cherche donc AUSSI cette forme échappée.
  const SURROGATE_ECHAPPE = /\ud[89a-f][0-9a-f]{2}/i;
  const surrogateIsole = (v: unknown): boolean => {
    const json = JSON.stringify(v);
    return SURROGATE_ISOLE.test(json) || SURROGATE_ECHAPPE.test(json);
  };
  const emoji = "\u{1F600}";

  it("besoin lu dans Calendly : emoji pile à la limite", async () => {
    const { besoinDesReponses } = await import("@/server/calendly/type-rendez-vous");
    const b = besoinDesReponses([
      { question: "Quel service vous intéresse ?", answer: "a".repeat(299) + emoji },
    ]);
    expect(surrogateIsole(b)).toBe(false);
    expect(b?.length).toBeLessThanOrEqual(300);
  });

  it("réponses lues dans Calendly : emoji pile à la limite", async () => {
    const { reponsesDesQuestions } = await import("@/server/calendly/type-rendez-vous");
    const r = reponsesDesQuestions([
      { question: "q".repeat(119) + emoji, answer: "r".repeat(299) + emoji },
    ]);
    expect(surrogateIsole(r)).toBe(false);
  });

  it("coupe au point de code : un texte court reste intact", async () => {
    const { couperTexte } = await import("@/server/calendly/type-rendez-vous");
    expect(couperTexte("abc" + emoji, 5)).toBe("abc" + emoji);
    expect(couperTexte("abc" + emoji, 4)).toBe("abc");
  });
});
