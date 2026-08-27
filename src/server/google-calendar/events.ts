/**
 * Lecture et écriture des événements de l'agenda Google (2026-08-26).
 *
 * Trois opérations, pas une de plus : lister une fenêtre, poser une
 * indisponibilité, la retirer. Tout le reste (déplacer, inviter, récurrence
 * complexe) se fait dans Google Agenda, qui le fait mieux.
 *
 * 🔴 LE PIÈGE QUI A COÛTÉ DEUX ALLERS-RETOURS LE 2026-08-26 — LE BATTEMENT.
 * Calendly refuse un créneau qui touche un événement occupé, sans laisser de
 * marge. Mesuré : un événement 15:00–15:30 ferme AUSSI le créneau de 14:30 (qui
 * finit à 15:00) et celui de 15:30 (qui commence à 15:30). Conséquence pratique,
 * contre-intuitive et coûteuse si on l'ignore :
 *
 *     pour garder le créneau de 11:30 et fermer tout à partir de 12:00,
 *     il faut poser le blocage à 12:30 — PAS à 12:00.
 *
 * Un blocage posé à midi pile emporte la matinée avec lui. `debutBlocageApres()`
 * fait ce calcul une fois pour toutes, pour que l'interface puisse parler en
 * langage humain (« ferme après 12 h ») sans que l'utilisateur ait à connaître
 * ce détail — ni à le redécouvrir en constatant qu'il lui manque un créneau.
 */

import { getGoogleAccessToken, readGoogleCalendarConfig } from "./auth";

const API_BASE = "https://www.googleapis.com/calendar/v3";

/** Aucun appel d'agenda ne bloque un rendu plus longtemps que ça. */
const TIMEOUT_MS = 8_000;

/**
 * Plafond d'événements ramenés par fenêtre.
 *
 * 250 est le maximum accepté par l'API. Une semaine chargée en compte quelques
 * dizaines : la borne ne mord jamais en pratique, mais son dépassement est
 * journalisé plutôt que silencieux — une page qui affiche 250 rendez-vous sur
 * 300 se lit exactement comme une page complète.
 */
const MAX_RESULTS = 250;

/**
 * Marge minimale, en minutes, entre un blocage et le dernier créneau conservé.
 *
 * ⚠️ VALEUR DÉRIVÉE D'UNE MESURE, PAS D'UNE DOCUMENTATION. Calendly n'expose
 * son réglage de battement ni dans l'API v2 ni dans la réponse publique de
 * réservation. Il faut donc l'encadrer par observation — et l'encadrement dépend
 * du PAS de la grille, ce qui a d'abord conduit à une valeur trop large :
 *
 *   · Première mesure (2026-08-26, rendez-vous de 30 min, grille de 30 min) :
 *     écart de 0 refusé, écart de 30 accepté. Aucun écart intermédiaire n'était
 *     OBSERVABLE — la grille n'en produisait pas. Conclusion prudente : 30.
 *   · Seconde mesure, le même jour, après le passage à 45 min sur une grille
 *     restée à 30 : les créneaux finissent désormais à :15 et :45, donc des
 *     écarts de 15 minutes existent. Constaté sur trois journées réelles
 *     (01/09 et 22/09) : un créneau séparé de 15 minutes d'un événement est
 *     ACCEPTÉ. Le battement vaut donc au plus 15.
 *
 * On retient 15, et ce n'est pas un arrondi prudent : c'est la borne HAUTE
 * mesurée, et c'est exactement ce qu'il faut. Pour garantir qu'un créneau
 * survive, il suffit d'un écart ≥ battement réel ; 15 le garantit puisque le
 * battement lui est inférieur ou égal. Pour garantir que le suivant tombe, il
 * suffit d'un écart nul, refusé dans tous les cas. Garder 30 coûtait un créneau
 * réservable par journée fermée, pour rien.
 *
 * 🔑 Si Will change le battement dans Calendly, c'est CETTE constante qu'il faut
 * corriger, et le symptôme sera : « je ferme après midi et je perds aussi le
 * créneau d'avant ». La re-mesurer demande une grille dont le pas est plus fin
 * que le battement soupçonné — sinon on ne mesure que le pas.
 */
export const BATTEMENT_CALENDLY_MINUTES = 15;

