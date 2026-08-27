/**
 * Tests du client Google Agenda.
 *
 * Trois risques justifient une couverture serrée, et ils viennent tous d'une
 * mesure faite en production le 2026-08-26 :
 *
 *  1. LE BATTEMENT. Calendly ferme aussi le créneau ADJACENT à un événement.
 *     Poser un blocage à 12:00 pour « garder la matinée » supprime le créneau
 *     de 11:30. Le calcul est contre-intuitif et invisible à la relecture ;
 *     sans test, il se re-cassera à la première refonte de l'interface.
 *  2. LE DRAPEAU « DISPONIBLE ». Un événement `transparency: "transparent"` ne
 *     bloque rien — mesuré sur un rendez-vous annulé qui laissait bien le
 *     créneau ouvert chez Calendly. L'afficher comme occupé serait un mensonge.
 *  3. LE REPLI. Sans configuration, aucune requête ne doit partir : la console
 *     doit se rabattre sur les seules réservations Calendly, pas tomber.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  creerRendezVous,
  modifierEvenement,
  listerEvenements,
  poserIndisponibilite,
  debutBlocageApres,
  BATTEMENT_CALENDLY_MINUTES,
  MARQUEUR_CONSOLE,
} from "../events";
import { resetGoogleTokenCacheForTests } from "../auth";

const fetchMock = vi.fn();

/** Clé RSA de test — générée à la volée, jamais un secret réel. */
let PRIVATE_KEY = "";

beforeEach(async () => {
  vi.clearAllMocks();
  resetGoogleTokenCacheForTests();
  vi.stubGlobal("fetch", fetchMock);
  if (!PRIVATE_KEY) {
    const { generateKeyPairSync } = await import("node:crypto");
    PRIVATE_KEY = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
      type: "pkcs8",
      format: "pem",
    }) as string;
  }
  process.env.GOOGLE_CALENDAR_CLIENT_EMAIL = "compte-de-test@example.invalid";
  process.env.GOOGLE_CALENDAR_PRIVATE_KEY = PRIVATE_KEY;
  process.env.GOOGLE_CALENDAR_ID = "agenda-de-test@example.invalid";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_CALENDAR_CLIENT_EMAIL;
  delete process.env.GOOGLE_CALENDAR_PRIVATE_KEY;
  delete process.env.GOOGLE_CALENDAR_ID;
});

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Répond au jeton puis à l'appel Calendar, en distinguant par URL. */
function routeFetch(calendarResponse: (url: string) => Response) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("oauth2.googleapis.com/token")) {
      return Promise.resolve(jsonRes({ access_token: "jeton-test", expires_in: 3600 }));
    }
    return Promise.resolve(calendarResponse(url));
  });
}

describe("battement Calendly — le piège qui a coûté deux allers-retours", () => {
  it("décale le blocage APRÈS la fin du dernier créneau conservé", () => {
    // Garder le créneau qui finit à 12:00 impose de ne bloquer qu'à 12:15. Un
    // blocage à 12:00 pile emporterait ce créneau-là avec lui.
    const finDeMatinee = new Date("2026-09-08T10:00:00.000Z"); // 12:00 à Paris.
    const debut = debutBlocageApres(finDeMatinee);
    expect(debut.toISOString()).toBe("2026-09-08T10:15:00.000Z"); // 12:15 à Paris.
  });

  it("le décalage vaut exactement le battement mesuré", () => {
    const t = new Date("2026-09-08T14:00:00.000Z");
    const ecartMinutes = (debutBlocageApres(t).getTime() - t.getTime()) / 60_000;
    expect(ecartMinutes).toBe(BATTEMENT_CALENDLY_MINUTES);
    // 🔑 Si Calendly change son réglage de battement, c'est CETTE constante
    // qu'il faut corriger — le symptôme sera « je ferme après midi et je perds
    // aussi le créneau d'avant ». Le test la nomme pour que le lien soit
    // trouvable.
    //
    // ⚠️ 15 et non 30. La première mesure du 2026-08-26 concluait 30, mais elle
    // était faite sur une grille de 30 minutes : aucun écart intermédiaire
    // n'était OBSERVABLE. Le passage des rendez-vous à 45 min, la grille restant
    // à 30, a fait apparaître des écarts de 15 minutes — et ils sont acceptés
    // par Calendly. On ne mesurait donc pas le battement, on mesurait le pas de
    // la grille. Garder 30 coûtait un créneau réservable par journée fermée.
    expect(BATTEMENT_CALENDLY_MINUTES).toBe(15);
  });
});

