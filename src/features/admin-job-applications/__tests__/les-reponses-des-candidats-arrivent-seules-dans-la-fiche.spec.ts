// Lot L3 (2026-10-07) — les réponses des candidats EMPLOI, relevées dans la
// boîte Zoho Mail, arrivent seules dans leur fiche.
//
// Joué sur une base EN MÉMOIRE et un client Zoho DOUBLÉ — aucun appel réseau.
// On vérifie :
//   · le rattachement : empreinte d'adresse ET un message parti vers le dossier
//     avant la réception ;
//   · ce qu'écrit une réponse humaine : la ligne (extrait chiffré), `email_recu`
//     au journal, « à traiter », une alerte `CANDIDAT_REPLIED` ;
//   · l'idempotence (trois passages, une ligne, une alerte) ;
//   · la réponse automatique : gardée, sans effet ;
//   · l'inertie : variables absentes, build `stub.invalid`, table absente,
//     Zoho injoignable — curseur intact ;
//   · 🔴 NON-RÉGRESSION : le relevé des APPORTEURS (le vrai module, pas un
//     double) se comporte EXACTEMENT de la même façon, que ce relevé tourne ou
//     non — même ligne, même alerte, même curseur ;
//   · [I13] une personne des deux mondes : sa réponse dans les DEUX fiches, UNE
//     alerte, dans quelque ordre que tournent les deux relevés.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;

const db = vi.hoisted(() => ({
  candidatures: [] as Ligne[],
  envoisCandidats: [] as Ligne[],
  evenements: [] as Ligne[],
  reponsesCandidats: [] as Ligne[],
  submissions: [] as Ligne[],
  emailLogs: [] as Ligne[],
  entrantesApporteurs: [] as Ligne[],
  settings: new Map<string, unknown>(),
  tableCandidatsAbsente: false,
  notify: null as unknown as ReturnType<typeof vi.fn>,
}));

function correspond(ligne: Ligne, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([cle, cond]) => {
    if (cle === "OR") return (cond as Record<string, unknown>[]).some((w) => correspond(ligne, w));
    const v = ligne[cle];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ("in" in c) return (c["in"] as unknown[]).includes(v);
      if ("lt" in c) return v instanceof Date && v.getTime() < (c["lt"] as Date).getTime();
      return false;
    }
    return v === cond;
  });
}
const trouver = (t: Ligne[], a: { where?: Record<string, unknown> }) =>
  t.filter((l) => correspond(l, a.where));

function absente(): never {
  throw Object.assign(new Error("The table `job_application_inbound_replies` does not exist"), {
    code: "P2021",
  });
}

function creerUnique(table: Ligne[], data: Ligne, prefixe: string): Ligne {
  if (table.some((l) => l["zohoMessageId"] === data["zohoMessageId"])) {
    throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  }
  const ligne = { id: `${prefixe}-${table.length}`, auto: false, ...data };
  table.push(ligne);
  return ligne;
}

vi.mock("@/lib/prisma", () => {
  const client = {
    jobApplication: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.candidatures, a),
      findUnique: async (a: { where: { id: string } }) =>
        db.candidatures.find((l) => l["id"] === a.where.id) ?? null,
      updateMany: async (a: { where: Record<string, unknown>; data: Ligne }) => {
        const cibles = trouver(db.candidatures, a);
        for (const l of cibles) Object.assign(l, a.data);
        return { count: cibles.length };
      },
    },
    jobApplicationReply: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.envoisCandidats, a),
    },
    jobApplicationEvent: {
      create: async (a: { data: Ligne }) => {
        const l = { id: `evt-${db.evenements.length}`, ...a.data };
        db.evenements.push(l);
        return l;
      },
    },
    jobApplicationInboundReply: {
      findMany: async (a: { where?: Record<string, unknown> }) =>
        db.tableCandidatsAbsente ? absente() : trouver(db.reponsesCandidats, a),
      create: async (a: { data: Ligne }) =>
        db.tableCandidatsAbsente ? absente() : creerUnique(db.reponsesCandidats, a.data, "rc"),
    },
    submission: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.submissions, a),
      updateMany: async (a: { where: Record<string, unknown>; data: Ligne }) => {
        const cibles = trouver(db.submissions, a);
        for (const l of cibles) Object.assign(l, a.data);
        return { count: cibles.length };
      },
    },
    emailLog: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.emailLogs, a),
    },
    submissionInboundReply: {
      findMany: async (a: { where?: Record<string, unknown> }) =>
        trouver(db.entrantesApporteurs, a),
      create: async (a: { data: Ligne }) => creerUnique(db.entrantesApporteurs, a.data, "ra"),
    },
    setting: {
      findUnique: async (a: { where: { key: string } }) =>
        db.settings.has(a.where.key) ? { value: db.settings.get(a.where.key) } : null,
      upsert: async (a: { where: { key: string }; update: { value: unknown } }) => {
        db.settings.set(a.where.key, a.update.value);
        return {};
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(client),
  };
  return { prisma: client };
});
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string | null) => (v ? `enc:${v}` : v),
  decryptPii: (v: string | null) => (v && v.startsWith("enc:") ? v.slice(4) : v),
  PII_DECRYPT_PLACEHOLDER: "[encrypted — key missing]",
}));
vi.mock("@/server/notifications", () => ({
  notify: (...a: unknown[]) => db.notify(...a),
}));
// Le module des apporteurs tire la file d'envoi par ses voisins : aucune
// connexion Redis dans un test.
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));

