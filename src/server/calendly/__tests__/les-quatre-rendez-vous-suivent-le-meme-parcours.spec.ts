// @vitest-environment node

/**
 * Verrou — les QUATRE rendez-vous suivent le même parcours, décrit par UNE table
 * (2026-10-05, ordre de Will : « étends notre parcours sur mesure aux 4 types »).
 *
 * Avant ce chantier, le parcours maison (créneaux → formulaire → confirmation →
 * report → annulation) ne servait que le diagnostic et l'échange projet ; l'échange
 * apporteur et la rencontre au salon renvoyaient vers la page Calendly brute.
 *
 * Ce que ce fichier interdit :
 *  · un cinquième endroit qui recopie une adresse, une durée ou un format d'un
 *    type : tout vient de `types-reservables.ts` ;
 *  · un lien privé (apporteur, salon) qui ramène au choix PUBLIC ;
 *  · un report qui retombe sur le type appel pour un autre type ;
 *  · un format proposé que l'événement ne permet pas — ou, pire, un format posté à
 *    la main que le serveur accepterait.
 *
 * Aucun réseau réel : `fetch` est simulé, et l'API Calendly n'a pas pu être
 * interrogée (pas de jeton dans cet environnement) — voir les cas « type privé ».
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHOIX_PUBLICS,
  CHOIX_RENDEZ_VOUS,
  TYPES_RESERVABLES,
  choixDeLaRoute,
  choixDuTypeRendezVous,
  configDuChoix,
  estUnChoixPublic,
  formatsProposes,
  urlConfigureeDuChoix,
} from "../types-reservables";
import { lieuxDeLEvenement } from "../lieux-evenement";
import {
  avecParametre,
  choixDuType,
  lienDuCalendrier,
  lireChoixRendezVous,
  typeDuChoix,
  urlDeReprogrammation,
} from "../choix-rendez-vous";
import {
  TYPES_RENDEZ_VOUS,
  tableDesTypesConnus,
  URL_CALENDLY_APPORTEUR_ANCIEN_DEFAUT,
} from "../type-rendez-vous";
import {
  fetchAvailableSlots,
  resoudreEventTypePourReservation,
  trouverLeType,
} from "../availability";
import { validerFormulaire, CHAMPS } from "../formulaire-reservation";
import { corpsDeLaDemande } from "../reservation";

const VARIABLES = [
  "NEXT_PUBLIC_CALENDLY_APPEL_URL",
  "NEXT_PUBLIC_CALENDLY_DIAGNOSTIC_URL",
  "CALENDLY_APPORTEUR_URL",
  "CALENDLY_SALON_URL",
  "CALENDLY_API_TOKEN",
] as const;

beforeEach(() => {
  for (const v of VARIABLES) delete process.env[v];
});
afterEach(() => {
  for (const v of VARIABLES) delete process.env[v];
  vi.unstubAllGlobals();
});

describe("🔑 la table des quatre rendez-vous", () => {
  it("contre-témoin : quatre choix, deux seulement offerts au public", () => {
    expect(CHOIX_RENDEZ_VOUS).toEqual(["diagnostic", "projet", "apporteur", "salon"]);
    expect(CHOIX_PUBLICS).toEqual(["diagnostic", "projet"]);
    expect(CHOIX_RENDEZ_VOUS.filter((c) => !estUnChoixPublic(c))).toEqual(["apporteur", "salon"]);
  });

  it("chaque rendez-vous a SON adresse, SON type et son segment d'URL", () => {
    const routes = CHOIX_RENDEZ_VOUS.map((c) => configDuChoix(c).route);
    expect(new Set(routes).size).toBe(4);
    expect(routes).toEqual(["diagnostic", "echange-projet", "apporteur", "salon-gofab"]);

    const types = CHOIX_RENDEZ_VOUS.map((c) => typeDuChoix(c));
    expect(new Set(types).size).toBe(4);
    for (const t of types) expect(TYPES_RENDEZ_VOUS).toContain(t);

    const urls = CHOIX_RENDEZ_VOUS.map((c) => urlConfigureeDuChoix(c));
    expect(new Set(urls).size).toBe(4);
    for (const u of urls) expect(u).toMatch(/^https:\/\/calendly\.com\/axion-ia\/[a-z0-9-]+$/);
  });

  it("le segment d'URL se traduit en choix, et un segment inconnu n'est RIEN", () => {
    for (const c of CHOIX_RENDEZ_VOUS) {
      expect(choixDeLaRoute(TYPES_RESERVABLES[c].route)).toBe(c);
    }
    expect(choixDeLaRoute("reserver")).toBeNull();
    expect(choixDeLaRoute("confirme")).toBeNull();
    expect(choixDeLaRoute("")).toBeNull();
    expect(choixDeLaRoute(undefined)).toBeNull();
  });

  it("le type classé en base et le choix se répondent dans les deux sens", () => {
    for (const c of CHOIX_RENDEZ_VOUS) {
      expect(choixDuType(typeDuChoix(c))).toBe(c);
      expect(choixDuTypeRendezVous(typeDuChoix(c))).toBe(c);
    }
    expect(choixDuType("autre")).toBeNull();
  });

  it("`?rdv=` accepte les quatre valeurs, et rien d'autre", () => {
    for (const c of CHOIX_RENDEZ_VOUS) expect(lireChoixRendezVous(c)).toBe(c);
    expect(lireChoixRendezVous("tout")).toBeNull();
    expect(lireChoixRendezVous(undefined)).toBeNull();
  });

  it("une variable d'environnement l'emporte sur le défaut, et un blanc n'est pas une valeur", () => {
    process.env.CALENDLY_SALON_URL = "https://calendly.com/axion-ia/autre-salon";
    expect(urlConfigureeDuChoix("salon")).toBe("https://calendly.com/axion-ia/autre-salon");
    process.env.CALENDLY_SALON_URL = "   ";
    expect(urlConfigureeDuChoix("salon")).toBe(
      "https://calendly.com/axion-ia/rencontre-salon-gofab",
    );
    process.env.CALENDLY_APPORTEUR_URL = "https://calendly.com/axion-ia/echange-apporteur-15";
    expect(urlConfigureeDuChoix("apporteur")).toBe(
      "https://calendly.com/axion-ia/echange-apporteur-15",
    );
  });
});

describe("🔑 chaque type est classé par l'URI de SON événement", () => {
  it("les quatre adresses configurées donnent les quatre types, et l'ancien défaut reste apporteur", () => {
    const types = [
      ...CHOIX_RENDEZ_VOUS.map((c, i) => ({
        uri: `https://api.calendly.com/event_types/T${i}`,
        scheduling_url: urlConfigureeDuChoix(c),
      })),
      {
        uri: "https://api.calendly.com/event_types/ANCIEN",
        scheduling_url: URL_CALENDLY_APPORTEUR_ANCIEN_DEFAUT,
      },
    ];
    const table = tableDesTypesConnus(types);
    CHOIX_RENDEZ_VOUS.forEach((c, i) => {
      expect(table.get(`https://api.calendly.com/event_types/T${i}`)).toBe(typeDuChoix(c));
    });
    expect(table.get("https://api.calendly.com/event_types/ANCIEN")).toBe("apporteur");
  });
});

describe("🔑 le calendrier d'un type privé ne passe jamais par le choix public", () => {
  it("diagnostic et projet : l'adresse historique, inchangée", () => {
    expect(lienDuCalendrier("fr", "projet", "faq", { utm_source: "linkedin" })).toBe(
      "/fr/appel?rdv=projet&depuis=faq&utm_source=linkedin",
    );
    expect(lienDuCalendrier("fr", "diagnostic")).toBe("/fr/appel?rdv=diagnostic");
  });

  it("apporteur et salon : leur propre adresse, sans `rdv`", () => {
    expect(lienDuCalendrier("fr", "apporteur")).toBe("/fr/appel/apporteur");
    expect(lienDuCalendrier("fr", "salon", "email-invitation-apporteur")).toBe(
      "/fr/appel/salon-gofab?depuis=email-invitation-apporteur",
    );
  });

  it("un paramètre se colle avec `?` ou `&` selon l'adresse", () => {
    expect(avecParametre("/fr/appel/apporteur", "creneau=indisponible")).toBe(
      "/fr/appel/apporteur?creneau=indisponible",
    );
    expect(avecParametre("/fr/appel?rdv=projet", "creneau=indisponible")).toBe(
      "/fr/appel?rdv=projet&creneau=indisponible",
    );
  });
});

describe("🔑 un report garde son type d'ORIGINE, salon et apporteur compris", () => {
  it.each([
    ["salon", "https://calendly.com/axion-ia/rencontre-salon-gofab"],
    ["apporteur", "https://calendly.com/axion-ia/echange-apporteur"],
    ["echange_projet", "https://calendly.com/axion-ia/premier-contact"],
  ])("type %s → son adresse, jamais celle d'un autre", async (typeRendezVous, attendu) => {
    expect(await urlDeReprogrammation({ typeRendezVous })).toBe(attendu);
  });

  it("un type inconnu retombe sur l'appel, comme avant", async () => {
    expect(await urlDeReprogrammation({ typeRendezVous: "autre" })).toBe(
      "https://calendly.com/axion-ia/premier-contact",
    );
  });
});

describe("🔑 les formats viennent du type, et l'événement a le dernier mot", () => {
  it("sans lieux connus : les candidats de la table", () => {
    expect(formatsProposes("diagnostic", null)).toEqual(["visio", "telephone"]);
    expect(formatsProposes("apporteur", undefined)).toEqual(["visio"]);
    expect(formatsProposes("salon", [])).toEqual(["sur_place"]);
  });

  it("des lieux connus : l'intersection, dans l'ordre de la table", () => {
    expect(formatsProposes("projet", ["telephone", "visio"])).toEqual(["visio", "telephone"]);
    expect(formatsProposes("projet", ["visio"])).toEqual(["visio"]);
    // L'apporteur offre les deux chez Calendly : on n'en propose qu'un (décision Will).
    expect(formatsProposes("apporteur", ["visio", "telephone"])).toEqual(["visio"]);
  });

  it("une intersection vide : ce que l'événement permet vraiment", () => {
    expect(formatsProposes("apporteur", ["telephone"])).toEqual(["telephone"]);
  });

  it("les lieux se lisent dans `locations`, sans rien deviner", () => {
    expect(
      lieuxDeLEvenement([
        { kind: "google_conference" },
        { kind: "outbound_call" },
        { kind: "inconnu_chez_nous" },
      ]),
    ).toEqual({ formats: ["visio", "telephone"] });
    expect(
      lieuxDeLEvenement([{ kind: "physical", location: "  1 place Bellecour, Lyon " }]),
    ).toEqual({ formats: ["sur_place"], adresse: "1 place Bellecour, Lyon" });
    expect(lieuxDeLEvenement(undefined)).toBeNull();
    expect(lieuxDeLEvenement([])).toBeNull();
    expect(lieuxDeLEvenement([{ kind: "inconnu_chez_nous" }])).toBeNull();
    expect(lieuxDeLEvenement("pas un tableau")).toBeNull();
  });
});

describe("🔴 le serveur retient le format du TYPE, pas celui du formulaire", () => {
  function saisie(format: string): FormData {
    const fd = new FormData();
    fd.set(CHAMPS.debut, new Date(Date.now() + 3 * 86_400_000).toISOString());
    fd.set(CHAMPS.nom, "Camille Martin");
    fd.set(CHAMPS.email, "camille@exemple.fr");
    fd.set(CHAMPS.format, format);
    fd.set(CHAMPS.telephone, "+33 6 12 34 56 78");
    fd.set(CHAMPS.consent, "on");
    return fd;
  }
  const base = { questions: [], eventTypeUri: "https://api.calendly.com/event_types/ET" } as const;

  it("format unique : le format posté est ignoré, celui du type part", () => {
    const r = validerFormulaire(saisie("telephone"), { ...base, formats: ["visio"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.demande.format).toBe("visio");
  });

  it("format unique, rien posté : le formulaire n'a rien à choisir, donc aucune erreur de format", () => {
    const r = validerFormulaire(saisie(""), { ...base, formats: ["sur_place"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.demande.format).toBe("sur_place");
  });

  it("plusieurs formats : un format hors liste est refusé", () => {
    const r = validerFormulaire(saisie("sur_place"), { ...base, formats: ["visio", "telephone"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs[CHAMPS.format]).toBeDefined();
  });

  it("sans liste (ancien appelant) : visio ET téléphone, comme avant", () => {
    expect(validerFormulaire(saisie("visio"), base).ok).toBe(true);
    expect(validerFormulaire(saisie("telephone"), base).ok).toBe(true);
    expect(validerFormulaire(saisie("sur_place"), base).ok).toBe(false);
  });

  it("sur place : la demande part avec l'adresse DE L'ÉVÉNEMENT et le lieu `physical`", () => {
    const r = validerFormulaire(saisie("sur_place"), {
      ...base,
      formats: ["sur_place"],
      adresseDuLieu: "1 place Bellecour, Lyon",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const corps = corpsDeLaDemande(r.demande);
    expect(corps["location"]).toEqual({ kind: "physical", location: "1 place Bellecour, Lyon" });
  });

  it("l'adresse n'est jamais celle d'un visiteur : hors sur place, elle ne part pas", () => {
    const r = validerFormulaire(saisie("visio"), {
      ...base,
      formats: ["visio", "telephone"],
      adresseDuLieu: "ne doit pas partir",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(corpsDeLaDemande(r.demande)["location"]).toEqual({ kind: "google_conference" });
  });
});

// ── Un type « En privé » ─────────────────────────────────────────────────────

const USER_URI = "https://api.calendly.com/users/USER";
const NOW = Date.UTC(2026, 9, 6, 9, 0, 0);

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Un type d'événement « En privé » : `secret`, `locations`, et un lien d'une autre forme. */
function typePrive(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uri: "https://api.calendly.com/event_types/PRIVE",
    name: "Rencontre au salon GOFAB",
    slug: "rencontre-salon-gofab",
    secret: true,
    active: true,
    duration: 20,
    scheduling_url: "https://calendly.com/axion-ia/rencontre-salon-gofab",
    custom_questions: [],
    locations: [{ kind: "physical", location: "Espace Lyon Pacte PME" }],
    ...over,
  };
}

