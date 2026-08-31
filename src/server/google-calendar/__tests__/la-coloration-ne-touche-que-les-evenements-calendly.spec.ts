/**
 * Verrou — la coloration par format n'écrit QUE sur les événements créés par
 * Calendly, et n'écrit QUE la couleur.
 *
 * ## Pourquoi ce témoin est nécessaire, et pas seulement confortable
 *
 * `MARQUEUR_CONSOLE` interdit à la console de modifier un événement qu'elle n'a
 * pas créé. La règle existe pour une raison précise : l'agenda de Will contient
 * sa vie, et une console qui écrit dedans par inadvertance ne se rattrape pas.
 *
 * `colorerReservationCalendly` s'en écarte volontairement — elle modifie des
 * événements créés par Calendly. L'écart ne tient que sur trois garanties, et
 * chacune est vérifiée ici :
 *
 * 1. elle ne vise que ce qui porte la signature de Calendly ;
 * 2. elle n'écrit que `colorId`, jamais un titre, un horaire ou une description ;
 * 3. elle ne crée ni ne supprime rien.
 *
 * Une garantie énoncée dans un commentaire n'est pas une garantie. Sans ces
 * tests, un `PATCH` qui recopierait au passage le corps d'un autre appel — le
 * genre de copie qui arrive — enverrait un titre ou des horaires sur un
 * rendez-vous réel, et rien ne le dirait.
 *
 * ## Et le cas le plus dangereux
 *
 * Le dernier test simule un événement PERSONNEL placé exactement au même
 * horaire qu'un rendez-vous. C'est la situation où une recherche par créneau
 * peut se tromper de cible, et c'est celle qu'il ne faut manquer sous aucun
 * prétexte : colorier l'anniversaire de quelqu'un est bénin, mais la même
 * erreur sur un appel qui écrirait autre chose que la couleur ne l'est pas.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { colorerReservationCalendly } from "../events";
import { resetGoogleTokenCacheForTests } from "../auth";

const fetchMock = vi.fn();

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

const DEBUT = new Date("2026-09-25T09:30:00.000Z");

/** La signature que Calendly pose lui-même dans la description. */
const SIGNATURE = "Alimenté par Calendly.com";

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/**
 * Répond au jeton, puis à la liste, puis à tout le reste.
 *
 * Renvoie les appels d'ÉCRITURE observés — c'est eux que les tests lisent.
 */
function agendaContenant(evenements: unknown[]): Array<{ url: string; init: RequestInit }> {
  const ecritures: Array<{ url: string; init: RequestInit }> = [];
  fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
    if (url.includes("oauth2.googleapis.com/token")) {
      return Promise.resolve(jsonRes({ access_token: "jeton-test", expires_in: 3600 }));
    }
    if ((init.method ?? "GET") === "GET") {
      return Promise.resolve(jsonRes({ items: evenements }));
    }
    ecritures.push({ url, init });
    return Promise.resolve(jsonRes({ id: "evt" }));
  });
  return ecritures;
}

/** Un événement au format que renvoie l'API Google. */
function evenement(o: { id: string; description?: string; debut?: string }) {
  return {
    id: o.id,
    summary: "Camille Prospect et Williams",
    start: { dateTime: o.debut ?? DEBUT.toISOString() },
    end: { dateTime: "2026-09-25T10:15:00.000Z" },
    ...(o.description === undefined ? {} : { description: o.description }),
  };
}

describe("la coloration d'une réservation dans l'agenda Google", () => {
  it("colore l'événement que Calendly a créé", async () => {
    const ecritures = agendaContenant([evenement({ id: "cal_1", description: SIGNATURE })]);
    const pose = await colorerReservationCalendly(DEBUT, "9");

    expect(pose).toBe(true);
    expect(ecritures).toHaveLength(1);
    expect(ecritures[0]?.init.method).toBe("PATCH");
    expect(ecritures[0]?.url).toContain("cal_1");
  });

  it("🔴 n'écrit QUE la couleur — rien d'autre ne part", async () => {
    const ecritures = agendaContenant([evenement({ id: "cal_1", description: SIGNATURE })]);
    await colorerReservationCalendly(DEBUT, "7");

    const corps = JSON.parse(String(ecritures[0]?.init.body)) as Record<string, unknown>;
    expect(corps).toEqual({ colorId: "7" });
    // Nommés un par un : `toEqual` seul passerait si le corps devenait vide, et
    // un corps vide serait un autre défaut. Ceux-ci sont les champs dont
    // l'écriture accidentelle abîmerait un vrai rendez-vous.
    for (const champ of ["summary", "description", "start", "end", "attendees", "transparency"]) {
      expect(Object.keys(corps), `« ${champ} » ne doit jamais partir`).not.toContain(champ);
    }
  });

  it("🔴 NE TOUCHE PAS un événement personnel au même horaire", async () => {
    // Le cas le plus dangereux : un rendez-vous privé posé exactement sur le
    // créneau. Sans la signature, il n'est pas de Calendly — on n'y touche pas.
    const ecritures = agendaContenant([evenement({ id: "perso_1" })]);
    const pose = await colorerReservationCalendly(DEBUT, "9");

    expect(pose).toBe(false);
    expect(ecritures, "aucune écriture ne doit partir sur un événement personnel").toEqual([]);
  });

  it("ne touche pas un événement Calendly d'un AUTRE horaire", async () => {
    // La fenêtre de recherche fait une minute de part et d'autre ; la
    // correspondance, elle, est exacte. Un rendez-vous voisin ne doit pas
    // hériter de la couleur de son voisin.
    const ecritures = agendaContenant([
      evenement({ id: "cal_voisin", description: SIGNATURE, debut: "2026-09-25T09:30:30.000Z" }),
    ]);
    expect(await colorerReservationCalendly(DEBUT, "9")).toBe(false);
    expect(ecritures).toEqual([]);
  });

  it("🔑 un format indéterminé ne déclenche AUCUN appel réseau", async () => {
    // `null` veut dire « on ne sait pas » : Google doit alors garder la couleur
    // par défaut de l'agenda. En poser une au hasard ferait croire à une
    // information qu'on n'a pas.
    agendaContenant([evenement({ id: "cal_1", description: SIGNATURE })]);
    expect(await colorerReservationCalendly(DEBUT, null)).toBe(false);
    expect(fetchMock, "aucune requête, pas même la lecture").not.toHaveBeenCalled();
  });

  it("sans configuration, elle ne touche pas au réseau", async () => {
    delete process.env.GOOGLE_CALENDAR_ID;
    agendaContenant([]);
    expect(await colorerReservationCalendly(DEBUT, "9")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("🔑 CONTRE-TÉMOIN : le simulateur distingue bien lecture et écriture", async () => {
    // Si `agendaContenant` classait le PATCH parmi les lectures, le test
    // « n'écrit que la couleur » n'aurait rien à lire et celui de l'événement
    // personnel serait vert sans rien prouver.
    const ecritures = agendaContenant([evenement({ id: "cal_1", description: SIGNATURE })]);
    await colorerReservationCalendly(DEBUT, "9");
    expect(ecritures.length, "aucune écriture captée : le simulateur ne les voit pas").toBe(1);
    const lectures = fetchMock.mock.calls.filter(
      (c) => ((c[1] as RequestInit | undefined)?.method ?? "GET") === "GET",
    );
    expect(lectures.length, "la lecture de la fenêtre doit avoir eu lieu").toBeGreaterThan(0);
  });
});
