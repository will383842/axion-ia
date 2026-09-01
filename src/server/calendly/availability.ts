// Disponibilités Calendly résolues CÔTÉ SERVEUR (ADR 0038).
//
// POURQUOI CE MODULE EXISTE
// -------------------------
// ADR 0034 a fait passer l'embed Calendly en click-to-load, pour une raison qui
// reste entièrement valable : l'iframe dépose les cookies de calendly.com sur le
// terminal du visiteur, donc l'article 82 de la loi Informatique et Libertés
// impose un consentement préalable. Le prix payé était un placeholder bavard là
// où le visiteur venait chercher un calendrier — et un clic de plus dans le seul
// funnel du site.
//
// Ce module supprime le dilemme au lieu de l'arbitrer. Les créneaux sont
// demandés à l'API Calendly v2 PAR NOTRE SERVEUR, avec notre Personal Access
// Token. Le navigateur du visiteur ne parle jamais à Calendly : pas de requête,
// pas d'IP transmise, pas de cookie tiers, donc aucun accès en écriture à son
// terminal — l'article 82 ne s'applique tout simplement pas. Le calendrier peut
// donc s'afficher immédiatement, sans clic et sans pavé d'information.
//
// Le visiteur ne rejoint Calendly qu'en cliquant un créneau, pour confirmer son
// nom et son email : une navigation à SON initiative, hors du champ de l'art. 82
// (c'est déjà le raisonnement qui justifiait le lien « nouvel onglet » du
// placeholder, cf. ADR 0034 PIÈGE 4).
//
// CONTRAT D'ACTIVATION — le repli n'est pas un cas d'erreur, c'est le défaut
// -------------------------------------------------------------------------
// Toute défaillance renvoie `{ ok: false }` et l'appelant retombe sur
// `CalendlyConsentGate`, inchangé. Sans jeton, avec un jeton refusé, avec
// l'API injoignable ou sans aucun créneau libre, le produit se comporte
// EXACTEMENT comme avant ce module. C'est délibéré : au build GitHub Actions le
// jeton est absent (secret de runtime Coolify), donc la page est prérendue avec
// le repli, et l'ISR la repeuple en production. Même contrat que les stubs
// Prisma/Redis décrits dans AGENTS.md.
//
// ⚠️ NON VÉRIFIÉ À L'ÉCRITURE — `/event_type_available_times` est documenté par
// Calendly sans mention de palier, mais l'accès API au plan gratuit est
// précisément le point qui restait incertain dans ADR 0036 (« poser le jeton est
// le test décisif »). Je n'ai pas pu l'éprouver contre le compte réel. Si
// l'endpoint répond 403 sur ce plan, rien ne casse : la page rend le placeholder
// d'avant. Commande de vérification dans ADR 0038.
//
// PIÈGE — la fenêtre de temps fait partie de la CLÉ DE CACHE.
// L'URL demandée contient `start_time`. Calculée sur l'horloge à chaque rendu,
// elle serait unique à chaque fois : le cache de données ne servirait jamais et
// chaque régénération taperait l'API. `windowStart()` quantifie donc l'instant
// de départ sur le même pas que le TTL (`SLOTS_REVALIDATE_SECONDS`) : une seule
// URL par intervalle, donc un seul appel réseau par intervalle.

import { CALENDLY_API_BASE } from "./api";
import { lireLesQuestions, type QuestionEventType } from "./questions";

/**
 * TTL du cache des créneaux, en secondes.
 *
 * ⚠️ À GARDER ALIGNÉ avec `export const revalidate` de
 * `src/app/[locale]/appel/page.tsx`. Le segment ne peut pas importer cette
 * constante (Next exige une valeur littéralement analysable), et il ne peut pas
 * non plus se contenter d'hériter du `fetch` : au build le jeton est absent,
 * aucun `fetch` n'a lieu, donc la route garderait son intervalle d'origine et
 * servirait le repli prérendu pendant tout ce temps.
 */
export const SLOTS_REVALIDATE_SECONDS = 900;

/**
 * Étiquette de cache des créneaux.
 *
 * 🔴 ELLE N'A EU AUCUN APPELANT PENDANT QUATRE SEMAINES. Ce commentaire annonçait
 * « permet une invalidation à la réservation » depuis l'ADR 0038, et
 * `revalidateTag("calendly-slots")` n'apparaissait NULLE PART dans `src/`.
 * L'étiquette était décorative : la seule fraîcheur venait du TTL de 900 s, et
 * `/appel` a proposé pendant 13 minutes (mesuré le 2026-08-26) un créneau que
 * Calendly refusait déjà.
 *
 * Les deux appelants sont désormais dans `revalider-creneaux.ts` — lire son
 * en-tête avant d'en ajouter un troisième : le webhook et le cron ne couvrent
 * pas le même cas, et il en faut deux.
 */
