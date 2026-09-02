// @vitest-environment node

/**
 * Verrou — l'annulation n'envoie jamais de motif, et ne confond jamais les
 * deux 403.
 *
 * ## Les deux propriétés, et ce qu'elles coûtent si on les rate
 *
 * **1. Le corps est VIDE.** Mesuré le 2026-09-01 contre l'API réelle : envoyer
 * `{"reason":"…"}` rend un 400 **et l'événement reste ACTIF**. Ce n'est pas une
 * requête mal formée qu'on corrige au prochain essai — c'est un rendez-vous
 * qu'on croit annulé et qui ne l'est pas. Le visiteur repart tranquille, le
 * créneau reste bloqué, et le jour venu personne ne se présente.
 *
 * Ajouter un motif est la modification la plus naturelle du monde : elle
 * améliorerait le suivi, elle a l'air gratuite, et Calendly documente un champ
 * qui porte ce nom. Ce fichier existe pour qu'elle rougisse.
 *
 * **2. Deux 403 différents.** Le rejeu d'un lien rend 403 « Event is already
 * canceled ». Un jeton sans droit d'écriture rend 403 aussi. Les confondre
 * coûte dans les DEUX sens :
 *
 * — une panne de configuration prise pour un rejeu devient invisible le jour de
 *   la mise en service, c'est-à-dire quand personne ne surveille encore ;
 * — un rejeu pris pour une panne alerte à chaque lien cliqué deux fois — et un
 *   lien d'annulation cliqué deux fois est le cas COURANT, pas le cas rare.
 *   L'alerte cesserait d'être lue, puis la vraie panne passerait avec elle.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { annulerRendezVous, estDejaAnnule, estUnePorteeManquante } from "../annulation";

const URI = "https://api.calendly.com/scheduled_events/be44303d-c25f-4b5f-9ce1-319761a646a3";

beforeEach(() => {
  process.env.CALENDLY_API_TOKEN = "jeton-de-test";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CALENDLY_API_TOKEN;
});

/**
 * Un `fetch` qui répond différemment au POST d'annulation et au GET de
 * relecture.
 *
 * ⚠️ `mockImplementation`, jamais `mockResolvedValue` : le corps d'une
 * `Response` ne se lit qu'une fois, et rendre le même objet aux deux appels
 * ferait tomber la relecture dans sa branche d'échec sans qu'aucun test ne
 * s'en aperçoive. C'est exactement ainsi que dix-huit tests de
 * `reserver-un-creneau…` ont cessé de mesurer le second appel en restant verts.
 */
function deuxAppels(
  post: { status: number; corps: unknown },
  statutRelu: string | null = "canceled",
) {
  return vi.fn((_url: string, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "POST") {
      return Promise.resolve(new Response(JSON.stringify(post.corps), { status: post.status }));
    }
    if (statutRelu === null) return Promise.resolve(new Response("nope", { status: 500 }));
    return Promise.resolve(
      new Response(JSON.stringify({ resource: { status: statutRelu } }), { status: 200 }),
    );
  });
}

describe("🔴 le corps de la requête reste VIDE", () => {
  it("aucun motif n'est envoyé", async () => {
    const f = deuxAppels({ status: 201, corps: { resource: { canceler_type: "host" } } });
    vi.stubGlobal("fetch", f);
    await annulerRendezVous(URI);

    const envoye = f.mock.calls.find((c) => (c[1] as RequestInit)?.method === "POST");
    const corps = String((envoye?.[1] as RequestInit).body ?? "");
    expect(
      corps.includes("reason"),
      "Un motif fait rendre 400 à l'API — ET L'ÉVÉNEMENT RESTE ACTIF. " +
        "Le rendez-vous serait annoncé annulé sans l'être : le créneau reste " +
        "bloqué, et le jour venu personne ne se présente.",
    ).toBe(false);
    expect(JSON.parse(corps || "{}")).toEqual({});
  });

  it("🔑 CONTRE-TÉMOIN : la requête part bien, sinon le test ci-dessus ne mesure rien", async () => {
    const f = deuxAppels({ status: 201, corps: { resource: {} } });
    vi.stubGlobal("fetch", f);
    const r = await annulerRendezVous(URI);
    expect(r.ok).toBe(true);
    expect(f, "un POST puis une relecture").toHaveBeenCalledTimes(2);
  });
});

