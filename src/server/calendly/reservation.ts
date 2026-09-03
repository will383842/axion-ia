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
 *
 *   ⚠️ Depuis le 2026-09-03, le numéro part dans les DEUX champs, et cette
 *   nuance vaut d'être lue : `location.location` reste le seul endroit qui
 *   décide de ce que Will compose pour un appel sortant — mais une VISIO n'a
 *   aucune case où ranger un numéro, alors que le formulaire l'exige désormais
 *   dans les deux formats. `text_reminder_number` est là pour cela, et pour
 *   rien d'autre. Il n'a PAS été mesuré contre l'API, d'où le repli sans lui.
 * - `questions_and_answers` passe les libellés **exacts**, accents compris.
 * - `tracking` est **tout ou rien** : envoyer deux UTM sur six fait échouer la
 *   requête entière. Les six champs doivent être présents, quitte à valoir
 *   `null`.
 *
 * ## Ce que l'ANNULATION a établi, et qui a failli être perdu
 *
 * Les deux réservations de test ont été annulées par l'API. Ce constat-là n'a
 * PAS été écrit ici le premier jour — il tenait dans une demi-phrase, « créées
 * puis annulées ». Il a fallu qu'une recherche exhaustive du dépôt et de tout
 * l'historique git échoue pour qu'on pense à le récupérer dans la transcription
 * de la conversation. **Une mesure faite en conversation et non consignée ici
 * est perdue pour tout le monde, y compris pour celui qui l'a faite.**
 *
 * `POST /scheduled_events/{uuid}/cancellation` :
 *
 * — corps `{"reason":"…"}` → **400** `{"title":"Invalid Argument", "message":
 *   "The supplied parameters are invalid."}`, **et l'événement reste ACTIF**.
 *   🔴 Le champ `reason` n'est PAS accepté. On ne peut donc pas demander de
 *   motif d'annulation : l'envoyer fait échouer l'annulation elle-même.
 * — corps `{}` → **201** `{"resource":{"canceled_by":"…", "canceler_type":
 *   "host", "reason":null}}`.
 * — rejeu sur un événement déjà annulé → **403** `{"title":"Permission Denied",
 *   "message":"Event is already canceled"}`. 🔑 Réponse parfaitement
 *   discriminante : un lien d'annulation cliqué deux fois — le cas COURANT — se
 *   distingue sans ambiguïté d'une panne. Aucun registre de jetons consommés
 *   n'est nécessaire.
 *
 * ⚠️ **`canceler_type` vaut `host`, et c'est une conséquence produit.** Un
 * prospect qui annulerait depuis une page à nous apparaîtra chez Calendly comme
 * ayant été annulé *par nous*, et leur e-mail le dira. À décider avant
 * d'écrire l'annulation, pas à découvrir après.
 *
 * ⚠️ Ce « 400 muet » a longtemps été décrit comme muet. Il ne l'était pas : son
 * corps disait exactement ce qui n'allait pas. C'est la troisième fois dans ce
 * module qu'une réponse jugée silencieuse s'avère simplement non lue — voir le
 * 403 de portée plus bas. **« Muet » est presque toujours un jugement sur notre
 * observation, pas sur l'émetteur.**
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
import { canalDuRendezVous } from "./canal";

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
      /**
       * Le lieu enregistré a-t-il pu être RELU et confirmé ?
       *
       * ⚠️ `false` ne veut pas dire « mauvais lieu » — ce cas-là a sa propre
       * raison. Il veut dire « la réservation existe, mais la relecture n'a pas
       * abouti ». La distinction compte : on confirme au visiteur (le
       * rendez-vous est bien pris) tout en sachant qu'on n'a pas vérifié le
       * format, ce qui vaut un signalement mais pas une alarme.
       */
      readonly lieuVerifie: boolean;
      /**
       * Le numéro du visiteur est-il PARTI avec la réservation ?
       *
       * 🔴 `false` veut dire : le rendez-vous existe, et le numéro que le
       * formulaire vient d'exiger n'est nulle part. C'est le seul état qui
       * rende un champ obligatoire silencieusement inutile — il doit donc
       * remonter à l'appelant, qui alerte. Sans ce drapeau, le repli sur
       * `text_reminder_number` réussirait dans le noir, et Will découvrirait
       * l'absence de numéro le jour d'un rendez-vous manqué.
       */
      readonly numeroTransmis: boolean;
    }
  /** Quelqu'un a réservé pendant que le prospect remplissait. Le cas FRÉQUENT. */
  | { readonly ok: false; readonly raison: "creneau_pris" }
  /** L'API refuse et le dit. Repli vers Calendly, pré-rempli. */
  | { readonly ok: false; readonly raison: "refus"; readonly detail: string }
  /** L'API se tait. ⚠️ On ne sait PAS si la réservation existe. */
  | { readonly ok: false; readonly raison: "silence" }
  /**
   * Le lieu demandé n'est pas celui enregistré — voir la note ci-dessus.
   *
   * 🔴 CE CAS PORTE `eventUri` ET `cancelUrl`, ET CE N'EST PAS DÉCORATIF : la
   * réservation EXISTE. On ne peut pas se contenter de dire non au visiteur, il
   * faut pouvoir défaire ce qui a été fait, ou au moins prévenir. Une variante
   * sans ces deux champs laisserait un rendez-vous fantôme au mauvais format,
   * que personne ne pourrait retrouver.
   */
  | {
      readonly ok: false;
      readonly raison: "lieu_non_pris_en_compte";
      readonly eventUri: string;
      readonly cancelUrl: string | null;
      /** Ce que Calendly a réellement enregistré, pour le journal. */
      readonly lieuEnregistre: string | null;
    }
  /** Ni jeton ni configuration : le module est inerte, comme le reste. */
  | { readonly ok: false; readonly raison: "non_configure" }
  /**
   * 🔴 LE JETON N'A PAS LE DROIT D'ÉCRIRE.
   *
   * Cette raison existe parce que sans elle, le cas se rangerait dans `refus` —
   * et un `refus` est traité comme un problème du visiteur : on le renvoie vers
   * Calendly avec sa saisie, ce qui marche. Le formulaire serait donc en panne
   * TOTALE et PERMANENTE, pour tout le monde, en se comportant exactement comme
   * un formulaire qui rencontre un cas limite.
   *
   * Il ne se produit qu'à un moment : la mise en service, si le jeton posé dans
   * Coolify n'a pas `scheduled_events:write`. C'est-à-dire précisément quand
   * personne ne surveille encore, et quand le repli masque le défaut.
   *
   * Calendly rend un 403 dont le corps porte `required_scopes` — ce dépôt a
   * déjà perdu trois allers-retours en 2026-07 sur un 403 dont on jetait le
   * corps avant de le lire (voir `availability.ts`, `CalendlyCallFailure`).
   */
  | {
      readonly ok: false;
      readonly raison: "portee_manquante";
      /** Ce que Calendly dit exiger, quand il le dit. */
      readonly porteesRequises: string | null;
    };

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
 * Les détails d'une erreur Calendly, quand elle en porte.
 *
 * 🔴 Un refus de l'API tient en DEUX étages : `message` de premier niveau
 * (« The supplied parameters are invalid. »), puis `details[]`, où chaque entrée
 * nomme le paramètre fautif et dit pourquoi. Mesuré en prod le 2026-09-02 :
 * un créneau pris entre-temps rendait le message générique, et la raison —
 * celle qui distingue « choisissez un autre créneau » de « le formulaire est
 * cassé » — dormait dans `details`, que personne ne lisait.
 */
