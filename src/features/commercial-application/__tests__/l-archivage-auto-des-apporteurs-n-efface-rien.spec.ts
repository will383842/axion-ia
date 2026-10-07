// L'archivage automatique des apporteurs (2026-10-07, demande de Will).
//
// Deux déclencheurs : le contrat est CONTRESIGNÉ, ou l'issue « Non retenu » est
// enregistrée. Ce qui est garanti, et que ce fichier vérifie :
//   · rien n'est effacé — on pose le statut « archivé » existant, c'est tout ;
//   · toutes les lignes de la personne (premier contact, dossier…) sont rangées ;
//   · rejouer ne fait rien de plus (idempotent) ;
//   · une fiche que Will a DÉSARCHIVÉE après un archivage automatique n'est
//     jamais ré-archivée ;
//   · l'essai à blanc n'écrit rien ;
//   · la fenêtre (`depuis`) borne le passage automatique ; le rattrapage n'en a pas ;
//   · `details` est relu DANS la transaction : une écriture concurrente survit ;
//   · un « Non retenu » corrigé en « Retenu » désarchive ce que le passage avait
//     rangé — jamais ce que Will a rangé à la main, ni un contrat contresigné.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = {
  id: string;
  contactEmailHash: string | null;
  contactEmail: string;
  details: Record<string, unknown>;
  archivedAt: Date | null;
  deletedAt: Date | null;
  status: string;
  needsAttention: boolean;
};
type Dossier = {
  id: string;
  submissionId: string | null;
  emailHash: string;
  signeParSocieteAt: Date | null;
};
type Evenement = {
  id: string;
  linkedSubmissionId: string | null;
  eventTypeName: string;
  status: string;
  startTime: Date | null;
  suivi: { issue: string; decision: string | null; renseigneLe: Date } | null;
};

const db = vi.hoisted(() => ({
  lignes: [] as Ligne[],
  dossiers: [] as Dossier[],
  evenements: [] as Evenement[],
  journal: [] as Array<Record<string, unknown>>,
  relancesAnnulees: [] as string[],
  /** Appelé juste avant chaque transaction : simule une écriture concurrente. */
  avantTransaction: null as null | (() => void),
}));

/** Ce que renvoie une lecture : une COPIE, comme une vraie base. */
function copie<T extends { details: Record<string, unknown> }>(l: T): T {
  return { ...l, details: { ...l.details } };
}

function correspond(l: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    const actuel = l[k];
    if (v instanceof Date) return actuel instanceof Date && actuel.getTime() === v.getTime();
    return actuel === v;
  });
}

function dansListe(v: unknown, cond: unknown): boolean {
  if (cond && typeof cond === "object" && "in" in (cond as Record<string, unknown>)) {
    return ((cond as { in: unknown[] }).in ?? []).includes(v);
  }
  return v === cond;
}

