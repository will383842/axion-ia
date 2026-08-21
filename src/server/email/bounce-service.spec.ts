/**
 * 🔴 `D5-3-02` — lecture du payload de rebond ZeptoMail.
 *
 * Un rebond dur était indiscernable d'une remise réussie : le relais acceptait
 * le message, le serveur destinataire le refusait ensuite, et rien ne revenait.
 * Une convocation « envoyée » pouvait n'être jamais arrivée.
 *
 * Ce module lit le payload. Il ne doit JAMAIS lever : un format inattendu
 * produit un refus lisible, pas un 500 sur un endpoint public.
 */

import { describe, it, expect } from "vitest";
import { lireRebond } from "./bounce-service";

/** Payload conforme au contrat officiel ZeptoMail. */
function payload(over: Record<string, unknown> = {}): unknown {
  return {
    event_name: "hardbounce",
    event_message: {
      email_info: {
        email_reference: "ref-1",
        client_reference: null,
        subject: "Votre convocation — Bien démarrer avec l'IA",
        from: { address: "noreply@axion-ia.com", name: "Axion-IA" },
        to: [{ email_address: [{ address: "Alice.Martin@Example.COM" }] }],
        processed_time: "2026-08-20T09:00:00Z",
        object: "email",
      },
      event_data: {
        details: {
          reason: "550 5.1.1 User unknown",
          time: "2026-08-20T09:00:12Z",
          diagnostic_message: "smtp;550 5.1.1 <alice.martin@example.com> User unknown",
        },
        object: "hardbounce",
      },
      request_id: "req-abc",
    },
    mailagent_key: "agent-1",
    webhook_request_id: "wh-1",
    ...over,
  };
}

describe("lireRebond", () => {
  it("lit un rebond DUR complet", () => {
    const r = lireRebond(payload());
    expect(r).not.toBeNull();
    expect(r?.type).toBe("hard");
    expect(r?.motif).toBe("550 5.1.1 User unknown");
    expect(r?.requestId).toBe("req-abc");
    expect(r?.survenuLe?.toISOString()).toBe("2026-08-20T09:00:12.000Z");
  });

  it("distingue le rebond DOUX du dur — la distinction commande le geste", () => {
    // Un dur = adresse morte, on ne sollicite plus. Un doux = boîte pleine, on
    // réessaie. Les confondre fait soit renoncer trop tôt, soit s'acharner.
    const r = lireRebond(payload({ event_name: "softbounce" }));
    expect(r?.type).toBe("soft");
  });

  it("🔴 normalise le destinataire en minuscules", () => {
    // Le rattachement se fait par adresse : une casse non normalisée ferait
    // manquer l'envoi correspondant, et le rebond serait classé « inconnu »
    // alors que l'envoi est en base.
    expect(lireRebond(payload())?.destinataire).toBe("alice.martin@example.com");
  });

  it("🔴 traverse la double imbrication `to[].email_address[].address`", () => {
    // Ce n'est pas une coquetterie du format : un e-mail peut avoir plusieurs
    // destinataires. Supposer un seul niveau rendrait `null` sur TOUS les
    // rebonds, et aucun ne serait jamais rattaché.
    const r = lireRebond(
      payload({
        event_message: {
          ...(payload() as { event_message: Record<string, unknown> }).event_message,
          email_info: {
            to: [{ email_address: [] }, { email_address: [{ address: "bob@example.com" }] }],
          },
        },
      }),
    );
    expect(r?.destinataire).toBe("bob@example.com");
  });

  it("🔴 IGNORE un événement qui n'est pas un rebond", () => {
    // L'agent peut être configuré pour d'autres événements. Traiter un « ouvert »
    // comme un rebond marquerait un envoi RÉUSSI comme échoué — pire que le
    // défaut qu'on répare.
    expect(lireRebond(payload({ event_name: "emailopen" }))).toBeNull();
    expect(lireRebond(payload({ event_name: "" }))).toBeNull();
  });

  it("🔴 un horodatage illisible devient `null`, jamais une date invalide", () => {
    // Une `Invalid Date` partirait en base, Prisma la refuserait, et l'échec
    // masquerait le rebond lui-même.
    const r = lireRebond(
      payload({
        event_message: {
          ...(payload() as { event_message: Record<string, unknown> }).event_message,
          event_data: { details: { time: "pas une date", reason: "x" } },
        },
      }),
    );
    expect(r).not.toBeNull();
    expect(r?.survenuLe).toBeNull();
  });

  it("ne lève JAMAIS sur un payload inattendu", () => {
    // Un endpoint public : un format surprenant doit produire un refus lisible,
    // pas un 500 qui se lit comme une panne de notre côté.
    for (const mauvais of [null, undefined, 42, "texte", [], {}, { event_message: 3 }]) {
      expect(() => lireRebond(mauvais)).not.toThrow();
    }
    expect(lireRebond({})).toBeNull();
  });

  it("survit à un payload de rebond MINIMAL", () => {
    // Témoin de non-vacuité de la robustesse : accepter n'importe quoi ne doit
    // pas se traduire par « on ne lit plus rien ». Le type reste extrait.
    const r = lireRebond({ event_name: "hardbounce" });
    expect(r?.type).toBe("hard");
    expect(r?.destinataire).toBeNull();
    expect(r?.motif).toBeNull();
  });
});
