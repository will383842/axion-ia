/**
 * CONTRAT du canal site → CRM (lot L2), miroir EXACT du contrat d'entrée
 * `App\Crm\Ingest\SiteSyncEvent` côté Axion CRM Pro.
 *
 * Le schéma y est STRICT : toute clé inconnue fait rejeter le message (422).
 * Ce fichier est donc la seule source de vérité côté site — un champ ajouté
 * ici sans être ajouté là-bas casse la synchro, et réciproquement. Les deux
 * fichiers portent le même numéro de version de schéma.
 *
 * Ce que le payload ne porte JAMAIS, volontairement :
 *   - le workspace ni le type de relation de destination : c'est le CRM qui
 *     classe (sinon le site déciderait de l'univers d'atterrissage) ;
 *   - de pièce jointe : le CV reste sur le disque du site, `cv_ref` n'est
 *     qu'une référence (surface RGPD minimale) ;
 *   - de jeton du site (désinscription, RGPD) : ils restent côté site, qui est
 *     la source de vérité du consentement.
 */

export const CRM_SYNC_SCHEMA_VERSION = 1;

/** Univers de destination — informatif ; le CRM tranche de son côté. */
export type CrmUniverse = "business" | "vivier";

/**
 * Types d'événement — 🔴 MIROIR EXACT de `SiteSyncEvent::EVENT_TYPES` (CRM).
 * Liste RUNTIME pour être pinnée par un test (`contract.spec.ts`), comme
 * `CRM_FORM_TYPES`.
 *
 * Lot L4-S (2026-09-25) — deux types de plus, arrivés au CRM avec son lot L4-C :
 *   · `lead_magnet_requested` : clic HUMAIN (POST) sur le lien personnel du
 *     guide (décision D1) — jamais la simple demande, qu'un tiers peut faire ;
 *   · `email_hard_bounced` : rebond dur constaté sur un abonné.
 * Tous deux derrière `CRM_SYNC_GUIDE_ENABLED` (OFF) : le CRM les refuse en 503
 * tant que sa propre ingestion « personnes » est fermée.
 */
export const CRM_EVENT_TYPES = [
  "form_submission",
  "calendly_booked",
  "calendly_completed",
  "calendly_canceled",
  "calendly_no_show",
  "newsletter_optin",
  "newsletter_optout",
  "review_posted",
  "application_submitted",
  "opt_out",
  "lead_magnet_requested",
  "email_hard_bounced",
] as const;

export type CrmEventType = (typeof CRM_EVENT_TYPES)[number];

/**
 * Les types qui n'existent que derrière `CRM_SYNC_GUIDE_ENABLED`. Le verrou est
 * posé dans `enqueue.ts`, au point de passage unique : un appelant qui
 * oublierait le drapeau n'écrirait quand même rien.
 */
export const CRM_EVENT_TYPES_DU_FLUX_GUIDE: readonly CrmEventType[] = [
  "lead_magnet_requested",
  "email_hard_bounced",
];

/**
 * `payload` des événements « personnes » (lettre et guide), clés lues par
 * `PersonnesIngestService` côté CRM (`CLES_PAYLOAD_CONSIGNEES`) :
 *   · `base_legale`  — `consent` | `legitimate_interest_b2b`
 *                      (`Taxonomy::ABONNEMENT_LEGAL_BASES`) ;
 *   · `email_nature` — `pro` | `perso`, décidée par le SITE ;
 *   · `placement`, `locale`, `aimant`, `verifie`.
 * `lettre` (statut de la lettre au moment du clic) voyage aussi : le CRM
 * l'accepte (le `payload` n'est pas à clés fermées) sans le consigner — c'est
 * `newsletter_optin` qui porte l'abonnement.
 */
export type CrmBaseLegaleLettre = "consent" | "legitimate_interest_b2b";
export type CrmNatureEmail = "pro" | "perso";
export type CrmStatutLettre = "abonne" | "non_abonne" | "desabonne";

/**
 * Types métier du formulaire unifié (12) + podcast + simulateur de gains.
 *
 * 🔴 MIROIR EXACT de `SiteSyncEvent::FORM_TYPES` (CRM :
 * `backend/app/Crm/Ingest/SiteSyncEvent.php`). Aucun compilateur ne relie les
 * deux dépôts : un type présent ici et absent là-bas est refusé 422, la ligne
 * d'outbox passe en `gave_up` et le lead n'arrive JAMAIS. C'est arrivé avec
 * `simulateur_roi`. D'où la liste RUNTIME ci-dessous plutôt qu'une simple union
 * de types : elle est pinnée par un test, et le CRM en a un symétrique.
 */
export const CRM_FORM_TYPES = [
  "audit",
  "implementation",
  "formation",
  "un_a_un",
  "devis",
  "partenariat",
  "presse",
  "recrutement",
  "speaker",
  "investisseur",
  "support_client",
  "autre",
  "podcast",
  "simulateur_roi",
] as const;

export type CrmFormType = (typeof CRM_FORM_TYPES)[number];

/** Familles de métiers du vivier — liste FERMÉE (cf. `Taxonomy::CANDIDATE_RELATION_TYPES`). */
export type CrmCandidateFamily =
  "candidat_commercial" | "candidat_video" | "candidat_tech" | "candidat_autre";

export interface CrmSyncEvent {
  schema_version: typeof CRM_SYNC_SCHEMA_VERSION;
  /** Clé d'idempotence de l'événement (UUID). Rejouer = aucun doublon côté CRM. */
  event_id: string;
  event_type: CrmEventType;
  occurred_at: string;
  form_type?: CrmFormType;
  /** Slug de provenance → tag gouverné `src:<slug>`. */
  source_slug?: string;
  /** Référence de l'enregistrement source : `site:submission:<uuid>`. */
  subject_ref: string;
  person: {
    /** `hashEmailForLookup(email)` — la clé qui traverse les deux systèmes. */
    person_key: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
  company?: {
    siren?: string;
    name?: string;
    postcode?: string;
    city?: string;
    website?: string;
    size_category?: string;
    sector?: string;
  };
  consent?: {
    version?: string;
    at?: string;
    text_ref?: string;
    /** Horodatage de l'accord de conservation en VIVIER (case optionnelle v2). */
    vivier_at?: string;
  };
  candidate?: {
    family?: CrmCandidateFamily;
    offer_slug?: string;
    attributes?: Record<string, unknown>;
    experiences?: unknown[];
    cv_ref?: string;
  };
  /** Tags gouvernés supplémentaires (`namespace:valeur`). */
  tags?: string[];
  /** Métadonnées de timeline (page, UTM…). Jamais de PII hors des champs dédiés. */
  payload?: Record<string, unknown>;
}

/** Statut renvoyé par le CRM quand il a accepté le message. */
export type CrmIngestStatus =
  "created" | "updated" | "noop_idempotent" | "pending_match" | "opted_out";

export interface CrmIngestResponse {
  ok?: boolean;
  result?: {
    status?: CrmIngestStatus;
    subject_type?: string | null;
    subject_id?: number | null;
    activity_id?: number | null;
    tags?: string[];
  };
  error?: string;
  message?: string;
}
