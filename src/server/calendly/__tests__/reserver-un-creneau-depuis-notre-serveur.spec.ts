// @vitest-environment node

/**
 * Verrou — le client de réservation dit toujours CE QUI S'EST PASSÉ, et ne
 * confirme jamais une réservation dont le lieu n'a pas été pris en compte.
 *
 * ## Les deux propriétés qui portent tout le reste
 *
 * **1. Un résultat typé PAR CAS, jamais un booléen.** L'appelant doit répondre
 * différemment selon la panne : le créneau pris entre-temps se traite sur place,
 * un refus se replie vers Calendly, et un silence oblige à VÉRIFIER avant de
 * replier — faute de quoi le prospect réserverait deux fois. Un `ok: false`
 * indifférencié le forcerait à deviner, et il devinerait mal le cas le plus
 * fréquent.
 *
 * **2. On relit la réponse.** Mesuré le 2026-09-01 contre l'API réelle : une
 * requête contenant un champ inventé de toutes pièces passe **sans le moindre
 * avertissement**. Un nom de champ mal orthographié serait donc ignoré en
 * silence — le lieu ne partirait jamais, la réservation aboutirait quand même,
 * et on l'apprendrait par un client mécontent le jour du rendez-vous.
 *
 * ## Ce que la phase 0 a établi, et que ces tests figent
 *
 * Rien de ce qui suit n'était documenté par Calendly. Tout a été obtenu en
 * créant deux vraies réservations, puis en les annulant :
 *
 * - `location.kind` accepte `outbound_call` et `google_conference` ;
 * - le numéro d'un appel va dans `location.location`, pas dans
 *   `invitee.text_reminder_number` ;
 * - `tracking` est **tout ou rien** — deux champs sur six font échouer la
 *   requête entière.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import {
  corpsDeLaDemande,
  lieuConforme,
  reserverCreneau,
  MAX_INVITES,
  type DemandeReservation,
} from "../reservation";

const EVENT_TYPE = "https://api.calendly.com/event_types/7315f013-3c9f-46a0-ab09-ebc57f441c31";

function demande(over: Partial<DemandeReservation> = {}): DemandeReservation {
  return {
    eventTypeUri: EVENT_TYPE,
    debut: new Date("2026-09-25T09:30:00.000Z"),
    nom: "Camille Prospect",
    email: "camille@exemple.test",
    fuseau: "Europe/Paris",
    format: "visio",
    ...over,
  };
}

/** La réponse que Calendly rend réellement sur un 201. */
function reponseCreee(over: Record<string, unknown> = {}) {
  return {
    resource: {
      event: "https://api.calendly.com/scheduled_events/be44303d",
      cancel_url: "https://calendly.com/cancellations/3cc21e7f",
      reschedule_url: "https://calendly.com/reschedulings/3cc21e7f",
      ...over,
    },
  };
}

beforeEach(() => {
  process.env.CALENDLY_API_TOKEN = "jeton-de-test";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CALENDLY_API_TOKEN;
});

