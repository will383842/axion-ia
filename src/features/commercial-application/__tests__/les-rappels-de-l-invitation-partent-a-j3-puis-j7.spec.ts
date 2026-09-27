// Le passage quotidien des rappels de l'invitation (décision Will, 2026-09-27).
//
// Joué sur une base EN MÉMOIRE (les filtres Prisma utilisés sont réinterprétés
// ici), jour après jour : J+3 puis J+7, jamais un troisième ; rien pour une
// personne qui a réservé (même annulé, même pas encore rattaché), qui a reçu une
// réponse, qui est archivée / sans suite, effacée, opposée ; jobId déterministe ;
// une invitation partie AVANT le déploiement est rattrapée.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;

const db = vi.hoisted(() => ({
  submissions: [] as Ligne[],
  emailLogs: [] as Ligne[],
  outbox: [] as Ligne[],
  calendly: [] as Ligne[],
  replies: [] as Ligne[],
  enqueue: null as unknown as ReturnType<typeof vi.fn>,
  verdict: null as unknown as ReturnType<typeof vi.fn>,
}));

/** Réinterprète le sous-ensemble de filtres Prisma employé par les modules testés. */
function correspond(ligne: Ligne, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([cle, cond]) => {
    if (cle === "OR") return (cond as Record<string, unknown>[]).some((w) => correspond(ligne, w));
    const v = ligne[cle];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ("in" in c) {
        const liste = c["in"] as unknown[];
        return liste.some((x) =>
          typeof x === "string" && typeof v === "string"
            ? x.toLowerCase() === v.toLowerCase()
            : x === v,
        );
      }
      if ("gt" in c) return v instanceof Date && v.getTime() > (c["gt"] as Date).getTime();
      if ("gte" in c) return v instanceof Date && v.getTime() >= (c["gte"] as Date).getTime();
      if ("not" in c) return v !== c["not"] && v !== undefined;
      return false;
    }
    return v === cond;
  });
}

function trouver(table: Ligne[], args: { where?: Record<string, unknown>; orderBy?: unknown }) {
  const rows = table.filter((l) => correspond(l, args.where));
  const ordre = args.orderBy as { createdAt?: "asc" | "desc" } | undefined;
  if (ordre?.createdAt) {
    rows.sort((a, b) => {
      const d = (a["createdAt"] as Date).getTime() - (b["createdAt"] as Date).getTime();
      return ordre.createdAt === "desc" ? -d : d;
    });
  }
  return rows;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.submissions, a),
      findUnique: async (a: { where: { id: string } }) =>
        db.submissions.find((l) => l["id"] === a.where.id) ?? null,
    },
    emailLog: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.emailLogs, a),
      findFirst: async (a: { where?: Record<string, unknown> }) =>
        trouver(db.emailLogs, a)[0] ?? null,
    },
    emailOutbox: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.outbox, a),
    },
    calendlyEvent: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.calendly, a),
    },
    submissionReply: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.replies, a),
    },
    // 2026-09-27 — réponses reçues par e-mail : couvertes par
    // `les-reponses-entrantes-arretent-les-rappels.spec.ts`, vides ici.
    submissionInboundReply: { findMany: async () => [] },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => v,
  isDecryptedEmailUsable: (v: string | null) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => db.enqueue(...a),
}));
vi.mock("@/server/email/verdict-envoi", () => ({
  verdictAvantEnvoi: (...a: unknown[]) => db.verdict(...a),
}));

import { passerRelancesInvitation } from "../relances-invitation-apporteur";
import { GABARIT_INVITATION } from "../relance-invitation-etat";
import { GABARIT_INVITATION_APPORTEUR, lireSuiviInvitationListe } from "../invitation-apporteur";
import { GABARIT_RELANCE_INVITATION } from "@/lib/commercial-application/relance-invitation";

const JOUR = 24 * 60 * 60 * 1000;
/** Soir du 27/09 : les 58 invitations. */
const INVITATION = new Date("2026-09-27T19:30:00Z");
/** Le passage tourne à 08:00 UTC. */
const passage = (jour: number) => new Date(Date.UTC(2026, 8, 27 + jour, 8, 0, 0));
const CALENDLY = "https://calendly.com/axion-ia/echange-apporteur";

function ligne(over: Ligne = {}): Ligne {
  return {
    id: "ligne-a",
    contactEmailHash: "empreinte-a",
    contactEmail: "camille@exemple.fr",
    contactName: "Camille Martin",
    locale: "fr",
    deletedAt: null,
    archivedAt: null,
    status: "new",
    details: { unifiedType: "candidature", subType: "commercial" },
    ...over,
  };
}