vi.mock("@/lib/prisma", () => {
  const submission = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const l = db.lignes.find((x) => x.id === where.id);
      return l ? copie(l) : null;
    }),
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      return db.lignes.map(copie).filter((l) => {
        if (where["deletedAt"] === null && l.deletedAt !== null) return false;
        if (where["id"] && !dansListe(l.id, where["id"])) return false;
        const or = where["OR"] as Array<Record<string, unknown>> | undefined;
        if (or) {
          return or.some((c) =>
            c["id"]
              ? dansListe(l.id, c["id"])
              : dansListe(l.contactEmailHash, c["contactEmailHash"]),
          );
        }
        return true;
      });
    }),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const l = db.lignes.find((x) => correspond(x, where));
        if (!l) return { count: 0 };
        Object.assign(l, data);
        return { count: 1 };
      },
    ),
  };
  const activityLog = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      db.journal.push(data);
      return data;
    }),
  };
  const prisma = {
    submission,
    activityLog,
    apporteurReseau: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            signeParSocieteAt: { gte?: Date };
            OR?: Array<{ emailHash?: { in: string[] }; submissionId?: { in: string[] } }>;
          };
        }) =>
          db.dossiers.filter(
            (d) =>
              d.signeParSocieteAt !== null &&
              (!where.signeParSocieteAt.gte ||
                d.signeParSocieteAt >= where.signeParSocieteAt.gte) &&
              (!where.OR ||
                where.OR.some(
                  (c) =>
                    (c.emailHash?.in ?? []).includes(d.emailHash) ||
                    (c.submissionId?.in ?? []).includes(d.submissionId ?? ""),
                )),
          ),
      ),
    },
    rendezVousSuivi: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { decision: string | { in: string[] }; renseigneLe?: { gte: Date } };
        }) =>
          db.evenements
            .filter(
              (e) =>
                e.suivi !== null &&
                dansListe(e.suivi.decision, where.decision) &&
                (!where.renseigneLe || e.suivi.renseigneLe >= where.renseigneLe.gte),
            )
            .map((e) => ({
              decision: e.suivi!.decision,
              calendlyEvent: { linkedSubmissionId: e.linkedSubmissionId },
            })),
      ),
    },
    calendlyEvent: {
      findMany: vi.fn(async ({ where }: { where: { linkedSubmissionId: { in: string[] } } }) =>
        db.evenements.filter((e) =>
          where.linkedSubmissionId.in.includes(e.linkedSubmissionId ?? ""),
        ),
      ),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      db.avantTransaction?.();
      return fn({ submission, activityLog });
    }),
  };
  return { prisma };
});

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("../relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn(async (adresse: string) => {
    db.relancesAnnulees.push(adresse);
    return 0;
  }),
}));

import { archiverApporteursTermines } from "../archivage-auto-apporteurs";
import {
  MARQUE_ARCHIVAGE_AUTO,
  MARQUE_ARCHIVAGE_AUTO_MOTIF,
} from "@/lib/commercial-application/etape-suivi-apporteur";

const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };
const MAINTENANT = new Date("2026-10-07T12:00:00Z");
const IL_Y_A_UN_MOIS = new Date("2026-09-07T12:00:00Z");

function ligne(id: string, hash: string | null, over: Partial<Ligne> = {}): Ligne {
  return {
    id,
    contactEmailHash: hash,
    contactEmail: `${id}@exemple.fr`,
    details: { ...APPORTEUR },
    archivedAt: null,
    deletedAt: null,
    status: "in_progress",
    needsAttention: true,
    ...over,
  };
}

function echange(id: string, fiche: string, decision: string | null, le: Date): Evenement {
  return {
    id,
    linkedSubmissionId: fiche,
    eventTypeName: "Échange apporteur",
    status: "active",
    startTime: le,
    suivi: { issue: decision ? "eu_lieu" : "absent", decision, renseigneLe: le },
  };
}

beforeEach(() => {
  db.lignes = [];
  db.dossiers = [];
  db.evenements = [];
  db.journal = [];
  db.relancesAnnulees = [];
  db.avantTransaction = null;
});