import {
  ATTENTE_AUTRE_RELEVE_MS,
  AUTEUR_RELEVE,
  CLE_CURSEUR,
  INTERRUPTEUR,
  passerReponsesEntrantesCandidats,
  reinitialiserJournalConfig,
} from "../reponses-entrantes-candidature";
import {
  CLE_CURSEUR as CLE_CURSEUR_APPORTEURS,
  passerReponsesEntrantes,
} from "@/features/commercial-application/reponses-entrantes-apporteur";
import { GABARIT_INVITATION_APPORTEUR } from "@/features/commercial-application/invitation-apporteur";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import type { ClientZohoMail, MessageZoho } from "@/server/zoho-mail/client";
import type { Entetes } from "@/lib/commercial-application/reponse-entrante";

const EMPREINTE = hashEmailForLookup("sarah@exemple.fr")!;
const ACCUSE = new Date("2026-10-02T18:40:00Z");
const MAINTENANT = new Date("2026-10-07T10:00:00Z");
const RECU = new Date("2026-10-07T09:14:00Z");

function candidature(over: Ligne = {}): Ligne {
  return {
    id: "cand-a",
    emailHash: EMPREINTE,
    firstName: "enc:Sarah",
    lastName: "enc:L.",
    offerTitleSnap: "Monteur vidéo freelance",
    needsAttention: false,
    lastActivityAt: null,
    ...over,
  };
}
function accuse(over: Ligne = {}): Ligne {
  return {
    id: "log-accuse",
    template: "candidature-recue",
    entityType: "JobApplication",
    entityId: "cand-a",
    status: "sent",
    createdAt: ACCUSE,
    sentAt: ACCUSE,
    ...over,
  };
}
function message(over: Partial<MessageZoho> = {}): MessageZoho {
  return {
    messageId: "1709887058769200001",
    folderId: "9000000002014",
    fromAddress: "Sarah@Exemple.fr",
    subject: "Re: Votre candidature",
    summary: "Bien reçu les rushs, je vous envoie une première version jeudi.",
    receivedAt: RECU,
    ...over,
  };
}

const HUMAIN: Entetes = { "message-id": ["<abc@exemple.fr>"] };
const AUTOMATIQUE: Entetes = { "auto-submitted": ["auto-replied"], "message-id": ["<oof@x>"] };

function clientDouble(messages: MessageZoho[], entetes: Record<string, Entetes> = {}) {
  return {
    listerMessagesRecus: vi.fn(async (depuis: Date) => ({
      messages: messages.filter((m) => m.receivedAt.getTime() >= depuis.getTime()),
      complet: true,
    })),
    lireEntetes: vi.fn(async (_f: string, id: string) => entetes[id] ?? HUMAIN),
  } satisfies ClientZohoMail;
}