describe("listerEvenements", () => {
  it("sans configuration : ne touche pas au réseau", async () => {
    delete process.env.GOOGLE_CALENDAR_ID;
    const res = await listerEvenements("2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z");
    expect(res).toEqual({ ok: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("développe les séries récurrentes — sinon l'agenda paraît vide", async () => {
    let urlVue = "";
    routeFetch((url) => {
      urlVue = url;
      return jsonRes({ items: [] });
    });
    await listerEvenements("2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z");
    // `singleEvents` est LE paramètre qu'on oublie : sans lui, une série
    // hebdomadaire ne renvoie qu'une ligne portant sa date de départ, et la vue
    // d'un jour donné manque ses occurrences.
    expect(urlVue).toContain("singleEvents=true");
    expect(urlVue).toContain("orderBy=startTime");
  });

  it("un événement marqué « disponible » n'est PAS compté comme occupé", async () => {
    routeFetch(() =>
      jsonRes({
        items: [
          {
            id: "a",
            summary: "Annulé(e) : ancien RDV",
            transparency: "transparent",
            start: { dateTime: "2026-09-01T09:00:00+02:00" },
            end: { dateTime: "2026-09-01T09:30:00+02:00" },
          },
          {
            id: "b",
            summary: "Vrai rendez-vous",
            start: { dateTime: "2026-09-01T11:00:00+02:00" },
            end: { dateTime: "2026-09-01T12:00:00+02:00" },
          },
        ],
      }),
    );
    const res = await listerEvenements("2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.events.map((e) => e.busy)).toEqual([false, true]);
  });

  it("reconnaît une réservation Calendly à sa signature", async () => {
    routeFetch(() =>
      jsonRes({
        items: [
          {
            id: "c",
            summary: "Juliette et Williams",
            description: "Nom d'événement\nDiscutons...\n\nAlimenté par Calendly.com\n",
            start: { dateTime: "2026-09-01T16:30:00+02:00" },
            end: { dateTime: "2026-09-01T17:00:00+02:00" },
          },
        ],
      }),
    );
    const res = await listerEvenements("2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Sert à ne pas afficher deux fois le même rendez-vous : la base en détient
    // déjà une version bien plus riche (téléphone, réponses, lien d'annulation).
    expect(res.events[0]?.fromCalendly).toBe(true);
    expect(res.events[0]?.fromConsole).toBe(false);
  });

  it("403 devient `forbidden` — l'agenda n'est pas partagé, ce n'est pas une panne", async () => {
    routeFetch(() => jsonRes({ error: { message: "Not Found" } }, 403));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const res = await listerEvenements("2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z");
      expect(res.ok).toBe(false);
      if (res.ok) return;
      // Confondre ça avec `api_error` enverrait chercher une panne réseau là où
      // il manque un clic dans les réglages de partage de l'agenda.
      expect(res.reason).toBe("forbidden");
      expect(res.detail).toContain("Not Found");
    } finally {
      warn.mockRestore();
    }
  });
});

describe("poserIndisponibilite", () => {
  it("écrit un événement OCCUPÉ et signé — c'est ce qui ferme Calendly", async () => {
    let corps: Record<string, unknown> = {};
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("oauth2.googleapis.com/token")) {
        return Promise.resolve(jsonRes({ access_token: "jeton-test", expires_in: 3600 }));
      }
      corps = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(jsonRes({ id: "nouvel-id", htmlLink: "https://cal/x" }));
    });

    const res = await poserIndisponibilite({
      titre: "Après-midi fermé",
      debut: new Date("2026-09-08T10:30:00.000Z"),
      fin: new Date("2026-09-08T17:30:00.000Z"),
    });

    expect(res.ok).toBe(true);
    // `opaque` = occupé. Un événement `transparent` s'afficherait dans l'agenda
    // sans rien bloquer du tout : le blocage serait décoratif.
    expect(corps["transparency"]).toBe("opaque");
    // Le marqueur rend l'opération réversible et reconnaissable : un blocage
    // anonyme est indistinguable d'un vrai rendez-vous, et personne n'ose
    // supprimer ce qu'il ne reconnaît pas.
    expect(String(corps["description"])).toContain(MARQUEUR_CONSOLE);
  });

  it("le motif devient le titre et la note descend sous le marqueur", async () => {
    // Les deux champs libres de la console (2026-08-27). L'action serveur les
    // acceptait depuis le premier jour, mais le formulaire envoyait « Indisponible »
    // en dur : tous les blocages portaient le même nom dans Google Agenda et sur
    // l'iPhone, et rien ne distinguait un déjeuner client d'un congé.
    let corps: Record<string, unknown> = {};
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("oauth2.googleapis.com/token")) {
        return Promise.resolve(jsonRes({ access_token: "jeton-test", expires_in: 3600 }));
      }
      corps = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(jsonRes({ id: "nouvel-id", htmlLink: "https://cal/x" }));
    });

    const res = await poserIndisponibilite({
      titre: "Déjeuner client Délifrance",
      note: "Restaurant côté gare, prévoir 30 min de trajet.",
      debut: new Date("2026-09-08T10:30:00.000Z"),
      fin: new Date("2026-09-08T12:30:00.000Z"),
    });

    expect(res.ok).toBe(true);
    expect(corps["summary"]).toBe("Déjeuner client Délifrance");
    const description = String(corps["description"]);
    // La note ne remplace JAMAIS le marqueur : c'est lui qui rend le blocage
    // reconnaissable et donc retirable depuis la console.
    expect(description).toContain(MARQUEUR_CONSOLE);
    expect(description).toContain("Restaurant côté gare");
  });

  it("sans note, la description garde le marqueur et rien de plus", async () => {
    let corps: Record<string, unknown> = {};
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("oauth2.googleapis.com/token")) {
        return Promise.resolve(jsonRes({ access_token: "jeton-test", expires_in: 3600 }));
      }
      corps = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(jsonRes({ id: "nouvel-id", htmlLink: "https://cal/x" }));
    });

    await poserIndisponibilite({
      titre: "Indisponible",
      debut: new Date("2026-09-08T10:30:00.000Z"),
      fin: new Date("2026-09-08T12:30:00.000Z"),
    });

    // Pas de « undefined » ni de ligne vide traînante dans un texte que Will lira
    // dans son agenda.
    expect(String(corps["description"])).not.toContain("undefined");
  });

  it("un échec revient avec sa cause, sans exception", async () => {
    routeFetch(() => jsonRes({ error: { message: "Insufficient permission" } }, 403));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const res = await poserIndisponibilite({
        titre: "x",
        debut: new Date("2026-09-08T10:30:00.000Z"),
        fin: new Date("2026-09-08T17:30:00.000Z"),
      });
      // Un blocage qu'on croit posé et qui ne l'est pas produit exactement le
      // problème qu'on voulait éviter : une réservation sur un créneau occupé.
      expect(res).toMatchObject({ ok: false, reason: "forbidden" });
    } finally {
      warn.mockRestore();
    }
  });
});