function invitation(over: Ligne = {}): Ligne {
  return {
    id: "inv-1",
    template: GABARIT_INVITATION_APPORTEUR,
    entityType: "Submission",
    entityId: "ligne-a",
    status: "sent",
    createdAt: INVITATION,
    ...over,
  };
}

/** `enqueueEmail` doublé comme le vrai : il pose la ligne « en attente », une seule par jobId. */
function enqueueCommeLeVrai(maintenant: () => Date) {
  return vi.fn(
    async (
      template: string,
      _to: string,
      _locale: string,
      _payload: Record<string, unknown>,
      o: { entityType: string; entityId: string; jobId: string },
    ) => {
      if (!db.emailLogs.some((l) => l["jobId"] === o.jobId)) {
        db.emailLogs.push({
          id: `log-${db.emailLogs.length}`,
          template,
          entityType: o.entityType,
          entityId: o.entityId,
          status: "pending",
          jobId: o.jobId,
          createdAt: maintenant(),
        });
      }
      return { enqueued: true };
    },
  );
}

let horloge = passage(0);

beforeEach(() => {
  db.submissions = [ligne()];
  db.emailLogs = [invitation()];
  db.outbox = [];
  db.calendly = [];
  db.replies = [];
  horloge = passage(0);
  db.enqueue = enqueueCommeLeVrai(() => horloge);
  db.verdict = vi.fn(async () => ({ retenu: false }));
  process.env["CALENDLY_APPORTEUR_URL"] = CALENDLY;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env["CALENDLY_APPORTEUR_URL"];
  vi.restoreAllMocks();
});

/** Joue le passage du jour 0 au jour `n`, et rend les étapes envoyées, jour par jour. */
async function jouerJusqua(n: number): Promise<Array<[number, string]>> {
  const envois: Array<[number, string]> = [];
  for (let j = 0; j <= n; j++) {
    horloge = passage(j);
    const avant = db.enqueue.mock.calls.length;
    await passerRelancesInvitation(horloge);
    for (const appel of db.enqueue.mock.calls.slice(avant)) {
      envois.push([j, (appel[3] as { etape: string }).etape]);
    }
    // Le worker d'e-mails passe : ce qui était en file est parti.
    for (const l of db.emailLogs) if (l["status"] === "pending") l["status"] = "sent";
  }
  return envois;
}

describe("le calendrier, joué jour après jour", () => {
  it("🔴 J+3 puis J+7, et jamais un troisième", async () => {
    expect(await jouerJusqua(14)).toEqual([
      [4, "j3"], // invitation à 19:30 le 27 : trois jours pleins atteints le 01/10 à 08:00
      [8, "j7"],
    ]);
  });

  it("le rappel porte le lien de réservation, le prénom, la fiche invitée et un jobId déterministe", async () => {
    horloge = passage(4);
    await passerRelancesInvitation(horloge);
    expect(db.enqueue).toHaveBeenCalledTimes(1);
    const [template, to, locale, payload, options] = db.enqueue.mock.calls[0]!;
    expect(template).toBe(GABARIT_RELANCE_INVITATION);
    expect(to).toBe("camille@exemple.fr");
    expect(locale).toBe("fr");
    expect(payload).toEqual({ contactName: "Camille Martin", calendlyUrl: CALENDLY, etape: "j3" });
    expect(options).toEqual({
      entityType: "Submission",
      entityId: "ligne-a",
      jobId: "apporteur-invit-relance-j3-empreinte-a-inv-1",
    });
    // Envoi IMMÉDIAT : aucun délai, le worker relit l'état juste avant de partir.
    expect(options).not.toHaveProperty("delayMs");
  });

  it("deux passages le même jour ne posent qu'un seul rappel", async () => {
    horloge = passage(4);
    await passerRelancesInvitation(horloge);
    await passerRelancesInvitation(horloge);
    expect(db.enqueue).toHaveBeenCalledTimes(1);
  });

  it("un rappel garé en validation, annulé ou en échec compte pour son étape", async () => {
    db.outbox.push({
      template: GABARIT_RELANCE_INVITATION,
      entityType: "Submission",
      entityId: "ligne-a",
      createdAt: passage(4),
      statut: "a_valider",
    });
    horloge = passage(5);
    await passerRelancesInvitation(horloge);
    expect(db.enqueue).not.toHaveBeenCalled();
    db.outbox = [];
    db.emailLogs.push({
      template: GABARIT_RELANCE_INVITATION,
      entityType: "Submission",
      entityId: "ligne-a",
      status: "failed",
      createdAt: passage(4),
    });
    await passerRelancesInvitation(horloge);
    expect(db.enqueue).not.toHaveBeenCalled();
  });
});