beforeEach(() => {
  db.candidatures = [candidature()];
  db.envoisCandidats = [];
  db.evenements = [];
  db.reponsesCandidats = [];
  db.submissions = [];
  db.emailLogs = [accuse()];
  db.entrantesApporteurs = [];
  db.settings = new Map();
  db.tableCandidatsAbsente = false;
  db.notify = vi.fn(async () => ({ ok: true }));
  reinitialiserJournalConfig();
  // Le relevé est ÉTEINT par défaut (paquet 2) : allumé ici pour l'éprouver ;
  // le cas « éteint » a son propre test plus bas.
  process.env[INTERRUPTEUR] = "true";
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env[INTERRUPTEUR];
  vi.restoreAllMocks();
});

describe("une réponse de candidat arrive seule dans sa fiche", () => {
  it("🔴 enregistrée (extrait chiffré), consignée au journal, dossier « à traiter », UNE alerte", async () => {
    const r = await passerReponsesEntrantesCandidats({
      client: clientDouble([message()]),
      maintenant: MAINTENANT,
    });

    expect(r.enregistrees).toEqual({ humaines: 1, automatiques: 0 });
    expect(db.reponsesCandidats).toHaveLength(1);
    const ligne = db.reponsesCandidats[0]!;
    expect(ligne).toMatchObject({
      applicationId: "cand-a",
      fromEmailHash: EMPREINTE,
      subject: "Re: Votre candidature",
      zohoMessageId: "1709887058769200001",
      internetMessageId: "<abc@exemple.fr>",
      auto: false,
    });
    expect(ligne["excerpt"]).toBe(
      "enc:Bien reçu les rushs, je vous envoie une première version jeudi.",
    );

    // Le journal : `email_recu`, à la date de RÉCEPTION, auteur = le mécanisme,
    // et JAMAIS l'extrait en clair (le journal n'est pas chiffré).
    expect(db.evenements).toHaveLength(1);
    expect(db.evenements[0]).toMatchObject({
      applicationId: "cand-a",
      type: "email_recu",
      authorId: null,
      authorName: AUTEUR_RELEVE,
      occurredAt: RECU,
      body: null,
    });
    // Résumé neutre : le journal est en clair, l'objet n'y est jamais recopié.
    expect(db.evenements[0]!["summary"]).toBe("Réponse reçue par e-mail");
    expect(JSON.stringify(db.evenements[0])).not.toContain("Re: Votre candidature");
    expect(JSON.stringify(db.evenements[0])).not.toContain("première version");

    expect(db.candidatures[0]!["needsAttention"]).toBe(true);
    expect(db.candidatures[0]!["lastActivityAt"]).toEqual(RECU);

    expect(db.notify).toHaveBeenCalledTimes(1);
    expect(db.notify.mock.calls[0]![0]).toMatchObject({
      category: "CANDIDAT_REPLIED",
      payload: {
        applicationId: "cand-a",
        offerTitle: "Monteur vidéo freelance",
      },
    });
    // 🔴 VETO relecture 2026-10-09 : ni nom, ni objet, ni adresse, ni extrait
    // dans l'alerte Telegram — le poste et le lien vers la fiche, rien d'autre.
    const alerte = JSON.stringify(db.notify.mock.calls[0]);
    expect(Object.keys(db.notify.mock.calls[0]![0].payload).sort()).toEqual([
      "applicationId",
      "offerTitle",
      "receivedAt",
    ]);
    expect(alerte).not.toContain("Sarah");
    expect(alerte).not.toContain("Re: Votre candidature");
    expect(alerte).not.toContain("sarah@exemple.fr");
    expect(alerte).not.toContain("première version");
  });

  it("🔴 trois passages : visible UNE seule fois, une seule alerte", async () => {
    const client = clientDouble([message()]);
    for (const minutes of [0, 15, 30]) {
      await passerReponsesEntrantesCandidats({
        client,
        maintenant: new Date(MAINTENANT.getTime() + minutes * 60_000),
      });
    }
    expect(db.reponsesCandidats).toHaveLength(1);
    expect(db.evenements).toHaveLength(1);
    expect(db.notify).toHaveBeenCalledTimes(1);
  });

  it("« je suis absent » : gardée, marquée automatique — ni journal, ni « à traiter », ni alerte", async () => {
    const m = message({ subject: "Réponse automatique : absente" });
    const r = await passerReponsesEntrantesCandidats({
      client: clientDouble([m], { [m.messageId]: AUTOMATIQUE }),
      maintenant: MAINTENANT,
    });
    expect(r.enregistrees).toEqual({ humaines: 0, automatiques: 1 });
    expect(db.reponsesCandidats[0]!["auto"]).toBe(true);
    expect(db.evenements).toHaveLength(0);
    expect(db.candidatures[0]!["needsAttention"]).toBe(false);
    expect(db.notify).not.toHaveBeenCalled();
  });

  it("une réponse à un message envoyé depuis la console compte aussi (sans accusé)", async () => {
    db.emailLogs = [];
    db.envoisCandidats = [
      {
        applicationId: "cand-a",
        deliveryStatus: "sent",
        sentAt: ACCUSE,
        repliedAt: ACCUSE,
      },
    ];
    await passerReponsesEntrantesCandidats({
      client: clientDouble([message()]),
      maintenant: MAINTENANT,
    });
    expect(db.reponsesCandidats).toHaveLength(1);
  });

  it("un message ancien (rattrapage, > 24 h) : enregistré et au journal, sans alerte ni « à traiter »", async () => {
    const ancien = message({ receivedAt: new Date("2026-10-04T08:00:00Z") });
    await passerReponsesEntrantesCandidats({
      client: clientDouble([ancien]),
      maintenant: MAINTENANT,
    });
    expect(db.reponsesCandidats).toHaveLength(1);
    expect(db.evenements).toHaveLength(1);
    expect(db.candidatures[0]!["needsAttention"]).toBe(false);
    expect(db.notify).not.toHaveBeenCalled();
  });
});

