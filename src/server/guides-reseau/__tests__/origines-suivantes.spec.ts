// @vitest-environment node
//
// Lot guide réseau 4 (O4) — les origines SUIVANTES partent au CRM, en charge cumulative, mais
// jamais avant le premier clic du lien du guide (D1 du lot S3), jamais si un stop existe.
// Adresses en `.test` (dépôt public). Base simulée avec vraie annulation de transaction.
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;

const bd = vi.hoisted(() => ({
  demande: null as Record<string, unknown> | null,
  origines: [] as Record<string, unknown>[],
  outbox: [] as Record<string, unknown>[],
  opposeeDepuis: null as number | null,
  appelsOpposee: 0,
  panneOutbox: false,
  requetesOutbox: 0,
  ordre: [] as string[],
  enTransaction: false,
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    guideRequest: {
      findUnique: async () => {
        bd.ordre.push(bd.enTransaction ? "demande:dans_transaction" : "demande:hors_transaction");
        return bd.demande;
      },
    },
    guideReseauOrigine: {
      findMany: async ({
        where,
        take,
      }: {
        where: {
          emailKey: string;
          guide: string;
          archiveeLe: null;
          OR: { crmStatut: string | null }[];
        };
        take: number;
      }) =>
        bd.origines
          .filter(
            (l) =>
              l.emailKey === where.emailKey &&
              l.guide === where.guide &&
              l.archiveeLe === null &&
              where.OR.some((c) => (l.crmStatut ?? null) === c.crmStatut),
          )
          .sort((a, b) => +(b.occurredAt as Date) - +(a.occurredAt as Date))
          .slice(0, take),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id?: { in: string[] }; emailKey?: string; crmStatut: null };
        data: Ligne;
      }) => {
        const c = bd.origines.filter(
          (l) =>
            (where.id ? where.id.in.includes(l.id as string) : true) &&
            (where.emailKey ? l.emailKey === where.emailKey : true) &&
            l.archiveeLe === null &&
            (l.crmStatut ?? null) === null,
        );
        c.forEach((l) => Object.assign(l, data));
        return { count: c.length };
      },
    },
    crmSyncOutbox: {
      create: async ({ data }: { data: Ligne }) => {
        bd.requetesOutbox++;
        if (bd.panneOutbox) throw new Error("panne outbox");
        if (bd.outbox.some((l) => l.eventId === data.eventId)) {
          throw Object.assign(new Error("unique"), {
            code: "P2002",
            meta: { target: ["event_id"] },
          });
        }
        const l = { id: `outbox-${bd.outbox.length + 1}`, ...data };
        bd.outbox.push(l);
        return { id: l.id as string };
      },
    },
    $executeRaw: async () => {
      bd.ordre.push("verrou");
      return 1;
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const photo = bd.origines.map((l) => ({ l, c: { ...l } }));
      const n = bd.outbox.length;
      bd.enTransaction = true;
      try {
        return await fn(client);
      } catch (e) {
        photo.forEach(({ l, c }) => {
          Object.keys(l).forEach((k) => delete l[k]);
          Object.assign(l, c);
        });
        bd.outbox.length = n;
        throw e;
      } finally {
        bd.enTransaction = false;
      }
    },
  };
  return { prisma: client };
});
vi.mock("@/server/queue/queues", () => ({ crmSyncQueue: null }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: () => "0000000000000000000000000000000000000000000000000000000000000000",
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
}));
vi.mock("@/server/email/opposition", () => ({
  estOpposee: async () => {
    bd.appelsOpposee += 1;
    return bd.opposeeDepuis !== null && bd.appelsOpposee >= bd.opposeeDepuis;
  },
}));

import { transmettreOriginesSuivantes } from "../synchro-v3";

const EMAIL = "personne@exemple.test";
const CLES = [
  "CRM_SYNC_ENABLED",
  "CRM_SYNC_GUIDE_ENABLED",
  "SYNCHRO_CRM_V3",
  "SYNCHRO_CRM_V3_ORIGINES_SUIVANTES",
  "CRM_SYNC_EXCLUSIONS_SHA256",
];
const env: Record<string, string | undefined> = {};
for (const k of CLES) env[k] = process.env[k];

