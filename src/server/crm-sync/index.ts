import { hashEmailForLookup, normalizeEmail } from "@/lib/security/email-hash";

import { enqueueCrmSyncEvent, newCrmEventId, type CrmOutboxWriter } from "./enqueue";
import {
  CRM_SYNC_SCHEMA_VERSION,
  type CrmCandidateFamily,
  type CrmEventType,
  type CrmFormType,
  type CrmSyncEvent,
} from "./types";

/**
 * API PUBLIQUE de la synchro site → CRM : une fonction par famille de point de
 * capture, appelée juste après l'écriture métier.
 *
 * Trois règles tenues par ce module, et par lui seul — les appelants n'ont
 * RIEN à savoir de la synchro :
 *   1. il ne lève jamais (aucun try/catch nécessaire chez l'appelant) ;
 *   2. il ne fait aucun appel réseau (l'émission part par la queue) ;
 *   3. drapeau `CRM_SYNC_ENABLED` à OFF ⇒ il ne fait STRICTEMENT rien, pas
 *      même une écriture en base.
 *
 * `person_key` = `hashEmailForLookup(email)`, c'est-à-dire EXACTEMENT le
 * `contactEmailHash` déjà posé sur les submissions. Les deux systèmes
 * partagent donc la même clé de personne, ce qui rend une demande RGPD
 * transverse (« tout ce que vous avez sur moi ») résoluble des deux côtés sans
 * jamais transporter l'adresse en clair d'un index à l'autre.
 */

export { enqueueCrmSyncEvent, newCrmEventId } from "./enqueue";
export { emitOutboxRow } from "./emit";
export * from "./types";

interface PersonInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  phone?: string | null;
}

interface CompanyInput {
  name?: string | null;
  siren?: string | null;
  postcode?: string | null;
  city?: string | null;
  website?: string | null;
  sizeCategory?: string | null;
  sector?: string | null;
}

interface ConsentInput {
  version?: string | null;
  at?: Date | string | null;
  textRef?: string | null;
  vivierAt?: Date | string | null;
}

interface BaseInput {
  subjectRef: string;
  occurredAt?: Date | null;
  person: PersonInput;
  company?: CompanyInput | null;
  consent?: ConsentInput | null;
  sourceSlug?: string | null;
  tags?: string[];
  payload?: Record<string, unknown>;
  tx?: CrmOutboxWriter;
}

/** Un formulaire du site (les 12 types unifiés + podcast + simulateur). */
export async function syncFormSubmissionToCrm(
  input: BaseInput & { formType: CrmFormType },
): Promise<void> {
  await dispatch("form_submission", input, { form_type: input.formType });
}

/** Un rendez-vous Calendly (pris, honoré, annulé, non honoré). */
export async function syncCalendlyEventToCrm(
  input: BaseInput & { kind: "booked" | "completed" | "canceled" | "no_show" },
): Promise<void> {
  const map = {
    booked: "calendly_booked",
    completed: "calendly_completed",
    canceled: "calendly_canceled",
    no_show: "calendly_no_show",
  } as const;

  await dispatch(map[input.kind], input, {});
}

/**
 * Abonnement à la lettre — émis à la CONFIRMATION du double opt-in, jamais à
 * la demande d'inscription : tant que l'adresse n'est pas confirmée, il n'y a
 * pas de consentement à transmettre (et l'inscription peut être le fait d'un
 * tiers).
 */
export async function syncNewsletterOptInToCrm(input: BaseInput): Promise<void> {
  await dispatch("newsletter_optin", input, {});
}

/** Désinscription — inscrit l'opposition côté CRM (univers business). */
export async function syncNewsletterOptOutToCrm(input: BaseInput): Promise<void> {
  await dispatch("newsletter_optout", input, {});
}

/** Avis client publié — l'auteur certifie être un client réel. */
export async function syncReviewToCrm(input: BaseInput): Promise<void> {
  await dispatch("review_posted", input, {});
}

/**
 * Candidature (offre d'emploi ou tunnel commercial) — univers VIVIER.
 *
 * Deux verrous en amont : le drapeau `CRM_SYNC_CANDIDATES_ENABLED` côté site,
 * et le REJET par le CRM de toute fiche sans consentement v2. Le second n'est
 * pas une redondance : c'est lui qui fait foi, le drapeau ne dispense de rien.
 */
