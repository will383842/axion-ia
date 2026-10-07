/**
 * Reporter un rendez-vous — deux opérations, et l'ordre décide de tout.
 *
 * ## 🔴 LA RÈGLE, ET CE QU'ELLE COÛTE DE L'INVERSER
 *
 * Reporter, c'est réserver le nouveau créneau ET annuler l'ancien. Les deux
 * peuvent échouer indépendamment, donc l'ordre n'est pas un détail
 * d'implémentation : **il décide de ce que le prospect perd quand ça casse.**
 *
 * On réserve d'abord. On ne libère l'ancien qu'une fois le nouveau CONFIRMÉ.
 *
 * L'ordre inverse — annuler puis réserver — est plus naturel à écrire et plus
 * naturel à raconter (« je libère ma place, j'en prends une autre »). Il
 * produit le seul état vraiment inacceptable : l'annulation réussit, la
 * réservation échoue, et **la personne n'a plus rien**. Elle a cliqué pour
 * déplacer un rendez-vous, elle se retrouve sans rendez-vous, et le créneau
 * qu'elle occupait est déjà repris.
 *
 * Notre ordre a lui aussi un état dégradé — deux rendez-vous — mais il est
 * strictement moins grave : les deux créneaux se voient immédiatement dans
 * l'agenda, et on peut en libérer un. « Plus rien » ne se répare pas, parce
 * qu'on ne sait même pas qui prévenir.
 *
 * ## ⚠️ LE CAS `silence` NE SE REPLIE PAS
 *
 * Quand l'API ne répond pas à la réservation, on ignore si le nouveau
 * rendez-vous existe. On garde donc l'ancien, IMPÉRATIVEMENT — annuler
 * mènerait à « plus rien » une fois sur deux — et on prévient un humain.
 * C'est la même doctrine que `soumettreLaReservation`, pour la même raison.
 *
 * ## Le prospect ne retape RIEN
 *
 * Tout ce dont la nouvelle réservation a besoin est déjà en base : nom,
 * adresse, téléphone, fuseau, UTM, et les réponses aux questions dans le
 * contenu brut. Redemander ces informations pour un simple changement d'heure
 * ferait abandonner — et introduirait une occasion de les saisir différemment.
 */

import type { Prisma } from "../../../prisma/generated/client";
import type { DemandeReservation, FormatDemande } from "./reservation";
import { reserverCreneau } from "./reservation";
import { annulerRendezVous } from "./annulation";
import { canalDuRendezVous } from "./canal";
import { normaliserLibelle, type QuestionEventType } from "./questions";

/** Ce qu'il faut savoir de l'ancien rendez-vous pour en fabriquer un nouveau. */
export interface RendezVousSource {
  readonly id: string;
  readonly eventUri: string | null;
  readonly inviteeName: string | null;
  readonly inviteeEmail: string | null;
  readonly inviteePhone: string | null;
  readonly timezone: string;
  readonly location: string | null;
  readonly rawPayload: unknown;
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  /** Le bouton d'origine (`diagnostic`, `projet:faq`…) — gardé au report (L2). */
  readonly utmContent?: string | null;
}