describe("ce qui n'est PAS rattaché", () => {
  it("un expéditeur inconnu : rien, pas même la lecture des en-têtes", async () => {
    const client = clientDouble([message({ fromAddress: "quelquun@ailleurs.fr" })]);
    const r = await passerReponsesEntrantesCandidats({ client, maintenant: MAINTENANT });
    expect(r.reconnus).toBe(0);
    expect(client.lireEntetes).not.toHaveBeenCalled();
    expect(db.reponsesCandidats).toHaveLength(0);
  });

  it("un message ANTÉRIEUR à tout envoi de notre part : ce n'est pas une réponse", async () => {
    const avant = message({ receivedAt: new Date(ACCUSE.getTime() - 60_000) });
    await passerReponsesEntrantesCandidats({
      client: clientDouble([avant]),
      maintenant: MAINTENANT,
    });
    expect(db.reponsesCandidats).toHaveLength(0);
  });

  it("un accusé en ÉCHEC n'est pas un message parti : rien n'est rattaché", async () => {
    db.emailLogs = [accuse({ status: "failed" })];
    await passerReponsesEntrantesCandidats({
      client: clientDouble([message()]),
      maintenant: MAINTENANT,
    });
    expect(db.reponsesCandidats).toHaveLength(0);
  });

  it("deux candidatures de la même personne : rattachée à celle du DERNIER envoi avant le message", async () => {
    db.candidatures.push(candidature({ id: "cand-b", offerTitleSnap: "Vidéaste tournage" }));
    db.emailLogs.push(
      accuse({
        id: "log-b",
        entityId: "cand-b",
        createdAt: new Date("2026-10-05T10:00:00Z"),
        sentAt: new Date("2026-10-05T10:00:00Z"),
      }),
    );
    await passerReponsesEntrantesCandidats({
      client: clientDouble([message()]),
      maintenant: MAINTENANT,
    });
    expect(db.reponsesCandidats.map((l) => l["applicationId"])).toEqual(["cand-b"]);
  });
});