export async function syncCandidateToCrm(
  input: BaseInput & {
    family: CrmCandidateFamily;
    offerSlug?: string | null;
    attributes?: Record<string, unknown>;
    experiences?: unknown[];
    cvRef?: string | null;
  },
): Promise<void> {
  await dispatch("application_submitted", input, {
    candidate: clean({
      family: input.family,
      offer_slug: input.offerSlug ?? undefined,
      attributes: input.attributes,
      experiences: input.experiences,
      cv_ref: input.cvRef ?? undefined,
    }),
  });
}

async function dispatch(
  eventType: CrmEventType,
  input: BaseInput,
  extra: Partial<CrmSyncEvent>,
): Promise<void> {
  const personKey = safePersonKey(input.person.email);
  if (!personKey) return;

  const [firstName, lastName] = splitName(input.person);

  const event: CrmSyncEvent = {
    schema_version: CRM_SYNC_SCHEMA_VERSION,
    event_id: newCrmEventId(),
    event_type: eventType,
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
    subject_ref: input.subjectRef,
    person: clean({
      person_key: personKey,
      email: normalizeEmail(input.person.email),
      first_name: firstName,
      last_name: lastName,
      phone: input.person.phone ?? undefined,
    }) as CrmSyncEvent["person"],
    ...(input.sourceSlug ? { source_slug: input.sourceSlug } : {}),
    ...(input.company ? { company: companySection(input.company) } : {}),
    ...(input.consent ? { consent: consentSection(input.consent) } : {}),
    ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
    ...(input.payload ? { payload: input.payload } : {}),
    ...extra,
  };

  await enqueueCrmSyncEvent(event, input.tx ? { tx: input.tx } : {});
}

function companySection(company: CompanyInput): NonNullable<CrmSyncEvent["company"]> {
  return clean({
    // Le CRM refuse tout SIREN qui n'est pas exactement 9 chiffres : on
    // nettoie ici (les formulaires acceptent « 123 456 789 »), on n'invente
    // rien — un numéro non conforme est simplement omis.
    siren: normalizeSiren(company.siren),
    name: company.name ?? undefined,
    postcode: company.postcode ?? undefined,
    city: company.city ?? undefined,
    website: company.website ?? undefined,
    size_category: company.sizeCategory ?? undefined,
    sector: company.sector ?? undefined,
  });
}

function consentSection(consent: ConsentInput): NonNullable<CrmSyncEvent["consent"]> {
  return clean({
    version: consent.version ?? undefined,
    at: toIso(consent.at),
    text_ref: consent.textRef ?? undefined,
    vivier_at: toIso(consent.vivierAt),
  });
}

export function normalizeSiren(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  // Un SIRET (14 chiffres) contient le SIREN en tête : on le récupère plutôt
  // que de perdre le rattachement à l'entreprise.
  if (digits.length === 14) return digits.slice(0, 9);
  return digits.length === 9 ? digits : undefined;
}

function splitName(person: PersonInput): [string | undefined, string | undefined] {
  if (person.firstName || person.lastName) {
    return [person.firstName ?? undefined, person.lastName ?? undefined];
  }

  const full = person.fullName?.trim();
  if (!full) return [undefined, undefined];

  const parts = full.split(/\s+/);
  if (parts.length === 1) return [undefined, parts[0]];

  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * `hashEmailForLookup` lève si la clé de chiffrement manque en production.
 * Un défaut de configuration ne doit pas faire échouer une capture de lead :
 * on renonce à l'événement (et on le dit), on ne casse pas le parcours.
 */
function safePersonKey(email: string): string | null {
  try {
    return hashEmailForLookup(email);
  } catch (error) {
    console.error("[crm-sync] person_key impossible à calculer:", error);
    return null;
  }
}

/**
 * Le contrat d'entrée du CRM est STRICT : une clé présente avec la valeur
 * `null` n'est pas la même chose qu'une clé absente. `clean()` retire donc les
 * `undefined`, les `null` et les chaînes vides AVANT sérialisation.
 *
 * Le type de retour dit cela au compilateur : chaque clé devient optionnelle et
 * son type perd `undefined`/`null`. Sans quoi, en `exactOptionalPropertyTypes`,
 * TypeScript refuse d'affecter le résultat aux sections de `CrmSyncEvent` (qui
 * déclarent `siren?: string`, pas `siren?: string | undefined`) — alors même
 * que la valeur produite à l'exécution est correcte.
 */
type Cleaned<T> = { [K in keyof T]?: Exclude<T[K], undefined | null> };

function clean<T extends Record<string, unknown>>(input: T): Cleaned<T> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  ) as Cleaned<T>;
}
