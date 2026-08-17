/**
 * TESTS DE CONTRAT de la frontière site ↔ Axion CRM Pro (lot L2).
 *
 * ── Le problème que ces tests ferment ─────────────────────────────────────
 * Deux dépôts, deux langages, deux CI, aucun compilateur commun. Le contrat
 * d'ingestion est écrit DEUX FOIS : en TypeScript (`src/server/crm-sync/types.ts`)
 * et en PHP (`backend/app/Crm/Ingest/SiteSyncEvent.php`, dépôt Axion-CRM-Pro).
 * Un type ajouté d'un seul côté ne casse aucune compilation : il produit un
 * refus 422 en production, la ligne d'outbox passe en `gave_up`, et le lead
 * n'arrive JAMAIS. C'est déjà arrivé avec `simulateur_roi`.
 *
 * ── Pourquoi on ne lit PAS le fichier PHP ─────────────────────────────────
 * Le réflexe serait de parser `SiteSyncEvent.php` depuis ce test. On s'y refuse
 * pour deux raisons : le dépôt CRM est ABSENT de la CI du site (le test serait
 * vert par défaut d'y trouver quoi que ce soit — une garde qui ne garde rien),
 * et un test qui dépend d'une expression régulière sur du code étranger casse
 * au premier reformatage.
 *
 * On PINNE donc les listes attendues en dur, ici, avec la référence au fichier
 * PHP qui doit porter les mêmes. Le test ne compare pas les deux dépôts : il
 * compare le site à une TRANSCRIPTION DATÉE du contrat CRM. Faire bouger l'un
 * oblige à venir modifier ce fichier, donc à relire l'autre. C'est précisément
 * l'effet recherché : rendre la divergence impossible en silence.
 *
 * ⚠️ Si un test de ce fichier rougit, la question n'est jamais « comment le
 * faire passer » mais « les deux dépôts sont-ils encore d'accord ». La réponse
 * se trouve dans le fichier PHP cité, pas ici.
 *
 * Ces tests n'ont besoin d'AUCUNE pile locale : ni Postgres, ni Redis, ni CRM.
 */

import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

// `emit.ts` instancie le client Prisma au chargement. On le neutralise : ce
// fichier ne teste que des constantes et une signature, jamais une base.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { signBody } from "@/server/crm-sync/emit";
import {
  CRM_FORM_TYPES,
  CRM_SYNC_SCHEMA_VERSION,
  type CrmEventType,
  type CrmIngestStatus,
  type CrmSyncEvent,
} from "@/server/crm-sync/types";

// ── Transcription du contrat CRM (source PHP citée à chaque bloc) ──────────

/** Miroir de `SiteSyncEvent::FORM_TYPES` — 12 types unifiés + podcast + simulateur. */
const CRM_EXPECTED_FORM_TYPES = [
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
];

/** Miroir de `SiteSyncEvent::EVENT_TYPES` — les 14 points de capture, liste FERMÉE. */
const CRM_EXPECTED_EVENT_TYPES = [
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
];

/** Miroir de `SiteSyncEvent::TOP_LEVEL_KEYS` — toute clé hors liste ⇒ 422. */
const CRM_EXPECTED_TOP_LEVEL_KEYS = [
  "schema_version",
  "event_id",
  "event_type",
  "occurred_at",
  "form_type",
  "source_slug",
  "subject_ref",
  "person",
  "company",
  "consent",
  "candidate",
  "tags",
  "payload",
];

/** Miroirs de `SiteSyncEvent::{PERSON,COMPANY,CONSENT,CANDIDATE}_KEYS`. */
const CRM_EXPECTED_SECTION_KEYS = {
  person: ["person_key", "email", "first_name", "last_name", "phone"],
  company: ["siren", "name", "postcode", "city", "website", "size_category", "sector"],
  consent: ["version", "at", "text_ref", "vivier_at"],
  candidate: ["family", "offer_slug", "attributes", "experiences", "cv_ref"],
};

/** Miroir des constantes de `IngestOutcome` — les statuts qui SOLDENT une ligne. */
const CRM_EXPECTED_INGEST_STATUSES = [
  "created",
  "updated",
  "noop_idempotent",
  "pending_match",
  "opted_out",
];