export const CALENDLY_SLOTS_TAG = "calendly-slots";

/** L'event-type et l'identité du compte ne bougent pas : cache long. */
const EVENT_TYPE_REVALIDATE_SECONDS = 86_400;
const EVENT_TYPE_TAG = "calendly-event-type";

/**
 * Fenêtre maximale acceptée par l'API pour une requête de disponibilités
 * (Calendly refuse un intervalle supérieur à 7 jours). On retire une seconde
 * pour rester STRICTEMENT en dessous de la borne, et on enchaîne les fenêtres
 * bout à bout pour ne pas créer de trou.
 */
const MAX_WINDOW_MS = 7 * 86_400_000 - 1_000;

/**
 * Horizon interrogé : 28 jours, soit quatre fenêtres.
 *
 * Passé de 14 à 28 le 2026-07-30, avec le rendu en grille mensuelle : une
 * quinzaine laissait la moitié du mois vide, ce qui donnait l'impression d'un
 * agenda saturé alors qu'il ne l'est pas. Coût réel : quatre appels réseau par
 * intervalle de cache au lieu de deux, soit seize par heure — négligeable
 * devant les quotas Calendly.
 */
const HORIZON_MS = 28 * 86_400_000;

/** Aucun appel ne bloque un rendu plus longtemps que ça. */
const TIMEOUT_MS = 6_000;

export interface CalendlySlot {
  /** Début du créneau, ISO 8601 UTC. */
  readonly startIso: string;
  /** Page Calendly de confirmation, déjà positionnée sur ce créneau. */
  readonly schedulingUrl: string;
}

export interface CalendlyAvailabilityDay {
  /** Clé `AAAA-MM-JJ` du jour civil à Paris. */
  readonly dateKey: string;
  readonly slots: readonly CalendlySlot[];
}

/**
 * Ce que l'appel a RÉELLEMENT fait — joint aussi bien au succès qu'à l'échec.
 *
 * Sans ça, un succès partiel est indiscernable d'un agenda qui s'arrête : les
 * fenêtres lointaines qui échouent sont volontairement avalées (voir plus bas),
 * donc la page affiche moins de jours sans que rien ne le signale. Constaté le
 * 2026-07-31 — impossible de dire, depuis l'extérieur, si les créneaux
 * s'arrêtaient à J+21 parce que Calendly n'en offrait pas ou parce que notre
 * 4ᵉ fenêtre avait échoué.
 */
export interface CalendlyAvailabilityDiagnostics {
  /** Profondeur demandée, en jours. */
  readonly horizonDays: number;
  /** Nombre de fenêtres émises (l'API refuse plus de 7 jours par requête). */
  readonly windowsRequested: number;
  readonly windowsOk: number;
  readonly windowsFailed: number;
  /**
   * Vrai quand des créneaux ont été rendus MALGRÉ l'échec d'au moins une
   * fenêtre : la couverture affichée est alors plus courte que l'horizon, et ce
   * n'est pas la faute de l'agenda.
   */
  readonly partial: boolean;
  /** Début du dernier créneau retenu — la borne réelle de réservation. */
  readonly lastSlotIso: string | null;
  /** Fin de l'horizon demandé, pour comparer d'un coup d'œil avec `lastSlotIso`. */
  readonly horizonEndIso: string;
  /** Détail par échec, dans l'ordre des fenêtres. Vide si tout a répondu. */
  readonly failures: readonly CalendlyCallFailure[];
}

export interface CalendlyCallFailure {
  readonly reason: Extract<CalendlyAvailabilityFailure, "forbidden" | "api_error">;
  /** Statut HTTP quand il y en a eu un ; absent sur timeout/DNS/TLS. */
  readonly status?: number;
  /**
   * Ce que Calendly a répondu dans le corps, resserré.
   *
   * 🔴 C'EST LE POINT QUI A COÛTÉ TROIS ALLERS-RETOURS le 2026-07-30 : un 403
   * `Insufficient scope` porte un champ `required_scopes` parfaitement explicite
   * dans son corps, que l'ancien code jetait avant de le lire. On croyait à un
   * jeton invalide (401) alors qu'il manquait juste une permission.
   */
  readonly detail?: string;
}

