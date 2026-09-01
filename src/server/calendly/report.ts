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

import type { DemandeReservation, FormatDemande } from "./reservation";
import { reserverCreneau } from "./reservation";
import { annulerRendezVous } from "./annulation";
import { canalDuRendezVous } from "./canal";

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
  | { readonly ok: false; readonly raison: "donnees_incompletes"; readonly manque: string };

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
  const racine = rawPayload as Record<string, unknown> | null;
  const brut =
    racine?.["questions_and_answers"] ??
    (racine?.["payload"] as Record<string, unknown> | undefined)?.["questions_and_answers"];
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
): { ok: true; demande: DemandeReservation } | { ok: false; manque: string } {
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

  // Le numéro n'est nécessaire que pour un appel — mais alors il l'est
  // vraiment : sans lui, on aurait un rendez-vous sans personne à appeler.
  const telephone = source.inviteePhone ?? extraireTelephone(source.location);
  if (format === "telephone" && !telephone) {
    return { ok: false, manque: "le numéro à composer" };
  }

  const reponses = reponsesDuPayload(source.rawPayload);

  return {
    ok: true,
    demande: {
      eventTypeUri,
      debut,
      nom: source.inviteeName,
      email: source.inviteeEmail,
      fuseau: source.timezone,
      format: format as FormatDemande,
      ...(format === "telephone" && telephone ? { telephone } : {}),
      ...(reponses.length > 0 ? { reponses } : {}),
      utmSource: source.utmSource,
      utmMedium: source.utmMedium,
      utmCampaign: source.utmCampaign,
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
): Promise<ResultatReport> {
  const construite = demandeDepuisLaSource(source, eventTypeUri, nouveauDebut);
  if (!construite.ok)
    return { ok: false, raison: "donnees_incompletes", manque: construite.manque };

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
  const ancien = await annulerRendezVous(source.eventUri);
  return { ok: true, nouvelEventUri: nouveau.eventUri, ancienLibere: ancien.ok };
}

function raisonNonTraitee(r: never): never {
  throw new Error(`Raison de reservation non traitee au report : ${JSON.stringify(r)}`);
}