describe("une invitation partie AVANT le déploiement est rattrapée", () => {
  it("invitation vieille de 9 jours, sur une AUTRE ligne de la personne : J+3 aujourd'hui, J+7 trois jours plus tard", async () => {
    db.submissions = [
      ligne({
        id: "ancienne",
        details: { unifiedType: "candidature", subType: "commercial", etape: "premier-contact" },
      }),
      ligne({ id: "recente" }),
    ];
    db.emailLogs = [
      invitation({ entityId: "ancienne", createdAt: new Date(passage(0).getTime() - 9 * JOUR) }),
    ];
    const envois = await jouerJusqua(5);
    expect(envois).toEqual([
      [0, "j3"],
      [3, "j7"],
    ]);
    expect((db.enqueue.mock.calls[0]![4] as { entityId: string }).entityId).toBe("ancienne");
  });

  it("au-delà de 14 jours, plus rien", async () => {
    db.emailLogs = [invitation({ createdAt: new Date(passage(0).getTime() - 15 * JOUR) })];
    await passerRelancesInvitation(passage(0));
    expect(db.enqueue).not.toHaveBeenCalled();
  });

  it("une nouvelle invitation (« Renvoyer quand même ») recommence le compte, avec ses propres jobId", async () => {
    await jouerJusqua(8);
    db.emailLogs.push(invitation({ id: "inv-2", createdAt: passage(9) }));
    horloge = passage(12);
    const avant = db.enqueue.mock.calls.length;
    await passerRelancesInvitation(horloge);
    const nouveaux = db.enqueue.mock.calls.slice(avant);
    expect(nouveaux).toHaveLength(1);
    expect((nouveaux[0]![4] as { jobId: string }).jobId).toBe(
      "apporteur-invit-relance-j3-empreinte-a-inv-2",
    );
  });

  it("une invitation plus récente encore en file suspend les rappels", async () => {
    db.emailLogs.push(invitation({ id: "inv-2", status: "pending", createdAt: passage(3) }));
    await passerRelancesInvitation(passage(4));
    expect(db.enqueue).not.toHaveBeenCalled();
  });
});

describe("🔴 ce qui arrête tout rappel", () => {
  it("un échange réservé sur une autre ligne de la personne — même ANNULÉ", async () => {
    db.submissions.push(ligne({ id: "ligne-b" }));
    db.calendly = [
      {
        linkedSubmissionId: "ligne-b",
        inviteeEmail: null,
        status: "canceled",
        eventTypeName: "Échange apporteur",
      },
    ];
    expect(await jouerJusqua(10)).toEqual([]);
  });

  it("un échange réservé mais PAS ENCORE rattaché : l'adresse de l'invité suffit", async () => {
    db.calendly = [
      {
        linkedSubmissionId: null,
        inviteeEmail: "Camille@Exemple.fr",
        status: "scheduled",
        eventTypeName: "Échange apporteur",
      },
    ];
    expect(await jouerJusqua(10)).toEqual([]);
  });

  it("une réservation arrivée APRÈS le premier rappel arrête le second", async () => {
    await jouerJusqua(5);
    db.calendly = [
      {
        linkedSubmissionId: "ligne-a",
        inviteeEmail: null,
        status: "scheduled",
        eventTypeName: "Échange apporteur",
      },
    ];
    const avant = db.enqueue.mock.calls.length;
    for (let j = 6; j <= 12; j++) await passerRelancesInvitation(passage(j));
    expect(db.enqueue.mock.calls.length).toBe(avant);
  });

  it("une réponse du composeur APRÈS l'invitation", async () => {
    db.replies = [{ submissionId: "ligne-a", repliedAt: passage(1) }];
    expect(await jouerJusqua(10)).toEqual([]);
  });

  it("…mais une réponse ANTÉRIEURE à l'invitation n'empêche pas le rappel", async () => {
    db.replies = [{ submissionId: "ligne-a", repliedAt: new Date(INVITATION.getTime() - JOUR) }];
    expect((await jouerJusqua(4)).map(([, e]) => e)).toEqual(["j3"]);
  });

  it("« j'ai répondu ailleurs » après l'invitation", async () => {
    db.submissions = [
      ligne({
        details: {
          unifiedType: "candidature",
          subType: "commercial",
          reponduHorsCircuitAt: passage(1).toISOString(),
        },
      }),
    ];
    expect(await jouerJusqua(10)).toEqual([]);
  });

  it.each<[string, Ligne]>([
    ["archivée", { archivedAt: new Date(0), status: "archived" }],
    [
      "classée sans suite",
      {
        details: {
          unifiedType: "candidature",
          subType: "commercial",
          sansSuiteAt: "2026-09-28T10:00:00Z",
        },
      },
    ],
    ["supprimée (corbeille)", { deletedAt: new Date("2026-09-28T10:00:00Z") }],
    ["effacée (art. 17)", { contactEmail: "erased-abc@erased.local", contactName: "[effacé]" }],
  ])("une fiche %s", async (_cas, over) => {
    db.submissions = [ligne(over)];
    expect(await jouerJusqua(10)).toEqual([]);
  });

  it("une personne opposée : relue avant l'enfilage, rien n'est mis en file", async () => {
    db.verdict = vi.fn(async () => ({ retenu: true, motif: "oppose", depuis: null }));
    const r = await passerRelancesInvitation(passage(4));
    expect(db.enqueue).not.toHaveBeenCalled();
    expect(r.ecartees).toEqual({ oppose: 1 });
  });

  it("sans CALENDLY_APPORTEUR_URL : rien ne part, rien n'est lu, et c'est dit", async () => {
    delete process.env["CALENDLY_APPORTEUR_URL"];
    const r = await passerRelancesInvitation(passage(4));
    expect(r.suspendu).toBe("lien-absent");
    expect(db.enqueue).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/CALENDLY_APPORTEUR_URL/));
  });

  it("un lien qui n'est pas un Calendly https est traité comme absent", async () => {
    process.env["CALENDLY_APPORTEUR_URL"] = "http://exemple.fr/rdv";
    const r = await passerRelancesInvitation(passage(4));
    expect(r.suspendu).toBe("lien-absent");
    expect(db.enqueue).not.toHaveBeenCalled();
  });
});