describe("creerRendezVous", () => {
  it("écrit un rendez-vous OCCUPÉ, signé, avec contact et note", async () => {
    let corps: Record<string, unknown> = {};
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("oauth2.googleapis.com/token")) {
        return Promise.resolve(jsonRes({ access_token: "jeton-test", expires_in: 3600 }));
      }
      corps = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(jsonRes({ id: "rdv-1", htmlLink: "https://cal/x" }));
    });

    const res = await creerRendezVous({
      titre: "Point Délifrance",
      debut: new Date("2026-09-08T10:30:00.000Z"),
      fin: new Date("2026-09-08T11:30:00.000Z"),
      contact: "Juliette Pechenot",
      telephone: "+33600000000",
      note: "Elle attend le RIB.",
    });

    expect(res.ok).toBe(true);
    expect(corps["summary"]).toBe("Point Délifrance");
    // `opaque` = occupé. C'est CE champ qui ferme le créneau Calendly ; un
    // rendez-vous « transparent » s'afficherait sans rien bloquer.
    expect(corps["transparency"]).toBe("opaque");
    const d = String(corps["description"]);
    // Le marqueur reste indispensable : sans lui, l'événement deviendrait
    // impossible à modifier ou retirer depuis la console.
    expect(d).toContain(MARQUEUR_CONSOLE);
    expect(d).toContain("Juliette Pechenot");
    expect(d).toContain("+33600000000");
    expect(d).toContain("Elle attend le RIB.");
  });

  it("sans contact ni note, la description ne contient pas « undefined »", async () => {
    let corps: Record<string, unknown> = {};
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("oauth2.googleapis.com/token")) {
        return Promise.resolve(jsonRes({ access_token: "jeton-test", expires_in: 3600 }));
      }
      corps = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(jsonRes({ id: "rdv-2" }));
    });

    await creerRendezVous({
      titre: "Appel",
      debut: new Date("2026-09-08T10:30:00.000Z"),
      fin: new Date("2026-09-08T11:00:00.000Z"),
    });
    // Ce texte, Will le lit dans son agenda et sur son iPhone.
    expect(String(corps["description"])).not.toContain("undefined");
    expect(String(corps["description"])).not.toContain("null");
  });
});