export type GoogleEventsFailure =
  | "not_configured"
  | "bad_private_key"
  | "rejected"
  /** Le compte de service n'a pas accès à cet agenda : partage non fait, ou en lecture seule. */
  | "forbidden"
  | "api_error";

export interface GoogleEvent {
  readonly id: string;
  readonly summary: string;
  /** Null pour un événement « journée entière ». */
  readonly startIso: string | null;
  readonly endIso: string | null;
  readonly allDay: boolean;
  /** `false` quand l'événement est marqué « disponible » : il ne bloque rien. */
  readonly busy: boolean;
  readonly location: string | null;
  readonly description: string | null;
  /**
   * `true` quand l'événement porte la signature d'une réservation Calendly.
   *
   * Calendly appose « Alimenté par Calendly.com » dans la description de chaque
   * événement qu'il crée. C'est le seul marqueur fiable : l'organisateur est
   * Will lui-même, et le titre suit un format libre (« Prénom Nom et Williams »).
   * Sert à ne pas afficher deux fois le même rendez-vous, puisque la base en
   * détient déjà une version bien plus riche (téléphone, réponses aux questions,
   * liens d'annulation).
   */
  readonly fromCalendly: boolean;
  /** `true` quand l'événement a été posé depuis la console. */
  readonly fromConsole: boolean;
  readonly htmlLink: string | null;
}

export type GoogleEventsResult =
  | { readonly ok: true; readonly events: readonly GoogleEvent[]; readonly tronque: boolean }
  | { readonly ok: false; readonly reason: GoogleEventsFailure; readonly detail?: string };

export type GoogleWriteResult =
  | { readonly ok: true; readonly id: string; readonly htmlLink: string | null }
  | { readonly ok: false; readonly reason: GoogleEventsFailure; readonly detail?: string };

/**
 * Marqueur apposé dans la description des blocages créés ici.
 *
 * Il rend l'opération RÉVERSIBLE et lisible : on sait quels événements viennent
 * de la console, on peut les lister et les retirer, et Will les reconnaît dans
 * son agenda sans avoir à deviner. Un blocage anonyme serait indistinguable
 * d'un vrai rendez-vous — et personne n'ose supprimer ce qu'il ne reconnaît pas.
 */
export const MARQUEUR_CONSOLE = "[axion-console]";

/** Signature laissée par Calendly dans les événements qu'il crée. */
const SIGNATURE_CALENDLY = "Alimenté par Calendly.com";

function journaliser(message: string, contexte: Record<string, unknown>): void {
  console.warn(`[google-calendar] ${message}`, JSON.stringify(contexte));
}

/**
 * Construit un échec en OMETTANT `detail` quand il est absent.
 *
 * Le dépôt tourne en `exactOptionalPropertyTypes` : `{ detail: undefined }` et
 * `{}` n'y sont pas la même chose, et poser explicitement `undefined` sur une
 * propriété optionnelle est refusé. Ce constructeur évite d'écrire le même
 * ternaire à chaque retour — et surtout d'être tenté de relâcher le type pour
 * faire taire le compilateur.
 */
function echec(
  reason: GoogleEventsFailure,
  detail?: string,
): { readonly ok: false; readonly reason: GoogleEventsFailure; readonly detail?: string } {
  return detail === undefined ? { ok: false, reason } : { ok: false, reason, detail };
}

/**
 * Traduit un statut HTTP en cause exploitable.
 *
 * 403 mérite son propre cas : c'est de loin l'échec le plus probable à la mise
 * en service, et il a une cause unique et actionnable — l'agenda n'a pas été
 * partagé avec l'adresse du compte de service, ou l'a été en lecture seule. Le
 * confondre avec « api_error » enverrait chercher une panne là où il manque un
 * clic dans les réglages de partage.
 */
function raisonDepuisStatut(status: number): GoogleEventsFailure {
  if (status === 401) return "rejected";
  if (status === 403 || status === 404) return "forbidden";
  return "api_error";
}

async function appeler(
  chemin: string,
  init: RequestInit & { readonly token: string },
): Promise<
  { ok: true; body: unknown } | { ok: false; reason: GoogleEventsFailure; detail: string }