describe("contrats", () => {
  it("le nom de l'invitation lu par le module d'état est celui de la console", () => {
    expect(GABARIT_INVITATION).toBe(GABARIT_INVITATION_APPORTEUR);
  });
});

describe("la liste des apporteurs lit le suivi par PERSONNE", () => {
  it("invitation d'une ligne, rappels, échange rattaché à une troisième : tout remonte sur la ligne affichée", async () => {
    db.submissions = [
      ligne({ id: "affichee" }),
      ligne({ id: "ligne-a" }),
      ligne({ id: "ligne-c" }),
    ];
    db.emailLogs = [
      invitation(),
      // Un rappel d'une invitation PRÉCÉDENTE ne compte pas.
      {
        template: GABARIT_RELANCE_INVITATION,
        entityType: "Submission",
        entityId: "ligne-a",
        status: "sent",
        createdAt: new Date(INVITATION.getTime() - JOUR),
      },
      {
        template: GABARIT_RELANCE_INVITATION,
        entityType: "Submission",
        entityId: "ligne-a",
        status: "sent",
        createdAt: passage(4),
      },
      // Un rappel annulé au départ n'est pas un rappel parti.
      {
        template: GABARIT_RELANCE_INVITATION,
        entityType: "Submission",
        entityId: "ligne-a",
        status: "cancelled",
        createdAt: passage(8),
      },
    ];
    let suivi = (await lireSuiviInvitationListe(["affichee"])).get("affichee");
    expect(suivi).toEqual({
      invitation: INVITATION,
      relances: [passage(4)],
      echange: null,
      reponse: null,
    });

    db.calendly = [
      { linkedSubmissionId: "ligne-c", status: "canceled", eventTypeName: "Échange apporteur" },
    ];
    suivi = (await lireSuiviInvitationListe(["affichee"])).get("affichee");
    expect(suivi?.echange).toBe("annule");

    db.calendly.push({
      linkedSubmissionId: "ligne-c",
      status: "scheduled",
      eventTypeName: "Échange apporteur",
    });
    suivi = (await lireSuiviInvitationListe(["affichee"])).get("affichee");
    expect(suivi?.echange).toBe("reserve");
  });

  it("un rendez-vous CLIENT rattaché n'est pas un échange apporteur", async () => {
    db.calendly = [
      { linkedSubmissionId: "ligne-a", status: "scheduled", eventTypeName: "Appel découverte" },
    ];
    const suivi = (await lireSuiviInvitationListe(["ligne-a"])).get("ligne-a");
    expect(suivi?.echange).toBeNull();
  });

  it("ni invitation ni échange : rien, la liste garde son badge", async () => {
    db.emailLogs = [];
    expect((await lireSuiviInvitationListe(["ligne-a"])).size).toBe(0);
  });
});
