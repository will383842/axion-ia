// @vitest-environment node
//
// LOT S3-CRM — RÉFÉRENCE « guide-ia » OCTET POUR OCTET (14/11/2026).
// Enregistrée AVANT toute modification de `lettre-guide.ts` : la charge qu'un clic sur le guide-ia
// (ancien guide) écrit en outbox est figée telle que `main` la produisait. Le lot S3-CRM ne change
// que les guides du catalogue (`gde-…`) ; cette référence doit rester verte INCHANGÉE.
// Quatre chemins : v1 (SYNCHRO_CRM_V3 éteint) venu d'un réseau ou du formulaire, v3 avec page,
// v3 conversation. Adresses en `.test`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;

const base = vi.hoisted(() => ({
  demandes: [] as Ligne[],
  contacts: [] as Ligne[],
  origines: [] as Ligne[],
  outbox: [] as Ligne[],
  /** `estOpposee` répond « oui » à partir du n-ième appel (1 = dès la première lecture). */
  opposeeDepuis: null as number | null,
  appelsOpposee: 0,
  /** Second argument reçu par `estOpposee` à chaque appel (le client de transaction, ou rien). */
  dbOpposee: [] as unknown[],
  /** Verrous consultatifs pris dans la transaction du clic (valeurs, et si le clic était déjà réservé). */
  verrous: [] as { valeurs: unknown[]; demandesDejaReservees: boolean }[],
  abonne: null as Ligne | null,
  nature: "pro" as "pro" | "perso",
}));

vi.mock("@/lib/prisma", () => {
  const ok = (l: Ligne, w: Record<string, unknown>): boolean =>
    Object.entries(w).every(([k, c]) => {
      // Clause OR de Prisma (ex. origines actives : en attente OU transmise).
      if (k === "OR") return (c as Record<string, unknown>[]).some((alt) => ok(l, alt));
      const v = l[k];
      if (c === null) return v === null || v === undefined;
      if (c instanceof Date) return v instanceof Date && v.getTime() === c.getTime();
      if (typeof c === "object") {
        const o = c as { not?: unknown; notIn?: unknown[] };
        if ("notIn" in o) return !(o.notIn as unknown[]).includes(v);
        return "not" in o ? !(o.not === null ? v == null : v === o.not) : true;
      }
      return v === c;
    });
  const client = {
    guideRequest: {
      findUnique: async ({ where }: { where: Ligne }) =>
        base.demandes.find((l) => ok(l, where)) ?? null,
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const c = base.demandes.filter((l) => ok(l, where));
        c.forEach((l) => Object.assign(l, data));
        return { count: c.length };
      },
    },
    contactGuideReseau: {
      findFirst: async ({ where }: { where: Ligne }) =>
        base.contacts.find((l) => ok(l, where)) ?? null,
    },
    guideReseauOrigine: {
      findMany: async ({ where, take }: { where: Ligne; take?: number }) =>
        base.origines
          .filter((l) => ok(l, where))
          .sort((x, y) => +(y.occurredAt as Date) - +(x.occurredAt as Date))
          .slice(0, take),
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const ids = (where.id as { in: string[] } | undefined)?.in;
        const c = base.origines.filter(
          (l) =>
            (ids ? ids.includes(l.id as string) : true) &&
            (where.emailKey === undefined || l.emailKey === where.emailKey) &&
            (where.guide === undefined || l.guide === where.guide) &&
            ok(l, { crmStatut: where.crmStatut }),
        );
        c.forEach((l) => Object.assign(l, data));
        return { count: c.length };
      },
    },
    newsletterSubscriber: { findUnique: async () => base.abonne },
    crmSyncOutbox: {
      create: async ({ data }: { data: Ligne }) => {
        if (base.outbox.some((l) => l.eventId === data.eventId)) {
          throw Object.assign(new Error("unique"), {
            code: "P2002",
            meta: { target: ["event_id"] },
          });
        }
        const l = { id: `outbox-${base.outbox.length + 1}`, ...data };
        base.outbox.push(l);
        return { id: l.id };
      },
      findUnique: async ({ where }: { where: Ligne }) =>
        base.outbox.find((l) => ok(l, where)) ?? null,
      findFirst: async () => null,
    },
    // Verrou consultatif de la transaction du clic : on note la clé et l'ordre (avant l'écriture).
    $executeRaw: async (_chaines: TemplateStringsArray, ...valeurs: unknown[]) => {
      base.verrous.push({
        valeurs,
        demandesDejaReservees: base.demandes.some((d) => d.crmEmittedAt),
      });
      return 1;
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const photoD = base.demandes.map((r) => ({ r, c: { ...r } }));
      const nOutbox = base.outbox.length;
      try {
        return await fn(client);
      } catch (e) {
        photoD.forEach(({ r, c }) => {
          Object.keys(r).forEach((k) => delete r[k]);
          Object.assign(r, c);
        });
        base.outbox.length = nOutbox;
        throw e;
      }
    },
  };
  return { prisma: client };
});
vi.mock("@/server/queue/queues", () => ({ crmSyncQueue: null }));
vi.mock("@/lib/email/nature-adresse", () => ({ natureAdresse: () => base.nature }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: () => "0000000000000000000000000000000000000000000000000000000000000000", // 64 hex, comme la vraie empreinte (SITE-429)
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string) => v.replace(/^enc:/, ""),
  PII_DECRYPT_PLACEHOLDER: "[encrypted — key missing]",
}));
vi.mock("@/server/email/opposition", () => ({
  estOpposee: async (_email: string, db?: unknown) => {
    base.dbOpposee.push(db);
    base.appelsOpposee += 1;
    return base.opposeeDepuis !== null && base.appelsOpposee >= base.opposeeDepuis;
  },
}));