describe("🔴 les deux 403 se distinguent", () => {
  it("« already canceled » est un SUCCÈS, marqué comme rejeu", async () => {
    // Le cas courant : lien transféré, retour en arrière, pré-chargement par un
    // client de messagerie. Le traiter comme une panne alerterait sans cesse.
    vi.stubGlobal(
      "fetch",
      deuxAppels({
        status: 403,
        corps: { title: "Permission Denied", message: "Event is already canceled" },
      }),
    );
    const r = await annulerRendezVous(URI);
    expect(r.ok, "un rejeu n'est pas un échec — le rendez-vous EST annulé").toBe(true);
    if (!r.ok) return;
    expect(r.deja, "la page doit pouvoir écrire « c'est annulé » et non « nous venons de »").toBe(
      true,
    );
  });

  it("🔴 un 403 de PORTÉE est une panne de configuration, pas un rejeu", async () => {
    vi.stubGlobal(
      "fetch",
      deuxAppels({
        status: 403,
        corps: { title: "Permission Denied", message: "Insufficient scope" },
      }),
    );
    const r = await annulerRendezVous(URI);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(
      r.raison,
      "confondu avec un rejeu, ce cas deviendrait invisible le jour de la mise " +
        "en service — quand plus personne ne peut annuler et que personne ne surveille",
    ).toBe("portee_manquante");
  });

  it("la portée exigée est extraite, sous ses deux formes", () => {
    expect(estUnePorteeManquante(403, "Insufficient scope", {})).toBe(true);
    expect(
      estUnePorteeManquante(403, "Permission Denied", {
        required_scopes: ["scheduled_events:write"],
      }),
    ).toBe(true);
  });

  it("🔑 l'ordre compte : le rejeu est reconnu AVANT la portée", () => {
    // Les deux sont des 403 et « Permission Denied » figure dans les deux
    // messages. Examiner la portée en premier classerait chaque rejeu en panne
    // de configuration — c'est-à-dire une alerte critique à chaque lien cliqué
    // deux fois.
    const message = "Event is already canceled";
    expect(estDejaAnnule(message)).toBe(true);
    expect(estUnePorteeManquante(403, message, {})).toBe(false);
  });

  it("reconnaît les deux orthographes de « annulé »", () => {
    // L'API a rendu « canceled » ; rien ne garantit qu'elle ne rendra jamais
    // « cancelled ». Le coût d'accepter les deux est nul ; celui de rater le
    // rejeu est une alerte critique à chaque clic.
    expect(estDejaAnnule("Event is already canceled")).toBe(true);
    expect(estDejaAnnule("Event is already cancelled")).toBe(true);
    expect(estDejaAnnule("Invalid event type")).toBe(false);
  });
});

describe("🔴 on relit avant d'annoncer", () => {
  it("un 201 dont la relecture NE confirme PAS ne vaut pas succès", async () => {
    // L'API accepte un champ inventé sans broncher : un 201 ne prouve pas
    // qu'elle a compris. Annoncer sans relire ferait dire « c'est annulé » sur
    // un rendez-vous encore actif.
    vi.stubGlobal("fetch", deuxAppels({ status: 201, corps: { resource: {} } }, "active"));
    const r = await annulerRendezVous(URI);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("non_confirme");
  });

  it("🔑 une relecture EN PANNE ne vaut pas « pas annulé »", async () => {
    // La distinction qui compte : « relu, et pas annulé » et « pas relu » ne se
    // traitent pas pareil. Le second est un silence — on ne sait pas.
    vi.stubGlobal("fetch", deuxAppels({ status: 201, corps: { resource: {} } }, null));
    const r = await annulerRendezVous(URI);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("silence");
  });
});

describe("les pannes ordinaires", () => {
  it("un délai dépassé rend « silence », jamais « refus »", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("aborted")));
    const r = await annulerRendezVous(URI);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("silence");
  });

  it("sans jeton, le module est INERTE et ne touche pas au réseau", async () => {
    delete process.env.CALENDLY_API_TOKEN;
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await annulerRendezVous(URI);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("non_configure");
    expect(f).not.toHaveBeenCalled();
  });

  it("🔑 un identifiant illisible ne part PAS sur le réseau", async () => {
    // Une URI tronquée construirait une adresse absurde. On refuse avant
    // d'émettre plutôt que de laisser l'API rendre un 404 qu'on classerait mal.
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await annulerRendezVous("https://api.calendly.com/scheduled_events/");
    expect(r.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("🔑 CONTRE-TÉMOIN : ne lève JAMAIS, quelle que soit la panne", async () => {
    for (const f of [
      vi.fn().mockRejectedValue(new Error("réseau")),
      vi.fn().mockImplementation(() => new Response("pas du json", { status: 201 })),
      vi.fn().mockImplementation(() => new Response("", { status: 429 })),
    ]) {
      vi.stubGlobal("fetch", f);
      await expect(annulerRendezVous(URI)).resolves.toBeDefined();
    }
  });
});