describe("contrat contresigné", () => {
  beforeEach(() => {
    db.lignes = [
      ligne("premier-contact", "h-ana"),
      ligne("dossier-complet", "h-ana"),
      ligne("message-contact", "h-ana", { details: { unifiedType: "contact" } }),
      ligne("autre-personne", "h-bob"),
    ];
    db.dossiers = [
      {
        id: "d-ana",
        submissionId: "dossier-complet",
        emailHash: "h-ana",
        signeParSocieteAt: MAINTENANT,
      },
    ];
  });

  it("archive TOUTES les lignes apporteur de la personne, et elles seules", async () => {
    const r = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: MAINTENANT,
    });
    expect(r.archivees).toBe(2);
    const statut = Object.fromEntries(db.lignes.map((l) => [l.id, l.status]));
    expect(statut).toEqual({
      "premier-contact": "archived",
      "dossier-complet": "archived",
      "message-contact": "in_progress", // un message /contact n'est pas une ligne apporteur
      "autre-personne": "in_progress",
    });
    const l = db.lignes.find((x) => x.id === "dossier-complet")!;
    expect(l.archivedAt).toEqual(MAINTENANT);
    expect(l.needsAttention).toBe(false);
    expect(l.details[MARQUE_ARCHIVAGE_AUTO]).toBe(MAINTENANT.toISOString());
    // Le reste de la fiche est intact : rien d'effacé.
    expect(l.details["unifiedType"]).toBe("recrutement");
    expect(db.journal).toHaveLength(2);
    expect(db.journal[0]).toMatchObject({
      adminUserId: null,
      action: "submission.archivage_auto",
      targetType: "submission",
    });
  });

  it("🔑 rejouer ne fait rien de plus", async () => {
    await archiverApporteursTermines({ appliquer: true, depuis: null, maintenant: MAINTENANT });
    const r = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: MAINTENANT,
    });
    expect(r.archivees).toBe(0);
    expect(db.journal).toHaveLength(2);
  });

  it("🔴 une fiche désarchivée par Will après l'archivage automatique reste ouverte", async () => {
    await archiverApporteursTermines({ appliquer: true, depuis: null, maintenant: MAINTENANT });
    const l = db.lignes.find((x) => x.id === "dossier-complet")!;
    // Ce que fait « Désarchiver » (transitions.ts) : statut et date, la marque reste.
    Object.assign(l, { status: "in_progress", archivedAt: null });
    const r = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: MAINTENANT,
    });
    expect(r.archivees).toBe(0);
    expect(r.laisseesOuvertes).toBe(1);
    expect(l.status).toBe("in_progress");
  });

  it("l'essai à blanc compte, et n'écrit rien", async () => {
    const r = await archiverApporteursTermines({
      appliquer: false,
      depuis: null,
      maintenant: MAINTENANT,
    });
    expect(r.archivees).toBe(2);
    expect(r.ecrit).toBe(false);
    expect(db.lignes.every((l) => l.status === "in_progress")).toBe(true);
    expect(db.journal).toHaveLength(0);
  });

  it("une ligne à la corbeille n'est pas touchée", async () => {
    db.lignes[0]!.deletedAt = IL_Y_A_UN_MOIS;
    const r = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: MAINTENANT,
    });
    expect(r.archivees).toBe(1);
    expect(db.lignes[0]!.status).toBe("in_progress");
  });

  it("la fenêtre du passage automatique laisse les anciennes au rattrapage", async () => {
    db.dossiers[0]!.signeParSocieteAt = IL_Y_A_UN_MOIS;
    const depuis = new Date(MAINTENANT.getTime() - 7 * 24 * 3600 * 1000);
    const r = await archiverApporteursTermines({ appliquer: true, depuis, maintenant: MAINTENANT });
    expect(r.archivees).toBe(0);
    const rattrapage = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: MAINTENANT,
    });
    expect(rattrapage.archivees).toBe(2);
  });

  it("🔴 une écriture concurrente dans `details` (webhook, geste de Will) n'est pas perdue", async () => {
    // Entre la lecture du début du passage et l'écriture du statut, un webhook
    // Calendly ajoute une clé à la fiche.
    db.avantTransaction = () => {
      const l = db.lignes.find((x) => x.id === "dossier-complet")!;
      l.details = { ...l.details, calendlyRecuAt: "2026-10-07T11:59:59Z" };
    };
    await archiverApporteursTermines({ appliquer: true, depuis: null, maintenant: MAINTENANT });
    const l = db.lignes.find((x) => x.id === "dossier-complet")!;
    expect(l.status).toBe("archived");
    expect(l.details["calendlyRecuAt"]).toBe("2026-10-07T11:59:59Z");
    expect(l.details[MARQUE_ARCHIVAGE_AUTO]).toBe(MAINTENANT.toISOString());
    expect(l.details[MARQUE_ARCHIVAGE_AUTO_MOTIF]).toBe("contrat-contresigne");
  });

  it("les relances encore en file de la personne sont retirées", async () => {
    await archiverApporteursTermines({ appliquer: true, depuis: null, maintenant: MAINTENANT });
    expect(db.relancesAnnulees).toContain("dossier-complet@exemple.fr");
  });
});