> {
  const { token, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${chemin}`, {
      ...rest,
      headers: {
        ...(rest.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      reason: "api_error",
      detail: `fetch:${e instanceof Error ? e.name : String(e)}`,
    };
  }

  // 204 sur une suppression : pas de corps à lire, et `json()` lèverait.
  if (res.status === 204) return { ok: true, body: null };

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    if (res.ok) return { ok: true, body: null };
    return { ok: false, reason: raisonDepuisStatut(res.status), detail: `http_${res.status}` };
  }

  if (!res.ok) {
    // Google renseigne `error.message` avec des phrases utiles (« Not Found »,
    // « Request had insufficient authentication scopes »). On les garde.
    const rec = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const err =
      typeof rec["error"] === "object" && rec["error"] !== null
        ? (rec["error"] as Record<string, unknown>)
        : {};
    const msg = typeof err["message"] === "string" ? err["message"] : "";
    return {
      ok: false,
      reason: raisonDepuisStatut(res.status),
      detail: `http_${res.status}${msg ? ` · ${msg}` : ""}`.slice(0, 300),
    };
  }

  return { ok: true, body };
}

function texte(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function normaliser(raw: unknown): GoogleEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Record<string, unknown>;
  const id = texte(e["id"]);
  if (!id) return null;

  const start =
    typeof e["start"] === "object" && e["start"] !== null
      ? (e["start"] as Record<string, unknown>)
      : {};
  const end =
    typeof e["end"] === "object" && e["end"] !== null ? (e["end"] as Record<string, unknown>) : {};

  const startDateTime = texte(start["dateTime"]);
  const endDateTime = texte(end["dateTime"]);
  const allDay = startDateTime === null;

  const description = texte(e["description"]);

  return {
    id,
    summary: texte(e["summary"]) ?? "(sans titre)",
    startIso: startDateTime,
    endIso: endDateTime,
    allDay,
    // `transparency: "transparent"` = « disponible » : l'événement figure dans
    // l'agenda mais ne bloque RIEN, ni Calendly ni la vue d'occupation. Mesuré
    // le 2026-08-26 sur un rendez-vous annulé qui portait ce drapeau : Calendly
    // laissait bien le créneau ouvert. L'afficher comme occupé serait un
    // mensonge visuel.
    busy: texte(e["transparency"]) !== "transparent",
    location: texte(e["location"]),
    description,
    fromCalendly: description?.includes(SIGNATURE_CALENDLY) ?? false,
    fromConsole: description?.includes(MARQUEUR_CONSOLE) ?? false,
    htmlLink: texte(e["htmlLink"]),
  };
}

/**
 * Liste les événements d'une fenêtre, triés par début.
 *
 * `singleEvents` développe les séries récurrentes en occurrences réelles — sans
 * lui, une série hebdomadaire ne renverrait qu'une ligne, portant sa date de
 * départ, et la vue d'un jour donné manquerait ses occurrences. C'est le
 * paramètre qu'on oublie et dont l'absence produit un agenda faussement vide.
 */
export async function listerEvenements(
  debutIso: string,
  finIso: string,
): Promise<GoogleEventsResult> {
  const cfg = readGoogleCalendarConfig();
  if (!cfg) return { ok: false, reason: "not_configured" };

  const auth = await getGoogleAccessToken();
  if (!auth.ok) {
    if (auth.reason !== "not_configured") {
      journaliser("authentification refusée", { reason: auth.reason, detail: auth.detail });
    }
    return echec(auth.reason, auth.detail);
  }

  const params = new URLSearchParams({
    timeMin: debutIso,
    timeMax: finIso,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(MAX_RESULTS),
    timeZone: "Europe/Paris",
  });

  const res = await appeler(`/calendars/${encodeURIComponent(cfg.calendarId)}/events?${params}`, {
    method: "GET",
    token: auth.token,
  });
  if (!res.ok) {
    journaliser("lecture de l'agenda en échec", { reason: res.reason, detail: res.detail });
    return { ok: false, reason: res.reason, detail: res.detail };
  }

  const rec =
    typeof res.body === "object" && res.body !== null ? (res.body as Record<string, unknown>) : {};
  const items = Array.isArray(rec["items"]) ? rec["items"] : [];
  const events = items.map(normaliser).filter((e): e is GoogleEvent => e !== null);

  // Une troncature muette se lit comme une semaine peu chargée. On le dit.
  const tronque = items.length >= MAX_RESULTS;
  if (tronque) {
    journaliser("fenêtre TRONQUÉE par le plafond — des événements manquent", {
      debutIso,
      finIso,
      plafond: MAX_RESULTS,
    });
  }

  return { ok: true, events, tronque };
}

/**
 * Instant à partir duquel poser un blocage pour que `dernierCreneauIso` reste
 * réservable.
 *
 * C'est la traduction du battement décrit en tête de fichier : le blocage doit
 * commencer au moins `BATTEMENT_CALENDLY_MINUTES` après la FIN du dernier
 * créneau qu'on veut garder. L'interface parle donc en « je ferme après X »,
 * et cette fonction rend l'heure réelle à écrire dans l'agenda.
 *
 * @param finDernierCreneau - fin du dernier créneau conservé (ex. 12:00 pour
 *   garder celui de 11:30 d'une durée de 30 min).
 */
export function debutBlocageApres(finDernierCreneau: Date): Date {
  return new Date(finDernierCreneau.getTime() + BATTEMENT_CALENDLY_MINUTES * 60_000);
}

export interface PoserIndisponibiliteInput {
  readonly titre: string;
  readonly debut: Date;
  readonly fin: Date;
  /** Ajouté à la description, sous le marqueur. Facultatif. */
  readonly note?: string;
}

/**
 * Crée un événement occupé — donc ferme Calendly sur la plage, en ~11 secondes.
 *
 * Ne throw jamais. Un échec revient à l'appelant avec sa cause, pour que
 * l'interface dise ce qui s'est passé au lieu d'afficher un succès imaginaire :
 * un blocage qu'on croit posé et qui ne l'est pas produit exactement le
 * problème qu'on voulait éviter — une réservation sur un créneau occupé.
 */
export async function poserIndisponibilite(
  input: PoserIndisponibiliteInput,
): Promise<GoogleWriteResult> {
  const cfg = readGoogleCalendarConfig();
  if (!cfg) return { ok: false, reason: "not_configured" };

  const auth = await getGoogleAccessToken();
  if (!auth.ok) return echec(auth.reason, auth.detail);

  const description = [
    MARQUEUR_CONSOLE,
    "Indisponibilité posée depuis la console Axion-IA. Elle ferme la réservation",
    "en ligne sur cette plage. Supprimer cet événement la rouvre.",
    input.note ? `\n${input.note}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const res = await appeler(`/calendars/${encodeURIComponent(cfg.calendarId)}/events`, {
    method: "POST",
    token: auth.token,
    body: JSON.stringify({
      summary: input.titre,
      description,
      start: { dateTime: input.debut.toISOString(), timeZone: "Europe/Paris" },
      end: { dateTime: input.fin.toISOString(), timeZone: "Europe/Paris" },
      // `opaque` = occupé. C'est CE champ qui fait fermer Calendly ; un
      // événement `transparent` s'afficherait sans rien bloquer.
      transparency: "opaque",
    }),
  });

  if (!res.ok) {
    journaliser("création d'indisponibilité en échec", {
      reason: res.reason,
      detail: res.detail,
      debut: input.debut.toISOString(),
    });
    return { ok: false, reason: res.reason, detail: res.detail };
  }

  const rec =
    typeof res.body === "object" && res.body !== null ? (res.body as Record<string, unknown>) : {};
  return { ok: true, id: texte(rec["id"]) ?? "", htmlLink: texte(rec["htmlLink"]) };
}

/**
 * Supprime un événement — utilisé pour retirer une indisponibilité posée ici.
 *
 * ⚠️ L'appelant DOIT vérifier que l'événement porte `MARQUEUR_CONSOLE` avant
 * d'appeler : la console n'a aucune raison de supprimer un vrai rendez-vous, et
 * une suppression d'agenda ne se rattrape pas. La garde est côté appelant parce
 * que c'est lui qui détient déjà l'événement lu.
 */
export async function retirerEvenement(
  eventId: string,
): Promise<
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: GoogleEventsFailure; readonly detail?: string }
> {
  const cfg = readGoogleCalendarConfig();
  if (!cfg) return { ok: false, reason: "not_configured" };

  const auth = await getGoogleAccessToken();
  if (!auth.ok) return echec(auth.reason, auth.detail);

  const res = await appeler(
    `/calendars/${encodeURIComponent(cfg.calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", token: auth.token },
  );
  if (!res.ok) {
    journaliser("suppression en échec", { reason: res.reason, detail: res.detail, eventId });
    return { ok: false, reason: res.reason, detail: res.detail };
  }
  return { ok: true };
}