export type CalendlyAvailability =
  | {
      readonly ok: true;
      readonly days: readonly CalendlyAvailabilityDay[];
      readonly diagnostics: CalendlyAvailabilityDiagnostics;
      /**
       * Durée réelle de l'event-type, en minutes, **telle que Calendly la
       * connaît**.
       *
       * 🔴 POURQUOI ELLE EST DÉRIVÉE ET PAS ÉCRITE. Le 2026-08-27, la page
       * annonçait « 30 minutes » à trois endroits pendant que l'event-type
       * durait 45. Personne n'avait rien cassé : quelqu'un avait changé la durée
       * dans Calendly, et le site — qui la portait en dur — ne pouvait pas
       * suivre. Le prospect lisait 30 et bloquait 45 minutes de son agenda.
       *
       * Un chiffre recopié depuis un tableau de bord finit toujours par
       * diverger. Celui-ci vient de la même réponse d'API que les créneaux :
       * changer la durée chez Calendly la change sur le site, sans déploiement.
       *
       * Absente si Calendly ne la renvoie pas — l'appelant retombe alors sur son
       * libellé de repli plutôt que d'afficher un chiffre inventé.
       */
      readonly dureeMinutes?: number;
    }
  | {
      readonly ok: false;
      readonly reason: CalendlyAvailabilityFailure;
      readonly diagnostics?: CalendlyAvailabilityDiagnostics;
      /** Détail du premier échec réseau/HTTP, quand il y en a eu un. */
      readonly failure?: CalendlyCallFailure;
    };

export type CalendlyAvailabilityFailure =
  /** Pas de Personal Access Token : module inerte, cas nominal (build). */
  | "not_configured"
  /** `NEXT_PUBLIC_CALENDLY_APPEL_URL` absente ou hors calendly.com. */
  | "bad_url"
  /** Le compte n'expose pas d'event-type correspondant à cette URL publique. */
  | "no_event_type"
  /** 401/403 — jeton invalide, révoqué, ou plan sans accès à cet endpoint. */
  | "forbidden"
  /** Autre statut HTTP, réponse illisible, timeout, DNS, TLS. */
  | "api_error"
  /** L'API a répondu, mais aucun créneau libre sur l'horizon interrogé. */
  | "no_slots";

interface GetOk {
  readonly ok: true;
  readonly body: unknown;
}
interface GetErr extends CalendlyCallFailure {
  readonly ok: false;
}

/**
 * Résume le corps d'une réponse d'erreur Calendly en une ligne exploitable.
 *
 * Calendly répond `{ title, message, details: [{ parameter, message }] }`, et
 * ajoute `required_scopes` sur un 403 de portée insuffisante. On garde ces trois
 * informations et rien d'autre : le but est de pouvoir DIAGNOSTIQUER sans jamais
 * recopier un corps entier dans un journal.
 *
 * ⚠️ Ne peut pas fuiter le jeton : il voyage dans l'en-tête `Authorization` de
 * la REQUÊTE, jamais dans le corps de la RÉPONSE. Le retour est en outre
 * tronqué, pour qu'une API bavarde ne remplisse pas les journaux.
 */
function summarizeError(body: unknown): string | undefined {
  const b = record(body);
  if (!b) return undefined;

  const morceaux: string[] = [];
  const title = b["title"];
  const message = b["message"];
  if (typeof title === "string" && title.trim()) morceaux.push(title.trim());
  if (typeof message === "string" && message.trim() && message !== title) {
    morceaux.push(message.trim());
  }

  // `required_scopes` : la clé qui disait tout et qu'on ne lisait pas.
  const scopes = b["required_scopes"];
  if (Array.isArray(scopes) && scopes.length > 0) {
    morceaux.push(`required_scopes=${scopes.filter((s) => typeof s === "string").join(",")}`);
  }

  const details = b["details"];
  if (Array.isArray(details)) {
    for (const d of details.slice(0, 3)) {
      const dr = record(d);
      const dm = dr?.["message"];
      if (typeof dm === "string" && dm.trim()) morceaux.push(dm.trim());
    }
  }

  const resume = morceaux.join(" · ").slice(0, 300);
  return resume || undefined;
}

/**
 * Caviarde le jeton s'il apparaît dans un texte destiné aux journaux.
 *
 * Défense en profondeur : le jeton voyage dans l'en-tête `Authorization` de la
 * requête, donc en théorie il ne peut pas revenir dans le corps d'une réponse.
 * Mais « en théorie » ne suffit pas pour une valeur qui donne accès en lecture
 * aux coordonnées des clients — et certaines API renvoient l'identifiant reçu
 * dans leur message d'erreur. Un journal se conserve, se copie, et part chez un
 * sous-traitant : il ne doit jamais pouvoir porter un secret.
 */