describe("issue « Non retenu »", () => {
  it("archive les lignes de la personne", async () => {
    db.lignes = [ligne("fiche", "h-cle"), ligne("premier", "h-cle")];
    db.evenements = [echange("e1", "fiche", "non_retenu", IL_Y_A_UN_MOIS)];
    const r = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: MAINTENANT,
    });
    expect(r.archivees).toBe(2);
    expect(r.personnesNonRetenues).toBe(1);
  });

  it("🔑 une décision « Retenu » PLUS RÉCENTE l'emporte : rien n'est archivé", async () => {
    db.lignes = [ligne("fiche", "h-cle")];
    db.evenements = [
      echange("e1", "fiche", "non_retenu", IL_Y_A_UN_MOIS),
      echange("e2", "fiche", "retenu", MAINTENANT),
    ];
    const r = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: MAINTENANT,
    });
    expect(r.archivees).toBe(0);
    expect(db.lignes[0]!.status).toBe("in_progress");
  });

  it("« Absent » ou « À revoir » n'archivent rien", async () => {
    db.lignes = [ligne("fiche", "h-cle")];
    db.evenements = [
      echange("e1", "fiche", null, MAINTENANT),
      echange("e2", "fiche", "a_revoir", MAINTENANT),
    ];
    const r = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: MAINTENANT,
    });
    expect(r.archivees).toBe(0);
  });
});