describe("le corps de la demande porte les pièges de la phase 0", () => {
  it("🔴 une visio demande explicitement google_conference", () => {
    const c = corpsDeLaDemande(demande({ format: "visio" }));
    expect((c["location"] as Record<string, unknown>)["kind"]).toBe("google_conference");
  });

  it("🔴 un appel met le numéro dans location.location", () => {
    // Et NON dans `invitee.text_reminder_number`, qui sert aux rappels SMS.
    // Se tromper de champ donnerait un rendez-vous sans numéro à composer.
    const c = corpsDeLaDemande(demande({ format: "telephone", telephone: "+33 6 11 22 33 44" }));
    const lieu = c["location"] as Record<string, unknown>;
    expect(lieu["kind"]).toBe("outbound_call");
    expect(lieu["location"]).toBe("+33 6 11 22 33 44");
    expect((c["invitee"] as Record<string, unknown>)["text_reminder_number"]).toBeUndefined();
  });

  it("🔴 tracking porte ses SIX champs, null compris", () => {
    // Mesuré : envoyer deux UTM sur six fait échouer la requête entière avec
    // « is missing » sur les quatre absents. C'est tout ou rien.
    const c = corpsDeLaDemande(demande({ utmSource: "linkedin" }));
    const t = c["tracking"] as Record<string, unknown>;
    for (const champ of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "salesforce_uuid",
    ]) {
      expect(Object.keys(t), `« ${champ} » manque : la requête entière échouerait`).toContain(
        champ,
      );
    }
    expect(t["utm_source"]).toBe("linkedin");
  });

  it("le fuseau du VISITEUR est transmis, pas le nôtre", () => {
    // Un prospect à Montréal doit voir son heure. Calendly exige le champ, ce
    // qui force à traiter le sujet plutôt qu'à l'oublier.
    const c = corpsDeLaDemande(demande({ fuseau: "America/Montreal" }));
    expect((c["invitee"] as Record<string, unknown>)["timezone"]).toBe("America/Montreal");
  });

  it("les invités sont plafonnés à ce que Calendly accepte", () => {
    const trop = Array.from({ length: 15 }, (_, i) => `invite${i}@exemple.test`);
    const c = corpsDeLaDemande(demande({ invites: trop }));
    expect((c["event_guests"] as string[]).length).toBe(MAX_INVITES);
  });

  it("les questions gardent leur libellé EXACT, accents compris", () => {
    // Calendly apparie sur le texte de la question, sensible à la casse et aux
    // accents. Une normalisation bien intentionnée perdrait la réponse.
    const q = "Quel est votre besoin (formation, 1 to 1, audit, implémentation, plateforme web) ?";
    const c = corpsDeLaDemande(
      demande({ reponses: [{ question: q, reponse: "Audit", position: 0 }] }),
    );
    const qa = c["questions_and_answers"] as Array<Record<string, unknown>>;
    expect(qa[0]?.["question"]).toBe(q);
  });

  it("🔑 CONTRE-TÉMOIN : sans invité ni réponse, les clés sont ABSENTES", () => {
    // Envoyer un tableau vide n'est pas neutre : l'API pourrait le lire comme
    // « efface les invités ». On n'envoie que ce qu'on a.
    const c = corpsDeLaDemande(demande());
    expect(Object.keys(c)).not.toContain("event_guests");
    expect(Object.keys(c)).not.toContain("questions_and_answers");
  });
});

describe("lieuConforme — la seule protection contre le silence de l'API", () => {
  it("🔴 reconnaît le lieu réellement enregistré", () => {
    expect(lieuConforme("visio", { type: "google_conference", status: "pushed" })).toBe(true);
    expect(lieuConforme("telephone", { type: "outbound_call" })).toBe(true);
  });

  it("🔴 REFUSE quand Calendly a enregistré autre chose", () => {
    // Le cas que l'API ne signale pas : la réservation est créée, mais au
    // mauvais format. Sans cette vérification, on confirmerait une visio à
    // quelqu'un qui recevra un appel.
    expect(lieuConforme("visio", { type: "outbound_call" })).toBe(false);
    expect(lieuConforme("telephone", { type: "google_conference" })).toBe(false);
  });

  it("refuse une réponse sans lieu du tout", () => {
    for (const v of [null, undefined, {}, 42, "google_conference"]) {
      expect(lieuConforme("visio", v)).toBe(false);
    }
  });
});

