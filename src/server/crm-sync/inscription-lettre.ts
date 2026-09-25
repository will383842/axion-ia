/**
 * `newsletter_optin` AU FORMAT L4-C — un seul constructeur (lot L4-S, 2026-09-25).
 *
 * Deux chemins transmettent une inscription à la lettre :
 *   · la confirmation par bouton (`newsletter/confirmer.ts`) — anciens liens du
 *     double opt-in, réinscription d'un désabonné ;
 *   · le clic sur le lien du guide (`crm-sync/lettre-guide.ts`) — inscriptions
 *     faites à la demande du guide depuis l'amendement du 24/09.
 * Tous deux construisent l'événement ICI, pour qu'ils ne divergent pas.
 *
 * Contrat lu par `PersonnesIngestService` (CRM) :
 *   · `occurred_at` = date d'inscription (`confirmedAt`), jamais « maintenant » ;
 *   · `source_slug = "newsletter"` (tag gouverné `src:newsletter`) ;
 *   · `payload.placement` (point de collecte), `payload.locale` ;
 *   · `payload.base_legale` ∈ { consent, legitimate_interest_b2b } ;
 *   · `payload.email_nature` ∈ { pro, perso }, décidée par le SITE ;
 *   · `consent.at` seulement pour un consentement ;
 *   · `event_id` DÉTERMINISTE (abonné + date d'inscription).
 *
 * Module PUR : aucun accès base, aucun effet.
 */

import { natureAdresse } from "@/lib/email/nature-adresse";
import { VERSION_MENTION } from "@/content/guide-ia-formulaire";

import { eventIdInscriptionLettre } from "./event-id";
import type { CrmBaseLegaleLettre } from "./types";

/** `source_slug` gouverné côté CRM pour la lettre. */
export const SOURCE_SLUG_LETTRE = "newsletter";

/** Référence historique du texte de la lettre (`CONSENT_FORM_REFS.newsletter`). */
export const TEXT_REF_LETTRE_HISTORIQUE = "newsletter-double-optin";

/**
 * Préfixe des versions de la MENTION « adresse professionnelle ». Une ligne
 * d'abonné qui porte une telle version a été inscrite par INTÉRÊT LÉGITIME
 * (`guide-ia/demande.ts` : la mention est le texte prouvé). Tout le reste
 * (case cochée, ancien double opt-in, réinscription par bouton) est un
 * consentement. Comparé par PRÉFIXE : une mention v2 reste une mention — le
 * contraire ferait passer une inscription d'office pour un consentement,
 * c'est-à-dire du mauvais côté.
 */
export const PREFIXE_VERSION_MENTION_PRO = VERSION_MENTION.pro.replace(/-v\d+(-.*)?$/, "");

export function baseLegaleDeLInscription(consentVersion: string | null): CrmBaseLegaleLettre {
  return consentVersion?.startsWith(PREFIXE_VERSION_MENTION_PRO)
    ? "legitimate_interest_b2b"
    : "consent";
}

export function localeCrm(valeur: string | null | undefined): "fr" | "en" {
  return valeur === "en" ? "en" : "fr";
}

export interface InscriptionATransmettre {
  readonly id: string;
  readonly email: string;
  readonly locale: string | null;
  readonly source: string | null;
  readonly inscritLe: Date;
  readonly consentFormRef: string | null;
  readonly consentVersion: string | null;
}

/** Les champs de `syncNewsletterOptInToCrm`, construits d'une seule façon. */
export function evenementInscriptionLettre(abonne: InscriptionATransmettre) {
  const base = baseLegaleDeLInscription(abonne.consentVersion);
  return {
    eventId: eventIdInscriptionLettre(abonne.id, abonne.inscritLe),
    subjectRef: `site:newsletter_subscriber:${abonne.id}`,
    occurredAt: abonne.inscritLe,
    sourceSlug: SOURCE_SLUG_LETTRE,
    person: { email: abonne.email },
    consent: {
      version: abonne.consentVersion,
      // Un consentement se date ; une inscription par intérêt légitime n'a pas
      // de date de consentement à inventer (le CRM la laisse vide).
      ...(base === "consent" ? { at: abonne.inscritLe } : {}),
      textRef: abonne.consentFormRef ?? TEXT_REF_LETTRE_HISTORIQUE,
    },
    payload: {
      ...(abonne.source ? { placement: abonne.source } : {}),
      locale: localeCrm(abonne.locale),
      base_legale: base,
      email_nature: natureAdresse(abonne.email),
    },
  };
}
