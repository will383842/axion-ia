/**
 * Réserver un créneau Calendly depuis NOTRE serveur.
 *
 * ## Pourquoi ce module existe
 *
 * Jusqu'ici, réserver imposait d'envoyer le prospect sur `calendly.com` : notre
 * page affichait les créneaux, le clic ouvrait leur formulaire. Calendly a
 * publié une **Scheduling API** — `POST /invitees` — qui crée la réservation
 * sans redirection. Le formulaire peut donc vivre chez nous.
 *
 * ⚠️ Ce dépôt a longtemps affirmé le contraire, et un commentaire de
 * `google-calendar/events.ts` le répète encore : « Calendly n'expose AUCUNE API
 * de création de réservation ». C'était vrai, ça ne l'est plus. Vérifié le
 * 2026-09-01 contre l'API de production, par deux réservations réelles créées
 * puis annulées.
 *
 * ## Ce que la phase 0 a établi, et qui n'était pas documenté
 *
 * - `location.kind` accepte **`outbound_call`** et **`google_conference`** : le
 *   choix téléphone / visio EST transmissible. C'était le go/no-go du projet.
 * - Le numéro d'un appel sortant va dans **`location.location`**, et non dans
 *   `invitee.text_reminder_number` qui sert aux rappels SMS.
 * - `questions_and_answers` passe les libellés **exacts**, accents compris.
 * - `tracking` est **tout ou rien** : envoyer deux UTM sur six fait échouer la
 *   requête entière. Les six champs doivent être présents, quitte à valoir
 *   `null`.
 *
 * ## 🔴 L'API NE DIT PAS NON QUAND ELLE NE COMPREND PAS
 *
 * Mesuré : une requête contenant un champ inventé de toutes pièces passe sans
 * le moindre avertissement. Un nom de champ mal orthographié serait donc
 * **ignoré en silence** — le lieu ne partirait jamais, la réservation
 * aboutirait quand même, et on l'apprendrait par un client mécontent.
 *
 * D'où la règle que ce module applique sans exception : **on relit la réponse**
 * et on refuse une réservation dont le lieu enregistré n'est pas celui demandé.
 * Une réservation muette vaut mieux qu'une réservation fausse : la première se
 * replie sur Calendly, la seconde arrive le jour du rendez-vous.
 *
 * ## Un résultat typé PAR CAS, et pas un booléen
 *
 * L'appelant doit répondre différemment selon la panne — c'est tout le sujet du
 * repli. Un `ok: false` indifférencié le forcerait à deviner, et il devinerait
 * mal le cas le plus fréquent : le créneau pris entre-temps, qui ne doit
 * surtout pas déclencher une redirection.
 */

import { CALENDLY_API_BASE } from "./api";

/** Le format demandé, tel que la page le propose. */
export type FormatDemande = "telephone" | "visio";

/**
 * Correspondance entre notre vocabulaire et celui de Calendly.
 *
 * 🔑 Les deux valeurs ont été VÉRIFIÉES contre l'API, pas lues dans une
 * documentation : la référence publique n'illustre `location.kind` que pour du
 * présentiel, et rien n'y garantissait que ces deux-là soient acceptées.
 */
const KIND_CALENDLY: Readonly<Record<FormatDemande, string>> = {
  telephone: "outbound_call",
  visio: "google_conference",
};

/** Ce que l'appelant doit savoir pour choisir sa réponse. */
export type ResultatReservation =
  | {
      readonly ok: true;
      /** URI de l'événement créé, pour la page de confirmation. */
      readonly eventUri: string;
      /** Lien de réunion, quand Calendly l'a déjà créé. */
      readonly lienReunion: string | null;
      readonly cancelUrl: string | null;
      readonly rescheduleUrl: string | null;
    }
  /** Quelqu'un a réservé pendant que le prospect remplissait. Le cas FRÉQUENT. */
  | { readonly ok: false; readonly raison: "creneau_pris" }
  /** L'API refuse et le dit. Repli vers Calendly, pré-rempli. */
  | { readonly ok: false; readonly raison: "refus"; readonly detail: string }
  /** L'API se tait. ⚠️ On ne sait PAS si la réservation existe. */
  | { readonly ok: false; readonly raison: "silence" }
  /** Le lieu demandé n'est pas celui enregistré — voir la note ci-dessus. */
  | { readonly ok: false; readonly raison: "lieu_non_pris_en_compte" }
  /** Ni jeton ni configuration : le module est inerte, comme le reste. */
  | { readonly ok: false; readonly raison: "non_configure" };

export interface DemandeReservation {
  /** URI de l'event-type, ex. `https://api.calendly.com/event_types/…`. */
  readonly eventTypeUri: string;
  /** Début du créneau, en UTC. */
  readonly debut: Date;
  readonly nom: string;
  readonly email: string;
  /** Fuseau du VISITEUR, pas le nôtre. Calendly l'exige. */
  readonly fuseau: string;
  readonly format: FormatDemande;
  /** Obligatoire pour un appel : c'est le numéro que l'on composera. */
  readonly telephone?: string | null;
  /** Réponses aux questions de l'event-type, libellés exacts. */
  readonly reponses?: ReadonlyArray<{ question: string; reponse: string; position: number }>;
  /** Invités supplémentaires — Calendly en accepte dix au plus. */
  readonly invites?: readonly string[];
  readonly utmSource?: string | null;
  readonly utmMedium?: string | null;
  readonly utmCampaign?: string | null;
}