describe("inertie et curseur", () => {
  it.each([undefined, "", "false", "1", "TRUE"])(
    "🔴 ÉTEINT PAR DÉFAUT (interrupteur = %s) : rien lu, rien écrit, curseur intact",
    async (valeur) => {
      if (valeur === undefined) delete process.env[INTERRUPTEUR];
      else process.env[INTERRUPTEUR] = valeur;
      const client = clientDouble([message()]);
      const r = await passerReponsesEntrantesCandidats({ client, maintenant: MAINTENANT });
      expect(r.suspendu).toBe("eteint");
      expect(client.listerMessagesRecus).not.toHaveBeenCalled();
      expect(db.reponsesCandidats).toHaveLength(0);
      expect(db.evenements).toHaveLength(0);
      expect(db.notify).not.toHaveBeenCalled();
      expect(db.settings.has(CLE_CURSEUR)).toBe(false);
    },
  );

  it("build `stub.invalid` : rien, sans un appel", async () => {
    const avant = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const client = clientDouble([message()]);
      const r = await passerReponsesEntrantesCandidats({ client, maintenant: MAINTENANT });
      expect(r.suspendu).toBe("build");
      expect(client.listerMessagesRecus).not.toHaveBeenCalled();
    } finally {
      if (avant === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = avant;
    }
  });

  it("variables Zoho absentes : suspendu, sans lever", async () => {
    const sauve = { ...process.env };
    delete process.env["ZOHO_MAIL_CLIENT_ID"];
    try {
      const r = await passerReponsesEntrantesCandidats({ maintenant: MAINTENANT });
      expect(r.suspendu).toBe("config-absente");
    } finally {
      process.env = sauve;
    }
  });

  it("table pas encore migrée : passage suspendu, curseur INTACT", async () => {
    db.tableCandidatsAbsente = true;
    const r = await passerReponsesEntrantesCandidats({
      client: clientDouble([message()]),
      maintenant: MAINTENANT,
    });
    expect(r.suspendu).toBe("table-absente");
    expect(db.settings.has(CLE_CURSEUR)).toBe(false);
    expect(db.evenements).toHaveLength(0);
  });

  it("Zoho injoignable : suspendu, curseur intact", async () => {
    const client = clientDouble([]);
    client.listerMessagesRecus.mockRejectedValueOnce(new Error("503"));
    const r = await passerReponsesEntrantesCandidats({ client, maintenant: MAINTENANT });
    expect(r.suspendu).toBe("zoho-injoignable");
    expect(db.settings.has(CLE_CURSEUR)).toBe(false);
  });

  it("🔴 son curseur est le SIEN : celui des apporteurs n'est ni lu ni écrit", async () => {
    expect(CLE_CURSEUR).not.toBe(CLE_CURSEUR_APPORTEURS);
    db.settings.set(CLE_CURSEUR_APPORTEURS, { depuis: "2026-10-01T00:00:00.000Z" });
    await passerReponsesEntrantesCandidats({
      client: clientDouble([message()]),
      maintenant: MAINTENANT,
    });
    expect(db.settings.get(CLE_CURSEUR)).toEqual({ depuis: MAINTENANT.toISOString() });
    expect(db.settings.get(CLE_CURSEUR_APPORTEURS)).toEqual({
      depuis: "2026-10-01T00:00:00.000Z",
    });
  });
});

// ── La même personne, candidate ET futur apporteur [I13] ────────────────────

const INVITATION = new Date("2026-10-03T08:00:00Z");
function ficheApporteur(): Ligne {
  return {
    id: "fiche-apporteur",
    contactEmailHash: EMPREINTE,
    contactName: "enc:Sarah L.",
    deletedAt: null,
    archivedAt: null,
    status: "processed",
    details: { unifiedType: "recrutement", subType: "candidature-commerciale" },
  };
}
function invitationApporteur(): Ligne {
  return {
    id: "log-invitation",
    template: GABARIT_INVITATION_APPORTEUR,
    entityType: "Submission",
    entityId: "fiche-apporteur",
    status: "sent",
    createdAt: INVITATION,
    sentAt: INVITATION,
  };
}
function deuxMondes(): void {
  db.submissions = [ficheApporteur()];
  db.emailLogs = [accuse(), invitationApporteur()];
}
const categories = () =>
  db.notify.mock.calls.map((c) => (c[0] as { category: string }).category).sort();