function caviarder(texte: string | undefined): string | undefined {
  if (!texte) return texte;
  const token = process.env.CALENDLY_API_TOKEN?.trim();
  if (!token || token.length < 8) return texte;
  return texte.split(token).join("[JETON]");
}

/**
 * Refuse toute URL qui ne pointe pas exactement sur `calendly.com`.
 *
 * Même esprit que le garde-fou SSRF de `api.ts` : ces URL finissent en `href`
 * dans la page, et l'une d'elles vient de la réponse de l'API. On ne relaie
 * jamais une destination qu'on n'a pas vérifiée.
 */
function isPublicCalendlyUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    (parsed.hostname === "calendly.com" || parsed.hostname.endsWith(".calendly.com"))
  );
}

/** Forme comparable d'une URL de prise de rendez-vous : origine + chemin, sans slash final. */
function canonicalPath(value: string): string | null {
  try {
    const u = new URL(value);
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}

async function calendlyGet(url: string, revalidate: number, tag: string): Promise<GetOk | GetErr> {
  const token = process.env.CALENDLY_API_TOKEN?.trim();
  // L'appelant a déjà filtré ce cas ; garde de dernier recours pour ne jamais
  // émettre une requête sans en-tête d'autorisation.
  if (!token) return { ok: false, reason: "api_error" };

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Pas de `cache:` ici — le combiner avec `next.revalidate` est une
      // configuration contradictoire que Next ignore purement et simplement.
      next: { revalidate, tags: [tag] },
    });
  } catch (e) {
    // Timeout, DNS, TLS : pas de statut, mais le NOM de l'erreur distingue déjà
    // un `TimeoutError` d'un échec de résolution — ce que « api_error » seul ne
    // disait pas.
    const nom = e instanceof Error ? e.name : "unknown";
    return { ok: false, reason: "api_error", detail: `fetch:${nom}`.slice(0, 300) };
  }

  if (!res.ok) {
    // On LIT le corps avant de conclure. C'est tout l'objet de ce correctif :
    // le statut seul confond « jeton invalide » et « jeton aux portées
    // insuffisantes », et seul le corps fait la différence.
    let detail: string | undefined;
    try {
      detail = caviarder(summarizeError((await res.json()) as unknown));
    } catch {
      // Corps vide ou non-JSON : le statut reste, c'est déjà mieux que rien.
    }
    const reason = res.status === 401 || res.status === 403 ? "forbidden" : "api_error";
    // Diffusion conditionnelle et non `detail: undefined` : `exactOptionalPropertyTypes`
    // distingue « clé absente » de « clé à undefined ».
    return { ok: false, reason, status: res.status, ...(detail ? { detail } : {}) };
  }

  try {
    return { ok: true, body: (await res.json()) as unknown };
  } catch {
    return { ok: false, reason: "api_error", status: res.status, detail: "corps illisible" };
  }
}

/** Préfixe stable, pour retrouver ces lignes dans les journaux du conteneur. */
const LOG = "[calendly:availability]";

/**
 * Journalise un diagnostic côté serveur.
 *
 * `console.warn` et pas Sentry : ces situations ne sont pas des exceptions mais
 * des états dégradés attendus (jeton absent au build, agenda vide, fenêtre
 * lointaine en échec). Elles doivent apparaître dans les journaux du conteneur
 * sans polluer le suivi d'erreurs. Rien de personnel n'y transite : des
 * compteurs, des dates de créneaux, et un résumé d'erreur d'API.
 */
