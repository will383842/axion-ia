/**
 * enveloppe.ts — l'enveloppe sur le fil, son identifiant idempotent, sa signature.
 *
 * L'enveloppe est en `snake_case` et ce n'est pas une entorse aux conventions : c'est
 * un FORMAT DE FIL partagé avec un autre dépôt, au même titre que les champs d'une API
 * tierce que `CONVENTIONS.md` §1 exempte nommément. Le camelCase et les suffixes
 * `Cents` / `At` restent la règle DANS le payload, qui est du code de ce dépôt.
 * L'arbitrage est consigné par `partners/ADR-0008`.
 */
import { createHash, createHmac } from "node:crypto";

import { PRODUCTEUR } from "./config";
import { SCHEMA_VERSION, TYPES_EVENEMENT, estDansLeContratV1, type TypeEvenement } from "./contrat";

export type Fait = {
  readonly type: TypeEvenement;
  /**
   * La clé qui identifie le FAIT MÉTIER, pas l'appel. Deux tentatives d'émission du
   * même fait portent la même clé, donc le même `event_id` — c'est tout le mécanisme
   * d'idempotence de REQ-ARG-002 côté producteur.
   */
  readonly cleDeFait: string;
  /** L'instant du fait métier. Distinct de l'instant d'émission (l'outbox rejoue). */
  readonly occurredAt: Date;
  readonly sujet: unknown;
  readonly payload: Record<string, unknown>;
  readonly sequence: number;
};

export type EnveloppeEvenement = {
  event_id: string;
  event_type: string;
  schema_version: number;
  occurred_at: string;
  emitted_at: string;
  producer: string;
  subject_ref: unknown;
  sequence: number;
  payload: Record<string, unknown>;
};

/**
 * L'identifiant d'événement — DÉTERMINISTE, et à la FORME d'un UUID v4.
 *
 * 🔴 LE PIÈGE, ET POURQUOI CE N'EST PAS UN `randomUUID()`. REQ-ARG-002 exige que
 * « deux livraisons d'un même `eventId` [...] produisent exactement une ligne ». Un
 * identifiant tiré au hasard à chaque appel rend cette exigence INAPPLICABLE côté
 * producteur : le rejeu d'un même fait après un timeout réseau porterait un
 * identifiant neuf, le récepteur ne verrait aucun doublon, et l'apporteur serait
 * commissionné deux fois. L'idempotence n'est pas une propriété du récepteur seul —
 * elle commence par un identifiant qui décrit le FAIT, pas l'ENVOI.
 *
 * 🔴 LE SECOND PIÈGE, ET POURQUOI PAS UN UUID v5. La solution canonique d'un
 * identifiant déterministe est l'UUID v5 (SHA-1 d'un espace de noms). Mais le schéma
 * publié par Partners ne contraint pas « un uuid » : il contraint le motif
 * `[0-9a-f]{8}-...-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-...` — REQ-INT-003 écrit « uuid v4 »,
 * et le motif contrôle le chiffre de version ET le nibble de variante. Un v5 porte un
 * « 5 » à cette position : il serait refusé en 422, donc passé en `gave_up`. On dérive
 * donc les 128 bits d'un SHA-256 de la clé de fait, puis on FORCE les deux nibbles que
 * le contrat impose. La valeur est déterministe, uniformément répartie, et conforme au
 * motif que l'autre dépôt vérifie réellement.
 */
export function identifiantEvenement(type: string, cleDeFait: string): string {
  // Le type entre dans l'empreinte : le même sujet sous deux types est deux faits.
  const hex = createHash("sha256").update(`${type} ${cleDeFait}`, "utf8").digest("hex");

  const octets = hex.slice(0, 32).split("");
  octets[12] = "4"; // chiffre de version — exigé par le motif du contrat
  const variante = "89ab"[parseInt(hex[32] ?? "0", 16) % 4] ?? "8";
  octets[16] = variante; // nibble de variante — exigé par le motif du contrat
  const u = octets.join("");

  return `${u.slice(0, 8)}-${u.slice(8, 12)}-${u.slice(12, 16)}-${u.slice(16, 20)}-${u.slice(20, 32)}`;
}

