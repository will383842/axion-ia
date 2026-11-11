// @vitest-environment node
//
// LOT S3 (2026-11-11) — l'événement `lead_magnet_requested` v3 de la page « Recevoir le guide »
// part AU CLIC (`transmettreClicGuide`), dans la transaction de la réservation, jamais au POST de
// la page. Les vrais modules (`lettre-guide.ts`, `enqueue.ts`, `synchro-v3.ts`) tournent contre une
// base SIMULÉE avec vraie annulation de transaction. Adresses en `.test` (dépôt public).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../guides-reseau/__tests__/fixtures/charge-crm-v3-page.json";

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
  abonne: null as Ligne | null,
  nature: "pro" as "pro" | "perso",
}));

vi.mock("@/lib/prisma", () => {
  const ok = (l: Ligne, w: Record<string, unknown>) =>
    Object.entries(w).every(([k, c]) => {
      const v = l[k];
      if (c === null) return v === null || v === undefined;
      if (c instanceof Date) return v instanceof Date && v.getTime() === c.getTime();
      if (typeof c === "object") {
        const o = c as { not?: unknown };
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
      findMany: async ({ where }: { where: Ligne }) => base.origines.filter((l) => ok(l, where)),
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
  versionConsentement: "page-guide-2026-11-08",
  ...sur,
});
const origine = (sur: Ligne = {}): Ligne => ({
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

const evenement = (i = 0) => base.outbox[i]?.payload as Record<string, unknown>;

describe("le clic émet l'événement v3 de la page", () => {
  it("charge conforme à la fixture JSON partagée, écrite DANS la transaction", async () => {
    installer();
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    expect(base.outbox).toHaveLength(1);
    expect(base.outbox[0]?.eventType).toBe("lead_magnet_requested");
    expect(evenement()).toEqual(fixture);
    expect(base.demandes[0]?.crmEmittedAt).toBeInstanceOf(Date);
  });

  it("rejeu du clic = un seul événement", async () => {
    installer();
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    expect(await transmettreClicGuide("demande-1")).toBe("deja-transmise");
    expect(base.outbox).toHaveLength(1);
  });

  it("deux clics SIMULTANÉS = un seul événement", async () => {
    installer();
    await Promise.all([transmettreClicGuide("demande-1"), transmettreClicGuide("demande-1")]);
    expect(base.outbox).toHaveLength(1);
  });

  it("interrupteur SYNCHRO_CRM_V3 éteint : chemin v1 inchangé (aucun bloc v3, source guide-ia)", async () => {
    delete process.env.SYNCHRO_CRM_V3;
    installer();
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    const e = evenement();
    expect(e.schema_version).toBe(1);
    expect(e.source_slug).toBe("guide-ia");
    expect(e).not.toHaveProperty("consentements");
    expect(e).not.toHaveProperty("guides_recus");
    expect((e.person as Ligne).first_name).toBeUndefined();
  });

  it("flux guide fermé : rien n'est écrit, la demande reste au rattrapage", async () => {
    process.env.CRM_SYNC_GUIDE_ENABLED = "false";
    installer();
    expect(await transmettreClicGuide("demande-1")).toBe("drapeau-ferme");
    expect(base.outbox).toHaveLength(0);
    expect(base.demandes[0]?.crmEmittedAt).toBeNull();
  });

  it("demande née du formulaire (pas d'un réseau) : chemin v1, source guide-ia", async () => {
    installer({ demande: demande({ origine: "formulaire" }) });
    await transmettreClicGuide("demande-1");
    expect(evenement().schema_version).toBe(1);
    expect(evenement().source_slug).toBe("guide-ia");
  });

  it("clic SANS consentement de la page (aucun contact) : pas d'optin, pas de prénom, source guide-reseau", async () => {
    installer({ contact: null });
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    const e = evenement();
    expect(e.source_slug).toBe("guide-reseau");
    expect(e).not.toHaveProperty("consentements");
    expect((e.person as Ligne).first_name).toBeUndefined();
  });

  it("origine hors format CRM : l'événement part sans bloc v3, la valeur fautive ne voyage pas", async () => {
    installer({ origines: [origine({ compte: "Compte Invalide" })] });
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    expect(evenement().schema_version).toBe(1);
    expect(JSON.stringify(evenement())).not.toContain("Compte Invalide");
  });

  it("sans abonné à la lettre : une seule ligne, lead_magnet_requested (jamais de newsletter_optin)", async () => {
    installer();
    await transmettreClicGuide("demande-1");
    expect(base.outbox.map((l) => l.eventType)).toEqual(["lead_magnet_requested"]);
  });

  it("abonné existant (adresse perso, case cochée ailleurs) : consent, base légale et lettre de v1 conservés, et ce qui part est figé", async () => {
    base.nature = "perso";
    base.abonne = {
      id: "abonne-1",
      email: EMAIL,
      locale: "fr",
      status: "confirmed",
      source: "guide-ia",
      confirmedAt: new Date("2026-10-30T09:00:00.000Z"),
      consentFormRef: "newsletter-footer",
      consentVersion: "lettre-2026-10",
    };
    installer();
    expect(await transmettreClicGuide("demande-1")).toBe("transmise");
    const lead = evenement();
    expect(lead.schema_version).toBe(3);
    expect(lead.consent).toEqual({ version: "lettre-2026-10", at: "2026-10-30T09:00:00.000Z" });
    expect(lead.payload).toMatchObject({
      base_legale: "consent",
      lettre: "abonne",
      email_nature: "perso",
      aimant: "guide-ia-entreprise",
      version_mention: "m1-v1",
      verifie: true,
    });
    // Comportement existant de v1 conservé : l'inscription déjà confirmée suit au même clic.
    // Ce lot ne l'écrit pas lui-même ; l'interrupteur newsletter de la page ne la commande pas.
    expect(base.outbox.map((l) => l.eventType)).toEqual([
      "lead_magnet_requested",
      "newsletter_optin",
    ]);
  });

  it("un abonné n'ajoute aucune ligne si le clic est une relecture (déjà transmise)", async () => {
    installer({ demande: demande({ crmEmittedAt: CLIC }) });
    expect(await transmettreClicGuide("demande-1")).toBe("deja-transmise");
    expect(base.outbox.filter((l) => l.eventType === "lead_magnet_requested")).toHaveLength(0);
  });

  it("figé : deux visites de la page avant le clic = le PREMIER contact (prénom et case) fait foi", async () => {
    installer({ contact: contact({ prenom: "enc:Premier" }) });
    base.contacts.push(
      contact({ prenom: "enc:Second", consentiLe: new Date("2026-11-01T10:02:00.000Z") }),
    );
    await transmettreClicGuide("demande-1");
    expect((evenement().person as Ligne).first_name).toBe("Premier");
    expect((evenement().consentements as Ligne[])[0]?.date).toBe("2026-11-01T10:00:00.000Z");
  });

  it("figé : demande née du formulaire, même avec un contact lié : v1, aucun bloc v3", async () => {
    installer({ demande: demande({ origine: "formulaire" }) });
    await transmettreClicGuide("demande-1");
    const e = evenement();
    expect(e.schema_version).toBe(1);
    expect(e.source_slug).toBe("guide-ia");
    expect(e).not.toHaveProperty("consentements");
    expect((e.person as Ligne).first_name).toBeUndefined();
  });
});

describe("opposition et exclusion : rien ne part, rien n'est supprimé", () => {
  it("adresse opposée avant le clic : aucun événement, demande marquée traitée", async () => {
    installer();
    base.opposeeDepuis = 1;
    expect(await transmettreClicGuide("demande-1")).toBe("opposee");
    expect(base.outbox).toHaveLength(0);
    expect(base.demandes[0]?.crmEmittedAt).toBeInstanceOf(Date);
    expect(base.contacts).toHaveLength(1);
    expect(base.origines).toHaveLength(1);
  });

  it("opposition arrivée ENTRE la lecture et l'écriture : contrôle refait dans la transaction", async () => {
    installer();
    base.opposeeDepuis = 2;
    expect(await transmettreClicGuide("demande-1")).toBe("opposee");
    expect(base.outbox).toHaveLength(0);
    expect(base.demandes[0]?.crmEmittedAt).toBeInstanceOf(Date);
    expect(base.contacts).toHaveLength(1);
    // Le second contrôle lit la base DE LA TRANSACTION (premier appel : client global).
    expect(base.dbOpposee[0]).toBeUndefined();
    expect(base.dbOpposee[1]).toBeDefined();
  });

  it("adresse exclue de l'environnement : rien ne part", async () => {
    process.env.CRM_SYNC_EXCLUSIONS_SHA256 = createHash("sha256").update(EMAIL).digest("hex");
    installer();
    expect(await transmettreClicGuide("demande-1")).toBe("exclue");
    expect(base.outbox).toHaveLength(0);
  });
});

describe("la page n'envoie plus rien au CRM au POST", () => {
  // Le comportement (aucune charge transmise au CRM pendant le POST, dans tous les parcours) est
  // prouvé par `guides-reseau/__tests__/page-confirmation.spec.ts` (`bd.crm` reste vide). Ici, la
  // garantie STRUCTURELLE : depuis la page, ni la page ni l'écriture d'origine ne peuvent atteindre
  // une émission CRM (l'événement part au clic, `transmettreClicGuide`).
  const lire = (f: string) =>
    readFileSync(join(process.cwd(), "src/server/guides-reseau", f), "utf8");
  const EMISSION_CRM =
    /crm-sync|transmettreOriginesV3|enqueueCrmSyncEvent|mettreEnFileCrm|crmSyncOutbox|noterOrigineAvec/;

  it("page-confirmation.ts n'importe ni n'appelle aucune émission CRM", () => {
    expect(lire("page-confirmation.ts")).not.toMatch(EMISSION_CRM);
  });

  it("l'écriture d'origine de la transaction (origines.ts) n'émet rien vers le CRM", () => {
    expect(lire("origines.ts")).not.toMatch(EMISSION_CRM);
  });

  it("l'origine est écrite dans la transaction de la page (relue plus tard par le clic)", () => {
    expect(lire("page-confirmation.ts")).toMatch(/ecrireOrigineDansTransaction\(tx,/);
  });
});