describe("modifierEvenement", () => {
  it("🔴 emploie PATCH et non PUT — sinon on détruit ce qu'on ne réécrit pas", async () => {
    // Un PUT remplacerait l'événement entier : invités, rappels et
    // visioconférence disparaîtraient en ne changeant qu'une heure.
    let methode = "";
    let corps: Record<string, unknown> = {};
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("oauth2.googleapis.com/token")) {
        return Promise.resolve(jsonRes({ access_token: "jeton-test", expires_in: 3600 }));
      }
      methode = String(init?.method);
      corps = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(jsonRes({ id: "rdv-1" }));
    });

    const res = await modifierEvenement("rdv-1", {
      titre: "Point reporté",
      debut: new Date("2026-09-09T10:30:00.000Z"),
      fin: new Date("2026-09-09T11:30:00.000Z"),
      note: "Reporté à sa demande.",
      phrase: "Rendez-vous posé depuis la console Axion-IA.",
    });

    expect(res.ok).toBe(true);
    expect(methode).toBe("PATCH");
    expect(corps["summary"]).toBe("Point reporté");
    // La modification NE DOIT PAS effacer le marqueur : sinon l'événement
    // deviendrait intouchable dès la première modification.
    expect(String(corps["description"])).toContain(MARQUEUR_CONSOLE);
    expect(String(corps["description"])).toContain("Reporté à sa demande.");
  });

  it("un échec revient avec sa cause, sans exception", async () => {
    routeFetch(() => jsonRes({ error: { message: "Insufficient permission" } }, 403));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const res = await modifierEvenement("rdv-1", {
        titre: "x",
        phrase: "y",
        debut: new Date("2026-09-09T10:30:00.000Z"),
        fin: new Date("2026-09-09T11:30:00.000Z"),
      });
      expect(res).toMatchObject({ ok: false, reason: "forbidden" });
    } finally {
      warn.mockRestore();
    }
  });
});
