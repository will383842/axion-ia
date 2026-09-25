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
// Adresses en `@example.invalid` uniquement (dépôt PUBLIC). Les adresses
// « personnelles » sont COMPOSÉES à l'exécution depuis la liste fermée du site :
// aucun domaine réel n'est écrit ici.

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
  ecritures: [] as string[],
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
  function table(nom: "demandes" | "abonnes" | "entrants") {
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
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
        lignes().filter((l) => correspond(l, where)),
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
      if (base.outbox.some((l) => l.eventId === data.eventId)) {
        throw Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
          meta: { target: ["event_id"] },
        });
      }
      const l = { id: `outbox-${base.outbox.length + 1}`, createdAt: new Date(), ...data };
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
  const client = {
    guideRequest: table("demandes"),
    newsletterSubscriber: table("abonnes"),
    crmInboundEvent: table("entrants"),
    crmSyncOutbox: outbox,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };
  return { prisma: client };
});

vi.mock("@/server/queue/queues", () => ({ crmSyncQueue: { add: async () => undefined } }));
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
import { DOMAINES_WEBMAIL } from "@/lib/email/nature-adresse";
import { FORM_REF_LETTRE, VERSION_LETTRE, VERSION_MENTION } from "@/content/guide-ia-formulaire";
import { noterRebondSurAbonne } from "@/server/newsletter/rebonds";
import { desabonnerAbonne } from "@/server/newsletter/desabonner";
import { confirmerLettre } from "@/server/newsletter/confirmer";
import { unsubscribeNewsletterAction } from "@/features/newsletter/actions";
import { processInboundEvent, sha256Email } from "@/server/crm-sync/inbound";
import {
  lireArgumentsRattrapage,
  rattraperLettreEtGuide,
} from "@/server/crm-sync/rattrapage-lettre-guide";
import { eventIdDemandeGuide, eventIdDeterministe } from "@/server/crm-sync/event-id";
import { PREFIXE_VERSION_MENTION_PRO } from "@/server/crm-sync/inscription-lettre";

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
const DOMAINE_PERSO = [...DOMAINES_WEBMAIL][0]!;
const PERSO = `zz.perso@${DOMAINE_PERSO}`;
const CLIC = new Date("2026-09-20T08:00:00.000Z");
const INSCRIT_LE = new Date("2026-09-19T08:00:00.000Z");

const OLD_ENV = { ...process.env };

function ouvrirFluxGuide(): void {
  process.env.CRM_SYNC_ENABLED = "true";
  process.env.CRM_SYNC_GUIDE_ENABLED = "true";
}

function demande(email: string, extra: Ligne = {}): Ligne {
  const l: Ligne = {
    id: `demande-${base.demandes.length + 1}`,
    email,
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
  base.ecritures.length = 0;
  process.env = { ...OLD_ENV };
  delete process.env.CRM_SYNC_ENABLED;
  delete process.env.CRM_SYNC_GUIDE_ENABLED;
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
        consent: { version: VERSION_MENTION.pro },
        payload: {
          aimant: "guide-ia-entreprise",
          placement: "guide-ia",
          locale: "fr",
          verifie: true,
          email_nature: "pro",
          base_legale: "legitimate_interest_b2b",
          lettre: "non_abonne",
        },
      });
      // Contrat STRICT du CRM : aucune clé inconnue, clé de personne en 64 hex.
      expect(Object.keys(ev!).every((k) => CRM_TOP_LEVEL.includes(k))).toBe(true);
      const personne = ev!.person as Record<string, unknown>;
      expect(Object.keys(personne).every((k) => CRM_PERSON.includes(k))).toBe(true);
      expect(personne.person_key).toMatch(/^[0-9a-f]{64}$/);
      expect(Object.keys(ev!.consent as object).every((k) => CRM_CONSENT.includes(k))).toBe(true);
      // Le payload ne porte que des clés consignées par le CRM, plus `lettre`
      // (acceptée sans être consignée : c'est `newsletter_optin` qui abonne).
      const cles = Object.keys(ev!.payload as object);
      expect(cles.filter((k) => !CRM_PAYLOAD_CONSIGNE.includes(k))).toEqual(["lettre"]);
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

    expect(evenements("lead_magnet_requested")[0]?.payload).toMatchObject({
      email_nature: "perso",
      base_legale: "consent",
      lettre: "abonne",
    });
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
    });
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
  it("🔴 drapeau ouvert : une ligne, référencée sur l'abonné", async () => {
    ouvrirFluxGuide();
    const a = abonne(PRO);
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
    abonne(PRO);
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

  it("exécution drapeau fermé : refus, zéro écriture (témoin : les comptes sont là)", async () => {
    process.env.CRM_SYNC_ENABLED = "true";
    peupler();
    const b = await rattraperLettreEtGuide({ executer: true });
    expect(b.refus).toBe("drapeau-guide-ferme");
    expect(b.demandes.aTransmettre).toBe(2);
    expect(base.ecritures).toEqual([]);
  });

  it("arguments : à blanc par défaut, --exclure répétable, refus des incohérences", () => {
    expect(lireArgumentsRattrapage([])).toEqual({ executer: false, exclure: [] });
    expect(lireArgumentsRattrapage(["--a-blanc"])).toEqual({ executer: false, exclure: [] });
    expect(
      lireArgumentsRattrapage([
        "--executer",
        "--exclure",
        "a@example.invalid",
        "--exclure",
        "b@example.invalid",
      ]),
    ).toEqual({ executer: true, exclure: ["a@example.invalid", "b@example.invalid"] });
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

  it("vecteur RFC 4122 : l'implémentation v5 rend la valeur de référence", () => {
    // Recalcul indépendant, pour qu'une régression de l'implémentation se voie.
    const espace = Buffer.from("5b0f3c2e8d1a4c6b9e7f2a4d6c8e0b13", "hex");
    const h = createHash("sha1")
      .update(Buffer.concat([espace, Buffer.from("n", "utf8")]))
      .digest();
    h[6] = (h[6]! & 0x0f) | 0x50;
    h[8] = (h[8]! & 0x3f) | 0x80;
    const x = h.subarray(0, 16).toString("hex");
    const attendu = `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
    expect(eventIdDeterministe("n")).toBe(attendu);
  });

  it("la mention PRO est reconnue par PRÉFIXE (une v2 reste de l'intérêt légitime)", () => {
    expect(VERSION_MENTION.pro.startsWith(PREFIXE_VERSION_MENTION_PRO)).toBe(true);
    expect(PREFIXE_VERSION_MENTION_PRO.length).toBeGreaterThan(8);
    expect(VERSION_LETTRE.guide.startsWith(PREFIXE_VERSION_MENTION_PRO)).toBe(false);
    expect(VERSION_MENTION.perso.startsWith(PREFIXE_VERSION_MENTION_PRO)).toBe(false);
  });
});
