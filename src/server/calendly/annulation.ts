/**
 * Annuler un rendez-vous Calendly depuis NOTRE serveur.
 *
 * ## Ce que la phase 0 a mesuré, et qui gouverne tout ce fichier
 *
 * Le contrat de cet endpoint n'est documenté nulle part de façon utilisable. Il
 * a été établi le 2026-09-01 contre l'API de production, sur deux réservations
 * réelles créées puis annulées — et la mesure a bien failli être perdue, faute
 * d'avoir été écrite ailleurs que dans une conversation. Les trois réponses,
 * telles qu'elles sont revenues :
 *
 * ```
 * POST /scheduled_events/{uuid}/cancellation
 *
 *   {"reason":"…"}  → 400  {"title":"Invalid Argument",
 *                           "message":"The supplied parameters are invalid."}
 *                     ⚠️ ET L'ÉVÉNEMENT RESTE ACTIF
 *   {}              → 201  {"resource":{"canceled_by":"…",
 *                           "canceler_type":"host","reason":null}}
 *   rejeu           → 403  {"title":"Permission Denied",
 *                           "message":"Event is already canceled"}
 * ```
 *
 * **1. 🔴 On n'envoie JAMAIS de motif.** Le champ `reason` fait échouer la
 * requête — et l'annulation n'a alors pas lieu du tout. Ce n'est pas un détail
 * de sérialisation : c'est la différence entre un rendez-vous annulé et un
 * rendez-vous qu'on croit annulé. Le corps est vide, et il doit le rester.
 *
 * **2. 🔑 Le rejeu a sa propre réponse, et c'est un cadeau.** Un lien
 * d'annulation cliqué deux fois est le cas COURANT, pas le cas rare : on le
 * transfère à une assistante, on revient en arrière, le client de messagerie le
 * pré-charge. Calendly le distingue lui-même d'une panne. Aucun registre de
 * jetons consommés n'est donc nécessaire — l'idempotence est fournie par l'API.
 *
 * **3. ⚠️ `canceler_type` vaut `host`.** Un visiteur qui annule depuis une page
 * à nous apparaîtra chez Calendly comme ayant été annulé PAR NOUS, et leur
 * e-mail le dira. C'est une conséquence produit, pas un détail technique.
 *
 * ## 🔴 DEUX 403 QUI NE VEULENT PAS DIRE LA MÊME CHOSE
 *
 * Le rejeu rend 403. Un jeton sans droit d'écriture rend 403 aussi. Les
 * confondre serait coûteux dans les deux sens : traiter une panne de
 * configuration comme un rejeu la rendrait invisible le jour de la mise en
 * service ; traiter un rejeu comme une panne alerterait à chaque lien cliqué
 * deux fois, jusqu'à ce que l'alerte ne soit plus lue.
 *
 * On les sépare sur le message, et le rejeu est examiné EN PREMIER — c'est le
 * cas fréquent, et son message est le plus spécifique.
 *
 * ## On relit avant d'annoncer
 *
 * Même raison que pour la réservation : l'API accepte sans broncher un champ
 * inventé de toutes pièces. Un 201 ne prouve donc pas qu'elle a compris. On
 * relit l'événement et on exige `status === "canceled"` avant de dire quoi que
 * ce soit au visiteur.
 */

import { CALENDLY_API_BASE } from "./api";

/**
 * Ce que l'appelant doit savoir.
 *
 * 🔑 `deja` n'est PAS une erreur. Il porte l'information dont la page a besoin
 * pour écrire la bonne phrase : « c'est annulé » plutôt que « nous venons de
 * l'annuler ». Un booléen unique forcerait à mentir dans un sens ou dans
 * l'autre.
 */
export type ResultatAnnulation =
  | { readonly ok: true; readonly deja: boolean }
  /** L'API se tait. ⚠️ On ne sait PAS si l'annulation a eu lieu. */
  | { readonly ok: false; readonly raison: "silence" }
  /** 201 rendu, mais la relecture ne confirme pas l'annulation. */
  | { readonly ok: false; readonly raison: "non_confirme" }
  /** Refus explicite de l'API. */
  | { readonly ok: false; readonly raison: "refus"; readonly detail: string }
  /**
   * 🔴 Le jeton n'a pas le droit d'écrire. Panne de configuration, pas panne du
   * visiteur — et elle touche TOUT LE MONDE. Voir `reservation.ts`, où la même
   * raison existe pour la création : rangée dans `refus`, elle se déguiserait
   * en cas limite pendant que plus personne ne peut annuler.
   */
  | {
      readonly ok: false;
      readonly raison: "portee_manquante";
      readonly porteesRequises: string | null;
    }
  | { readonly ok: false; readonly raison: "non_configure" };

const TIMEOUT_MS = 8_000;

