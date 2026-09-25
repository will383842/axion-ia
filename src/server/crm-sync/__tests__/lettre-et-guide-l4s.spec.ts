// @vitest-environment node
//
// LOT L4-S (2026-09-25) — la lettre et le guide entrent au CRM Pro.
//
// Ce fichier joue les VRAIS modules (route du lien, `lettre-guide.ts`,
// `enqueue.ts`, `rebonds.ts`, `desabonner.ts`, `confirmer.ts`, `inbound.ts`,
// rattrapage) contre une base SIMULÉE qui garde son état : une ligne d'outbox
// écrite ici est une ligne qu'un second passage relit. Seuls la file BullMQ,
// le débit, Plausible, Telegram et le registre de preuve sont remplacés.
//
// Chaque « rien ne part » est accompagné d'un TÉMOIN positif (le chemin a bien
// été parcouru), sinon il serait satisfait par n'importe quelle panne.
//
// Adresses en `@example.invalid` uniquement (dépôt PUBLIC). La nature d'une
// adresse « personnelle » est SIMULÉE (`natureAdresse` remplacée) : aucun
// domaine de messagerie réel n'est écrit ni utilisé ici.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Ligne = Record<string, unknown>;

const base = vi.hoisted(() => ({
  demandes: [] as Ligne[],
  abonnes: [] as Ligne[],
  outbox: [] as Ligne[],
  entrants: [] as Ligne[],
  oppositions: [] as Ligne[],
  ecritures: [] as string[],
  /** Vrai pendant un `$transaction` : la file doit être appelée APRÈS. */
  enTransaction: false,
  /** Types d'événement dont l'écriture en outbox échoue (panne simulée). */
  echecOutbox: new Set<string>(),
  /** Appels à la file : `enTransaction` au moment de l'appel. */
  file: [] as Array<{ outboxId: string; enTransaction: boolean }>,
  /** Comportement de `crmSyncQueue.add` : « ne revient jamais » possible. */
  fileMuette: false,
}));

vi.mock("@/lib/prisma", () => {
  function correspond(ligne: Ligne, where: Record<string, unknown> | undefined): boolean {
    for (const [cle, cond] of Object.entries(where ?? {})) {
      const v = ligne[cle];
      if (cond === null) {
        if (v !== null && v !== undefined) return false;
        continue;
      }
      if (cond instanceof Date) {
        if (!(v instanceof Date) || v.getTime() !== cond.getTime()) return false;
        continue;
      }
      if (typeof cond === "object") {
        const c = cond as Record<string, unknown>;
        const operateurs = ["not", "in", "gte", "lt", "gt"];
        if (!Object.keys(c).some((k) => operateurs.includes(k))) {
          // Clé composée (`emailKey_aimant: { emailKey, aimant }`).
          if (!correspond(ligne, c)) return false;
          continue;
        }
        if ("not" in c) {
          if (c.not === null ? v === null || v === undefined : v === c.not) return false;
        }
        if ("in" in c) {
          const liste = (c.in as unknown[]).map((x) =>
            typeof x === "string" ? x.toLowerCase() : x,
          );
          if (!liste.includes(typeof v === "string" ? v.toLowerCase() : v)) return false;
        }
        if ("gte" in c && (!(v instanceof Date) || v < (c.gte as Date))) return false;
        if ("lt" in c && (!(v instanceof Date) || v >= (c.lt as Date))) return false;
        if ("gt" in c && !(String(v) > String(c.gt))) return false;
        continue;
      }
      if (cle === "email" && typeof v === "string" && typeof cond === "string") {
        if (v.toLowerCase() !== cond.toLowerCase()) return false;
        continue;
      }
      if (v !== cond) return false;
    }
    return true;
  }
  /** `orderBy: { id }` + `take` : ce qu'il faut à la pagination par curseur. */
  function paginer(
    lignes: Ligne[],
    args: { orderBy?: Record<string, string>; take?: number } | undefined,
  ): Ligne[] {
    let r = lignes;
    if (args?.orderBy && "id" in args.orderBy) {
      r = [...r].sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1));
    }
    return args?.take === undefined ? r : r.slice(0, args.take);
  }
  function table(nom: "demandes" | "abonnes" | "entrants" | "oppositions") {
    const lignes = () => base[nom];
    return {
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        lignes().find((l) => correspond(l, where)) ?? null,
      findUniqueOrThrow: async ({ where }: { where: Record<string, unknown> }) => {
        const l = lignes().find((x) => correspond(x, where));
        if (!l) throw new Error("introuvable");
        return l;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        lignes().find((l) => correspond(l, where)) ?? null,
      findMany: async (
        args: {
          where?: Record<string, unknown>;
          orderBy?: Record<string, string>;
          take?: number;
        } = {},
      ) =>
        paginer(
          lignes().filter((l) => correspond(l, args.where)),
          args,
        ),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Ligne }) => {
        const cibles = lignes().filter((l) => correspond(l, where));
        for (const l of cibles) Object.assign(l, data);
        if (cibles.length > 0)
          base.ecritures.push(`${nom}.updateMany:${Object.keys(data).join(",")}`);
        return { count: cibles.length };
      },
      update: async ({ where, data }: { where: Record<string, unknown>; data: Ligne }) => {
        const l = lignes().find((x) => correspond(x, where));
        if (!l) throw new Error("introuvable");
        Object.assign(l, data);
        base.ecritures.push(`${nom}.update:${Object.keys(data).join(",")}`);
        return l;
      },
      create: async ({ data }: { data: Ligne }) => {
        const l = { id: `${nom}-${lignes().length + 1}`, ...data };
        lignes().push(l);
        base.ecritures.push(`${nom}.create`);
        return l;
      },
    };
  }
  const outbox = {
    create: async ({ data }: { data: Ligne }) => {
      if (base.echecOutbox.has(String(data.eventType))) {
        throw Object.assign(new Error("base indisponible"), { code: "P1001" });
      }
      if (base.outbox.some((l) => l.eventId === data.eventId)) {
        throw Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
          meta: { target: ["event_id"] },
        });
      }
      const l = {
        id: `outbox-${base.outbox.length + 1}`,
        createdAt: new Date(),
        status: "pending",
        attempts: 0,
        responseStatus: null,
        ...data,
      };
      base.outbox.push(l);
      base.ecritures.push(`outbox.create:${String(data.eventType)}`);
      return { id: l.id };
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) =>
      base.outbox.find((l) => correspond(l, where)) ?? null,
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      base.outbox.find((l) => correspond(l, where)) ?? null,
    findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
      base.outbox.filter((l) => correspond(l, where)),
  };
  const TABLES = ["demandes", "abonnes", "outbox", "entrants", "oppositions"] as const;
  const client = {
    guideRequest: table("demandes"),
    newsletterSubscriber: table("abonnes"),
    crmInboundEvent: table("entrants"),
    emailOpposition: table("oppositions"),
    crmSyncOutbox: outbox,
    // Une VRAIE transaction : une exception annule toutes les écritures.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const photo = TABLES.map((t) => ({
        t,
        lignes: base[t].map((ref) => ({ ref, copie: { ...ref } })),
      }));
      base.enTransaction = true;
      try {
        return await fn(client);
      } catch (e) {
        for (const { t, lignes } of photo) {
          base[t].length = 0;
          for (const { ref, copie } of lignes) {
            for (const k of Object.keys(ref)) delete ref[k];
            Object.assign(ref, copie);
            base[t].push(ref);
          }
        }
        throw e;
      } finally {
        base.enTransaction = false;
      }
    },
  };
  return { prisma: client };
});