function detailsDeLErreur(
  o: unknown,
): ReadonlyArray<{ parameter: string; message: string; code: string }> {
  if (typeof o !== "object" || o === null) return [];
  const brut = (o as Record<string, unknown>)["details"];
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((d) => {
    if (typeof d !== "object" || d === null) return [];
    const r = d as Record<string, unknown>;
    return [
      {
        parameter: typeof r["parameter"] === "string" ? r["parameter"] : "?",
        message: typeof r["message"] === "string" ? r["message"] : "",
        code: typeof r["code"] === "string" ? r["code"] : "",
      },
    ];
  });
}

/**
 * Le corps de la requête.
 *
 * Exporté pour être testable seul : c'est lui qui porte les quatre pièges de la
 * phase 0, et le vérifier ne doit pas demander d'appel réseau.
 */
export function corpsDeLaDemande(
  d: DemandeReservation,
  /**
   * Deuxième tentative : on retire le numéro de rappel parce que Calendly
   * vient de le refuser. Voir `reserverCreneau` — un rendez-vous vaut mieux
   * qu'un numéro.
   */
  sansNumeroDeRappel = false,
): Record<string, unknown> {
  const lieu: Record<string, unknown> = { kind: KIND_CALENDLY[d.format] };
  // 🔑 Le numéro va dans `location.location`. Vérifié le 2026-09-01 : c'est là
  // que Calendly le range, et l'événement créé le rend à cet endroit.
  if (d.format === "telephone" && d.telephone) lieu["location"] = d.telephone;

  // 🔴 ET AUSSI DANS `invitee.text_reminder_number`, DEPUIS LE 2026-09-03.
  //
  // La ligne au-dessus ne s'applique qu'à `outbound_call`. Une visio n'a aucune
  // case où ranger un numéro : celui que le formulaire exige désormais dans les
  // DEUX formats serait saisi, posté, puis jeté — et n'arriverait jamais dans
  // la console, puisque `api.ts::extractPhone` ne lit que ce que Calendly rend.
  //
  // `text_reminder_number` est le champ que Calendly documente pour le numéro
  // de l'invité (rappels SMS). Il est aussi le PREMIER que `extractPhone`
  // consulte, donc celui qui remonte le plus sûrement.
  //
  // ⚠️ Ce champ n'a PAS été mesuré contre l'API de production, contrairement à
  // `location.kind` et à `tracking`. Son acceptation dépend, selon la
  // documentation, de la configuration des rappels SMS sur l'event-type — que
  // nous ne contrôlons pas depuis ici. D'où le repli de `reserverCreneau` :
  // s'il est refusé, on rejoue SANS lui. On perd le numéro, jamais le
  // rendez-vous.
  const numeroDeRappel = !sansNumeroDeRappel && d.telephone ? d.telephone : null;

  return {
    event_type: d.eventTypeUri,
    start_time: d.debut.toISOString(),
    invitee: {
      name: d.nom,
      email: d.email,
      timezone: d.fuseau,
      ...(numeroDeRappel ? { text_reminder_number: numeroDeRappel } : {}),
    },
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
  // 🔴 ON DÉRIVE PAR `canalDuRendezVous`, PAS PAR `KIND_CALENDLY`.
  //
  // La première version comparait le type rendu à `KIND_CALENDLY[format]`,
  // c'est-à-dire à `google_conference` exactement. Or `canal.ts` — la
  // dérivation qu'emploient l'e-mail, la console et la page de confirmation —
  // reconnaît AUSSI `zoom`, `microsoft_teams_conference`, `webex_conference`,
  // `gotomeeting_conference` et `custom` comme des visioconférences.
  //
  // Deux dérivations du même fait, donc, et elles se contredisaient sur des cas
  // réels : un event-type dont l'intégration Google Meet est déconnectée, ou
  // qui porte un lien saisi à la main, fait enregistrer `custom` par Calendly.
  // La réservation était alors REFUSÉE avec une alerte `critical` « au mauvais
  // format » — pour une visio parfaitement valide, que la page de confirmation
  // aurait annoncée « En visioconférence » deux secondes plus tard.
  //
  // Une alerte critique qui se déclenche à tort est pire qu'aucune alerte :
  // on apprend à l'ignorer, et le jour où elle dit vrai, elle ne dit plus rien.
  //
  // `KIND_CALENDLY` reste la table d'ÉMISSION — ce qu'on demande. `canal.ts`
  // est la table de LECTURE — ce qu'on accepte. Les deux ne sont pas
  // symétriques, et c'est correct : on demande le plus précis, on accepte le
  // plus large.
  return canalDuRendezVous(null, { event: { location: lieuRendu } }) === format;
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

  const premier = await tenterLaReservation(d, token, false);

  // 🔴 UN SEUL CAS SE REJOUE, ET LA LISTE DES AUTRES EST LA VRAIE GARDE.
  //
  // Rejouer une réservation est l'opération la plus dangereuse de ce module :
  // un second POST sur un premier qui a ABOUTI donne deux rendez-vous. On ne
  // rejoue donc que sur `refus` — un 4xx, c'est-à-dire le seul cas où Calendly
  // affirme n'avoir rien créé. Jamais sur `silence` (on ignore si la
  // réservation existe : c'est exactement le cas que l'en-tête de ce fichier
  // interdit de rejouer), jamais sur `creneau_pris`, jamais sur un succès.
  //
  // Et il faut que le refus NOMME le numéro de rappel : sans cette condition,
  // n'importe quel refus déclencherait un second appel inutile, qui doublerait
  // le temps d'attente d'un visiteur déjà en train de partir.
  if (
    premier.ok ||
    premier.raison !== "refus" ||
    !d.telephone ||
    !refusDuNumeroDeRappel(premier.detail)
  ) {
    return premier;
  }

  return tenterLaReservation(d, token, true);
}

/**
 * Le refus porte-t-il sur `invitee.text_reminder_number` ?
 *
 * On lit le NOM du paramètre, présent dans `details[]` et recopié dans le
 * `detail` — pas le message, qui est localisé (mesuré : « Cette heure de début
 * est déjà occupée », en français) et donc impossible à reconnaître par un mot.
 */
function refusDuNumeroDeRappel(detail: string): boolean {
  return /text_reminder_number/i.test(detail);
}

/** Une tentative, une seule. Le repli est décidé par `reserverCreneau`. */
async function tenterLaReservation(
  d: DemandeReservation,
  token: string,
  sansNumeroDeRappel: boolean,
): Promise<ResultatReservation> {
  let res: Response;
  try {
    res = await fetch(`${CALENDLY_API_BASE}/invitees`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpsDeLaDemande(d, sansNumeroDeRappel)),
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
    const details = detailsDeLErreur(corps);
    // Le détail SERT : il part dans l'alerte « reservation_refusee » et c'est lui
    // qu'on lit pour savoir si le formulaire est cassé. Sans `details[]`, il ne
    // disait que « The supplied parameters are invalid. »
    const detail = [
      texte(corps, "message") ?? texte(corps, "title") ?? `HTTP ${res.status}`,
      ...details.map((x) => `${x.parameter}: ${x.message}${x.code ? ` [${x.code}]` : ""}`),
    ].join(" — ");

    // 🔴 AVANT TOUT LE RESTE. Un 403 de portée n'est pas un refus de la demande,
    // c'est un refus du JETON — donc une panne de configuration qui touche tout
    // le monde et ne se réparera pas toute seule. La ranger dans `refus`
    // reviendrait à replier poliment vers Calendly à chaque réservation, ce qui
    // marche, ce qui ne casse rien, et ce que personne ne remarquerait.
    if (res.status === 403 || /scope|permission|forbidden/i.test(detail)) {
      const requises = texte(corps, "required_scopes");
      return {
        ok: false,
        raison: "portee_manquante",
        porteesRequises:
          requises ??
          (Array.isArray((corps as Record<string, unknown> | null)?.["required_scopes"])
            ? ((corps as Record<string, unknown>)["required_scopes"] as unknown[]).join(", ")
            : null),
      };
    }

    // Le créneau pris entre-temps est le refus le PLUS FRÉQUENT, et il ne doit
    // surtout pas être traité comme une panne : rediriger vers Calendly ferait
    // lire au prospect le même refus, en moins bien, sur une page étrangère.
    // 🔴 LA FORME RÉELLE, mesurée en prod le 2026-09-02 (sonde du workflow
    // jeton sur un créneau pris trente secondes plus tôt) :
    //   400 { title: "Invalid Argument", message: "The supplied parameters are
    //   invalid.", details: [{ parameter: "event.start_time",
    //   message: "Cette heure de début est déjà occupée", code: "already_filled" }] }
    // Trois enseignements : le paramètre est PRÉFIXÉ (`event.start_time`, pas
    // `start_time`), le message est LOCALISÉ (français ici, donc aucun mot
    // anglais à attendre), et un `code` stable existe. On lit le code d'abord,
    // le suffixe du paramètre ensuite, le texte en dernier recours — dans cet
    // ordre de fiabilité. Un refus sur l'heure de début dit toujours la même
    // chose au prospect : cet horaire n'est plus prenable, choisissez-en un
    // autre — la saisie est conservée.
    if (
      details.some((x) => x.code === "already_filled" || /(^|\.)start_time$/.test(x.parameter)) ||
      /already|no longer available|not available|taken|slot|occup/i.test(detail)
    ) {
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

  const cancelUrl = texte(ressource, "cancel_url");
  const rescheduleUrl = texte(ressource, "reschedule_url");

  // 🔴 LA RELECTURE QUE L'EN-TÊTE DE CE FICHIER PROMET.
  //
  // Elle a manqué à la première version, et son absence rendait deux choses
  // fausses à la fois : la variante `lieu_non_pris_en_compte` ne pouvait
  // JAMAIS se produire — un cas d'échec déclaré et inatteignable — et
  // `lienReunion` valait toujours `null`, donc la page de confirmation n'aurait
  // jamais eu de lien de réunion à afficher.
  //
  // La cause est simple et vaut d'être écrite : la réponse du POST ne porte pas
  // le lieu. Elle rend l'URI de l'événement, et c'est tout. Vérifier exige donc
  // un second appel, sur l'événement créé.
  const relu = await relireLeLieu(eventUri, token);

  if (relu.lu && !lieuConforme(d.format, relu.lieu)) {
    return {
      ok: false,
      raison: "lieu_non_pris_en_compte",
      eventUri,
      cancelUrl,
      lieuEnregistre: texte(relu.lieu, "type"),
    };
  }

  return {
    ok: true,
    eventUri,
    // `join_url` n'existe que pour une visio, et seulement une fois que Google
    // a rendu la conférence. Un `null` ici est un état d'attente légitime, pas
    // une panne — le lien arrive par le webhook quelques secondes plus tard.
    lienReunion: relu.lu ? texte(relu.lieu, "join_url") : null,
    cancelUrl,
    rescheduleUrl,
    lieuVerifie: relu.lu,
    // Un numéro exigé au formulaire mais absent de la requête n'arrivera nulle
    // part. L'appelant en fait une alerte.
    numeroTransmis: Boolean(d.telephone) && !sansNumeroDeRappel,
  };
}

/**
 * Relit le lieu réellement enregistré sur l'événement créé.
 *
 * ⚠️ Une relecture qui échoue N'EST PAS une réservation qui échoue. Le
 * rendez-vous existe : le dire au visiteur est la bonne réponse, même sans
 * avoir pu confirmer le format. D'où `{ lu: false }` plutôt qu'une exception ou
 * un `null` ambigu — l'appelant doit pouvoir distinguer « relu et conforme » de
 * « pas relu », et ne surtout pas confondre l'un des deux avec « mauvais lieu ».
 */
async function relireLeLieu(
  eventUri: string,
  token: string,
): Promise<{ lu: true; lieu: unknown } | { lu: false }> {
  try {
    const res = await fetch(eventUri, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { lu: false };
    const corps: unknown = await res.json();
    const ressource =
      typeof corps === "object" && corps !== null
        ? ((corps as Record<string, unknown>)["resource"] ?? corps)
        : null;
    const lieu =
      typeof ressource === "object" && ressource !== null
        ? (ressource as Record<string, unknown>)["location"]
        : undefined;
    return lieu === undefined ? { lu: false } : { lu: true, lieu };
  } catch {
    return { lu: false };
  }
}