function journaliser(message: string, contexte: Record<string, unknown>): void {
  console.warn(`${LOG} ${message}`, JSON.stringify(contexte));
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * Retrouve l'URI d'API de l'event-type à partir de son URL publique.
 *
 * L'URL publique (`NEXT_PUBLIC_CALENDLY_APPEL_URL`) est la seule chose que le
 * site connaisse ; l'API, elle, ne travaille qu'avec des URI. Deux appels, tous
 * deux mis en cache 24 h : ni le compte ni l'event-type ne changent d'un jour à
 * l'autre.
 */
async function resolveEventTypeUri(
  schedulingUrl: string,
): Promise<
  { uri: string; dureeMinutes?: number; customQuestions: unknown } | { failure: GetErr } | null
> {
  const me = await calendlyGet(
    `${CALENDLY_API_BASE}/users/me`,
    EVENT_TYPE_REVALIDATE_SECONDS,
    EVENT_TYPE_TAG,
  );
  // On renvoie l'échec ENTIER, pas seulement sa catégorie : c'est ici que
  // transitait le `required_scopes` d'un 403, jusqu'ici perdu en route.
  if (!me.ok) return { failure: me };

  const userUri = record(record(me.body)?.["resource"])?.["uri"];
  if (typeof userUri !== "string" || !userUri) return null;

  const list = await calendlyGet(
    `${CALENDLY_API_BASE}/event_types?user=${encodeURIComponent(userUri)}&count=100&active=true`,
    EVENT_TYPE_REVALIDATE_SECONDS,
    EVENT_TYPE_TAG,
  );
  if (!list.ok) return { failure: list };

  const collection = record(list.body)?.["collection"];
  if (!Array.isArray(collection)) return null;

  const wanted = canonicalPath(schedulingUrl);
  for (const raw of collection) {
    const et = record(raw);
    if (!et) continue;
    const uri = et["uri"];
    const sched = et["scheduling_url"];
    if (typeof uri !== "string" || typeof sched !== "string") continue;
    if (canonicalPath(sched) !== wanted) continue;
    // La duree officielle de l event-type, telle que Calendly la connait. C est
    // la SEULE source qui ne peut pas diverger de ce que le visiteur reservera.
    const duree = et["duration"];
    // Les questions posées au visiteur voyagent DANS cette même réponse. Les
    // relire ici ne coûte donc aucun appel supplémentaire — et surtout, cela
    // évite d'ouvrir une seconde résolution de l'event-type ailleurs dans le
    // code, qui serait une deuxième vérité pour un seul fait.
    return {
      uri,
      customQuestions: et["custom_questions"],
      ...(typeof duree === "number" && duree > 0 ? { dureeMinutes: duree } : {}),
    };
  }
  return null;
}

/**
 * Instant de départ des fenêtres, quantifié sur le pas du TTL.
 *
 * Toujours STRICTEMENT dans le futur : l'API rejette un `start_time` passé, et
 * un multiple exact de l'intervalle vaut « maintenant ». Conséquence assumée :
 * les créneaux commençant dans les prochaines minutes ne sont pas proposés — ce
 * que fait déjà Calendly lui-même avec son préavis minimum de réservation.
 */
function windowStart(nowMs: number, stepMs: number): Date {
  return new Date(Math.floor(nowMs / stepMs) * stepMs + stepMs);
}

/**
 * Sous cette durée, une fenêtre résiduelle ne vaut pas son appel réseau.
 *
 * 🔴 SANS CE SEUIL, L'HORIZON DE 28 JOURS EN PRODUISAIT CINQ, dont une de
 * QUATRE SECONDES. Chaque fenêtre mesure `7 j − 1 s` (marge de sécurité sous la
 * borne API), donc quatre d'affilée couvrent `28 j − 4 s` : il restait 4
 * secondes, et la boucle émettait une requête entière pour elles. À raison d'une
 * régénération tous les quarts d'heure, cela faisait ~96 appels par jour pour
 * rien — et surtout une requête concurrente de plus à chaque rendu, sur une API
 * qui applique des quotas. Débusqué le 2026-07-31 par le compteur
 * `windowsRequested` que ce même correctif a introduit.
 *
 * Une minute est très au-delà du résidu observé (4 s) et très en deçà d'un
 * créneau réservable (30 min) : aucune disponibilité ne peut être perdue.
 */
const MIN_WINDOW_MS = 60_000;

/** Découpe l'horizon en fenêtres contiguës toutes inférieures à la borne API. */
function buildWindows(start: Date): ReadonlyArray<{ start: Date; end: Date }> {
  const windows: Array<{ start: Date; end: Date }> = [];
  const horizonEnd = start.getTime() + HORIZON_MS;
  let cursor = start.getTime();
  while (horizonEnd - cursor >= MIN_WINDOW_MS) {
    const end = Math.min(cursor + MAX_WINDOW_MS, horizonEnd);
    windows.push({ start: new Date(cursor), end: new Date(end) });
    cursor = end;
  }
  return windows;
}

/**
 * Clé du jour civil À PARIS.
 *
 * `en-CA` rend `AAAA-MM-JJ`, ce qui donne une clé triable sans manipulation. Le
 * fuseau est explicite : le serveur tourne en UTC, et regrouper sur son jour à
 * lui casserait les créneaux de début de matinée à l'heure d'été.
 */
const PARIS_DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function parisDayKey(date: Date): string {
  return PARIS_DAY_KEY.format(date);
}

function parseSlots(body: unknown): CalendlySlot[] {
  const collection = record(body)?.["collection"];
  if (!Array.isArray(collection)) return [];

  const slots: CalendlySlot[] = [];
  for (const raw of collection) {
    const s = record(raw);
    if (!s) continue;
    if (s["status"] !== "available") continue;

    // `invitees_remaining` vaut 0 sur un créneau plein d'un event-type
    // collectif. Absent sur un event-type individuel : on ne l'exige donc pas.
    const remaining = s["invitees_remaining"];
    if (typeof remaining === "number" && remaining <= 0) continue;

    const startRaw = s["start_time"];
    if (typeof startRaw !== "string") continue;
    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) continue;

    const schedulingUrl = s["scheduling_url"];
    if (!isPublicCalendlyUrl(schedulingUrl)) continue;

    slots.push({ startIso: start.toISOString(), schedulingUrl });
  }
  return slots;
}