function texte(o: unknown, cle: string): string | null {
  if (typeof o !== "object" || o === null) return null;
  const v = (o as Record<string, unknown>)[cle];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Reconnaît le rejeu — un événement déjà annulé.
 *
 * Exporté pour être éprouvé seul : c'est la distinction la plus coûteuse à se
 * tromper de tout le fichier, et elle tient à la lecture d'un message.
 */
export function estDejaAnnule(detail: string): boolean {
  return /already\s+canceled|already\s+cancelled/i.test(detail);
}

/** Reconnaît un refus de PORTÉE, par opposition à un refus de la demande. */
export function estUnePorteeManquante(status: number, detail: string, corps: unknown): boolean {
  if (estDejaAnnule(detail)) return false; // le rejeu est aussi un 403
  if (status !== 403) return false;
  if (/scope|permission denied|insufficient/i.test(detail)) return true;
  return Array.isArray((corps as Record<string, unknown> | null)?.["required_scopes"]);
}

function porteesDe(corps: unknown): string | null {
  const direct = texte(corps, "required_scopes");
  if (direct) return direct;
  const tableau = (corps as Record<string, unknown> | null)?.["required_scopes"];
  return Array.isArray(tableau) ? tableau.join(", ") : null;
}

/**
 * Annule le rendez-vous.
 *
 * Ne lève jamais : chaque panne a une réponse utile, et l'appelant est une
 * action de formulaire où une exception deviendrait un écran d'erreur.
 *
 * @param eventUri URI d'API de l'événement, ou son seul identifiant.
 */
export async function annulerRendezVous(eventUri: string): Promise<ResultatAnnulation> {
  const token = process.env.CALENDLY_API_TOKEN?.trim();
  if (!token) return { ok: false, raison: "non_configure" };

  const uuid = eventUri.split("/").filter(Boolean).pop() ?? "";
  if (!/^[a-f0-9-]{10,64}$/i.test(uuid)) {
    return { ok: false, raison: "refus", detail: `identifiant illisible : « ${uuid} »` };
  }
  const base = `${CALENDLY_API_BASE}/scheduled_events/${uuid}`;

  let res: Response;
  try {
    res = await fetch(`${base}/cancellation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // 🔴 CORPS VIDE, ET C'EST MESURÉ. Ajouter `reason` fait rendre un 400 et
      // l'événement reste ACTIF — donc une annulation qu'on croirait faite.
      body: "{}",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    // Délai dépassé, DNS, TLS : on ne sait pas si l'annulation a eu lieu.
    return { ok: false, raison: "silence" };
  }

  if (res.status >= 500) return { ok: false, raison: "silence" };

  let corps: unknown = null;
  try {
    corps = await res.json();
  } catch {
    corps = null;
  }

  if (!res.ok) {
    // ⚠️ Le CORPS se lit AVANT toute décision. Ce dépôt a perdu trois
    // allers-retours en juillet 2026 sur un 403 jugé « muet » qui portait
    // `required_scopes` en clair, et la mesure de phase 0 a failli se perdre
    // pour la même raison : on avait décrit un 400 comme silencieux sans avoir
    // lu ce qu'il disait.
    const detail = texte(corps, "message") ?? texte(corps, "title") ?? `HTTP ${res.status}`;

    // Le rejeu D'ABORD : c'est le cas fréquent, et son message est le plus
    // spécifique des deux 403.
    if (estDejaAnnule(detail)) return { ok: true, deja: true };

    if (estUnePorteeManquante(res.status, detail, corps)) {
      return { ok: false, raison: "portee_manquante", porteesRequises: porteesDe(corps) };
    }
    return { ok: false, raison: "refus", detail };
  }

  // 🔴 ON RELIT. Un 201 ne prouve pas que l'API a compris : elle accepte sans
  // broncher un champ inventé de toutes pièces (mesuré, cf. `reservation.ts`).
  const confirme = await statutEstAnnule(base, token);
  if (confirme === null) return { ok: false, raison: "silence" };
  if (!confirme) return { ok: false, raison: "non_confirme" };

  return { ok: true, deja: false };
}

/**
 * Relit le statut de l'événement.
 *
 * Rend `null` quand la relecture elle-même échoue — à distinguer de `false`,
 * qui veut dire « relu, et pas annulé ». Confondre les deux ferait annoncer une
 * annulation qui n'a pas eu lieu, ou l'inverse.
 */
async function statutEstAnnule(base: string, token: string): Promise<boolean | null> {
  try {
    const res = await fetch(base, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const corps: unknown = await res.json();
    const ressource = (corps as Record<string, unknown> | null)?.["resource"] ?? corps;
    const statut = texte(ressource, "status");
    return statut === null ? null : statut === "canceled";
  } catch {
    return null;
  }
}
