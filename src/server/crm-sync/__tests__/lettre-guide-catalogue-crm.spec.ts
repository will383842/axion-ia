// @vitest-environment node
//
// LOT S3-CRM (14/11/2026) — un guide du CATALOGUE (`gde-…`) part au CRM avec la source
// `guide-reseau` (famille de provenance), JAMAIS le code comme source ; le code voyage dans
// `guides_recus` et `origine_contenu.guide`. Code hors format ^gde-[a-z0-9-]{6,24}$ : aucun champ
// guide (le CRM rejetterait tout l'événement en invalid_token), journal sans adresse.
// La charge du guide-ia est figée à part (lettre-guide-reference-guide-ia.spec.ts).
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

const CODE = "gde-essai-livraison";
const JSON_BRUT = () => JSON.stringify(base.outbox[0]?.payload);
type Evt = Record<string, unknown> & {
  payload: Record<string, unknown> & {
    origines: { guide: string }[];
    origine_contenu: { guide: string };
  };
};
const objet = () => base.outbox[0]?.payload as unknown as Evt;
const catalogue = (sur: Ligne = {}) => demande({ aimant: CODE, ...sur });
const origC = (sur: Ligne = {}) => origine({ guide: CODE, ...sur });

describe("guide du catalogue : source guide-reseau, code dans les champs de contenu", () => {
  it("v3 page : source guide-reseau, guides_recus et origine_contenu portent le code, pas d'aimant brut", async () => {
    installer({ demande: catalogue(), origines: [origC()] });
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    const e = objet();
    expect(e.source_slug).toBe("guide-reseau");
    expect(e.guides_recus).toStrictEqual([{ guide: CODE, date: CLIC.toISOString() }]);
    expect(e.payload.origine_contenu).toStrictEqual({
      mot: "GUIDE",
      reseau: "instagram",
      guide: CODE,
      date: CONSENTI.toISOString(),
    });
    expect(e.payload.origines[0]?.guide).toBe(CODE);
    expect("aimant" in e.payload).toBe(false);
    expect(e.source_slug).not.toBe(CODE);
  });

  it("v3 formulaire avec origine réseau : source guide-reseau (et non guide-ia)", async () => {
    installer({ demande: catalogue({ origine: "formulaire" }), origines: [origC()] });
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    expect(objet().source_slug).toBe("guide-reseau");
    expect(objet().guides_recus).toStrictEqual([{ guide: CODE, date: CLIC.toISOString() }]);
  });

  it("v3 conversation : mêmes champs de contenu", async () => {
    installer({ demande: catalogue(), contact: null, origines: [origC()] });
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    expect(objet().source_slug).toBe("guide-reseau");
    expect(objet().guides_recus).toStrictEqual([{ guide: CODE, date: CLIC.toISOString() }]);
    expect(objet().payload.origine_contenu.guide).toBe(CODE);
  });

  it("v1 (SYNCHRO_CRM_V3 éteint), demande venue d'un réseau : source guide-reseau + guides_recus", async () => {
    delete process.env.SYNCHRO_CRM_V3;
    installer({ demande: catalogue(), contact: null, origines: [] });
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    const e = objet();
    expect(e.source_slug).toBe("guide-reseau");
    expect(e.guides_recus).toStrictEqual([{ guide: CODE, date: CLIC.toISOString() }]);
    expect("aimant" in e.payload).toBe(false);
    expect(e.payload.origine_contenu).toBeUndefined();
  });

  it("v1, demande née du formulaire : source guide-reseau aussi", async () => {
    delete process.env.SYNCHRO_CRM_V3;
    installer({ demande: catalogue({ origine: "formulaire" }), contact: null, origines: [] });
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    expect(objet().source_slug).toBe("guide-reseau");
  });

  it("le code n'apparaît nulle part comme source_slug ni dans payload.aimant", async () => {
    installer({ demande: catalogue(), origines: [origC()] });
    await transmettreClicGuide("demande-1");
    expect(JSON_BRUT()).not.toContain(`"source_slug":"${CODE}"`);
    expect(JSON_BRUT()).not.toContain(`"aimant":"${CODE}"`);
  });
});