export interface FetchAvailableSlotsOptions {
  /** URL publique de l'event-type (`NEXT_PUBLIC_CALENDLY_APPEL_URL`). */
  readonly schedulingUrl: string | undefined;
  /**
   * Nombre maximum de jours porteurs de créneaux rendus.
   *
   * Défaut large depuis le passage en grille mensuelle : chaque case cliquable
   * du calendrier pointe une ancre vers la liste des horaires de ce jour, donc
   * tronquer les jours produirait des cases qui ne mènent nulle part.
   */
  readonly maxDays?: number;
  /**
   * Nombre maximum de créneaux rendus par jour.
   *
   * ⚠️ CE PLAFOND GARDE LES PREMIERS CRÉNEAUX DE LA JOURNÉE, pas un échantillon
   * réparti : les créneaux sont triés chronologiquement avant d'être tronqués.
   * Trop bas, il ne raccourcit donc pas la liste — il SUPPRIME L'APRÈS-MIDI.
   *
   * Constaté en production le 2026-07-31 avec l'ancienne valeur (6) : les jours
   * entiers n'affichaient que 09:00 → 11:30, alors que le vendredi — dont la
   * matinée était déjà passée — proposait 12:30 → 15:00. L'après-midi existait
   * bien côté Calendly, le plafond le masquait.
   *
   * 🔴 C'EST EXACTEMENT CE QUI S'EST REPRODUIT — mesuré le 2026-08-26. La valeur
   * précédente (16) couvrait une journée de 8 h. L'agenda Calendly, lui, ouvre
   * désormais 9 h → 19 h, soit **20 créneaux**. Le plafond retranchait donc les
   * quatre derniers de chaque journée pleine : 17:00, 17:30, 18:00 et 18:30
   * étaient réservables sur Calendly et INVISIBLES sur le site, ~70 créneaux sur
   * les 28 jours d'horizon — toutes les fins d'après-midi. Le paragraphe
   * ci-dessus avait prévu le cas ; personne n'était là pour le lire au moment où
   * la plage s'est élargie. D'où le journal ajouté plus bas : à la prochaine
   * extension, la troncature se signalera d'elle-même au lieu d'attendre qu'on
   * la soupçonne.
   *
   * 20 couvre une journée de 10 h au pas de 30 minutes. Le coût est faible parce
   * que ce markup est très répétitif donc très compressible :
   *     plafond  8 → 192 créneaux, 115 Ko brut, 4,1 Ko gz
   *     plafond 16 → 384 créneaux, 211 Ko brut, 6,1 Ko gz   (+2,0 Ko gz)
   *     plafond 20 → 480 créneaux, 264 Ko brut, 7,6 Ko gz   (+1,5 Ko gz)
   * Aucun JavaScript n'est ajouté : le budget `First Load JS` de `/appel`
   * (≤ 110 Ko gz, cf. AGENTS.md) est inchangé — c'est du HTML, pas un chunk.
   *
   * Si l'agenda s'ouvrait un jour au-delà de 10 h par jour, remonter ce plafond
   * plutôt que de laisser la troncature décider à la place du visiteur.
   */
  readonly maxSlotsPerDay?: number;
  /** Injectable pour les tests — l'horloge est quantifiée, jamais lue telle quelle. */
  readonly nowMs?: number;
}

/**
 * Renvoie les prochains créneaux libres, groupés par jour civil à Paris.
 *
 * Ne lève jamais : toute défaillance devient un `{ ok: false, reason }` que
 * l'appelant traduit en repli.
 */