describe("retour en arrière : « Non retenu » corrigé en « Retenu »", () => {
  const PLUS_TARD = new Date("2026-10-08T12:00:00Z");

  it("🔴 désarchive ce que le passage avait rangé, au statut d'origine, et le trace", async () => {
    db.lignes = [ligne("fiche", "h-cle"), ligne("premier", "h-cle", { status: "processed" })];
    db.evenements = [echange("e1", "fiche", "non_retenu", IL_Y_A_UN_MOIS)];
    await archiverApporteursTermines({ appliquer: true, depuis: null, maintenant: MAINTENANT });
    expect(db.lignes.every((l) => l.status === "archived")).toBe(true);

    // Will corrige : la dernière décision devient « Retenu ».
    db.evenements.push(echange("e2", "fiche", "retenu", PLUS_TARD));
    const r = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: PLUS_TARD,
    });
    expect(r.desarchivees).toBe(2);
    expect(r.archivees).toBe(0);
    const statut = Object.fromEntries(db.lignes.map((l) => [l.id, l.status]));
    expect(statut).toEqual({ fiche: "in_progress", premier: "processed" });
    for (const l of db.lignes) {
      expect(l.archivedAt).toBeNull();
      expect(l.details[MARQUE_ARCHIVAGE_AUTO]).toBeUndefined();
      expect(l.details[MARQUE_ARCHIVAGE_AUTO_MOTIF]).toBeUndefined();
      expect(l.details["unifiedType"]).toBe("recrutement"); // rien d'effacé
    }
    const traces = db.journal.filter((j) => j["action"] === "submission.desarchivage_auto");
    expect(traces).toHaveLength(2);
    expect(traces[0]).toMatchObject({ adminUserId: null, targetType: "submission" });

    // Rejouer ne fait rien de plus.
    const encore = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: PLUS_TARD,
    });
    expect(encore.desarchivees).toBe(0);
    expect(encore.archivees).toBe(0);
  });

  it("l'essai à blanc compte le désarchivage, et n'écrit rien", async () => {
    db.lignes = [ligne("fiche", "h-cle")];
    db.evenements = [echange("e1", "fiche", "non_retenu", IL_Y_A_UN_MOIS)];
    await archiverApporteursTermines({ appliquer: true, depuis: null, maintenant: MAINTENANT });
    db.evenements.push(echange("e2", "fiche", "retenu", PLUS_TARD));
    const r = await archiverApporteursTermines({
      appliquer: false,
      depuis: null,
      maintenant: PLUS_TARD,
    });
    expect(r.desarchivees).toBe(1);
    expect(db.lignes[0]!.status).toBe("archived");
  });

  it("🔑 une fiche archivée À LA MAIN par Will n'est jamais désarchivée", async () => {
    db.lignes = [ligne("fiche", "h-cle", { status: "archived", archivedAt: IL_Y_A_UN_MOIS })];
    db.evenements = [
      echange("e1", "fiche", "non_retenu", IL_Y_A_UN_MOIS),
      echange("e2", "fiche", "retenu", PLUS_TARD),
    ];
    const r = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: PLUS_TARD,
    });
    expect(r.desarchivees).toBe(0);
    expect(db.lignes[0]!.status).toBe("archived");
  });

  it("🔑 rouverte par Will puis RÉ-archivée à la main : l'ancienne marque ne suffit pas", async () => {
    db.lignes = [ligne("fiche", "h-cle")];
    db.evenements = [echange("e1", "fiche", "non_retenu", IL_Y_A_UN_MOIS)];
    await archiverApporteursTermines({ appliquer: true, depuis: null, maintenant: MAINTENANT });
    const l = db.lignes[0]!;
    Object.assign(l, { status: "in_progress", archivedAt: null }); // « Désarchiver »
    Object.assign(l, { status: "archived", archivedAt: new Date("2026-10-07T15:00:00Z") }); // « Archiver »
    db.evenements.push(echange("e2", "fiche", "retenu", PLUS_TARD));
    const r = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: PLUS_TARD,
    });
    expect(r.desarchivees).toBe(0);
    expect(l.status).toBe("archived");
  });

  it("🔑 une fiche archivée pour contrat contresigné n'est jamais désarchivée", async () => {
    db.lignes = [ligne("fiche", "h-cle")];
    db.dossiers = [
      { id: "d", submissionId: "fiche", emailHash: "h-cle", signeParSocieteAt: MAINTENANT },
    ];
    await archiverApporteursTermines({ appliquer: true, depuis: null, maintenant: MAINTENANT });
    db.evenements = [
      echange("e1", "fiche", "non_retenu", IL_Y_A_UN_MOIS),
      echange("e2", "fiche", "retenu", PLUS_TARD),
    ];
    const r = await archiverApporteursTermines({
      appliquer: true,
      depuis: null,
      maintenant: PLUS_TARD,
    });
    expect(r.desarchivees).toBe(0);
    expect(db.lignes[0]!.status).toBe("archived");
  });

  it("🔑 rangée pour « Non retenu » mais contrat contresigné depuis : reste archivée", async () => {
    db.lignes = [ligne("fiche", "h-cle")];
    db.evenements = [echange("e1", "fiche", "non_retenu", IL_Y_A_UN_MOIS)];
    await archiverApporteursTermines({ appliquer: true, depuis: null, maintenant: MAINTENANT });
    db.evenements.push(echange("e2", "fiche", "retenu", PLUS_TARD));
    // Contresigné hors de la fenêtre du passage : il compte quand même.
    db.dossiers = [
      { id: "d", submissionId: "fiche", emailHash: "h-cle", signeParSocieteAt: IL_Y_A_UN_MOIS },
    ];
    const depuis = new Date(PLUS_TARD.getTime() - 7 * 24 * 3600 * 1000);
    const r = await archiverApporteursTermines({ appliquer: true, depuis, maintenant: PLUS_TARD });
    expect(r.desarchivees).toBe(0);
    expect(db.lignes[0]!.status).toBe("archived");
  });
});
