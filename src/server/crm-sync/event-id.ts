import { createHash } from "node:crypto";

/**
 * `event_id` DÉTERMINISTES (lot L4-S, 2026-09-25).
 *
 * L'outbox tire d'ordinaire un UUID aléatoire par événement (`newCrmEventId`).
 * C'est juste pour un geste qui n'a lieu qu'une fois ; c'est FAUX pour un
 * événement qu'on peut vouloir émettre deux fois par deux chemins — le geste
 * en direct (clic sur le lien du guide) ET la commande de rattrapage. Deux
 * UUID aléatoires feraient deux lignes d'outbox, donc deux activités au CRM.
 *
 * Ici l'identifiant est un UUID v5 (RFC 4122, SHA-1) calculé depuis un NOM
 * stable (`lead_magnet_requested:<id de la demande>`). Même nom ⇒ même
 * identifiant, sur n'importe quelle machine, à n'importe quel moment :
 *   · côté site, `crm_sync_outbox.event_id` est UNIQUE → la seconde écriture
 *     est refusée par la base (et `enqueue` le tait : ce n'est pas une perte) ;
 *   · côté CRM, `activities.external_ref = site:event:<event_id>` → `noop_idempotent`.
 *
 * Le nom ne porte JAMAIS d'adresse : seulement des identifiants de lignes et
 * des horodatages. L'identifiant voyage au CRM et dans les journaux.
 */

/**
 * Espace de noms propre à la synchro site → CRM. Valeur arbitraire, FIGÉE :
 * la changer changerait tous les identifiants, et un rattrapage relancé après
 * coup créerait des doublons au lieu de s'arrêter.
 */
export const ESPACE_EVENT_ID_CRM = "5b0f3c2e-8d1a-4c6b-9e7f-2a4d6c8e0b13";

function octetsUuid(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

/** UUID v5 de `nom` dans l'espace de la synchro CRM. */
export function eventIdDeterministe(nom: string): string {
  const empreinte = createHash("sha1")
    .update(Buffer.concat([octetsUuid(ESPACE_EVENT_ID_CRM), Buffer.from(nom, "utf8")]))
    .digest();
  const o = Buffer.from(empreinte.subarray(0, 16));
  o[6] = (o[6]! & 0x0f) | 0x50; // version 5
  o[8] = (o[8]! & 0x3f) | 0x80; // variante RFC 4122
  const h = o.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Demande du guide : UNE entrée au CRM par demande, au premier clic humain. */
export function eventIdDemandeGuide(demandeId: string): string {
  return eventIdDeterministe(`lead_magnet_requested:${demandeId}`);
}

/**
 * Inscription à la lettre : une par (abonné, date d'inscription). Une
 * réinscription après un désabonnement porte une autre date, donc un autre
 * identifiant — c'est un nouvel événement, qui doit passer.
 */
export function eventIdInscriptionLettre(abonneId: string, inscritLe: Date): string {
  return eventIdDeterministe(`newsletter_optin:${abonneId}:${inscritLe.toISOString()}`);
}

/** Rebond dur constaté sur un abonné, à un instant donné. */
export function eventIdRebondDur(abonneId: string, quand: Date): string {
  return eventIdDeterministe(`email_hard_bounced:${abonneId}:${quand.toISOString()}`);
}