export async function fetchAvailableSlots({
  schedulingUrl,
  maxDays = 31,
  maxSlotsPerDay = 20,
  nowMs = Date.now(),
}: FetchAvailableSlotsOptions): Promise<CalendlyAvailability> {
  if (!process.env.CALENDLY_API_TOKEN?.trim()) return { ok: false, reason: "not_configured" };
  if (!isPublicCalendlyUrl(schedulingUrl)) return { ok: false, reason: "bad_url" };

  const resolved = await resolveEventTypeUri(schedulingUrl);
  if (resolved && "failure" in resolved) {
    const { ok: _ignore, ...failure } = resolved.failure;
    journaliser("résolution de l'event-type en échec", failure);
    return { ok: false, reason: failure.reason, failure };
  }
  if (!resolved) {
    journaliser("aucun event-type ne correspond à l'URL publique", { schedulingUrl });
    return { ok: false, reason: "no_event_type" };
  }
  const eventTypeUri = resolved.uri;
  const dureeMinutes = resolved.dureeMinutes;

  const debut = windowStart(nowMs, SLOTS_REVALIDATE_SECONDS * 1_000);
  const windows = buildWindows(debut);
  const responses = await Promise.all(
    windows.map((w) =>
      calendlyGet(
        `${CALENDLY_API_BASE}/event_type_available_times` +
          `?event_type=${encodeURIComponent(eventTypeUri)}` +
          `&start_time=${encodeURIComponent(w.start.toISOString())}` +
          `&end_time=${encodeURIComponent(w.end.toISOString())}`,
        SLOTS_REVALIDATE_SECONDS,
        CALENDLY_SLOTS_TAG,
      ),
    ),
  );

  const failures = responses
    .filter((r): r is GetErr => !r.ok)
    .map(({ ok: _ignore, ...f }) => f satisfies CalendlyCallFailure);

  /** Construit le diagnostic une fois la borne réelle connue. */
  const diagnostiquer = (lastSlotIso: string | null): CalendlyAvailabilityDiagnostics => ({
    horizonDays: Math.round(HORIZON_MS / 86_400_000),
    windowsRequested: windows.length,
    windowsOk: responses.length - failures.length,
    windowsFailed: failures.length,
    partial: failures.length > 0 && failures.length < responses.length,
    lastSlotIso,
    horizonEndIso: new Date(debut.getTime() + HORIZON_MS).toISOString(),
    failures,
  });

  // Une fenêtre lointaine qui échoue ne doit pas emporter les créneaux proches,
  // qui sont les plus utiles. On n'abandonne que si TOUT a échoué.
  const succeeded = responses.filter((r): r is GetOk => r.ok);
  if (succeeded.length === 0) {
    const firstFailure = failures[0];
    journaliser("toutes les fenêtres ont échoué", { failures });
    return {
      ok: false,
      reason: firstFailure?.reason ?? "api_error",
      ...(firstFailure ? { failure: firstFailure } : {}),
      diagnostics: diagnostiquer(null),
    };
  }

  // Les fenêtres se touchent bout à bout : un créneau pile sur la jointure peut
  // être renvoyé deux fois.
  const deduped = new Map<string, CalendlySlot>();
  for (const res of succeeded) {
    for (const slot of parseSlots(res.body)) {
      if (!deduped.has(slot.startIso)) deduped.set(slot.startIso, slot);
    }
  }

  const sorted = [...deduped.values()].sort((a, b) => a.startIso.localeCompare(b.startIso));
  if (sorted.length === 0) {
    journaliser("aucun créneau libre sur l'horizon", { horizonDays: HORIZON_MS / 86_400_000 });
    return { ok: false, reason: "no_slots", diagnostics: diagnostiquer(null) };
  }

  const byDay = new Map<string, CalendlySlot[]>();
  for (const slot of sorted) {
    const key = parisDayKey(new Date(slot.startIso));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(slot);
    else byDay.set(key, [slot]);
  }

  const days = [...byDay.entries()]
    .slice(0, maxDays)
    .map(([dateKey, slots]) => ({ dateKey, slots: slots.slice(0, maxSlotsPerDay) }));

  // 🔴 UNE TRONCATURE MUETTE SE LIT COMME UN AGENDA PLEIN. Ajouté le 2026-08-26,
  // après avoir mis quatre semaines à découvrir que le plafond de 16 masquait
  // toutes les fins d'après-midi (cf. `maxSlotsPerDay`). Rien ne distinguait, de
  // l'extérieur, « Calendly n'ouvre pas après 16 h 30 » de « on coupe à 16 h 30 » :
  // les deux rendent la même page. Ce journal nomme le jour et les deux comptes,
  // pour que la prochaine extension de plage se signale au lieu d'attendre.
  const jourTronque = [...byDay.entries()]
    .slice(0, maxDays)
    .find(([, slots]) => slots.length > maxSlotsPerDay);
  if (jourTronque) {
    const [dateKey, slots] = jourTronque;
    journaliser("créneaux TRONQUÉS par le plafond — la fin de journée est masquée", {
      premierJourTronque: dateKey,
      offertsParCalendly: slots.length,
      rendus: maxSlotsPerDay,
      premierMasqueIso: slots[maxSlotsPerDay]?.startIso ?? null,
    });
  }

  const diagnostics = diagnostiquer(sorted.at(-1)?.startIso ?? null);

  // Le succès PARTIEL est le cas sournois : la page s'affiche normalement, mais
  // avec moins de jours que demandé. Sans cette ligne, rien ne distingue « le
  // calendrier est plein jusqu'à J+21 » de « notre 4ᵉ requête a échoué ».
  if (diagnostics.partial) {
    journaliser("couverture PARTIELLE — des fenêtres ont échoué, l'agenda paraît plus court", {
      windowsFailed: diagnostics.windowsFailed,
      windowsRequested: diagnostics.windowsRequested,
      lastSlotIso: diagnostics.lastSlotIso,
      horizonEndIso: diagnostics.horizonEndIso,
      failures: diagnostics.failures,
    });
  }

  // Diffusion conditionnelle : `exactOptionalPropertyTypes` distingue « clé
  // absente » de « clé à undefined », et l appelant teste la présence pour
  // décider s il affiche un chiffre ou son libellé de repli.
  return { ok: true, days, diagnostics, ...(dureeMinutes ? { dureeMinutes } : {}) };
}