import { transmettreClicGuide } from "../lettre-guide";

const EMAIL = "personne@exemple.test";
const CLIC = new Date("2026-11-01T10:05:00.000Z");
const CONSENTI = new Date("2026-11-01T10:00:00.000Z");

function demande(sur: Ligne = {}): Ligne {
  return {
    id: "demande-1",
    email: EMAIL,
    emailKey: "cle-1",
    aimant: "guide-ia",
    origine: "message_prive",
    source: "mot-guide:instagram",
    locale: "fr",
    version: "m1-v1",
    firstClickAt: CLIC,
    crmEmittedAt: null,
    ...sur,
  };
}
const contact = (sur: Ligne = {}): Ligne => ({
  guideRequestId: "demande-1",
  emailKey: "cle-1",
  prenom: "enc:Camille",
  consentiLe: CONSENTI,
  versionConsentement: "page-guide-2026-11-11",
  infosVersion: null,
  infosConsentiLe: null,
  ...sur,
});
let compteurOrigine = 0;
const origine = (sur: Ligne = {}): Ligne => ({
  id: `origine-${++compteurOrigine}`,
  crmStatut: null,
  emailKey: "cle-1",
  mot: "GUIDE",
  reseau: "instagram",
  guide: "guide-ia",
  postRef: "post_ref_test_01",
  postUrl: null,
  canal: null,
  famille: "guide_reseau",
  detail: "guide_ia",
  compte: "page_principale",
  versionTexte: "m1-v1",
  utmCampagne: null,
  commentaireRefHmac: null,
  occurredAt: CONSENTI,
  archiveeLe: null,
  ...sur,
});

const CLES_ENV = [
  "CRM_SYNC_ENABLED",
  "CRM_SYNC_GUIDE_ENABLED",
  "SYNCHRO_CRM_V3",
  "SYNCHRO_CRM_V3_NEWSLETTER_OPTIN",
  "CRM_SYNC_EXCLUSIONS_SHA256",
];
const env: Record<string, string | undefined> = {};
for (const k of CLES_ENV) env[k] = process.env[k];

function installer(opts: { demande?: Ligne; contact?: Ligne | null; origines?: Ligne[] } = {}) {
  base.demandes.push(opts.demande ?? demande());
  if (opts.contact !== null) base.contacts.push(opts.contact ?? contact());
  base.origines.push(...(opts.origines ?? [origine()]));
}

beforeEach(() => {
  base.demandes.length = 0;
  base.contacts.length = 0;
  base.origines.length = 0;
  base.outbox.length = 0;
  base.opposeeDepuis = null;
  base.appelsOpposee = 0;
  base.dbOpposee.length = 0;
  base.verrous.length = 0;
  base.abonne = null;
  base.nature = "pro";
  process.env.CRM_SYNC_ENABLED = "true";
  process.env.CRM_SYNC_GUIDE_ENABLED = "true";
  process.env.SYNCHRO_CRM_V3 = "true";
  delete process.env.SYNCHRO_CRM_V3_NEWSLETTER_OPTIN;
  delete process.env.CRM_SYNC_EXCLUSIONS_SHA256;
});
afterEach(() => {
  for (const k of CLES_ENV) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
});

const JSON_BRUT = () => JSON.stringify(base.outbox[0]?.payload);