/**
 * VERROU DE COMPILATION, en plus du verrou d'exécution.
 *
 * `Record<CrmEventType, true>` oblige cet objet à porter exactement une clé par
 * membre de l'union : un type ajouté au site sans être ajouté ici ne compile
 * plus, et une clé de trop non plus. Le test d'exécution qui suit compare
 * ensuite ces clés à la transcription du PHP — les trois doivent coïncider.
 */
const EVENT_TYPE_MIRROR: Record<CrmEventType, true> = {
  form_submission: true,
  calendly_booked: true,
  calendly_completed: true,
  calendly_canceled: true,
  calendly_no_show: true,
  newsletter_optin: true,
  newsletter_optout: true,
  review_posted: true,
  application_submitted: true,
  opt_out: true,
};

/** Même verrou pour les statuts rendus par le CRM. */
const INGEST_STATUS_MIRROR: Record<CrmIngestStatus, true> = {
  created: true,
  updated: true,
  noop_idempotent: true,
  pending_match: true,
  opted_out: true,
};

describe("contrat site ↔ CRM — listes gouvernées", () => {
  it("les types de formulaire du site sont EXACTEMENT ceux de SiteSyncEvent::FORM_TYPES", () => {
    // Comparaison ordonnée : les deux listes sont lues par des humains en
    // vis-à-vis, un même ordre rend la relecture croisée possible.
    expect([...CRM_FORM_TYPES]).toEqual(CRM_EXPECTED_FORM_TYPES);
  });

  it("aucun type de formulaire n'est en double", () => {
    expect(new Set(CRM_FORM_TYPES).size).toBe(CRM_FORM_TYPES.length);
  });

  it("les types d'événement du site sont EXACTEMENT ceux de SiteSyncEvent::EVENT_TYPES", () => {
    expect(Object.keys(EVENT_TYPE_MIRROR).sort()).toEqual([...CRM_EXPECTED_EVENT_TYPES].sort());
  });

  it("les statuts d'ingestion attendus sont ceux d'IngestOutcome", () => {
    expect(Object.keys(INGEST_STATUS_MIRROR).sort()).toEqual(
      [...CRM_EXPECTED_INGEST_STATUSES].sort(),
    );
  });

  it("la version de schéma est la même des deux côtés (SiteSyncEvent::SCHEMA_VERSION)", () => {
    expect(CRM_SYNC_SCHEMA_VERSION).toBe(1);
  });
});