function simulerCalendly(types: unknown[], creneaux: string[] = []) {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes("/users/me")) return Promise.resolve(jsonRes({ resource: { uri: USER_URI } }));
    if (url.includes("/event_types?")) return Promise.resolve(jsonRes({ collection: types }));
    if (url.includes("/event_type_available_times")) {
      return Promise.resolve(
        jsonRes({
          collection: creneaux.map((start_time) => ({
            status: "available",
            invitees_remaining: 1,
            start_time,
            scheduling_url: `https://calendly.com/axion-ia/rencontre-salon-gofab/${start_time}`,
          })),
        }),
      );
    }
    return Promise.resolve(jsonRes({}, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  process.env.CALENDLY_API_TOKEN = "pat_test_token";
  return fetchMock;
}

describe("🔴 un type « En privé » : créneaux et réservation passent par l'API", () => {
  it("le type privé se retrouve par son adresse, et ses créneaux se lisent", async () => {
    simulerCalendly([typePrive()], ["2026-10-08T09:00:00.000Z"]);
    const dispo = await fetchAvailableSlots({
      schedulingUrl: urlConfigureeDuChoix("salon"),
      nowMs: NOW,
    });
    expect(dispo.ok).toBe(true);
    if (dispo.ok) {
      expect(dispo.dureeMinutes).toBe(20);
      expect(dispo.days.flatMap((d) => d.slots)).toHaveLength(1);
    }
  });

  it("la réservation reçoit l'URI, ses questions, sa durée, ses lieux — et l'adresse du lieu", async () => {
    simulerCalendly([typePrive()]);
    const et = await resoudreEventTypePourReservation(urlConfigureeDuChoix("salon"));
    expect(et).not.toBeNull();
    expect(et?.uri).toBe("https://api.calendly.com/event_types/PRIVE");
    expect(et?.dureeMinutes).toBe(20);
    expect(et?.lieux).toEqual({ formats: ["sur_place"], adresse: "Espace Lyon Pacte PME" });
    expect(formatsProposes("salon", et?.lieux?.formats)).toEqual(["sur_place"]);
  });

  it("un lien secret d'une autre FORME se retrouve par son slug, sous le même compte", () => {
    const types = [
      typePrive({ scheduling_url: "https://calendly.com/axion-ia/rencontre-salon-gofab/ab12cd34" }),
    ];
    // Le chemin exact ne correspond pas…
    const trouve = trouverLeType(types, "https://calendly.com/axion-ia/rencontre-salon-gofab");
    // … le slug, sous le même compte, rattrape.
    expect(trouve?.uri).toBe("https://api.calendly.com/event_types/PRIVE");
  });

  it("le slug ne rattrape JAMAIS un autre compte, ni un autre type", () => {
    const types = [typePrive()];
    expect(
      trouverLeType(types, "https://calendly.com/autre-compte/rencontre-salon-gofab"),
    ).toBeNull();
    expect(trouverLeType(types, "https://calendly.com/axion-ia/echange-apporteur")).toBeNull();
    expect(trouverLeType(types, "https://calendly.com/axion-ia")).toBeNull();
  });

  it("le chemin exact reste la règle première : un type déjà résolu ne change pas", () => {
    const types = [
      typePrive({ uri: "https://api.calendly.com/event_types/A", slug: "premier-contact" }),
      typePrive({
        uri: "https://api.calendly.com/event_types/B",
        slug: "premier-contact",
        scheduling_url: "https://calendly.com/axion-ia/premier-contact",
      }),
    ];
    // A porte le slug mais pas le chemin ; B porte le chemin : B gagne.
    expect(trouverLeType(types, "https://calendly.com/axion-ia/premier-contact")?.uri).toBe(
      "https://api.calendly.com/event_types/B",
    );
  });

  it("type absent de la liste : repli (null), pas d'exception", async () => {
    simulerCalendly([]);
    expect(await resoudreEventTypePourReservation(urlConfigureeDuChoix("apporteur"))).toBeNull();
  });
});