/**
 * Ce que la page de réservation doit savoir avant d'afficher un formulaire.
 *
 * ## Pourquoi cette fonction vit ICI et pas dans son propre module
 *
 * Elle réutilise `resolveEventTypeUri`, qui est la SEULE résolution de
 * l'event-type du dépôt. En ouvrir une seconde ailleurs donnerait deux vérités
 * pour un seul fait — et le jour où l'URL publique change, l'une des deux
 * suivrait sans l'autre. Les deux appels réseau sont d'ailleurs mis en cache
 * 24 h sous le même `tag`, donc appeler cette fonction juste après
 * `fetchAvailableSlots` ne coûte rien.
 *
 * ## Le contrat de repli, identique au reste du module
 *
 * Toute défaillance rend `null`, et l'appelant renvoie le visiteur sur la page
 * Calendly. Y compris — et surtout — le cas `incomplet` : une question que nous
 * ne savons pas poser rend le formulaire indisponible, parce qu'un formulaire
 * amputé produirait une réservation qui a l'air complète et à laquelle il
 * manque une réponse obligatoire. Voir `questions.ts`.
 */
export async function resoudreEventTypePourReservation(schedulingUrl: string): Promise<{
  readonly uri: string;
  readonly questions: readonly QuestionEventType[];
  readonly dureeMinutes?: number;
} | null> {
  if (!process.env.CALENDLY_API_TOKEN?.trim()) return null;
  if (!isPublicCalendlyUrl(schedulingUrl)) return null;

  const resolved = await resolveEventTypeUri(schedulingUrl);
  if (!resolved || "failure" in resolved) {
    if (resolved) {
      const { ok: _ignore, ...failure } = resolved.failure;
      journaliser("réservation directe : résolution de l'event-type en échec", failure);
    }
    return null;
  }

  const lecture = lireLesQuestions(resolved.customQuestions);
  if (!lecture.ok) {
    // 🔴 Ce journal est le SEUL endroit où l'on apprendra qu'une question
    // ajoutée chez Calendly a fermé notre formulaire. Sans lui, le repli vers
    // Calendly serait silencieux et durerait jusqu'à ce que quelqu'un s'étonne
    // que le formulaire n'apparaisse plus.
    journaliser("réservation directe : question non rendable, repli vers Calendly", {
      typesInconnus: lecture.typesInconnus,
    });
    return null;
  }

  return {
    uri: resolved.uri,
    questions: lecture.questions,
    ...(resolved.dureeMinutes ? { dureeMinutes: resolved.dureeMinutes } : {}),
  };
}