describe("référence guide-ia : la charge écrite en outbox ne change pas d'un octet", () => {
  it("v1, demande venue d'un réseau", async () => {
    delete process.env.SYNCHRO_CRM_V3;
    installer({ contact: null, origines: [] });
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    expect(JSON_BRUT()).toMatchInlineSnapshot(
      `"{"schema_version":1,"event_id":"da29d4c1-acad-5ef1-92e1-60184acf6f2d","event_type":"lead_magnet_requested","occurred_at":"2026-11-01T10:05:00.000Z","subject_ref":"site:guide_request:demande-1","person":{"person_key":"0000000000000000000000000000000000000000000000000000000000000000","email":"personne@exemple.test"},"source_slug":"guide-ia","payload":{"aimant":"guide-ia-entreprise","placement":"mot-guide:instagram","locale":"fr","verifie":true,"email_nature":"pro","base_legale":"legitimate_interest_b2b","lettre":"non_abonne","version_mention":"m1-v1"}}"`,
    );
  });

  it("v1, demande née du formulaire", async () => {
    delete process.env.SYNCHRO_CRM_V3;
    installer({ demande: demande({ origine: "formulaire" }), contact: null, origines: [] });
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    expect(JSON_BRUT()).toMatchInlineSnapshot(
      `"{"schema_version":1,"event_id":"da29d4c1-acad-5ef1-92e1-60184acf6f2d","event_type":"lead_magnet_requested","occurred_at":"2026-11-01T10:05:00.000Z","subject_ref":"site:guide_request:demande-1","person":{"person_key":"0000000000000000000000000000000000000000000000000000000000000000","email":"personne@exemple.test"},"source_slug":"guide-ia","payload":{"aimant":"guide-ia-entreprise","placement":"mot-guide:instagram","locale":"fr","verifie":true,"email_nature":"pro","base_legale":"legitimate_interest_b2b","lettre":"non_abonne","version_mention":"m1-v1"}}"`,
    );
  });

  it("v3, page « Recevoir le guide » (prénom, origine)", async () => {
    installer();
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    expect(JSON_BRUT()).toMatchInlineSnapshot(
      `"{"schema_version":3,"event_id":"da29d4c1-acad-5ef1-92e1-60184acf6f2d","event_type":"lead_magnet_requested","occurred_at":"2026-11-01T10:05:00.000Z","source_slug":"guide-reseau","subject_ref":"site:guide_request:demande-1","person":{"person_key":"0000000000000000000000000000000000000000000000000000000000000000","email":"personne@exemple.test","first_name":"Camille"},"guides_recus":[{"guide":"guide-ia","date":"2026-11-01T10:05:00.000Z"}],"payload":{"aimant":"guide-ia-entreprise","placement":"mot-guide:instagram","locale":"fr","verifie":true,"email_nature":"pro","base_legale":"legitimate_interest_b2b","lettre":"non_abonne","version_mention":"m1-v1","schema_version":3,"origine_contenu":{"mot":"GUIDE","reseau":"instagram","guide":"guide-ia","date":"2026-11-01T10:00:00.000Z"},"origines":[{"mot":"GUIDE","reseau":"instagram","guide":"guide-ia","date":"2026-11-01T10:00:00.000Z","post_ref":"post_ref_test_01","canal":"commentaire","famille":"guide_reseau","detail":"guide_ia","compte":"page_principale","version_texte":"m1-v1"}]}}"`,
    );
  });

  it("v3, formulaire avec origine réseau : garde la source guide-ia", async () => {
    installer({ demande: demande({ origine: "formulaire" }) });
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    expect(JSON_BRUT()).toMatchInlineSnapshot(
      `"{"schema_version":3,"event_id":"da29d4c1-acad-5ef1-92e1-60184acf6f2d","event_type":"lead_magnet_requested","occurred_at":"2026-11-01T10:05:00.000Z","source_slug":"guide-ia","subject_ref":"site:guide_request:demande-1","person":{"person_key":"0000000000000000000000000000000000000000000000000000000000000000","email":"personne@exemple.test","first_name":"Camille"},"guides_recus":[{"guide":"guide-ia","date":"2026-11-01T10:05:00.000Z"}],"payload":{"aimant":"guide-ia-entreprise","placement":"mot-guide:instagram","locale":"fr","verifie":true,"email_nature":"pro","base_legale":"legitimate_interest_b2b","lettre":"non_abonne","version_mention":"m1-v1","schema_version":3,"origine_contenu":{"mot":"GUIDE","reseau":"instagram","guide":"guide-ia","date":"2026-11-01T10:00:00.000Z"},"origines":[{"mot":"GUIDE","reseau":"instagram","guide":"guide-ia","date":"2026-11-01T10:00:00.000Z","post_ref":"post_ref_test_01","canal":"commentaire","famille":"guide_reseau","detail":"guide_ia","compte":"page_principale","version_texte":"m1-v1"}]}}"`,
    );
  });

  it("v3, conversation (aucune case cochée)", async () => {
    installer({ contact: null });
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    expect(JSON_BRUT()).toMatchInlineSnapshot(
      `"{"schema_version":3,"event_id":"da29d4c1-acad-5ef1-92e1-60184acf6f2d","event_type":"lead_magnet_requested","occurred_at":"2026-11-01T10:05:00.000Z","source_slug":"guide-reseau","subject_ref":"site:guide_request:demande-1","person":{"person_key":"0000000000000000000000000000000000000000000000000000000000000000","email":"personne@exemple.test"},"guides_recus":[{"guide":"guide-ia","date":"2026-11-01T10:05:00.000Z"}],"payload":{"aimant":"guide-ia-entreprise","placement":"mot-guide:instagram","locale":"fr","verifie":true,"email_nature":"pro","base_legale":"legitimate_interest_b2b","lettre":"non_abonne","version_mention":"m1-v1","schema_version":3,"origine_contenu":{"mot":"GUIDE","reseau":"instagram","guide":"guide-ia","date":"2026-11-01T10:00:00.000Z"},"origines":[{"mot":"GUIDE","reseau":"instagram","guide":"guide-ia","date":"2026-11-01T10:00:00.000Z","post_ref":"post_ref_test_01","famille":"guide_reseau","detail":"guide_ia","compte":"page_principale","version_texte":"m1-v1"}]}}"`,
    );
  });
});