let n = 0;
const origine = (sur: Ligne = {}): Ligne => ({
  id: `o-${++n}`,
  emailKey: "cle-1",
  cleDedoublonnage: `cle${n}`.padEnd(64, "0"),
  mot: "GUIDE",
  reseau: "instagram",
  guide: "guide-ia",
  postRef: `post_ref_${String(n).padStart(4, "0")}`,
  postUrl: null,
  canal: null,
  famille: "guide_reseau",
  detail: null,
  compte: "page_principale",
  versionTexte: "m1-v1",
  utmCampagne: null,
  commentaireRefHmac: null,
  occurredAt: new Date(Date.UTC(2026, 10, 1, 0, 0, n)),
  // Écrite APRÈS la réservation du clic (`crmEmittedAt` : 10:05:01).
  createdAt: new Date("2026-11-01T11:00:00.000Z"),
  archiveeLe: null,
  crmStatut: null,
  crmTraiteeLe: null,
  ...sur,
});
const cliquee = () => ({
  id: "demande-1",
  firstClickAt: new Date("2026-11-01T10:05:00.000Z"),
  crmEmittedAt: new Date("2026-11-01T10:05:01.000Z"),
});
const appel = (cle?: string) =>
  transmettreOriginesSuivantes({
    email: EMAIL,
    emailKey: "cle-1",
    guide: "guide-ia",
    ...(cle ? { declenchante: cle } : {}),
  });

let logs: string[] = [];
beforeEach(() => {
  bd.demande = cliquee();
  bd.origines.length = 0;
  bd.outbox.length = 0;
  bd.opposeeDepuis = null;
  bd.appelsOpposee = 0;
  bd.panneOutbox = false;
  bd.requetesOutbox = 0;
  bd.ordre.length = 0;
  bd.enTransaction = false;
  process.env.CRM_SYNC_ENABLED = "true";
  process.env.CRM_SYNC_GUIDE_ENABLED = "true";
  process.env.SYNCHRO_CRM_V3 = "true";
  process.env.SYNCHRO_CRM_V3_ORIGINES_SUIVANTES = "true";
  delete process.env.CRM_SYNC_EXCLUSIONS_SHA256;
  logs = [];
  for (const m of ["log", "warn", "error", "info"] as const) {
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      logs.push(a.map(String).join(" "));
    });
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const k of CLES) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
});