describe("contrat site ↔ CRM — forme du message", () => {
  /**
   * Événement MAXIMAL : toutes les clés optionnelles renseignées. C'est ce qui
   * rend le test capable de voir un champ ajouté côté site — un événement
   * minimal ne porterait pas la clé nouvelle et passerait sans rien dire.
   */
  const maximalEvent: CrmSyncEvent = {
    schema_version: CRM_SYNC_SCHEMA_VERSION,
    event_id: "11111111-2222-3333-4444-555555555555",
    event_type: "application_submitted",
    occurred_at: "2026-08-14T09:00:00.000Z",
    form_type: "recrutement",
    source_slug: "zz-test",
    subject_ref: "site:submission:11111111-2222-3333-4444-555555555555",
    person: {
      person_key: "a".repeat(64),
      email: "zz-test@axion-ia.test",
      first_name: "ZZ",
      last_name: "TEST",
      phone: "+33100000000",
    },
    company: {
      siren: "000000000",
      name: "ZZ TEST",
      postcode: "38000",
      city: "Grenoble",
      website: "https://exemple.test",
      size_category: "tpe",
      sector: "services",
    },
    consent: {
      version: "candidature-v2",
      at: "2026-08-14T09:00:00.000Z",
      text_ref: "zz-test",
      vivier_at: "2026-08-14T09:00:00.000Z",
    },
    candidate: {
      family: "candidat_commercial",
      offer_slug: "zz-test",
      attributes: {},
      experiences: [],
      cv_ref: "site:cv:zz-test",
    },
    tags: ["src:zz-test"],
    payload: { page: "/zz-test" },
  };

  it("aucune clé de premier niveau n'est inconnue du contrat PHP", () => {
    // Le schéma CRM est STRICT : une clé hors liste fait rejeter tout le
    // message en 422, elle n'est pas ignorée.
    expect(Object.keys(maximalEvent).sort()).toEqual([...CRM_EXPECTED_TOP_LEVEL_KEYS].sort());
  });

  it.each(Object.entries(CRM_EXPECTED_SECTION_KEYS))(
    "la section « %s » n'expose que les clés acceptées par le CRM",
    (section, expectedKeys) => {
      const value = maximalEvent[section as "person" | "company" | "consent" | "candidate"];
      expect(Object.keys(value ?? {}).sort()).toEqual([...expectedKeys].sort());
    },
  );

  it("subject_ref porte le préfixe « site: » exigé par le CRM", () => {
    // `SiteSyncEvent::fromArray()` refuse en 422 (`invalid_subject_ref`) toute
    // référence qui ne commence pas par « site: ». Le préfixe n'est pas
    // décoratif : c'est lui qui dit au CRM que la ligne vient du site et non
    // d'un collecteur, et il conditionne la réconciliation.
    const crmRule = (ref: string): boolean => ref.startsWith("site:");

    expect(crmRule(maximalEvent.subject_ref)).toBe(true);
    expect(maximalEvent.subject_ref).toMatch(/^site:[a-z-]+:[0-9a-f-]{36}$/);

    for (const accepted of ["site:submission:abc", "site:review:12", "site:newsletter:x"]) {
      expect(crmRule(accepted)).toBe(true);
    }
    for (const refused of ["submission:abc", "crm:submission:abc", "", "SITE:submission:abc"]) {
      expect(crmRule(refused)).toBe(false);
    }
  });
});

describe("contrat site ↔ CRM — signature HMAC", () => {
  // Secret de test construit par concaténation : un littéral hexadécimal de 64
  // caractères dans un fichier versionné est ce qu'un scanner doit signaler.
  const secret = ("0123456789" + "abcdef").repeat(4);

  it("signBody signe « <horodatage>.<corps> », vecteur recalculé indépendamment", () => {
    const timestamp = "1755172800";
    const body = JSON.stringify({ schema_version: 1, event_id: "zz-test-event" });

    // Vecteur calculé SANS passer par le code testé — miroir exact de
    // `HmacSignature::signedPayload()` puis `hash_hmac('sha256', …)` côté PHP.
    const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

    expect(signBody(secret, timestamp, body)).toBe(expected);
    expect(signBody(secret, timestamp, body)).toHaveLength(64);
    expect(signBody(secret, timestamp, body)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("l'horodatage est DANS la signature — le retirer change le résultat", () => {
    // Sans horodatage signé, une requête légitime interceptée resterait
    // rejouable pour l'éternité. Ce test interdit de « simplifier » la
    // signature en ne signant que le corps.
    const body = JSON.stringify({ zz: "test" });
    const signedWithTimestamp = signBody(secret, "1755172800", body);
    const signedBodyOnly = createHmac("sha256", secret).update(body).digest("hex");

    expect(signedWithTimestamp).not.toBe(signedBodyOnly);
  });

  it("deux horodatages différents produisent deux signatures différentes", () => {
    const body = JSON.stringify({ zz: "test" });

    expect(signBody(secret, "1755172800", body)).not.toBe(signBody(secret, "1755172801", body));
  });

  it("un corps re-sérialisé n'est PAS interchangeable avec le corps exact", () => {
    // Le corps signé doit être la chaîne EXACTE envoyée : le CRM vérifie la
    // signature sur les OCTETS reçus. Une re-sérialisation de l'autre côté —
    // ne serait-ce qu'une différence d'espacement — invaliderait la signature.
    const timestamp = "1755172800";
    const exact = '{"a": 1, "b": 2}';
    const reserialized = JSON.stringify(JSON.parse(exact));

    expect(reserialized).not.toBe(exact);
    expect(signBody(secret, timestamp, exact)).not.toBe(signBody(secret, timestamp, reserialized));
  });
});
