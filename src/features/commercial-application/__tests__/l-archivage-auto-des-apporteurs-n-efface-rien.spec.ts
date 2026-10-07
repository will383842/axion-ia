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
//   · la fenêtre (`depuis`) borne le passage automatique ; le rattrapage n'en a pas.

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
}));

function dansListe(v: unknown, cond: unknown): boolean {
  if (cond && typeof cond === "object" && "in" in (cond as Record<string, unknown>)) {
    return ((cond as { in: unknown[] }).in ?? []).includes(v);
  }
  return v === cond;
}

vi.mock("@/lib/prisma", () => {
  const submission = {
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      return db.lignes.filter((l) => {
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
        const l = db.lignes.find(
          (x) => x.id === where["id"] && x.archivedAt === null && x.deletedAt === null,
        );
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
      findMany: vi.fn(async ({ where }: { where: { signeParSocieteAt: { gte?: Date } } }) =>
        db.dossiers.filter(
          (d) =>
            d.signeParSocieteAt !== null &&
            (!where.signeParSocieteAt.gte || d.signeParSocieteAt >= where.signeParSocieteAt.gte),
        ),
      ),
    },
    rendezVousSuivi: {
      findMany: vi.fn(async ({ where }: { where: { renseigneLe?: { gte: Date } } }) =>
        db.evenements
          .filter(
            (e) =>
              e.suivi?.decision === "non_retenu" &&
              (!where.renseigneLe || e.suivi.renseigneLe >= where.renseigneLe.gte),
          )
          .map((e) => ({ calendlyEvent: { linkedSubmissionId: e.linkedSubmissionId } })),
      ),
    },
    calendlyEvent: {
      findMany: vi.fn(async ({ where }: { where: { linkedSubmissionId: { in: string[] } } }) =>
        db.evenements.filter((e) =>
          where.linkedSubmissionId.in.includes(e.linkedSubmissionId ?? ""),
        ),
      ),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ submission, activityLog }),
    ),
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
import { MARQUE_ARCHIVAGE_AUTO } from "@/lib/commercial-application/etape-suivi-apporteur";

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