export type ResultatReport =
  | {
      readonly ok: true;
      readonly nouvelEventUri: string;
      /**
       * ⚠️ `false` veut dire : le nouveau rendez-vous EXISTE, l'ancien n'a pas
       * pu être libéré. Le visiteur doit être confirmé — son but est atteint —
       * mais un humain doit libérer l'ancien créneau.
       */
      readonly ancienLibere: boolean;
    }
  /** Quelqu'un a pris le créneau entre-temps. L'ancien rendez-vous est INTACT. */
  | { readonly ok: false; readonly raison: "creneau_pris" }
  /** Refus explicite. L'ancien est INTACT. */
  | { readonly ok: false; readonly raison: "refus"; readonly detail: string }
  /**
   * 🔴 L'API se tait sur la RÉSERVATION. On ignore si le nouveau existe, donc on
   * garde l'ancien. Ne JAMAIS replier vers une nouvelle tentative sans
   * vérification humaine : deux rendez-vous valent mieux que zéro, mais aucun
   * des deux n'est souhaitable.
   */
  | { readonly ok: false; readonly raison: "silence" }
  | {
      readonly ok: false;
      readonly raison: "portee_manquante";
      readonly porteesRequises: string | null;
    }
  /** Le nouveau a été créé au mauvais format. Il existe — voir `reservation.ts`. */
  | {
      readonly ok: false;
      readonly raison: "lieu_non_pris_en_compte";
      readonly nouvelEventUri: string;
      readonly cancelUrl: string | null;
    }
  | { readonly ok: false; readonly raison: "non_configure" }
  /** La ligne source n'a pas de quoi rejouer une réservation. */
  | { readonly ok: false; readonly raison: "donnees_incompletes"; readonly manque: string }
  /**
   * Une question OBLIGATOIRE de l'event-type n'a pas de réponse dans l'ancien
   * rendez-vous (pris avant que la question existe). RIEN n'a été envoyé à
   * Calendly : l'ancien est INTACT. Le visiteur passe par la page Calendly de
   * déplacement, qui pose la question — on n'invente jamais la réponse.
   */
  | {
      readonly ok: false;
      readonly raison: "reponses_manquantes";
      readonly questions: readonly string[];
    }
  /**
   * Rendez-vous SUR PLACE (lieu `physical`) : la réservation directe ne sait
   * demander qu'un appel ou une visio, il ne se rejoue donc pas en ligne. Une
   * raison à part, pour que l'alerte dise la vraie cause — pas « données
   * incomplètes », qui ferait chercher un enrichissement raté.
   */
  | { readonly ok: false; readonly raison: "sur_place" };

/**
 * Relit les réponses aux questions depuis le contenu brut.
 *
 * 🔑 Elles doivent repartir avec le nouveau rendez-vous. Les perdre ferait
 * arriver dans l'agenda un rendez-vous sans contexte — et Will découvrirait au
 * moment de l'appel qu'il ne sait plus de quoi il s'agit, sans comprendre
 * pourquoi ce rendez-vous-là est vide alors que les autres ne le sont pas.
 *
 * Les libellés repartent EXACTEMENT tels qu'ils sont revenus : Calendly apparie
 * sur le texte, accents et casse compris.
 */