describe("🔴 non-régression : le relevé des apporteurs est STRICTEMENT inchangé", () => {
  async function releveApporteursSeul() {
    deuxMondes();
    const client = clientDouble([message()]);
    const r = await passerReponsesEntrantes({ client, maintenant: MAINTENANT });
    return {
      r,
      lignes: db.entrantesApporteurs.map(({ id: _id, ...reste }) => reste),
      fiche: { ...db.submissions[0] },
      curseur: db.settings.get(CLE_CURSEUR_APPORTEURS),
      alertes: db.notify.mock.calls.map((c) => c[0]),
    };
  }

  it("même ligne, même fiche rouverte, même alerte APPORTEUR_REPLIED, même curseur — que le relevé des candidats tourne avant lui ou non", async () => {
    const seul = await releveApporteursSeul();

    // On rejoue tout, avec le relevé des candidats AVANT celui des apporteurs.
    db.entrantesApporteurs = [];
    db.reponsesCandidats = [];
    db.evenements = [];
    db.settings = new Map();
    db.notify = vi.fn(async () => ({ ok: true }));
    db.candidatures = [candidature()];
    deuxMondes();
    const client = clientDouble([message()]);
    await passerReponsesEntrantesCandidats({ client, maintenant: MAINTENANT });
    const r = await passerReponsesEntrantes({ client, maintenant: MAINTENANT });

    expect(r).toEqual(seul.r);
    expect(db.entrantesApporteurs.map(({ id: _id, ...reste }) => reste)).toEqual(seul.lignes);
    expect({ ...db.submissions[0] }).toEqual(seul.fiche);
    expect(db.settings.get(CLE_CURSEUR_APPORTEURS)).toEqual(seul.curseur);
    expect(db.notify.mock.calls.map((c) => c[0])).toEqual(seul.alertes);
    expect(seul.alertes).toHaveLength(1);
    expect(seul.alertes[0]).toMatchObject({ category: "APPORTEUR_REPLIED" });
  });
});

describe("🔴 [I13] une personne des deux mondes : les deux fiches, UNE alerte", () => {
  it("relevé des apporteurs d'abord : la réponse est dans les deux fiches, seule l'alerte apporteur part", async () => {
    deuxMondes();
    const client = clientDouble([message()]);
    await passerReponsesEntrantes({ client, maintenant: MAINTENANT });
    const r = await passerReponsesEntrantesCandidats({
      client,
      maintenant: new Date(MAINTENANT.getTime() + 7 * 60_000),
    });

    expect(db.entrantesApporteurs.map((l) => l["submissionId"])).toEqual(["fiche-apporteur"]);
    expect(db.reponsesCandidats.map((l) => l["applicationId"])).toEqual(["cand-a"]);
    expect(db.evenements).toHaveLength(1);
    expect(db.candidatures[0]!["needsAttention"]).toBe(true);
    expect(r.alertes).toBe(0);
    expect(categories()).toEqual(["APPORTEUR_REPLIED"]);
  });

  it("relevé des candidats d'abord : le message est REMIS, puis rattaché sans seconde alerte", async () => {
    deuxMondes();
    const client = clientDouble([message()]);
    const premier = await passerReponsesEntrantesCandidats({ client, maintenant: MAINTENANT });
    expect(premier.remises).toBe(1);
    expect(db.reponsesCandidats).toHaveLength(0);
    // Un message remis retient le curseur : il sera relu.
    expect(db.settings.has(CLE_CURSEUR)).toBe(false);

    await passerReponsesEntrantes({
      client,
      maintenant: new Date(MAINTENANT.getTime() + 8 * 60_000),
    });
    await passerReponsesEntrantesCandidats({
      client,
      maintenant: new Date(MAINTENANT.getTime() + 15 * 60_000),
    });

    expect(db.entrantesApporteurs).toHaveLength(1);
    expect(db.reponsesCandidats).toHaveLength(1);
    expect(categories()).toEqual(["APPORTEUR_REPLIED"]);
  });

  it("si le relevé des apporteurs reste muet au-delà de l'attente, la réponse est rattachée et l'alerte part quand même", async () => {
    deuxMondes();
    const client = clientDouble([message()]);
    await passerReponsesEntrantesCandidats({ client, maintenant: MAINTENANT });
    const tard = new Date(RECU.getTime() + ATTENTE_AUTRE_RELEVE_MS + 60_000);
    const r = await passerReponsesEntrantesCandidats({ client, maintenant: tard });
    expect(r.remises).toBe(0);
    expect(db.reponsesCandidats).toHaveLength(1);
    expect(categories()).toEqual(["CANDIDAT_REPLIED"]);
  });

  it("une fiche apporteur JAMAIS invitée ne retient rien : l'alerte candidat part tout de suite", async () => {
    db.submissions = [ficheApporteur()];
    const r = await passerReponsesEntrantesCandidats({
      client: clientDouble([message()]),
      maintenant: MAINTENANT,
    });
    expect(r.remises).toBe(0);
    expect(categories()).toEqual(["CANDIDAT_REPLIED"]);
  });
});
