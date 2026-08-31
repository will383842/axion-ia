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
  /**
   * La note libre saisie dans la console, extraite de la description.
   *
   * 🔴 ELLE DOIT REMONTER JUSQU'À L'ÉCRAN, sinon le formulaire de modification
   * s'ouvrirait avec un champ note VIDE et l'enregistrement effacerait la note
   * existante — en silence, puisque rien à l'écran n'aurait signalé sa présence.
   * C'est le genre de perte qu'on ne découvre que le jour où on en a besoin.
   */
  readonly noteConsole: string | null;
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
    noteConsole: extraireNote(description),
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
 * Récupère la note libre d'une description écrite par la console.
 *
 * Structure posée par `composerDescription` : le marqueur et sa phrase, puis
 * `Contact :` / `Téléphone :` s'ils existent, puis une LIGNE VIDE, puis la note.
 * C'est cette ligne vide qui sert de séparateur — tout ce qui la suit est la
 * note, retours à la ligne compris.
 */
function extraireNote(description: string | null): string | null {
  if (!description || !description.includes(MARQUEUR_CONSOLE)) return null;
  const lignes = description.split(SAUT_DE_LIGNE);
  const vide = lignes.findIndex((l, i) => i > 0 && l.trim() === "");
  if (vide === -1) return null;
  const note = lignes
    .slice(vide + 1)
    .join(SAUT_DE_LIGNE)
    .trim();
  return note.length > 0 ? note : null;
}

/** Separateur de lignes des descriptions. */
const SAUT_DE_LIGNE = String.fromCharCode(10);

/**
 * Compose la description d'un événement posé depuis la console.
 *
 * 🔑 LE MARQUEUR VIENT TOUJOURS EN PREMIER, et il n'est jamais facultatif : c'est
 * lui, et lui seul, qui autorise la console à modifier ou supprimer un événement
 * plus tard. Un événement écrit sans marqueur devient intouchable — le contraire
 * d'un service rendu.
 */
function composerDescription(
  phrase: string,
  contact: string | null,
  telephone: string | null,
  note: string | null,
): string {
  const lignes = [`${MARQUEUR_CONSOLE} ${phrase}`];
  if (contact) lignes.push(`Contact : ${contact}`);
  if (telephone) lignes.push(`Téléphone : ${telephone}`);
  if (note) lignes.push("", note);
  return lignes.join(SAUT_DE_LIGNE);
}

export interface CreerRendezVousInput {
  readonly titre: string;
  readonly debut: Date;
  readonly fin: Date;
  readonly contact?: string | null;
  readonly telephone?: string | null;
  /** Note interne. Elle finit dans la description Google — donc sur l'iPhone. */
  readonly note?: string | null;
  /**
   * `colorId` Google — la couleur du format (téléphone / visio).
   *
   * Google n'accepte que ses onze couleurs, désignées par un identifiant ; la
   * table de correspondance est `COULEUR_GOOGLE_CANAL` (`calendly/canal.ts`),
   * calée sur les teintes de la console pour qu'un rendez-vous ait la même
   * couleur des deux côtés.
   */
  readonly couleur?: string | null;
}

/**
 * Crée un VRAI rendez-vous — pas un blocage — depuis la console.
 *
 * POURQUOI C'EST LA MÊME MÉCANIQUE QU'UNE INDISPONIBILITÉ
 * -------------------------------------------------------
 * Un rendez-vous et un blocage ne different, pour Google, que par leur titre et
 * leur description : les deux sont des événements OCCUPÉS, et c'est ce
 * `transparency: "opaque"` qui ferme le créneau Calendly correspondant en une
 * dizaine de secondes. On ne parle donc jamais à Calendly, ici non plus.
 *
 * 🔴 ET C'EST LA SEULE VOIE POSSIBLE. Calendly n'expose AUCUNE API de création
 * de réservation — on ne réserve que par leur page. Passer par l'agenda Google
 * n'est pas un contournement : c'est le seul mécanisme qui existe, et il a
 * l'avantage de tenir les deux bouts d'un coup.
 *
 * ⚠️ L'invité n'est PAS prévenu. Aucun e-mail ne part : l'événement est posé
 * dans l'agenda de Will, pour Will. Si quelqu'un doit être prévenu, c'est un
 * geste humain, séparé et délibéré.
 */