vi.mock("@/server/queue/queues", () => ({
  crmSyncQueue: {
    add: (_nom: string, data: { outboxId: string }) => {
      base.file.push({ outboxId: data.outboxId, enTransaction: base.enTransaction });
      // Redis injoignable avec `maxRetriesPerRequest: null` : `add` ne revient jamais.
      return base.fileMuette ? new Promise(() => undefined) : Promise.resolve(undefined);
    },
  },
}));
vi.mock("@/lib/email/nature-adresse", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/nature-adresse")>()),
  // Nature SIMULÉE : aucun domaine de messagerie réel dans ce fichier.
  natureAdresse: (e: string) => (/@perso\.example\.invalid$/i.test(e.trim()) ? "perso" : "pro"),
}));
vi.mock("@/server/guide-ia/envoi", () => ({ mettreEnFileGuide: async () => "en-file" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/analytics/plausible-serveur", () => ({
  emettreEvenementPlausible: async () => true,
}));
vi.mock("@/server/notifications", () => ({ notify: async () => ({ ok: true }) }));
vi.mock("@/server/crm-sync/alerts", () => ({
  alertCrmSync: async () => undefined,
  crmSyncAlertDedupKey: () => "cle",
  CRM_SYNC_BACKLOG_THRESHOLD: 50,
}));
vi.mock("@/lib/consents", () => ({
  CONSENT_FORM_REFS: { newsletter: "newsletter-double-optin" },
  recordConsentEvent: async () => true,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("@/lib/security/email-hash", () => ({
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
  // Forme RÉELLE d'une clé (64 hex), exigée par le contrat du CRM.
  hashEmailForLookup: (e: string | null | undefined) =>
    e ? createHash("sha256").update(`cle|${e.trim().toLowerCase()}`).digest("hex") : null,
}));

// eslint-disable-next-line no-restricted-imports -- le test joue la VRAIE route du lien (GET/POST)
import { GET, POST } from "@/app/api/guide-ia/telecharger/route";
import { FORM_REF_LETTRE, VERSION_LETTRE, VERSION_MENTION } from "@/content/guide-ia-formulaire";
import { noterRebondSurAbonne } from "@/server/newsletter/rebonds";
import { desabonnerAbonne } from "@/server/newsletter/desabonner";
import { confirmerLettre } from "@/server/newsletter/confirmer";
import { unsubscribeNewsletterAction } from "@/features/newsletter/actions";
import { processInboundEvent, sha256Email } from "@/server/crm-sync/inbound";
import {
  TAILLE_LOT,
  adressesDeLEntree,
  lireArgumentsRattrapage,
  rattraperLettreEtGuide,
} from "@/server/crm-sync/rattrapage-lettre-guide";
import { eventIdDemandeGuide, eventIdDeterministe, uuidV5 } from "@/server/crm-sync/event-id";
import {
  PREFIXE_VERSION_MENTION_PRO,
  baseLegaleDeLInscription,
} from "@/server/crm-sync/inscription-lettre";
import {
  transmettreClicGuide,
  transmettreInscriptionApresClic,
} from "@/server/crm-sync/lettre-guide";
import { inscriptionsAControler } from "@/server/crm-sync/reconcile";
import { empreinteSha256 } from "@/server/newsletter/exports";
import { enregistrerDemandeGuide } from "@/server/guide-ia/demande";

// ── Transcription du contrat CRM (axion-crm-pro, lot L4-C, #246) ────────────
// `SiteSyncEvent::TOP_LEVEL_KEYS`, `PERSON_KEYS`, `CONSENT_KEYS` : toute clé
// hors liste ⇒ 422. `PersonnesIngestService::CLES_PAYLOAD_CONSIGNEES` : les
// clés de `payload` que le CRM recopie dans la timeline.
const CRM_TOP_LEVEL = [
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
const CRM_PERSON = ["person_key", "email", "first_name", "last_name", "phone"];
const CRM_CONSENT = ["version", "at", "text_ref", "vivier_at"];
const CRM_PAYLOAD_CONSIGNE = [
  "source",
  "placement",
  "locale",
  "reason",
  "base_legale",
  "email_nature",
  "aimant",
  "edition",
  "verifie",
];
/** `Taxonomy::ABONNEMENT_LEGAL_BASES`. */
const CRM_BASES_LEGALES = ["consent", "legitimate_interest_b2b"];
/** `PersonnesIngestService::PREFIXES_DESABONNEMENT_LETTRE`. */
const CRM_PREFIXE_DESABONNEMENT_LETTRE = "site:newsletter_subscriber:";

const JETON = "b7".repeat(32);
const BASE_URL = "https://axion-ia.com";
const PRO = "zz.pro@example.invalid";
/** Adresse « personnelle » : la nature est simulée (voir le mock de `natureAdresse`). */
const PERSO = "zz.perso@perso.example.invalid";
const CLIC = new Date("2026-09-20T08:00:00.000Z");
const INSCRIT_LE = new Date("2026-09-19T08:00:00.000Z");

const OLD_ENV = { ...process.env };

function ouvrirFluxGuide(): void {
  process.env.CRM_SYNC_ENABLED = "true";
  process.env.CRM_SYNC_GUIDE_ENABLED = "true";
}

/** Clé d'adresse, calculée comme le mock de `hashEmailForLookup`. */
function cleAdresse(email: string): string {
  return createHash("sha256").update(`cle|${email.trim().toLowerCase()}`).digest("hex");
}

function demande(email: string, extra: Ligne = {}): Ligne {
  const l: Ligne = {
    id: `demande-${base.demandes.length + 1}`,
    email,
    emailKey: cleAdresse(email),
    aimant: "guide-ia",
    origine: "formulaire",
    source: "guide-ia",
    locale: "fr",
    version: VERSION_MENTION.pro,
    downloadToken: JETON,
    firstSeenAt: null,
    firstClickAt: null,
    crmEmittedAt: null,
    ...extra,
  };
  base.demandes.push(l);
  return l;
}

function abonne(email: string, extra: Ligne = {}): Ligne {
  const l: Ligne = {
    id: `abonne-${base.abonnes.length + 1}`,
    email,
    locale: "fr",
    status: "confirmed",
    source: "guide-ia",
    confirmedAt: INSCRIT_LE,
    confirmToken: null,
    unsubscribeToken: `u${base.abonnes.length}`.padEnd(64, "0"),
    unsubscribedAt: null,
    consentFormRef: FORM_REF_LETTRE.guide,
    consentVersion: VERSION_MENTION.pro,
    ...extra,
  };
  base.abonnes.push(l);
  return l;
}

function post(t: string = JETON): NextRequest {
  return new NextRequest(`${BASE_URL}/api/guide-ia/telecharger`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `t=${t}`,
  });
}
function get(t: string = JETON): NextRequest {
  return new NextRequest(`${BASE_URL}/api/guide-ia/telecharger?t=${t}`, { method: "GET" });
}

/** Une opposition à la prospection enregistrée pour `email`. */
function opposition(email: string): void {
  base.oppositions.push({ id: `op-${base.oppositions.length + 1}`, emailHash: cleAdresse(email) });
}

/** Une ligne d'outbox déjà là (transmise par un passage antérieur). */
function dejaEnOutbox(eventType: string, subjectRef: string, extra: Ligne = {}): void {
  base.outbox.push({
    id: `outbox-${base.outbox.length + 1}`,
    eventId: `ancien-${base.outbox.length + 1}`,
    eventType,
    subjectRef,
    createdAt: new Date("2026-09-22T00:00:00.000Z"),
    status: "sent",
    attempts: 1,
    responseStatus: 200,
    payload: {},
    ...extra,
  });
}

/** Les événements réellement écrits dans l'outbox, par type. */
function evenements(type?: string): Array<Record<string, unknown>> {
  return base.outbox
    .filter((l) => type === undefined || l.eventType === type)
    .map((l) => l.payload as Record<string, unknown>);
}

beforeEach(() => {
  base.demandes.length = 0;
  base.abonnes.length = 0;
  base.outbox.length = 0;
  base.entrants.length = 0;
  base.oppositions.length = 0;
  base.ecritures.length = 0;
  base.file.length = 0;
  base.echecOutbox.clear();
  base.enTransaction = false;
  base.fileMuette = false;
  process.env = { ...OLD_ENV };
  delete process.env.CRM_SYNC_ENABLED;
  delete process.env.CRM_SYNC_GUIDE_ENABLED;
  delete process.env.CRM_SYNC_EXCLUSIONS_SHA256;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Le lien du guide : GET jamais, POST une fois
// ─────────────────────────────────────────────────────────────────────────────

describe("lien du guide → CRM (décision D1 : au clic humain)", () => {
  it("🔴 GET : aucune émission, drapeau OUVERT (témoin : first_seen_at posé)", async () => {
    ouvrirFluxGuide();
    const d = demande(PRO);
    abonne(PRO);

    const res = await GET(get());

    expect(res.status).toBe(200);
    expect(d.firstSeenAt).toBeInstanceOf(Date); // le GET a bien été traité
    expect(d.firstClickAt).toBeNull();
    expect(d.crmEmittedAt).toBeNull();
    expect(base.outbox).toHaveLength(0);
  });

  it("🔴 POST, drapeau ouvert : UNE ligne `lead_magnet_requested` au format du CRM, crm_emitted_at posé", async () => {
    ouvrirFluxGuide();
    vi.useFakeTimers({ now: CLIC, toFake: ["Date"] });
    try {
      const d = demande(PRO);
      const res = await POST(post());
      expect(res.status).toBe(303);

      const [ev, ...reste] = evenements("lead_magnet_requested");
      expect(reste).toHaveLength(0);
      expect(d.crmEmittedAt).toBeInstanceOf(Date);

      expect(ev).toMatchObject({
        schema_version: 1,
        event_id: eventIdDemandeGuide(String(d.id)),
        event_type: "lead_magnet_requested",
        occurred_at: CLIC.toISOString(),
        source_slug: "guide-ia",
        subject_ref: `site:guide_request:${String(d.id)}`,
        person: { email: PRO },
        payload: {
          aimant: "guide-ia-entreprise",
          placement: "guide-ia",
          locale: "fr",
          verifie: true,
          email_nature: "pro",
          base_legale: "legitimate_interest_b2b",
          lettre: "non_abonne",
          version_mention: VERSION_MENTION.pro,
        },
      });
      // 🔴 Personne n'a consenti : AUCUN bloc `consent` (relecture du 25/09).
      expect(ev).not.toHaveProperty("consent");
      // Contrat STRICT du CRM : aucune clé inconnue, clé de personne en 64 hex.
      expect(Object.keys(ev!).every((k) => CRM_TOP_LEVEL.includes(k))).toBe(true);
      const personne = ev!.person as Record<string, unknown>;
      expect(Object.keys(personne).every((k) => CRM_PERSON.includes(k))).toBe(true);
      expect(personne.person_key).toMatch(/^[0-9a-f]{64}$/);
      // Le payload ne porte que des clés consignées par le CRM, plus `lettre`
      // et `version_mention` (acceptées — `payload` n'est pas à clés fermées —
      // sans être consignées dans la timeline).
      const cles = Object.keys(ev!.payload as object);
      expect(cles.filter((k) => !CRM_PAYLOAD_CONSIGNE.includes(k))).toEqual([
        "lettre",
        "version_mention",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("🔴 POST, drapeau FERMÉ : aucune ligne (témoin : first_click_at posé, crm_emitted_at reste vide)", async () => {
    process.env.CRM_SYNC_ENABLED = "true"; // le maître seul ne suffit pas
    const d = demande(PRO);

    const res = await POST(post());

    expect(res.status).toBe(303);
    expect(d.firstClickAt).toBeInstanceOf(Date); // le clic a bien été pris
    expect(d.crmEmittedAt).toBeNull(); // → le rattrapage le reprendra
    expect(base.outbox).toHaveLength(0);
  });

  it("🔴 second POST : pas de doublon (témoin : le premier a bien écrit)", async () => {
    ouvrirFluxGuide();
    demande(PRO);

    await POST(post());
    expect(evenements("lead_magnet_requested")).toHaveLength(1);
    await POST(post());
    await POST(post());

    expect(evenements("lead_magnet_requested")).toHaveLength(1);
  });

  it("adresse PRO inscrite d'office : l'inscription part AU MÊME CLIC, en intérêt légitime, datée de l'inscription", async () => {
    ouvrirFluxGuide();
    demande(PRO);
    const a = abonne(PRO);

    await POST(post());

    expect(evenements("lead_magnet_requested")[0]?.payload).toMatchObject({ lettre: "abonne" });
    const [optin, ...reste] = evenements("newsletter_optin");
    expect(reste).toHaveLength(0);
    expect(optin).toMatchObject({
      occurred_at: INSCRIT_LE.toISOString(),
      source_slug: "newsletter",
      subject_ref: `${CRM_PREFIXE_DESABONNEMENT_LETTRE}${String(a.id)}`,
      consent: { version: VERSION_MENTION.pro, text_ref: FORM_REF_LETTRE.guide },
      payload: {
        placement: "guide-ia",
        locale: "fr",
        base_legale: "legitimate_interest_b2b",
        email_nature: "pro",
      },
    });
    // Pas de date de consentement à inventer pour un intérêt légitime.
    expect((optin!.consent as Record<string, unknown>).at).toBeUndefined();
    // Ordre : la demande d'abord, pour que la personne existe au CRM.
    expect(base.outbox.map((l) => l.eventType)).toEqual([
      "lead_magnet_requested",
      "newsletter_optin",
    ]);
  });

  it("adresse PERSO, case cochée : inscription en CONSENTEMENT, datée", async () => {
    ouvrirFluxGuide();
    demande(PERSO, { version: VERSION_MENTION.perso });
    abonne(PERSO, { consentVersion: VERSION_LETTRE.guide });

    await POST(post());

    const [lead] = evenements("lead_magnet_requested");
    expect(lead?.payload).toMatchObject({
      email_nature: "perso",
      base_legale: "consent",
      lettre: "abonne",
    });
    // Un consentement, lui, porte son bloc : version de la CASE, datée.
    expect(lead?.consent).toEqual({ version: VERSION_LETTRE.guide, at: INSCRIT_LE.toISOString() });
    expect(Object.keys(lead!.consent as object).every((k) => CRM_CONSENT.includes(k))).toBe(true);
    expect(evenements("newsletter_optin")[0]).toMatchObject({
      consent: { at: INSCRIT_LE.toISOString() },
      payload: { base_legale: "consent", email_nature: "perso" },
    });
  });

  it("🔴 adresse PERSO SANS la case : demandeur du guide seul, AUCUNE inscription transmise", async () => {
    ouvrirFluxGuide();
    demande(PERSO, { version: VERSION_MENTION.perso });

    await POST(post());

    const [ev] = evenements("lead_magnet_requested");
    expect(ev?.payload).toMatchObject({
      email_nature: "perso",
      base_legale: "legitimate_interest_b2b",
      lettre: "non_abonne",
      version_mention: VERSION_MENTION.perso,
    });
    expect(ev).not.toHaveProperty("consent");
    expect(evenements("newsletter_optin")).toHaveLength(0);
    expect(CRM_BASES_LEGALES).toContain((ev!.payload as Record<string, unknown>).base_legale);
  });

  it("le verrou du drapeau est aussi dans `enqueue` : un appel direct drapeau fermé n'écrit rien", async () => {
    process.env.CRM_SYNC_ENABLED = "true";
    const { syncLeadMagnetRequestedToCrm, syncNewsletterOptOutToCrm } =
      await import("@/server/crm-sync");
    expect(
      await syncLeadMagnetRequestedToCrm({
        subjectRef: "site:guide_request:x",
        person: { email: PRO },
      }),
    ).toBeNull();
    // Témoin : le même canal, pour un type hors flux guide, écrit bien.
    expect(
      await syncNewsletterOptOutToCrm({
        subjectRef: "site:newsletter_subscriber:x",
        person: { email: PRO },
      }),
    ).not.toBeNull();
    expect(base.outbox.map((l) => l.eventType)).toEqual(["newsletter_optout"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Rebond dur
// ─────────────────────────────────────────────────────────────────────────────

describe("rebond dur → email_hard_bounced", () => {
  it("🔴 JAMAIS transmise au CRM : AUCUNE ligne (témoin : l'abonné est bien passé en `bounced`, drapeau ouvert)", async () => {
    ouvrirFluxGuide();
    const a = abonne(PRO);
    demande(PRO); // une demande, jamais cliquée : rien n'est parti

    expect(await noterRebondSurAbonne(PRO, "hard")).toBe(1);

    expect(a.status).toBe("bounced");
    expect(base.outbox).toHaveLength(0);
  });

  it("🔴 refus DÉFINITIF (422) de la seule ligne : la personne n'est pas au CRM, rien ne part", async () => {
    ouvrirFluxGuide();
    const a = abonne(PRO);
    dejaEnOutbox("newsletter_optin", `site:newsletter_subscriber:${String(a.id)}`, {
      status: "gave_up",
      attempts: 1,
      responseStatus: 422,
    });

    await noterRebondSurAbonne(PRO, "hard");

    expect(a.status).toBe("bounced");
    expect(evenements("email_hard_bounced")).toHaveLength(0);
  });

  it("🔴 entrée au CRM par la DEMANDE du guide : le rebond part (une ligne)", async () => {
    ouvrirFluxGuide();
    abonne(PRO);
    const d = demande(PRO, { firstClickAt: CLIC, crmEmittedAt: CLIC });
    dejaEnOutbox("lead_magnet_requested", `site:guide_request:${String(d.id)}`, {
      status: "pending",
      attempts: 0,
      responseStatus: null,
    });

    await noterRebondSurAbonne(PRO, "hard");

    expect(evenements("email_hard_bounced")).toHaveLength(1);
  });

  it("🔴 adresse EXCLUE (CRM_SYNC_EXCLUSIONS_SHA256) : rien, même transmise (témoin : `bounced`)", async () => {
    ouvrirFluxGuide();
    process.env.CRM_SYNC_EXCLUSIONS_SHA256 = empreinteSha256(PRO);
    const a = abonne(PRO);
    dejaEnOutbox("newsletter_optin", `site:newsletter_subscriber:${String(a.id)}`);

    await noterRebondSurAbonne(PRO, "hard");

    expect(a.status).toBe("bounced");
    expect(evenements("email_hard_bounced")).toHaveLength(0);
  });

  it("🔴 déjà transmise, drapeau ouvert : une ligne, référencée sur l'abonné", async () => {
    ouvrirFluxGuide();
    const a = abonne(PRO);
    dejaEnOutbox("newsletter_optin", `site:newsletter_subscriber:${String(a.id)}`);
    const quand = new Date("2026-09-21T10:00:00.000Z");

    expect(await noterRebondSurAbonne(PRO, "hard", quand)).toBe(1);

    const [ev, ...reste] = evenements("email_hard_bounced");
    expect(reste).toHaveLength(0);
    expect(ev).toMatchObject({
      event_type: "email_hard_bounced",
      occurred_at: quand.toISOString(),
      subject_ref: `site:newsletter_subscriber:${String(a.id)}`,
      person: { email: PRO },
    });
  });

  it("drapeau fermé : rien (témoin : l'abonné est bien passé en `bounced`)", async () => {
    process.env.CRM_SYNC_ENABLED = "true";
    const a = abonne(PRO);

    await noterRebondSurAbonne(PRO, "hard");

    expect(a.status).toBe("bounced");
    expect(base.outbox).toHaveLength(0);
  });

  it("un second rebond sur une adresse déjà `bounced` ne réémet rien", async () => {
    ouvrirFluxGuide();
    const a = abonne(PRO);
    dejaEnOutbox("newsletter_optin", `site:newsletter_subscriber:${String(a.id)}`);
    // Deux instants DISTINCTS : sinon l'identifiant déterministe masquerait,
    // à lui seul, l'absence de la garde de transition.
    await noterRebondSurAbonne(PRO, "hard", new Date("2026-09-21T10:00:00.000Z"));
    await noterRebondSurAbonne(PRO, "hard", new Date("2026-09-21T11:00:00.000Z"));
    expect(evenements("email_hard_bounced")).toHaveLength(1);
  });

  it("un rebond MOU n'émet rien (témoin : compteur incrémenté)", async () => {
    ouvrirFluxGuide();
    const a = abonne(PRO, { softBounceCount: 0 });
    await noterRebondSurAbonne(PRO, "soft");
    expect(a.softBounceCount).toEqual({ increment: 1 }); // la base simulée recopie l'ordre
    expect(base.outbox).toHaveLength(0);
  });

  it("🔴 une file Redis qui ne répond JAMAIS ne bloque pas le webhook (ligne écrite quand même)", async () => {
    ouvrirFluxGuide();
    base.fileMuette = true;
    const a = abonne(PRO);
    dejaEnOutbox("newsletter_optin", `site:newsletter_subscriber:${String(a.id)}`);

    const issue = await Promise.race([
      noterRebondSurAbonne(PRO, "hard").then(() => "rendu" as const),
      new Promise<"bloque">((r) => setTimeout(() => r("bloque"), 1_000)),
    ]);

    expect(issue).toBe("rendu");
    expect(evenements("email_hard_bounced")).toHaveLength(1);
    expect(base.file).toHaveLength(1); // la mise en file est bien partie
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 bis. Relecture du 25/09 — inscription après un clic, opposition,
// exclusion persistante, atomicité, file qui ne répond pas
// ─────────────────────────────────────────────────────────────────────────────

describe("inscription faite APRÈS un premier clic déjà transmis", () => {
  it("🔴 perso sans case → clic → nouvelle demande AVEC la case : l'inscription part à la demande, sans second clic", async () => {
    ouvrirFluxGuide();
    const d = demande(PERSO, { version: VERSION_MENTION.perso });

    // 1. Premier clic, sans la case : la demande part, `non_abonne`.
    await POST(post());
    expect(evenements("lead_magnet_requested")).toHaveLength(1);
    expect(evenements("lead_magnet_requested")[0]?.payload).toMatchObject({ lettre: "non_abonne" });
    expect(evenements("newsletter_optin")).toHaveLength(0);
    expect(d.crmEmittedAt).toBeInstanceOf(Date);

    // 2. Nouvelle demande, case cochée : la VRAIE fonction du formulaire.
    const r = await enregistrerDemandeGuide({
      email: PERSO,
      locale: "fr",
      source: "guide-ia",
      variante: "guide",
      caseLettre: true,
      ipHash: null,
    });
    expect(r.lettre).toBe("inscrite");

    // L'inscription est au CRM TOUT DE SUITE, en consentement.
    const [optin, ...reste] = evenements("newsletter_optin");
    expect(reste).toHaveLength(0);
    expect(optin).toMatchObject({
      payload: { base_legale: "consent", email_nature: "perso" },
      consent: { version: VERSION_LETTRE.guide },
    });
    // La demande n'est pas réémise.
    expect(evenements("lead_magnet_requested")).toHaveLength(1);
  });

  it("🔴 même scénario, inscription faite drapeau fermé : le SECOND CLIC la transmet (branche « déjà transmise »)", async () => {
    ouvrirFluxGuide();
    demande(PERSO, { version: VERSION_MENTION.perso });
    await POST(post());
    expect(evenements("newsletter_optin")).toHaveLength(0);

    // Inscrite entre-temps, sans que rien ne parte (pas d'appel au CRM ici).
    abonne(PERSO, {
      consentVersion: VERSION_LETTRE.guide,
      confirmedAt: new Date("2026-09-23T08:00:00.000Z"),
    });

    await POST(post());

    expect(evenements("newsletter_optin")).toHaveLength(1);
    expect(evenements("lead_magnet_requested")).toHaveLength(1); // pas de doublon
    // Un troisième clic ne réémet rien.
    await POST(post());
    expect(evenements("newsletter_optin")).toHaveLength(1);
  });

  it("drapeau fermé : l'inscription après clic ne lit ni n'écrit rien (témoin : `drapeau-ferme`)", async () => {
    process.env.CRM_SYNC_ENABLED = "true";
    const d = demande(PERSO, { firstClickAt: CLIC, crmEmittedAt: CLIC });
    abonne(PERSO, { consentVersion: VERSION_LETTRE.guide });
    expect(await transmettreInscriptionApresClic(String(d.id))).toBe("drapeau-ferme");
    expect(base.outbox).toHaveLength(0);
  });

  it("demande jamais cliquée : l'inscription attend le clic (décision D1)", async () => {
    ouvrirFluxGuide();
    const d = demande(PERSO);
    abonne(PERSO, { consentVersion: VERSION_LETTRE.guide });
    expect(await transmettreInscriptionApresClic(String(d.id))).toBe("sans-clic");
    expect(base.outbox).toHaveLength(0);
  });

  it("🔴 inscription NON ÉCRITE : issue distincte, jamais « transmise » (témoin : la demande est partie)", async () => {
    ouvrirFluxGuide();
    const d = demande(PRO, { firstClickAt: CLIC });
    abonne(PRO);
    base.echecOutbox.add("newsletter_optin");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await transmettreClicGuide(String(d.id))).toBe("inscription-non-ecrite");
    expect(evenements("lead_magnet_requested")).toHaveLength(1);
    expect(evenements("newsletter_optin")).toHaveLength(0);

    // Le rattrapage la voit, et la reprend quand la base revient.
    const aBlanc = await rattraperLettreEtGuide();
    expect(aBlanc.abonnes).toMatchObject({ aTransmettre: 1, dejaTransmis: 0 });
    base.echecOutbox.clear();
    const b = await rattraperLettreEtGuide({ executer: true });
    expect(b.abonnes.transmis).toBe(1);
    expect(evenements("newsletter_optin")).toHaveLength(1);
  });

  it("le rattrapage compte « inscriptions non écrites » à part des transmises", async () => {
    ouvrirFluxGuide();
    demande(PRO, { firstClickAt: CLIC });
    abonne(PRO);
    base.echecOutbox.add("newsletter_optin");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const b = await rattraperLettreEtGuide({ executer: true });

    expect(b.demandes).toMatchObject({ transmises: 0, inscriptionsNonEcrites: 1, echecs: 0 });
  });
});

describe("opposition à la prospection (email_oppositions)", () => {
  it("🔴 opposée puis clic : AUCUNE ligne, issue `opposee`, demande marquée traitée", async () => {
    ouvrirFluxGuide();
    const d = demande(PRO, { firstClickAt: CLIC });
    abonne(PRO);
    opposition(PRO);

    expect(await transmettreClicGuide(String(d.id))).toBe("opposee");
    expect(base.outbox).toHaveLength(0);
    expect(d.crmEmittedAt).toBeInstanceOf(Date); // le rattrapage ne la repropose pas
  });

  it("témoin : même adresse SANS opposition → une ligne `lead_magnet_requested`", async () => {
    ouvrirFluxGuide();
    const d = demande(PRO, { firstClickAt: CLIC });
    expect(await transmettreClicGuide(String(d.id))).toBe("transmise");
    expect(evenements("lead_magnet_requested")).toHaveLength(1);
  });

  it("🔴 rattrapage : les opposées sont COMPTÉES, jamais transmises", async () => {
    ouvrirFluxGuide();
    demande(PRO, { firstClickAt: CLIC });
    abonne("zz.ancien@example.invalid", { consentFormRef: null, consentVersion: null });
    opposition(PRO);
    opposition("zz.ancien@example.invalid");

    const b = await rattraperLettreEtGuide({ executer: true });

    expect(b.demandes).toMatchObject({ opposees: 1, aTransmettre: 0, transmises: 0 });
    expect(b.abonnes).toMatchObject({ opposes: 1, aTransmettre: 0, transmis: 0 });
    expect(base.outbox).toHaveLength(0);
  });
});

describe("exclusion PERSISTANTE (CRM_SYNC_EXCLUSIONS_SHA256, décision D4)", () => {
  it("🔴 empreinte dans l'environnement : un clic n'écrit RIEN, issue `exclue`, rien n'est posé", async () => {
    ouvrirFluxGuide();
    process.env.CRM_SYNC_EXCLUSIONS_SHA256 = ` ${"0".repeat(64)} , ${empreinteSha256(PRO)} `;
    const d = demande(PRO);
    abonne(PRO);

    const res = await POST(post());

    expect(res.status).toBe(303);
    expect(d.firstClickAt).toBeInstanceOf(Date); // le clic a bien été pris
    expect(await transmettreClicGuide(String(d.id))).toBe("exclue");
    expect(d.crmEmittedAt).toBeNull();
    expect(base.outbox).toHaveLength(0);
  });

  it("témoin : SANS l'empreinte, le même clic écrit une ligne", async () => {
    ouvrirFluxGuide();
    process.env.CRM_SYNC_EXCLUSIONS_SHA256 = "0".repeat(64);
    demande(PRO);
    await POST(post());
    expect(evenements("lead_magnet_requested")).toHaveLength(1);
  });

  it("🔴 l'empreinte se compare sur l'adresse NORMALISÉE (casse, espaces)", async () => {
    ouvrirFluxGuide();
    // L'empreinte de la forme normalisée, calculée ICI (pas par le code testé)…
    process.env.CRM_SYNC_EXCLUSIONS_SHA256 = createHash("sha256").update(PRO).digest("hex");
    // … et une adresse enregistrée avec majuscules et espaces.
    const d = demande("  ZZ.Pro@Example.Invalid ", { firstClickAt: CLIC });
    expect(await transmettreClicGuide(String(d.id))).toBe("exclue");
    expect(base.outbox).toHaveLength(0);
  });

  it("🔴 rattrapage : l'environnement exclut aussi, compté AVANT « déjà transmis »", async () => {
    ouvrirFluxGuide();
    process.env.CRM_SYNC_EXCLUSIONS_SHA256 = empreinteSha256("zz.maison@example.invalid");
    demande("zz.maison@example.invalid", { firstClickAt: CLIC });
    const a = abonne("zz.maison@example.invalid", { consentFormRef: null, consentVersion: null });
    // Déjà transmise AVANT l'exclusion : elle est comptée EXCLUE, pas « déjà transmise ».
    dejaEnOutbox("newsletter_optin", `site:newsletter_subscriber:${String(a.id)}`, {
      createdAt: new Date("2026-09-24T00:00:00.000Z"),
    });

    const b = await rattraperLettreEtGuide({ executer: true });

    expect(b.demandes).toMatchObject({ exclues: 1, transmises: 0 });
    expect(b.abonnes).toMatchObject({ exclus: 1, dejaTransmis: 0 });
    expect(evenements("lead_magnet_requested")).toHaveLength(0);
  });

  it("confirmation par bouton d'une adresse exclue : rien ne part (témoin : confirmée)", async () => {
    process.env.CRM_SYNC_ENABLED = "true";
    process.env.CRM_SYNC_EXCLUSIONS_SHA256 = empreinteSha256(PRO);
    const jeton = "d".repeat(64);
    const a = abonne(PRO, { status: "pending", confirmedAt: null, confirmToken: jeton });

    const r = await confirmerLettre(jeton, { maintenant: new Date("2026-09-22T12:00:00.000Z") });

    expect(r).toMatchObject({ ok: true, alreadyConfirmed: false });
    expect(a.status).toBe("confirmed");
    expect(evenements("newsletter_optin")).toHaveLength(0);
  });
});

describe("atomicité et file (relecture du 25/09)", () => {
  it("🔴 écriture outbox en échec : la réservation est ANNULÉE avec elle (crm_emitted_at vide, issue `echec`)", async () => {
    ouvrirFluxGuide();
    const d = demande(PRO, { firstClickAt: CLIC });
    base.echecOutbox.add("lead_magnet_requested");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await transmettreClicGuide(String(d.id))).toBe("echec");
    expect(d.crmEmittedAt).toBeNull(); // → le rattrapage la reprendra
    expect(base.outbox).toHaveLength(0);
  });

  it("🔴 la mise en file vient APRÈS la transaction (témoin : une mise en file, ligne visible)", async () => {
    ouvrirFluxGuide();
    const d = demande(PRO, { firstClickAt: CLIC });

    expect(await transmettreClicGuide(String(d.id))).toBe("transmise");

    expect(base.file).toEqual([{ outboxId: base.outbox[0]!.id, enTransaction: false }]);
  });

  it("🔴 une file Redis qui ne répond JAMAIS n'empêche pas la 303 vers le PDF", async () => {
    ouvrirFluxGuide();
    base.fileMuette = true;
    demande(PRO);

    const debut = Date.now();
    const res = await Promise.race([
      POST(post()),
      new Promise<"bloque">((r) => setTimeout(() => r("bloque"), 1_000)),
    ]);

    expect(res).not.toBe("bloque");
    expect((res as Response).status).toBe(303);
    expect(Date.now() - debut).toBeLessThan(1_000);
    // L'écriture en base, elle, a eu lieu : le balayage enverra la ligne.
    expect(evenements("lead_magnet_requested")).toHaveLength(1);
    expect(base.file).toHaveLength(1);
  });
});

describe("réconciliation : les inscriptions du guide restent sous contrôle", () => {
  it("🔴 référence nulle gardée, guide jamais cliqué écarté, guide cliqué ET transmis contrôlé", async () => {
    const ancien = abonne("zz.ancien@example.invalid", { consentFormRef: null });
    const bouton = abonne("zz.bouton@example.invalid", {
      consentFormRef: "newsletter-double-optin",
    });
    const jamais = abonne("zz.jamais@example.invalid");
    demande("zz.jamais@example.invalid");
    const clique = abonne(PRO);
    const d = demande(PRO, { firstClickAt: CLIC, crmEmittedAt: CLIC });
    dejaEnOutbox("lead_magnet_requested", `site:guide_request:${String(d.id)}`);
    // Cliquée drapeau FERMÉ : rien n'est parti, rien à attendre.
    const fermee = abonne("zz.ferme@example.invalid");
    demande("zz.ferme@example.invalid", { firstClickAt: CLIC });

    const lignes = [ancien, bouton, jamais, clique, fermee].map((a) => ({
      id: String(a.id),
      email: String(a.email),
      consentFormRef: (a.consentFormRef as string | null) ?? null,
    }));
    const gardees = (await inscriptionsAControler(lignes)).map((l) => l.id);

    expect(gardees).toEqual([String(ancien.id), String(bouton.id), String(clique.id)]);
    expect(gardees).not.toContain(String(jamais.id));
    expect(gardees).not.toContain(String(fermee.id));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Désinscription : tous les chemins du site, sauf l'entrant
// ─────────────────────────────────────────────────────────────────────────────

describe("newsletter_optout depuis tous les chemins", () => {
  function pourDesabonner(a: Ligne) {
    return {
      id: String(a.id),
      email: String(a.email),
      locale: "fr" as const,
      consentFormRef: a.consentFormRef as string | null,
      consentVersion: a.consentVersion as string | null,
    };
  }

  it("🔴 console : une ligne `newsletter_optout`, préfixe « désabonnement de la LETTRE » du CRM", async () => {
    process.env.CRM_SYNC_ENABLED = "true";
    const a = abonne(PRO);

    expect(await desabonnerAbonne(pourDesabonner(a), "admin-console")).toBe(true);

    const [ev] = evenements("newsletter_optout");
    expect(ev).toMatchObject({
      subject_ref: `${CRM_PREFIXE_DESABONNEMENT_LETTRE}${String(a.id)}`,
      payload: { reason: "admin-console" },
    });
  });

  it("🔴 lien public (RFC 8058) : une ligne `newsletter_optout`", async () => {
    process.env.CRM_SYNC_ENABLED = "true";
    const a = abonne(PRO);

    const r = await unsubscribeNewsletterAction(String(a.unsubscribeToken));

    expect(r).toMatchObject({ ok: true, alreadyUnsubscribed: false });
    expect(evenements("newsletter_optout")[0]).toMatchObject({
      payload: { reason: "unsubscribe-link" },
    });
  });

  it("🔴 opposition venue du CRM (entrant) : AUCUNE émission (témoin : abonné désabonné)", async () => {
    process.env.CRM_SYNC_ENABLED = "true";
    process.env.SITE_SYNC_HMAC_SECRET = "secret-de-test";
    const a = abonne(PRO);

    const r = await processInboundEvent({
      event_id: "crm-evt-l4s-1",
      event_type: "consent_optout",
      email_hash: sha256Email(PRO),
      scope: "lettre",
      origin: "crm",
      occurred_at: "2026-09-24T09:00:00.000Z",
    } as never);

    expect(r).toMatchObject({ ok: true, outcome: "applied" });
    expect(a.status).toBe("unsubscribed");
    expect(base.outbox).toHaveLength(0);
  });

  it("CLIQUET NOMINATIF : les seuls fichiers qui passent un abonné en `unsubscribed` sont connus", () => {
    // Un NOUVEAU chemin de désinscription qui n'émettrait pas `newsletter_optout`
    // doit rougir ici : on l'ajoute à la liste en disant s'il émet (via
    // `desabonnerAbonne`) ou pourquoi il ne le doit pas (l'entrant).
    const ecrivains = new Map<string, "emet" | "entrant-anti-boucle">([
      ["src/server/newsletter/desabonner.ts", "emet"],
      ["src/server/crm-sync/inbound.ts", "entrant-anti-boucle"],
    ]);
    const motif = /data:\s*\{[^}]*status:\s*"unsubscribed"/s;
    const trouves: string[] = [];
    const parcourir = (dossier: string): void => {
      for (const nom of readdirSync(dossier)) {
        const chemin = join(dossier, nom);
        if (statSync(chemin).isDirectory()) {
          if (nom !== "__tests__" && nom !== "node_modules") parcourir(chemin);
        } else if (/\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
          const source = readFileSync(chemin, "utf-8");
          if (motif.test(source) || /status:\s*"unsubscribed"\s+as\s+const/.test(source)) {
            trouves.push(chemin.replace(/\\/g, "/"));
          }
        }
      }
    };
    parcourir("src");
    expect(trouves.sort()).toEqual([...ecrivains.keys()].sort());

    // Le chemin qui émet le fait bien ; l'entrant n'importe aucun `sync*ToCrm`.
    expect(readFileSync("src/server/newsletter/desabonner.ts", "utf-8")).toMatch(
      /syncNewsletterOptOutToCrm\(/,
    );
    const entrant = readFileSync("src/server/crm-sync/inbound.ts", "utf-8");
    expect(entrant).not.toMatch(/import[^;]*sync\w+ToCrm/);
    expect(entrant).not.toMatch(/from "\.\/(index|enqueue|lettre-guide)"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Confirmation par bouton : même déclencheur, format L4-C
// ─────────────────────────────────────────────────────────────────────────────

describe("newsletter_optin à la confirmation (ancien lien, réinscription)", () => {
  it("occurred_at = date d'inscription, source_slug « newsletter », base consentement", async () => {
    process.env.CRM_SYNC_ENABLED = "true";
    const jeton = "c".repeat(64);
    const maintenant = new Date("2026-09-22T12:00:00.000Z");
    const a = abonne(PRO, {
      status: "pending",
      confirmedAt: null,
      confirmToken: jeton,
      consentFormRef: null,
      consentVersion: null,
    });

    const r = await confirmerLettre(jeton, { maintenant });

    expect(r).toMatchObject({ ok: true, alreadyConfirmed: false });
    const [ev, ...reste] = evenements("newsletter_optin");
    expect(reste).toHaveLength(0);
    expect(ev).toMatchObject({
      occurred_at: maintenant.toISOString(),
      source_slug: "newsletter",
      subject_ref: `site:newsletter_subscriber:${String(a.id)}`,
      consent: { at: maintenant.toISOString(), text_ref: "newsletter-double-optin" },
      payload: { placement: "guide-ia", locale: "fr", base_legale: "consent", email_nature: "pro" },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Rattrapage
// ─────────────────────────────────────────────────────────────────────────────

describe("rattrapage lettre et guide", () => {
  function peupler(): void {
    // Cliquée avant l'ouverture du drapeau, inscrite d'office.
    demande(PRO, { firstClickAt: CLIC, downloadToken: "a".repeat(64) });
    abonne(PRO);
    // Inscrite par le guide, JAMAIS cliquée : l'adresse n'est pas vérifiée.
    demande("zz.jamais@example.invalid", { downloadToken: "b".repeat(64) });
    abonne("zz.jamais@example.invalid");
    // Ancien double opt-in, confirmée par bouton : vérifiée, jamais transmise.
    abonne("zz.ancien@example.invalid", { consentFormRef: null, consentVersion: null });
    // L'adresse que Will écarte à l'exécution (décision D4).
    demande("zz.maison@example.invalid", { firstClickAt: CLIC, downloadToken: "c".repeat(64) });
    abonne("zz.maison@example.invalid", { consentFormRef: null, consentVersion: null });
  }

  it("🔴 à blanc : des COMPTES, ZÉRO écriture (drapeau ouvert pour que seul le mode l'empêche)", async () => {
    ouvrirFluxGuide();
    peupler();

    const b = await rattraperLettreEtGuide({ exclure: ["  ZZ.Maison@example.invalid "] });

    expect(b.mode).toBe("a-blanc");
    // Témoin positif : il y a bien de quoi faire.
    expect(b.demandes).toMatchObject({ aTransmettre: 1, exclues: 1 });
    expect(b.abonnes).toMatchObject({
      examines: 4,
      nonVerifies: 1,
      avecLaDemande: 1,
      aTransmettre: 1,
      exclus: 1,
      dejaTransmis: 0,
    });
    expect(base.ecritures).toEqual([]);
    expect(base.outbox).toHaveLength(0);
    // Aucune adresse dans le bilan.
    expect(JSON.stringify(b)).not.toMatch(/@/);
  });

  it("🔴 exécution : les bons événements, l'exclusion appliquée, l'adresse non vérifiée écartée", async () => {
    ouvrirFluxGuide();
    peupler();

    const b = await rattraperLettreEtGuide({
      executer: true,
      exclure: ["zz.maison@example.invalid"],
    });

    expect(b.demandes).toMatchObject({ transmises: 1, echecs: 0 });
    expect(b.abonnes).toMatchObject({ transmis: 1, echecs: 0 });
    const adresses = base.outbox.map(
      (l) => ((l.payload as Record<string, unknown>).person as Record<string, unknown>).email,
    );
    expect(adresses.sort()).toEqual(
      ["zz.ancien@example.invalid", PRO, PRO].sort(), // demande + son inscription + l'ancien
    );
    expect(adresses).not.toContain("zz.maison@example.invalid");
    expect(adresses).not.toContain("zz.jamais@example.invalid");
    // La demande porte la date du CLIC, pas celle du rattrapage.
    expect(evenements("lead_magnet_requested")[0]?.occurred_at).toBe(CLIC.toISOString());
  });

  it("🔴 rejouable : event_id identiques sur deux passages, aucun doublon", async () => {
    ouvrirFluxGuide();
    peupler();

    await rattraperLettreEtGuide({ executer: true, exclure: ["zz.maison@example.invalid"] });
    const premiers = base.outbox.map((l) => String(l.eventId)).sort();
    expect(premiers).toHaveLength(3);

    // On efface la trace « déjà transmise » côté site : seul l'identifiant
    // déterministe peut encore empêcher le doublon.
    for (const d of base.demandes) d.crmEmittedAt = null;
    const avant = base.outbox.length;
    await rattraperLettreEtGuide({ executer: true, exclure: ["zz.maison@example.invalid"] });

    expect(base.outbox).toHaveLength(avant);
    expect(base.outbox.map((l) => String(l.eventId)).sort()).toEqual(premiers);
  });

  it("🔴 lecture PAR LOTS : plus d'un lot de demandes, toutes vues une fois", async () => {
    ouvrirFluxGuide();
    const n = TAILLE_LOT + 3;
    for (let i = 0; i < n; i += 1) {
      demande(`zz.lot${i}@example.invalid`, {
        firstClickAt: CLIC,
        downloadToken: i.toString(16).padStart(64, "0"),
      });
    }
    const b = await rattraperLettreEtGuide();
    expect(b.demandes.aTransmettre).toBe(n);
  });

  it("exécution drapeau fermé : refus, zéro écriture (témoin : les comptes sont là)", async () => {
    process.env.CRM_SYNC_ENABLED = "true";
    peupler();
    const b = await rattraperLettreEtGuide({ executer: true });
    expect(b.refus).toBe("drapeau-guide-ferme");
    expect(b.demandes.aTransmettre).toBe(2);
    expect(base.ecritures).toEqual([]);
  });

  it("arguments : à blanc par défaut, --exclure répétable, refus des incohérences", () => {
    expect(lireArgumentsRattrapage([])).toEqual({
      executer: false,
      exclure: [],
      exclureStdin: false,
    });
    expect(lireArgumentsRattrapage(["--a-blanc"])).toEqual({
      executer: false,
      exclure: [],
      exclureStdin: false,
    });
    expect(lireArgumentsRattrapage(["--executer", "--exclure-stdin"])).toEqual({
      executer: true,
      exclure: [],
      exclureStdin: true,
    });
    expect(
      adressesDeLEntree("a@example.invalid\r\n\n  # commentaire\n b@example.invalid \n"),
    ).toEqual(["a@example.invalid", "b@example.invalid"]);
    expect(
      lireArgumentsRattrapage([
        "--executer",
        "--exclure",
        "a@example.invalid",
        "--exclure",
        "b@example.invalid",
      ]),
    ).toEqual({
      executer: true,
      exclure: ["a@example.invalid", "b@example.invalid"],
      exclureStdin: false,
    });
    expect(lireArgumentsRattrapage(["--exclure"]).erreur).toBeDefined();
    expect(lireArgumentsRattrapage(["--exclure", "--executer"]).erreur).toBeDefined();
    expect(lireArgumentsRattrapage(["--executer", "--a-blanc"]).erreur).toBeDefined();
    expect(lireArgumentsRattrapage(["--emettre"]).erreur).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Identifiants et base légale
// ─────────────────────────────────────────────────────────────────────────────

describe("event_id déterministes et base légale", () => {
  it("UUID v5 stable, conforme au contrat (8 à 128 caractères, colonne uuid)", () => {
    const a = eventIdDeterministe("lead_magnet_requested:x");
    expect(a).toBe(eventIdDeterministe("lead_magnet_requested:x"));
    expect(a).not.toBe(eventIdDeterministe("lead_magnet_requested:y"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("vecteur RFC 4122 (annexe B, espace DNS) : `python.org` → la valeur publiée", () => {
    // Le vecteur de référence publié, pas un recalcul par le même algorithme.
    const ESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    expect(uuidV5(ESPACE_DNS, "python.org")).toBe("886313e1-3b8a-5372-9b90-0c9aee199e5d");
    // Et l'identifiant de la synchro est bien ce calcul, dans SON espace.
    expect(eventIdDeterministe("n")).toBe(uuidV5("5b0f3c2e-8d1a-4c6b-9e7f-2a4d6c8e0b13", "n"));
  });

  it("🔴 une mention PRO v2 reste de l'intérêt légitime (comparaison par PRÉFIXE)", () => {
    expect(PREFIXE_VERSION_MENTION_PRO).toBe("guide-mention-pro");
    expect(baseLegaleDeLInscription("guide-mention-pro-v2-2026-12-01")).toBe(
      "legitimate_interest_b2b",
    );
    expect(baseLegaleDeLInscription(VERSION_MENTION.pro)).toBe("legitimate_interest_b2b");
    // Témoins : la case, la mention PERSO et l'ancien parcours sont des consentements.
    expect(baseLegaleDeLInscription(VERSION_LETTRE.guide)).toBe("consent");
    expect(baseLegaleDeLInscription(VERSION_MENTION.perso)).toBe("consent");
    expect(baseLegaleDeLInscription(null)).toBe("consent");
  });
});