export function reponsesDuPayload(
  rawPayload: unknown,
): ReadonlyArray<{ question: string; reponse: string; position: number }> {
  // 🔴 CORRIGÉ le 2026-10-07 — « un déplacement renvoie les réponses déjà
  // données ». Cette fonction ne lisait que `rawPayload.questions_and_answers`
  // et `rawPayload.payload.questions_and_answers`. Or `enrich.ts` RÉÉCRIT la
  // charge brute à chaque passage sous la forme
  // `{ ..._clésPrivées, invitee, event, _refreshedAt }` : les réponses vivent
  // dans `rawPayload.invitee.questions_and_answers` (là où les lit déjà
  // `origine-rendez-vous.ts`). Le report repartait donc SANS AUCUNE réponse, et
  // depuis que les event-types portent des questions OBLIGATOIRES, Calendly
  // refusait la réservation de remplacement → `echec=refus`, à chaque fois.
  //
  // La forme enrichie passe EN PREMIER ; les anciennes formes restent lues.
  const racine = objet(rawPayload);
  const payload = objet(racine?.["payload"]);
  const candidats = [
    objet(racine?.["invitee"])?.["questions_and_answers"],
    racine?.["questions_and_answers"],
    payload?.["questions_and_answers"],
    objet(payload?.["invitee"])?.["questions_and_answers"],
  ].filter((c): c is unknown[] => Array.isArray(c));
  const brut = candidats.find((c) => c.length > 0) ?? candidats[0];
  if (!Array.isArray(brut)) return [];

  const out: Array<{ question: string; reponse: string; position: number }> = [];
  for (const qa of brut) {
    if (typeof qa !== "object" || qa === null) continue;
    const o = qa as Record<string, unknown>;
    const question = typeof o["question"] === "string" ? o["question"] : null;
    const reponse = typeof o["answer"] === "string" ? o["answer"] : null;
    const position = typeof o["position"] === "number" ? o["position"] : out.length;
    // Une réponse vide ne repart pas : elle écrirait « (vide) » dans le
    // récapitulatif, un bruit qu'on apprendrait à ignorer.
    if (!question || !reponse || reponse.trim() === "") continue;
    out.push({ question, reponse, position });
  }
  return out;
}

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Apparie les réponses de l'ANCIEN rendez-vous aux questions ACTUELLES de
 * l'event-type de destination.
 *
 * 🔑 La position qui part chez Calendly est celle de la question dans
 * l'event-type de DESTINATION (`questions.ts` : « c'est elle qu'attend l'API »),
 * et le libellé repart tel que l'event-type le porte aujourd'hui. Recopier la
 * position de l'ancien rendez-vous tiendrait tant que personne ne réordonne
 * les questions chez Calendly — puis enverrait chaque réponse sur la mauvaise
 * case.
 *
 * Appariement par libellé normalisé (casse, accents, ponctuation) : c'est le
 * seul lien stable entre une réponse donnée hier et une question d'aujourd'hui.
 *
 * ## 🔴 LE FILET : une question obligatoire sans réponse
 *
 * Un rendez-vous pris AVANT l'ajout d'une question obligatoire n'a pas de
 * réponse à lui donner. On ne la fabrique JAMAIS — une réponse inventée à
 * « Comment nous avez-vous connu ? » fausserait le compteur d'origine des
 * rendez-vous pour toujours, sans que rien ne la distingue d'une vraie. On
 * rend la liste des questions manquantes : l'appelant n'envoie RIEN à Calendly
 * (l'ancien rendez-vous reste intact) et renvoie le visiteur vers la page
 * Calendly de déplacement, qui sait poser la question.
 *
 * Seule complétion admise : une question de type `phone_number`, remplie avec le
 * numéro déjà en base — une donnée du visiteur, pas une invention.
 *
 * Une réponse à un choix qui n'existe plus (menu modifié depuis) est traitée
 * comme absente : Calendly la refuserait de toute façon. Une réponse dont la
 * question n'existe plus (ou est masquée, `QUESTIONS_MASQUEES`) ne repart pas,
 * comme le formulaire direct ne l'envoie pas.
 */
export function alignerSurLesQuestions(
  reponses: ReadonlyArray<{ question: string; reponse: string; position: number }>,
  questions: readonly QuestionEventType[],
  telephone: string | null,
):
  | { ok: true; reponses: Array<{ question: string; reponse: string; position: number }> }
  | { ok: false; manquantes: string[] } {
  const parLibelle = new Map<string, string>();
  for (const r of reponses) {
    const cle = normaliserLibelle(r.question);
    if (!parLibelle.has(cle)) parLibelle.set(cle, r.reponse);
  }

  const out: Array<{ question: string; reponse: string; position: number }> = [];
  const manquantes: string[] = [];
  for (const q of questions) {
    let valeur = parLibelle.get(normaliserLibelle(q.libelle)) ?? null;
    if (
      valeur !== null &&
      q.type === "single_select" &&
      !q.choix.includes(valeur) &&
      !q.autreAutorise
    ) {
      valeur = null;
    }
    if (valeur === null && q.type === "phone_number" && telephone) valeur = telephone;
    if (valeur === null) {
      if (q.requise) manquantes.push(q.libelle);
      continue;
    }
    out.push({ question: q.libelle, reponse: valeur, position: q.position });
  }
  return manquantes.length > 0 ? { ok: false, manquantes } : { ok: true, reponses: out };
}

/**
 * Reconstruit la demande à partir de la ligne existante.
 *
 * Exportée pour être éprouvée sans réseau : c'est ici que se perdraient
 * silencieusement le format, le téléphone ou les réponses.
 */
export function demandeDepuisLaSource(
  source: RendezVousSource,
  eventTypeUri: string,
  debut: Date,
  /**
   * Les questions ACTUELLES de l'event-type de destination
   * (`resoudreEventTypePourReservation`). Fournies, elles décident du libellé et
   * de la position qui partent, et une obligatoire sans réponse arrête le report
   * AVANT tout appel. Absentes : les réponses repartent telles qu'elles sont
   * revenues (comportement d'avant le 2026-10-07).
   */
  questionsDestination?: readonly QuestionEventType[],
):
  | { ok: true; demande: DemandeReservation }
  | { ok: false; manque: string; questionsManquantes?: readonly string[] } {
  if (!source.inviteeName) return { ok: false, manque: "le nom de l'invité" };
  if (!source.inviteeEmail) return { ok: false, manque: "l'adresse de l'invité" };

  // 🔑 Le format se DÉRIVE, il ne se devine pas — même dérivation que partout
  // ailleurs (`canal.ts`). Un rendez-vous téléphonique reporté doit rester
  // téléphonique : basculer en visio ferait attendre le prospect devant un
  // écran pendant qu'on compose son numéro.
  const format = canalDuRendezVous(source.location, source.rawPayload);
  if (format === "inconnu") {
    // On refuse plutôt que de choisir à la place du prospect. Un report qui
    // change le format sans le dire est pire qu'un report qui échoue.
    return { ok: false, manque: "le format du rendez-vous (ni téléphone ni visio reconnu)" };
  }
  if (format === "sur_place") {
    // 🔑 Un rendez-vous SUR PLACE (lieu `physical`, une adresse) ne se rejoue
    // pas par l'API : la réservation directe ne sait demander qu'un appel ou
    // une visio. Le reporter en `telephone` — ce qui arrivait tant que
    // `physical` était rangé parmi les téléphones — changerait le format sans
    // le dire. On refuse, l'alerte part, le visiteur est invité à nous écrire.
    return { ok: false, manque: "un format reportable en ligne (rendez-vous sur place)" };
  }

  // 🔴 LE NUMÉRO SUIT LE REPORT, VISIO COMPRISE (2026-09-03).
  //
  // Il n'était REPRIS que pour un appel sortant, et c'était cohérent tant que le
  // formulaire ne le demandait qu'à ce format-là. Depuis que le numéro est
  // obligatoire dans les deux (voir `formulaire-reservation.ts`), ne pas le
  // reporter le ferait disparaître au PREMIER report d'une visio : Calendly crée
  // un NOUVEL événement, `extractPhone` ne lit que ce que Calendly rend, et la
  // nouvelle ligne de la console naîtrait sans numéro. Le champ qu'on impose au
  // visiteur cesserait d'être vrai dès qu'il déplace son rendez-vous — c'est-à-
  // dire exactement quand un imprévu est en cours.
  //
  // Le refus ci-dessous, lui, ne bouge PAS : il ne vise que l'appel sortant, où
  // l'absence de numéro donne un rendez-vous sans personne à appeler. Une visio
  // ancienne, réservée avant cette règle, n'a pas de numéro en base et doit
  // pouvoir être reportée quand même.
  const telephone = source.inviteePhone ?? extraireTelephone(source.location);
  if (format === "telephone" && !telephone) {
    return { ok: false, manque: "le numéro à composer" };
  }

  let reponses: ReadonlyArray<{ question: string; reponse: string; position: number }> =
    reponsesDuPayload(source.rawPayload);
  if (questionsDestination) {
    const alignees = alignerSurLesQuestions(reponses, questionsDestination, telephone);
    if (!alignees.ok) {
      return {
        ok: false,
        manque: `une réponse obligatoire (${alignees.manquantes.join(" ; ")})`,
        questionsManquantes: alignees.manquantes,
      };
    }
    reponses = alignees.reponses;
  }

  return {
    ok: true,
    demande: {
      eventTypeUri,
      debut,
      nom: source.inviteeName,
      email: source.inviteeEmail,
      fuseau: source.timezone,
      format: format as FormatDemande,
      ...(telephone ? { telephone } : {}),
      ...(reponses.length > 0 ? { reponses } : {}),
      utmSource: source.utmSource,
      utmMedium: source.utmMedium,
      utmCampaign: source.utmCampaign,
      utmContent: source.utmContent ?? null,
    },
  };
}

/** Le `location` d'un appel sortant PORTE le numéro. Voir la phase 0. */
function extraireTelephone(location: string | null): string | null {
  if (!location) return null;
  const v = location.trim();
  return /^(\+|00)[0-9\s()\-.]{6,}$/.test(v) ? v : null;
}

/**
 * Reporte le rendez-vous.
 *
 * Ne lève jamais. L'ordre des deux opérations est la seule chose à ne pas
 * changer — voir l'en-tête.
 */
export async function reporterRendezVous(
  source: RendezVousSource,
  eventTypeUri: string,
  nouveauDebut: Date,
  /**
   * 2026-09-29 (chantier visio, PR 4) — JOURNAL du report : appelé dès que le
   * nouveau rendez-vous EXISTE, avant de libérer l'ancien. Un report fait sur
   * le site est une réservation neuve + une annulation : sans ce journal,
   * rien ne dirait au dossier client que le nouveau rendez-vous REMPLACE
   * l'ancien (la rencontre du nouveau hérite alors de la fiche proposée —
   * motif `report`). Ne bloque jamais le report : une erreur est avalée.
   */
  journaliser?: (ancienEventUri: string, nouvelEventUri: string) => Promise<unknown>,
  /** Les questions actuelles de l'event-type de destination — voir `demandeDepuisLaSource`. */
  questionsDestination?: readonly QuestionEventType[],
): Promise<ResultatReport> {
  if (canalDuRendezVous(source.location, source.rawPayload) === "sur_place") {
    return { ok: false, raison: "sur_place" };
  }
  const construite = demandeDepuisLaSource(
    source,
    eventTypeUri,
    nouveauDebut,
    questionsDestination,
  );
  if (!construite.ok) {
    if (construite.questionsManquantes) {
      return {
        ok: false,
        raison: "reponses_manquantes",
        questions: construite.questionsManquantes,
      };
    }
    return { ok: false, raison: "donnees_incompletes", manque: construite.manque };
  }

  // ── ÉTAPE 1 : le NOUVEAU. L'ancien n'est pas touché. ──────────────────────
  const nouveau = await reserverCreneau(construite.demande);

  if (!nouveau.ok) {
    // Toutes ces branches laissent l'ancien rendez-vous INTACT, et c'est le
    // point : le prospect garde ce qu'il avait, on ne lui a rien pris.
    switch (nouveau.raison) {
      case "creneau_pris":
        return { ok: false, raison: "creneau_pris" };
      case "silence":
        return { ok: false, raison: "silence" };
      case "portee_manquante":
        return {
          ok: false,
          raison: "portee_manquante",
          porteesRequises: nouveau.porteesRequises,
        };
      case "lieu_non_pris_en_compte":
        return {
          ok: false,
          raison: "lieu_non_pris_en_compte",
          nouvelEventUri: nouveau.eventUri,
          cancelUrl: nouveau.cancelUrl,
        };
      case "non_configure":
        return { ok: false, raison: "non_configure" };
      case "refus":
        return { ok: false, raison: "refus", detail: nouveau.detail };
      default:
        return raisonNonTraitee(nouveau);
    }
  }

  // ── ÉTAPE 2 : libérer l'ancien, MAINTENANT SEULEMENT. ─────────────────────
  //
  // ⚠️ À partir d'ici, le visiteur a son nouveau rendez-vous. Quoi qu'il arrive
  // ensuite, on ne lui montre PAS d'erreur : son but est atteint. Un doublon
  // est notre problème — deux créneaux bloqués se voient tout de suite dans
  // l'agenda — et le lui annoncer comme un échec l'inquiéterait pour rien.
  if (!source.eventUri) {
    return { ok: true, nouvelEventUri: nouveau.eventUri, ancienLibere: false };
  }
  if (journaliser) {
    try {
      await journaliser(source.eventUri, nouveau.eventUri);
    } catch {
      // Le journal est une aide au rangement : il ne coûte jamais le report.
    }
  }
  const ancien = await annulerRendezVous(source.eventUri);
  return { ok: true, nouvelEventUri: nouveau.eventUri, ancienLibere: ancien.ok };
}

function raisonNonTraitee(r: never): never {
  throw new Error(`Raison de reservation non traitee au report : ${JSON.stringify(r)}`);
}

/**
 * Écrit le lien « l'ancien rendez-vous a été reporté sur le nouveau »
 * (`calendly_reports`, chantier visio, PR 4). Idempotent : rejouer le même
 * report ne crée rien de plus. Le client de base est INJECTÉ (ce module ne
 * tire pas Prisma).
 */
export async function journaliserReport(
  db: Pick<Prisma.TransactionClient, "calendlyReport">,
  ancienEventUri: string,
  nouvelEventUri: string,
): Promise<void> {
  await db.calendlyReport.upsert({
    where: { ancienEventUri },
    create: { ancienEventUri, nouvelEventUri },
    update: { nouvelEventUri },
  });
}