export async function creerRendezVous(input: CreerRendezVousInput): Promise<GoogleWriteResult> {
  const cfg = readGoogleCalendarConfig();
  if (!cfg) return { ok: false, reason: "not_configured" };

  const auth = await getGoogleAccessToken();
  if (!auth.ok) return echec(auth.reason, auth.detail);

  const description = composerDescription(
    "Rendez-vous posé depuis la console Axion-IA. Il ferme la réservation en ligne sur ce créneau.",
    input.contact ?? null,
    input.telephone ?? null,
    input.note ?? null,
  );

  const res = await appeler(`/calendars/${encodeURIComponent(cfg.calendarId)}/events`, {
    method: "POST",
    token: auth.token,
    body: JSON.stringify({
      summary: input.titre,
      description,
      start: { dateTime: input.debut.toISOString(), timeZone: "Europe/Paris" },
      end: { dateTime: input.fin.toISOString(), timeZone: "Europe/Paris" },
      transparency: "opaque",
      // Absent quand le format n'est pas établi : Google retombe alors sur la
      // couleur par défaut de l'agenda. Envoyer une couleur au hasard ferait
      // croire à une information qu'on n'a pas.
      ...(input.couleur ? { colorId: input.couleur } : {}),
    }),
  });

  if (!res.ok) {
    journaliser("création de rendez-vous en échec", {
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

export interface ModifierEvenementInput {
  readonly titre?: string;
  readonly debut?: Date;
  readonly fin?: Date;
  readonly contact?: string | null;
  readonly telephone?: string | null;
  readonly note?: string | null;
  /** Phrase d'en-tête à conserver — dépend du type d'événement modifié. */
  readonly phrase: string;
}

/**
 * Modifie un événement posé depuis la console — horaire, titre ou note.
 *
 * ⚠️ MÊME GARDE QUE LA SUPPRESSION, ET POUR LA MÊME RAISON. L'appelant DOIT
 * avoir vérifié que l'événement porte `MARQUEUR_CONSOLE` avant d'appeler. La
 * console n'a aucune raison de réécrire un vrai rendez-vous client ni un
 * événement personnel : déplacer l'heure d'un rendez-vous que l'invité croit
 * fixé produirait exactement la panne qu'on veut éviter — deux personnes qui
 * n'ont pas la même vérité.
 *
 * On emploie `PATCH` et non `PUT` : les champs non transmis restent intacts,
 * donc on ne détruit pas les invités, les rappels ni la visioconférence d'un
 * événement en n'en changeant que l'heure.
 */
export async function modifierEvenement(
  eventId: string,
  input: ModifierEvenementInput,
): Promise<GoogleWriteResult> {
  const cfg = readGoogleCalendarConfig();
  if (!cfg) return { ok: false, reason: "not_configured" };

  const auth = await getGoogleAccessToken();
  if (!auth.ok) return echec(auth.reason, auth.detail);

  const corps: Record<string, unknown> = {
    description: composerDescription(
      input.phrase,
      input.contact ?? null,
      input.telephone ?? null,
      input.note ?? null,
    ),
  };
  if (input.titre) corps["summary"] = input.titre;
  if (input.debut)
    corps["start"] = { dateTime: input.debut.toISOString(), timeZone: "Europe/Paris" };
  if (input.fin) corps["end"] = { dateTime: input.fin.toISOString(), timeZone: "Europe/Paris" };

  const res = await appeler(
    `/calendars/${encodeURIComponent(cfg.calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", token: auth.token, body: JSON.stringify(corps) },
  );

  if (!res.ok) {
    journaliser("modification d'événement en échec", {
      reason: res.reason,
      detail: res.detail,
      eventId,
    });
    return { ok: false, reason: res.reason, detail: res.detail };
  }

  const rec =
    typeof res.body === "object" && res.body !== null ? (res.body as Record<string, unknown>) : {};
  return { ok: true, id: texte(rec["id"]) ?? eventId, htmlLink: texte(rec["htmlLink"]) };
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

/**
 * Colore, dans l'agenda Google, la réservation Calendly d'un créneau donné.
 *
 * ## Pourquoi ce n'est PAS une entorse à la règle du marqueur console
 *
 * `MARQUEUR_CONSOLE` interdit à la console de modifier ou de supprimer un
 * événement qu'elle n'a pas créé. Cette règle existe pour une raison précise :
 * l'agenda de Will contient sa vie, et une console qui écrit dedans par
 * inadvertance ne se rattrape pas.
 *
 * Cette fonction s'en écarte volontairement, sur trois garanties :
 *
 * 1. **Elle ne vise que les événements de Calendly**, reconnus par la signature
 *    que Calendly pose lui-même dans leur description (`SIGNATURE_CALENDLY`).
 *    Un événement personnel ne la porte jamais. Sans elle, on n'écrit pas.
 * 2. **Elle ne touche QUE `colorId`.** Pas le titre, pas les horaires, pas la
 *    description, pas les invités. La pire conséquence d'une erreur est une
 *    couleur fausse — réversible d'un clic, et sans perte.
 * 3. **Elle ne crée ni ne supprime rien.** Si l'événement n'existe pas, elle
 *    renonce sans bruit.
 *
 * ## Elle ne doit jamais faire échouer une réservation
 *
 * Elle est appelée après coup, sur un rendez-vous déjà enregistré. Un agenda
 * Google indisponible, un jeton expiré ou un événement pas encore propagé
 * (Calendly met quelques secondes à écrire) sont des situations NORMALES, pas
 * des erreurs : elle rend alors `false` et l'appelant continue. Une couleur
 * manquante n'a jamais empêché personne de tenir un rendez-vous.
 *
 * @param debut   l'horaire de début du rendez-vous, tel que la base le connaît
 * @param colorId la couleur à poser, ou `null` pour ne rien faire
 * @returns `true` seulement si une couleur a réellement été posée
 */
export async function colorerReservationCalendly(
  debut: Date,
  colorId: string | null,
): Promise<boolean> {
  if (colorId === null) return false;

  const cfg = readGoogleCalendarConfig();
  if (!cfg) return false;

  // Fenêtre étroite autour du créneau : on cherche un événement qui commence à
  // cet instant précis, pas « dans la journée ». Une minute de part et d'autre
  // absorbe les écarts d'arrondi sans jamais attraper le rendez-vous voisin.
  const marge = 60_000;
  const liste = await listerEvenements(
    new Date(debut.getTime() - marge).toISOString(),
    new Date(debut.getTime() + marge).toISOString(),
  );
  if (!liste.ok) {
    journaliser("coloration abandonnée : agenda illisible", { reason: liste.reason });
    return false;
  }

  const cible = liste.events.find(
    (e) =>
      e.fromCalendly && e.startIso !== null && new Date(e.startIso).getTime() === debut.getTime(),
  );
  if (!cible) return false;

  const auth = await getGoogleAccessToken();
  if (!auth.ok) return false;

  const res = await appeler(
    `/calendars/${encodeURIComponent(cfg.calendarId)}/events/${encodeURIComponent(cible.id)}`,
    { method: "PATCH", token: auth.token, body: JSON.stringify({ colorId }) },
  );
  if (!res.ok) {
    journaliser("coloration en échec", { reason: res.reason, detail: res.detail });
    return false;
  }
  return true;
}