describe("reserverCreneau — chaque panne a sa réponse", () => {
  it("🔴 une réservation acceptée rend l'événement et ses liens", () => {
    // Vérifie que le chemin nominal reste exploitable par la page de
    // confirmation : sans `eventUri`, elle n'aurait rien à afficher.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(reponseCreee()), { status: 201 })),
    );
    return reserverCreneau(demande()).then((r) => {
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.eventUri).toContain("scheduled_events");
      expect(r.cancelUrl).toContain("cancellations");
    });
  });

  it("🔴 un créneau pris entre-temps se distingue d'une panne", async () => {
    // Le refus le PLUS FRÉQUENT. Le confondre avec une panne enverrait le
    // prospect chez Calendly pour y lire le même refus, en moins bien.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "This time is no longer available" }), {
          status: 400,
        }),
      ),
    );
    const r = await reserverCreneau(demande());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("creneau_pris");
  });

  it("🔴 un délai dépassé rend « silence », jamais « refus »", async () => {
    // ⚠️ La distinction qui évite la double réservation. Sur un silence, on ne
    // sait PAS si Calendly a créé le rendez-vous : l'appelant doit vérifier
    // avant de replier.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("The operation was aborted")));
    const r = await reserverCreneau(demande());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("silence");
  });

  it("🔴 un 500 rend « silence » lui aussi", async () => {
    // Le serveur a pu traiter la demande avant de tomber : même incertitude,
    // donc même traitement. Le ranger dans « refus » ferait replier, et
    // replier ferait doubler.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 502 })));
    const r = await reserverCreneau(demande());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("silence");
  });

  it("un refus clair rend « refus » avec son détail", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: "Invalid event type" }), { status: 400 }),
        ),
    );
    const r = await reserverCreneau(demande());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // 🔑 Le `if` n'est pas une formalité : le type force à discriminer avant de
    // lire `detail`, exactement comme l'appelant devra le faire. Un `ok: false`
    // indifférencié aurait laissé passer un accès direct.
    if (r.raison !== "refus") throw new Error(`raison inattendue : ${r.raison}`);
    expect(r.detail).toContain("Invalid event type");
  });

  it("🔑 une réponse acceptée mais inexploitable est traitée comme un SILENCE", async () => {
    // Sans `event`, on ne peut ni confirmer au prospect, ni relire le lieu.
    // Le cas prudent est le silence, qui déclenche une vérification.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ resource: {} }), { status: 201 })),
    );
    const r = await reserverCreneau(demande());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("silence");
  });

  it("🔑 sans jeton, le module est INERTE et ne touche pas au réseau", async () => {
    delete process.env.CALENDLY_API_TOKEN;
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await reserverCreneau(demande());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("non_configure");
    expect(f, "aucune requête ne doit partir").not.toHaveBeenCalled();
  });

  it("🔑 CONTRE-TÉMOIN : ne lève JAMAIS, quelle que soit la panne", async () => {
    // L'appelant est une action de formulaire : une exception y deviendrait un
    // écran d'erreur, alors que chaque panne a une réponse utile.
    for (const f of [
      vi.fn().mockRejectedValue(new Error("réseau")),
      vi.fn().mockResolvedValue(new Response("pas du json", { status: 201 })),
      vi.fn().mockResolvedValue(new Response("", { status: 429 })),
    ]) {
      vi.stubGlobal("fetch", f);
      await expect(reserverCreneau(demande())).resolves.toBeDefined();
    }
  });
});

/**
 * La relecture du lieu — le second appel, sans lequel deux promesses de ce
 * module étaient fausses.
 *
 * ## Ce qui manquait, et comment ça s'est vu
 *
 * La première version de `reserverCreneau` s'arrêtait au 201. Son en-tête
 * promettait pourtant « on relit la réponse », et le type déclarait une variante
 * `lieu_non_pris_en_compte`. Les deux étaient inertes : la réponse du POST ne
 * porte PAS le lieu — elle rend l'URI de l'événement, et c'est tout. Vérifier
 * exige un second appel, qui n'existait pas.
 *
 * Conséquences, toutes deux muettes :
 * — un cas d'échec déclaré et INATTEIGNABLE, donc une protection qui n'en était
 *   pas une, alors que le fichier expliquait longuement pourquoi elle était
 *   indispensable ;
 * — `lienReunion` toujours `null`, donc une page de confirmation qui n'aurait
 *   jamais eu de lien de réunion à afficher.
 *
 * ## ⚠️ POURQUOI CES TESTS PILOTENT LE MOCK PAR MÉTHODE
 *
 * Les dix-huit tests ci-dessus rendaient le MÊME objet `Response` à chaque
 * appel. Le corps d'une `Response` ne se lit qu'une fois : la relecture tombait
 * donc systématiquement dans sa branche d'échec, et ces tests restaient verts
 * sans jamais éprouver la relecture. Verts pour une mauvaise raison — le piège
 * exact que ce dépôt a déjà rencontré ailleurs. On distingue donc POST et GET.
 */