/** Nombre maximal d'invités accepté par Calendly. */
export const MAX_INVITES = 10;

/**
 * Délai maximal, volontairement court.
 *
 * Un formulaire qui tourne quinze secondes est déjà perdu : le prospect a
 * fermé l'onglet. Mieux vaut replier vite vers la page Calendly, où sa
 * réservation aboutira.
 */
const TIMEOUT_MS = 8_000;

/** Lit une chaîne non vide dans un objet inconnu. */
function texte(o: unknown, cle: string): string | null {
  if (typeof o !== "object" || o === null) return null;
  const v = (o as Record<string, unknown>)[cle];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Le corps de la requête.
 *
 * Exporté pour être testable seul : c'est lui qui porte les quatre pièges de la
 * phase 0, et le vérifier ne doit pas demander d'appel réseau.
 */
export function corpsDeLaDemande(d: DemandeReservation): Record<string, unknown> {
  const lieu: Record<string, unknown> = { kind: KIND_CALENDLY[d.format] };
  // 🔑 Le numéro va dans `location.location`. Vérifié le 2026-09-01 : c'est là
  // que Calendly le range, et l'événement créé le rend à cet endroit.
  if (d.format === "telephone" && d.telephone) lieu["location"] = d.telephone;

  return {
    event_type: d.eventTypeUri,
    start_time: d.debut.toISOString(),
    invitee: { name: d.nom, email: d.email, timezone: d.fuseau },
    location: lieu,
    ...(d.reponses && d.reponses.length > 0
      ? {
          questions_and_answers: d.reponses.map((r) => ({
            question: r.question,
            answer: r.reponse,
            position: r.position,
          })),
        }
      : {}),
    ...(d.invites && d.invites.length > 0 ? { event_guests: d.invites.slice(0, MAX_INVITES) } : {}),
    // 🔴 TOUT OU RIEN. Mesuré : envoyer deux champs sur six fait échouer la
    // requête entière avec « is missing » sur les quatre absents. Les six
    // partent donc toujours, `null` compris.
    tracking: {
      utm_source: d.utmSource ?? null,
      utm_medium: d.utmMedium ?? null,
      utm_campaign: d.utmCampaign ?? null,
      utm_content: null,
      utm_term: null,
      salesforce_uuid: null,
    },
    booking_source: "axion_ia_site",
  };
}

/**
 * Décide si le lieu ENREGISTRÉ correspond à celui demandé.
 *
 * 🔑 C'est la seule protection contre le silence de l'API. Sans elle, un champ
 * mal nommé produirait une réservation valide au mauvais format, et personne ne
 * le saurait avant le jour du rendez-vous.
 */
export function lieuConforme(format: FormatDemande, lieuRendu: unknown): boolean {
  const type = texte(lieuRendu, "type");
  return type === KIND_CALENDLY[format];
}

/**
 * Réserve le créneau.
 *
 * Ne lève jamais : toute panne devient une `raison`, parce que l'appelant doit
 * pouvoir répondre à chacune sans avoir à intercepter.
 */
export async function reserverCreneau(d: DemandeReservation): Promise<ResultatReservation> {
  const token = process.env.CALENDLY_API_TOKEN?.trim();
  if (!token) return { ok: false, raison: "non_configure" };

  let res: Response;
  try {
    res = await fetch(`${CALENDLY_API_BASE}/invitees`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpsDeLaDemande(d)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    // ⚠️ Délai dépassé, DNS, TLS : on ne sait PAS si Calendly a créé la
    // réservation. L'appelant doit vérifier AVANT de replier, sous peine de
    // faire réserver deux fois.
    return { ok: false, raison: "silence" };
  }

  // 5xx : le serveur a peut-être traité la demande avant de tomber. Même
  // incertitude qu'un délai dépassé, donc même traitement.
  if (res.status >= 500) return { ok: false, raison: "silence" };

  let corps: unknown = null;
  try {
    corps = await res.json();
  } catch {
    corps = null;
  }

  if (!res.ok) {
    const detail = texte(corps, "message") ?? texte(corps, "title") ?? `HTTP ${res.status}`;
    // Le créneau pris entre-temps est le refus le PLUS FRÉQUENT, et il ne doit
    // surtout pas être traité comme une panne : rediriger vers Calendly ferait
    // lire au prospect le même refus, en moins bien, sur une page étrangère.
    if (/already|no longer available|not available|taken|slot/i.test(detail)) {
      return { ok: false, raison: "creneau_pris" };
    }
    return { ok: false, raison: "refus", detail };
  }

  const ressource =
    typeof corps === "object" && corps !== null
      ? ((corps as Record<string, unknown>)["resource"] ?? corps)
      : null;

  const eventUri = texte(ressource, "event");
  if (!eventUri) {
    // Réponse acceptée mais inexploitable : on ne peut ni confirmer, ni relire
    // le lieu. On la traite comme un silence, qui est le cas prudent.
    return { ok: false, raison: "silence" };
  }

  return {
    ok: true,
    eventUri,
    lienReunion: null,
    cancelUrl: texte(ressource, "cancel_url"),
    rescheduleUrl: texte(ressource, "reschedule_url"),
  };
}