describe("code de guide hors format : aucun champ guide, journal sans adresse", () => {
  const HORS_FORMAT = [
    "gde-ABCDEFG",
    "gde-abc",
    "gde-" + "a".repeat(25),
    "gde-abc_def",
    "GDE-abcdefg",
    "adr-abcdefg",
    "gde-abc def",
    "guide-xyz-long",
  ];
  for (const code of HORS_FORMAT) {
    for (const v3 of [true, false]) {
      it(`${JSON.stringify(code)} (v3 ${v3 ? "allumé" : "éteint"})`, async () => {
        if (!v3) delete process.env.SYNCHRO_CRM_V3;
        const trace = vi.spyOn(console, "error").mockImplementation(() => {});
        installer({
          demande: demande({ aimant: code }),
          origines: v3 ? [origine({ guide: code })] : [],
        });
        expect(await transmettreClicGuide("demande-1")).toBe("transmise");
        const e = objet();
        expect(e.guides_recus).toBeUndefined();
        expect(e.payload.origine_contenu).toBeUndefined();
        expect(e.payload.origines).toBeUndefined();
        expect("aimant" in e.payload).toBe(false);
        expect(JSON_BRUT()).not.toContain(code);
        // N1 : un code hors format n'est JAMAIS rangé sous `guide-ia` (réservé à l'ancien guide).
        expect(e.source_slug).toBe("guide-reseau");
        expect(JSON_BRUT()).not.toContain('"source_slug":"guide-ia"');
        expect(trace).toHaveBeenCalled();
        const journal = JSON.stringify(trace.mock.calls);
        expect(journal).not.toContain(EMAIL);
        expect(journal).not.toContain("@");
        trace.mockRestore();
      });
    }
  }
});

describe("N4 — bornes valides du format : gde- + 6 caractères, gde- + 24", () => {
  for (const code of ["gde-abcdef", "gde-" + "a1-".repeat(8)]) {
    for (const v3 of [true, false]) {
      it(`${code} (${code.length - 4} car., v3 ${v3 ? "allumé" : "éteint"}) : traité comme un guide du catalogue`, async () => {
        if (!v3) delete process.env.SYNCHRO_CRM_V3;
        installer({
          demande: demande({ aimant: code }),
          origines: v3 ? [origine({ guide: code })] : [],
        });
        expect(await transmettreClicGuide("demande-1")).toBe("transmise");
        const e = objet();
        expect(e.source_slug).toBe("guide-reseau");
        expect(e.guides_recus).toEqual([{ guide: code, date: CLIC.toISOString() }]);
        expect("aimant" in e.payload).toBe(false);
      });
    }
  }
  it("les bornes exactes sont 6 et 24 : 5 et 25 caractères restent hors format", async () => {
    for (const code of ["gde-abcde", "gde-" + "a".repeat(25)]) {
      base.demandes.length = 0;
      base.outbox.length = 0;
      installer({ demande: demande({ aimant: code }), origines: [] });
      const trace = vi.spyOn(console, "error").mockImplementation(() => {});
      await transmettreClicGuide("demande-1");
      expect(objet().guides_recus).toBeUndefined();
      trace.mockRestore();
    }
  });
});

describe("N5 — opposition sur un guide du catalogue (gde-) : rien ne part, rien n'est supprimé", () => {
  for (const v3 of [true, false]) {
    it(`adresse opposée avant le clic (v3 ${v3 ? "allumé" : "éteint"}) : aucun événement, demande traitée, origines conservées`, async () => {
      if (!v3) delete process.env.SYNCHRO_CRM_V3;
      installer({ demande: catalogue(), origines: [origC()] });
      base.opposeeDepuis = 1;
      expect(await transmettreClicGuide("demande-1")).toBe("opposee");
      expect(base.outbox).toHaveLength(0);
      expect(base.demandes[0]?.crmEmittedAt).toBeInstanceOf(Date);
      expect(base.contacts).toHaveLength(1);
      expect(base.origines).toHaveLength(1);
    });
  }
  it("opposition arrivée ENTRE la lecture et l'écriture : contrôle refait dans la transaction", async () => {
    installer({ demande: catalogue(), origines: [origC()] });
    base.opposeeDepuis = 2;
    expect(await transmettreClicGuide("demande-1")).toBe("opposee");
    expect(base.outbox).toHaveLength(0);
    expect(base.origines).toHaveLength(1);
    expect(base.dbOpposee[1]).toBeDefined();
  });
});