/**
 * L'enveloppe d'un fait.
 *
 * REFUSE un type hors du contrat v1 plutôt que de l'émettre : `additionalProperties:
 * false` et l'énumération fermée font qu'un type inconnu vaut 422 chez le récepteur,
 * et REQ-INT-003 passe alors la ligne en `gave_up`. Lever ici coûte un incident visible
 * en développement ; émettre coûte une ligne perdue en production.
 */
export function enveloppe(fait: Fait): EnveloppeEvenement {
  if (!estDansLeContratV1(fait.type)) {
    throw new Error(
      `[partners] « ${fait.type} » n'est pas dans le contrat v1 (${TYPES_EVENEMENT.join(", ")}). ` +
        "Voir `HORS_CONTRAT_V1` : ce type est construit et testé, mais son émission attend " +
        "que Partners republie une schema_version qui le porte (lockstep, partners/ADR-0008).",
    );
  }

  return {
    event_id: identifiantEvenement(fait.type, fait.cleDeFait),
    event_type: fait.type,
    schema_version: SCHEMA_VERSION,
    occurred_at: fait.occurredAt.toISOString(),
    emitted_at: new Date().toISOString(),
    producer: PRODUCTEUR,
    subject_ref: fait.sujet,
    sequence: fait.sequence,
    payload: fait.payload,
  };
}

/**
 * La signature d'un envoi : HMAC-SHA256 sur « horodatage.corps exact »
 * (REQ-SEC-010, qui absorbe REQ-QA-008).
 *
 * Le corps signé est la chaîne EXACTE envoyée sur le fil — jamais un objet
 * re-sérialisé de l'autre côté, sinon la moindre différence d'ordre de clés
 * invaliderait la signature d'un message parfaitement valide.
 *
 * L'horodatage est DANS la signature : sans lui, une requête légitime interceptée
 * resterait rejouable pour l'éternité. C'est lui qui donne son sens à la fenêtre de
 * 300 s que le récepteur applique.
 *
 * 🔴 POURQUOI L'HORODATAGE EST CONTRAINT AUX CHIFFRES, et pourquoi ce n'est pas du
 * zèle. Le schéma « t.corps » n'est PAS injectif si `t` peut porter un point :
 *
 *     t = "1"     corps = "23.4"   ->  "1.23.4"
 *     t = "1.23"  corps = "4"      ->  "1.23.4"
 *
 * Deux messages différents, une seule signature. Un attaquant qui contrôle le début
 * du corps peut alors déplacer la frontière entre l'horodatage et le corps, et faire
 * accepter un corps qu'il a réécrit avec une signature légitime — la fenêtre de 300 s
 * regardant un horodatage qui n'est plus celui qui a été signé. Trouvé par le
 * contre-témoin de `enveloppe.spec.ts`, qui a d'abord échoué contre ce fichier.
 *
 * La parade n'est pas de changer le séparateur (le contrat l'écrit) mais de rendre la
 * découpe non ambiguë : un horodatage de chiffres décimaux ne contient jamais de
 * point, donc le PREMIER point est toujours la frontière. La contrainte est portée
 * ici, où elle est vérifiable, plutôt que confiée à la discipline des appelants.
 */
const MOTIF_HORODATAGE = /^[0-9]{1,20}$/;

export function signerCorps(secret: string, horodatage: string, corps: string): string {
  if (!MOTIF_HORODATAGE.test(horodatage)) {
    throw new Error(
      `[partners] horodatage de signature invalide : « ${horodatage} ». Attendu des secondes ` +
        "Unix en chiffres décimaux — sans quoi la découpe « t.corps » devient ambiguë et " +
        "deux messages distincts peuvent porter la même signature.",
    );
  }
  return createHmac("sha256", secret).update(`${horodatage}.${corps}`).digest("hex");
}

/** L'horodatage de signature, dans la seule forme que `signerCorps` accepte. */
export function horodatageSignature(maintenant: Date = new Date()): string {
  return Math.floor(maintenant.getTime() / 1000).toString();
}