describe("transmettreOriginesSuivantes", () => {
  it("personne déjà transmise + nouvelle origine : UNE ligne cumulative, origine_contenu = la nouvelle", async () => {
    bd.origines.push(origine({ crmStatut: "transmise" }));
    const nouvelle = origine({ reseau: "linkedin" });
    bd.origines.push(nouvelle);
    expect(await appel(nouvelle.cleDedoublonnage as string)).toBe("transmise");
    expect(bd.outbox).toHaveLength(1);
    const e = bd.outbox[0]!.payload as { payload: { origines: unknown[]; origine_contenu: Ligne } };
    expect(e.payload.origines).toHaveLength(2);
    expect(e.payload.origine_contenu.reseau).toBe("linkedin");
    expect(bd.origines.map((o) => o.crmStatut)).toEqual(["transmise", "transmise"]);
  });

  it("événement : lead_magnet_requested v3, subject_ref d'origine, sans prénom ni consentement", async () => {
    const o = origine();
    bd.origines.push(o);
    await appel(o.cleDedoublonnage as string);
    const l = bd.outbox[0]!;
    const e = l.payload as Ligne;
    expect(l.eventType).toBe("lead_magnet_requested");
    expect(e.schema_version).toBe(3);
    expect(e.subject_ref).toBe(
      `site:guide-reseau:o-${(o.cleDedoublonnage as string).slice(0, 40)}`,
    );
    expect(e).not.toHaveProperty("consentements");
    expect((e.person as Ligne).first_name).toBeUndefined();
  });

  it("personne JAMAIS cliquée : aucune ligne, l'origine reste en attente (D1)", async () => {
    bd.demande = { id: "demande-1", firstClickAt: null, crmEmittedAt: null };
    bd.origines.push(origine());
    expect(await appel()).toBe("pas_clique");
    expect(bd.requetesOutbox).toBe(0);
    expect(bd.origines[0]?.crmStatut).toBeNull();
  });

  it("la demande est lue DANS la transaction, APRÈS la prise du verrou (course avec le clic)", async () => {
    bd.origines.push(origine());
    await appel();
    expect(bd.ordre).toEqual(["verrou", "demande:dans_transaction"]);
  });

  it("personne jamais cliquée : `pas_clique` vient de la transaction, sans rien écrire ni écarter", async () => {
    bd.demande = { id: "demande-1", firstClickAt: null, crmEmittedAt: null };
    bd.origines.push(origine());
    expect(await appel()).toBe("pas_clique");
    expect(bd.ordre).toEqual(["verrou", "demande:dans_transaction"]);
    expect(bd.origines[0]?.crmStatut).toBeNull();
  });

  it("aucune demande pour cette personne : rien", async () => {
    bd.demande = null;
    bd.origines.push(origine());
    expect(await appel()).toBe("pas_clique");
    expect(bd.requetesOutbox).toBe(0);
  });

  it("rejeu : la même origine déjà transmise ne crée aucune seconde ligne", async () => {
    const o = origine();
    bd.origines.push(o);
    await appel(o.cleDedoublonnage as string);
    expect(await appel(o.cleDedoublonnage as string)).toBe("rien");
    expect(bd.outbox).toHaveLength(1);
  });

  it("désordre : une origine d'hier écrite après celle d'aujourd'hui ne change pas origine_contenu", async () => {
    bd.origines.push(origine({ reseau: "linkedin", crmStatut: "transmise" }));
    const hier = origine({ reseau: "instagram", occurredAt: new Date("2026-10-01T00:00:00.000Z") });
    bd.origines.push(hier);
    await appel(hier.cleDedoublonnage as string);
    const e = bd.outbox[0]!.payload as { payload: { origine_contenu: Ligne } };
    expect(e.payload.origine_contenu.reseau).toBe("linkedin");
  });

  it("STOP déjà posé : aucune ligne, origines écartées, rien supprimé", async () => {
    bd.opposeeDepuis = 1;
    bd.origines.push(origine(), origine());
    expect(await appel()).toBe("opposee");
    expect(bd.requetesOutbox).toBe(0);
    expect(bd.origines).toHaveLength(2);
    expect(bd.origines.map((o) => o.crmStatut)).toEqual(["ecartee", "ecartee"]);
  });

  it("STOP relu DANS la transaction : le contrôle a lieu après l'ouverture, avant toute écriture d'outbox", async () => {
    bd.origines.push(origine());
    await appel();
    expect(bd.appelsOpposee).toBeGreaterThanOrEqual(1);
  });

  it("origine hors format CRM : sortie de la charge (hors_charge), jamais envoyée, jamais supprimée", async () => {
    bd.origines.push(origine({ compte: "Compte Invalide!" }));
    await expect(appel()).resolves.toBe("rien");
    expect(bd.requetesOutbox).toBe(0);
    expect(bd.origines).toHaveLength(1);
    expect(bd.origines[0]?.crmStatut).toBe("hors_charge");
  });

  it("origine hors format + origine valide : seule la valide part, l'autre passe hors_charge", async () => {
    bd.origines.push(origine({ compte: "Compte Invalide!" }));
    bd.origines.push(origine());
    await expect(appel()).resolves.toBe("transmise");
    const e = bd.outbox[0]!.payload as { payload: { origines: unknown[] } };
    expect(e.payload.origines).toHaveLength(1);
    expect(bd.origines.map((o) => o.crmStatut)).toEqual(["hors_charge", "transmise"]);
  });

  it("MIXTE, sans coupure : une origine ANTÉRIEURE au clic + une nouvelle → seule la nouvelle part, l'ancienne reste NULL", async () => {
    const ancienne = origine({ createdAt: new Date("2026-11-01T09:00:00.000Z") });
    const nouvelle = origine({ reseau: "linkedin" });
    bd.origines.push(ancienne, nouvelle);
    await expect(appel(nouvelle.cleDedoublonnage as string)).resolves.toBe("transmise");
    const e = bd.outbox[0]!.payload as { payload: { origines: { reseau: string }[] } };
    expect(e.payload.origines).toHaveLength(1);
    expect(e.payload.origines[0]?.reseau).toBe("linkedin");
    expect(ancienne.crmStatut).toBeNull();
    expect(ancienne.crmTraiteeLe).toBeNull();
    expect(nouvelle.crmStatut).toBe("transmise");
  });

  it("MIXTE, avec coupure : l'origine antérieure à la coupure reste NULL, la postérieure part", async () => {
    const ancienne = origine({ createdAt: new Date("2026-10-15T09:00:00.000Z") });
    const nouvelle = origine({ createdAt: new Date("2026-11-02T09:00:00.000Z") });
    bd.origines.push(ancienne, nouvelle);
    await expect(
      transmettreOriginesSuivantes({
        email: EMAIL,
        emailKey: "cle-1",
        guide: "guide-ia",
        depuis: new Date("2026-11-01T00:00:00.000Z"),
      }),
    ).resolves.toBe("transmise");
    const e = bd.outbox[0]!.payload as { payload: { origines: unknown[] } };
    expect(e.payload.origines).toHaveLength(1);
    expect(ancienne.crmStatut).toBeNull();
    expect(nouvelle.crmStatut).toBe("transmise");
  });

  it("seule une origine antérieure : rien ne part, elle reste NULL", async () => {
    const ancienne = origine({ createdAt: new Date("2026-11-01T09:00:00.000Z") });
    bd.origines.push(ancienne);
    await expect(appel()).resolves.toBe("rien");
    expect(bd.requetesOutbox).toBe(0);
    expect(ancienne.crmStatut).toBeNull();
  });

  it("une origine ecartee n'entre jamais dans la charge cumulative", async () => {
    bd.origines.push(origine({ crmStatut: "ecartee" }));
    bd.origines.push(origine());
    await expect(appel()).resolves.toBe("transmise");
    const e = bd.outbox[0]!.payload as { payload: { origines: unknown[] } };
    expect(e.payload.origines).toHaveLength(1);
    expect(bd.origines[0]?.crmStatut).toBe("ecartee");
  });

  it("l'événement porte source_slug et guides_recus", async () => {
    bd.origines.push(origine());
    await appel();
    const e = bd.outbox[0]!.payload as Ligne;
    expect(e.source_slug).toBe("guide-reseau");
    expect(e.guides_recus).toEqual([{ guide: "guide-ia", date: "2026-11-01T10:05:00.000Z" }]);
  });

  it("adresse exclue : ses origines passent hors_charge (rien supprimé), rien n'est envoyé", async () => {
    process.env.CRM_SYNC_EXCLUSIONS_SHA256 = createHash("sha256").update(EMAIL).digest("hex");
    bd.origines.push(origine(), origine());
    await expect(appel()).resolves.toBe("exclue");
    expect(bd.requetesOutbox).toBe(0);
    expect(bd.origines).toHaveLength(2);
    expect(bd.origines.map((o) => o.crmStatut)).toEqual(["hors_charge", "hors_charge"]);
  });

  it("panne d'outbox : transaction annulée, origines inchangées (NULL), aucune exception", async () => {
    bd.panneOutbox = true;
    bd.origines.push(origine());
    await expect(appel()).resolves.toBe("echec");
    expect(bd.origines[0]?.crmStatut).toBeNull();
    expect(bd.outbox).toHaveLength(0);
  });

  it("interrupteur ORIGINES_SUIVANTES éteint : aucune requête vers l'outbox ni la demande", async () => {
    delete process.env.SYNCHRO_CRM_V3_ORIGINES_SUIVANTES;
    bd.origines.push(origine());
    expect(await appel()).toBe("eteinte");
    expect(bd.requetesOutbox).toBe(0);
    expect(bd.origines[0]?.crmStatut).toBeNull();
  });

  it("SYNCHRO_CRM_V3 éteint, ou verrous CRM fermés : rien", async () => {
    bd.origines.push(origine());
    delete process.env.SYNCHRO_CRM_V3;
    expect(await appel()).toBe("eteinte");
    process.env.SYNCHRO_CRM_V3 = "true";
    process.env.CRM_SYNC_GUIDE_ENABLED = "false";
    expect(await appel()).toBe("eteinte");
    expect(bd.requetesOutbox).toBe(0);
  });

  it("aucun journal ne contient l'adresse, l'empreinte, le post_ref ni la clé de dédoublonnage", async () => {
    const o = origine();
    bd.origines.push(o);
    await appel(o.cleDedoublonnage as string);
    bd.opposeeDepuis = 1;
    bd.origines.push(origine());
    await appel();
    const tout = logs.join("\n");
    expect(tout).not.toMatch(/@|cle-1|post_ref_|cle\d+0{10}/);
  });
});