describe("🔴 la relecture du lieu, qui exige un SECOND appel", () => {
  /** Un `fetch` qui répond différemment au POST et au GET. */
  function deuxAppels(evenement: Record<string, unknown> | null) {
    return vi.fn((url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        return Promise.resolve(new Response(JSON.stringify(reponseCreee()), { status: 201 }));
      }
      if (evenement === null) return Promise.resolve(new Response("nope", { status: 500 }));
      return Promise.resolve(
        new Response(JSON.stringify({ resource: evenement }), { status: 200 }),
      );
    });
  }

  it("🔴 un lieu CONFORME est relu, et le lien de réunion en est extrait", async () => {
    const f = deuxAppels({
      location: {
        type: "google_conference",
        join_url: "https://meet.google.com/abc-defg-hij",
      },
    });
    vi.stubGlobal("fetch", f);
    const r = await reserverCreneau(demande({ format: "visio" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(f, "la relecture exige un SECOND appel").toHaveBeenCalledTimes(2);
    expect(r.lieuVerifie).toBe(true);
    expect(r.lienReunion).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("🔴 un lieu NON conforme échoue — et rend de quoi défaire", async () => {
    // Le cas que l'API ne signale pas : la réservation est créée, au mauvais
    // format. Sans `eventUri` ni `cancelUrl`, il resterait un rendez-vous
    // fantôme que personne ne pourrait retrouver.
    vi.stubGlobal("fetch", deuxAppels({ location: { type: "outbound_call" } }));
    const r = await reserverCreneau(demande({ format: "visio" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    if (r.raison !== "lieu_non_pris_en_compte") throw new Error(`raison : ${r.raison}`);
    expect(r.eventUri).toContain("scheduled_events");
    expect(r.cancelUrl).toContain("cancellations");
    expect(r.lieuEnregistre).toBe("outbound_call");
  });

  it("🔑 une relecture EN ÉCHEC ne fait pas échouer la réservation", async () => {
    // La distinction qui compte. Le rendez-vous EXISTE : le nier ferait
    // réserver une seconde fois. On confirme, en disant qu'on n'a pas vérifié.
    vi.stubGlobal("fetch", deuxAppels(null));
    const r = await reserverCreneau(demande());
    expect(r.ok, "une relecture ratée n'est pas une réservation ratée").toBe(true);
    if (!r.ok) return;
    expect(r.lieuVerifie).toBe(false);
    expect(r.lienReunion).toBeNull();
  });

  it("🔑 un appel téléphonique conforme passe la relecture", async () => {
    // Contre-témoin de la garde ci-dessus : si la relecture refusait TOUT, le
    // test du lieu non conforme passerait pour la mauvaise raison.
    vi.stubGlobal("fetch", deuxAppels({ location: { type: "outbound_call" } }));
    const r = await reserverCreneau(demande({ format: "telephone", telephone: "+33611223344" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lieuVerifie).toBe(true);
    // Un appel n'a pas de lien de réunion, et c'est normal — pas une lacune.
    expect(r.lienReunion).toBeNull();
  });

  it("un événement sans lieu du tout compte comme NON relu", async () => {
    // Ni conforme ni non conforme : on n'a rien lu. Le ranger dans « mauvais
    // lieu » annulerait des réservations parfaitement valides.
    vi.stubGlobal("fetch", deuxAppels({ uri: "x" }));
    const r = await reserverCreneau(demande());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lieuVerifie).toBe(false);
  });
});

/**
 * La portée manquante — la panne totale qui se déguise en cas limite.
 *
 * ## Pourquoi elle mérite sa propre raison
 *
 * Si le jeton posé dans Coolify n'a pas `scheduled_events:write`, Calendly rend
 * un 403 et AUCUNE réservation ne passe. Rangé dans `refus`, ce cas serait
 * traité comme un problème du visiteur : on lui rend sa saisie et on lui montre
 * le lien Calendly, qui fonctionne. Le parcours marcherait donc — en apparence
 * — pendant que le formulaire est mort pour tout le monde.
 *
 * Le moment où cela se produit est le pire possible : la mise en service. C'est
 * exactement quand personne ne surveille encore, et quand un repli qui marche
 * ressemble à un succès.
 *
 * ## 🔑 Le corps de la réponse se LIT
 *
 * Ce dépôt a déjà perdu trois allers-retours, en juillet 2026, sur un 403 dont
 * on jetait le corps avant de le lire : on croyait à un jeton invalide alors
 * qu'il manquait une permission, écrite noir sur blanc dans `required_scopes`.
 * La leçon est inscrite dans `availability.ts` ; elle vaut ici aussi.
 */
describe("🔴 un jeton sans droit d'écrire est nommé, pas confondu avec un refus", () => {
  function repond(status: number, corps: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(corps), { status })),
    );
  }

  it("un 403 devient « portee_manquante », jamais « refus »", async () => {
    repond(403, { message: "Insufficient scope", required_scopes: ["scheduled_events:write"] });
    const r = await reserverCreneau(demande());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(
      r.raison,
      "rangé dans « refus », ce cas replierait poliment vers Calendly à chaque " +
        "réservation — ce qui marche, ce qui ne casse rien, et que personne ne remarquerait",
    ).toBe("portee_manquante");
  });

  it("🔑 la portée exigée est EXTRAITE du corps, pas jetée", () => {
    // C'est la seule information qui dit quoi corriger. Sans elle, l'alerte
    // dirait « ça ne marche pas » sans dire quel droit ajouter.
    repond(403, { message: "Insufficient scope", required_scopes: ["scheduled_events:write"] });
    return reserverCreneau(demande()).then((r) => {
      if (r.ok || r.raison !== "portee_manquante") throw new Error("mauvaise raison");
      expect(r.porteesRequises).toContain("scheduled_events:write");
    });
  });

  it("un 403 sans détail reste « portee_manquante », sans inventer de portée", async () => {
    repond(403, {});
    const r = await reserverCreneau(demande());
    if (r.ok || r.raison !== "portee_manquante") throw new Error("mauvaise raison");
    expect(r.porteesRequises).toBeNull();
  });

  it("🔑 CONTRE-TÉMOIN : un 400 ordinaire reste un « refus »", async () => {
    // Sans lui, une détection trop large rangerait tous les refus dans la panne
    // de configuration — et alerterait Will à chaque saisie un peu bancale,
    // jusqu'à ce qu'il apprenne à ignorer l'alerte.
    repond(400, { message: "Invalid event type" });
    const r = await reserverCreneau(demande());
    if (r.ok) throw new Error("aurait dû échouer");
    expect(r.raison).toBe("refus");
  });

  it("🔑 CONTRE-TÉMOIN : un créneau pris reste un créneau pris", async () => {
    repond(400, { message: "This time is no longer available" });
    const r = await reserverCreneau(demande());
    if (r.ok) throw new Error("aurait dû échouer");
    expect(r.raison).toBe("creneau_pris");
  });
});
