/**
 * Lot 14 (T3b) — l'envoi groupé des alertes.
 *
 * Ce que ces tests gardent, et qui a été vu ROUGE :
 *   · dix alertes du même code font UN message, pas dix ;
 *   · deux guichets font deux messages, chacun à SES adresses ;
 *   · le claim `notifiedAt` couvre tout le lot, et il est RELÂCHÉ si l'envoi
 *     échoue — « notifiée » sans e-mail parti est le pire des deux états ;
 *   · un repli de destinataire est écrit dans le message, jamais silencieux.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alerteSysteme: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    adminUser: { findMany: vi.fn() },
  },
}));

vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(async () => ({ enqueued: true })),
}));

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { notifierAlertesGroupees } from "./envoi-groupe";

const alerteFindMany = prisma.alerteSysteme.findMany as unknown as ReturnType<typeof vi.fn>;
const alerteUpdateMany = prisma.alerteSysteme.updateMany as unknown as ReturnType<typeof vi.fn>;
const adminFindMany = prisma.adminUser.findMany as unknown as ReturnType<typeof vi.fn>;
const enqueue = enqueueEmail as unknown as ReturnType<typeof vi.fn>;

const MAINTENANT = new Date("2026-08-16T07:00:00.000Z");

function ligne(id: string, code: string, niveau = "critique", cibleId: string | null = null) {
  return {
    id,
    code,
    niveau,
    titre: `titre ${code}`,
    message: `message ${id}`,
    cibleType: cibleId != null ? "TrainingSession" : null,
    cibleId,
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
  };
}

/**
 * Câble les deux `findMany` d'alertes : le premier rend les candidates, les
 * suivants rendent les lignes claimées (relecture du claim).
 */
function poserCandidates(lignes: ReturnType<typeof ligne>[]): void {
  alerteFindMany.mockImplementation(async (args: { select?: Record<string, unknown> }) => {
    // La relecture du claim ne sélectionne QUE l'id — c'est ce qui la distingue.
    const estRelecture = args?.select != null && Object.keys(args.select).length === 1;
    if (estRelecture) return lignes.map((l) => ({ id: l.id }));
    return lignes;
  });
  alerteUpdateMany.mockResolvedValue({ count: lignes.length });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["DATABASE_URL"];
  delete process.env["ALERTES_ECRIRE_AUX_FORMATEURS"];
  process.env["QUALIOPI_ALERTE_EMAIL"] = "secours@axion-ia.com";
  adminFindMany.mockResolvedValue([
    { email: "direction@axion-ia.com", role: "admin" },
    { email: "qualite@axion-ia.com", role: "responsable_qualite" },
    { email: "secretariat@axion-ia.com", role: "secretaire" },
  ]);
});

describe("🔴 le périmètre notifié est inchangé depuis le cron", () => {
  // 🔴 Ces deux tests VIENNENT du spec du cron : le Lot 14 a déplacé la
  // sélection ici, et une intention qu'on déplace sans la reposer est une
  // couverture perdue en silence. Le seuil `critique` reste l'anti-spam par
  // défaut ; les déblocages du parcours vente restent l'exception voulue.
  it("ne retient que les non-résolues, non-notifiées, critiques OU déblocages", async () => {
    poserCandidates([]);
    await notifierAlertesGroupees(MAINTENANT);
    const where = (alerteFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({
      resolue: false,
      notifiedAt: null,
      OR: [
        { niveau: "critique" },
        { code: { in: ["devis_signe_convention", "moteur_assemble_a_publier"] } },
      ],
    });
  });

  it("les DÉBLOCAGES vente sont notifiés même sans être critiques", async () => {
    // Promesse du plan « Nouvelle vente » §1a : un devis signé prévient
    // l'équipe par e-mail, sans obliger à camper l'écran d'alertes.
    poserCandidates([ligne("d", "devis_signe_convention", "important", "devis-1")]);
    const r = await notifierAlertesGroupees(MAINTENANT);
    expect(r.messages).toBe(1);
    expect(r.alertes).toBe(1);
    // Guichet administratif : créer la session et générer la convention
    // n'engage rien — c'est la colonne déléguable du Lot 10.
    expect(enqueue.mock.calls.map((c) => c[1])).toContain("secretariat@axion-ia.com");
  });
});

describe("🔴 dix alertes du même code font UN message", () => {
  it("groupe et n'envoie qu'une fois par adresse", async () => {
    poserCandidates(
      Array.from({ length: 10 }, (_, i) =>
        ligne(`a${i}`, "session_sans_dispositif_emargement", "critique", `sess-${i}`),
      ),
    );

    const r = await notifierAlertesGroupees(MAINTENANT);

    expect(r.messages).toBe(1);
    expect(r.alertes).toBe(10);
    // Guichet « administratif » → secrétariat + admin (super_admin absent de
    // l'annuaire de test). Un envoi par adresse, pas un par alerte.
    expect(enqueue).toHaveBeenCalledTimes(2);
    const destinataires = enqueue.mock.calls.map((c) => c[1]).sort();
    expect(destinataires).toEqual(["direction@axion-ia.com", "secretariat@axion-ia.com"]);
  });

  it("le message porte les dix occurrences, pas seulement la première", async () => {
    poserCandidates(
      Array.from({ length: 10 }, (_, i) =>
        ligne(`a${i}`, "session_sans_dispositif_emargement", "critique", `sess-${i}`),
      ),
    );
    await notifierAlertesGroupees(MAINTENANT);
    const payload = enqueue.mock.calls[0]![3] as { occurrences: unknown[] };
    expect(payload.occurrences).toHaveLength(10);
  });
});

describe("🔴 deux guichets, deux messages, deux destinataires", () => {
  it("n'envoie pas les alertes de direction au secrétariat", async () => {
    poserCandidates([
      ligne("a", "session_sans_dispositif_emargement", "critique", "s1"), // administratif
      ligne("b", "opco_formation_demarree_sans_accord", "critique", "s2"), // direction
    ]);

    const r = await notifierAlertesGroupees(MAINTENANT);
    expect(r.messages).toBe(2);

    const parCode = new Map(
      enqueue.mock.calls.map((c) => [
        `${(c[3] as { code: string }).code}::${c[1] as string}`,
        true,
      ]),
    );
    // Le secrétariat reçoit l'émargement…
    expect(parCode.has("session_sans_dispositif_emargement::secretariat@axion-ia.com")).toBe(true);
    // …et surtout PAS l'OPCO, qui réclame un acte engageant.
    expect(parCode.has("opco_formation_demarree_sans_accord::secretariat@axion-ia.com")).toBe(
      false,
    );
    expect(parCode.has("opco_formation_demarree_sans_accord::direction@axion-ia.com")).toBe(true);
  });
});

describe("🔴 le claim couvre le lot, et se relâche si l'envoi échoue", () => {
  it("pose notifiedAt sur les dix d'un coup", async () => {
    poserCandidates(
      Array.from({ length: 10 }, (_, i) => ligne(`a${i}`, "session_sans_dispositif_emargement")),
    );
    await notifierAlertesGroupees(MAINTENANT);

    const claim = alerteUpdateMany.mock.calls[0]![0] as {
      where: { id: { in: string[] }; notifiedAt: null };
      data: { notifiedAt: Date };
    };
    expect(claim.where.id.in).toHaveLength(10);
    // `notifiedAt: null` dans le WHERE : c'est ce qui rend le claim atomique
    // face à une seconde instance. Sans lui, les deux enverraient le résumé.
    expect(claim.where.notifiedAt).toBeNull();
    expect(claim.data.notifiedAt).toEqual(MAINTENANT);
  });

  it("relâche le claim quand l'enqueue échoue", async () => {
    poserCandidates([ligne("a", "session_sans_dispositif_emargement")]);
    enqueue.mockRejectedValueOnce(new Error("redis down"));

    const r = await notifierAlertesGroupees(MAINTENANT);

    expect(r.messages).toBe(0);
    // Deux updateMany : le claim, puis sa libération. Sans la seconde,
    // l'alerte resterait « notifiée » sans qu'aucun e-mail ne soit parti — et
    // elle ne redeviendrait jamais candidate.
    const liberation = alerteUpdateMany.mock.calls.at(-1)![0] as {
      data: { notifiedAt: null };
    };
    expect(liberation.data.notifiedAt).toBeNull();
  });

  // ── 🔴 Le cas que le témoin ci-dessus NE couvrait pas ───────────────────────
  //
  // Il fait LEVER l'enqueue (`mockRejectedValueOnce`), et le `catch` s'arme.
  // Mais `enqueueEmail` ne lève sur AUCUN de ses chemins d'échec réels : elle
  // RETOURNE `{ enqueued: false }` — file absente, adresse sur liste de
  // suppression, corbeille indisponible. Le `catch` restait donc muet, le claim
  // gardé, et l'alerte n'était JAMAIS retentée (la sélection exige
  // `notifiedAt: null`). Le témoin existant mesurait le seul cas qui marchait.

  it("🔴 relâche AUSSI le claim quand l'enqueue RETOURNE false sans lever", async () => {
    poserCandidates([ligne("a", "session_sans_dispositif_emargement")]);
    enqueue.mockResolvedValue({ enqueued: false });

    const r = await notifierAlertesGroupees(MAINTENANT);

    expect(r.messages).toBe(0);
    // Et surtout : le compteur d'alertes ne doit RIEN annoncer. Un « N alertes
    // routées » sur zéro envoi est ce qui fait croire que le moteur tourne.
    expect(r.alertes).toBe(0);
    const liberation = alerteUpdateMany.mock.calls.at(-1)![0] as {
      data: { notifiedAt: null };
    };
    expect(liberation.data.notifiedAt).toBeNull();
  });

  it("un message GARÉ en corbeille de validation compte comme parti — pas de relâche", async () => {
    // Contre-témoin. Une garde qui relâcherait aussi sur `garePourValidation`
    // renverrait le lot à chaque tour sur une alerte volontairement retenue par
    // un humain : ce n'est pas une perte, c'est une décision.
    poserCandidates([ligne("a", "session_sans_dispositif_emargement")]);
    enqueue.mockResolvedValue({ enqueued: false, garePourValidation: true });

    const r = await notifierAlertesGroupees(MAINTENANT);

    expect(r.alertes).toBe(1);
    const dernier = alerteUpdateMany.mock.calls.at(-1)![0] as { data: { notifiedAt: unknown } };
    expect(dernier.data.notifiedAt).not.toBeNull();
  });

  it("envoi PARTIEL : le claim est GARDÉ, parce qu'un humain a bien été prévenu", async () => {
    // Relâcher ici renverrait le lot à ceux qui l'ont déjà reçu. On garde, et
    // on le dit dans le journal — l'échec d'une adresse sur trois ne doit pas
    // être parfaitement muet, mais il ne doit pas non plus tout rejouer.
    poserCandidates([ligne("a", "session_sans_dispositif_emargement")]);
    enqueue.mockResolvedValueOnce({ enqueued: true }).mockResolvedValue({ enqueued: false });

    const r = await notifierAlertesGroupees(MAINTENANT);

    expect(r.messages).toBeGreaterThanOrEqual(1);
    expect(r.alertes).toBe(1);
    const dernier = alerteUpdateMany.mock.calls.at(-1)![0] as { data: { notifiedAt: unknown } };
    expect(dernier.data.notifiedAt).not.toBeNull();
  });
});

describe("🔴 un repli de destinataire s'écrit dans le message", () => {
  it("dit pourquoi le guichet nominal n'a pas été servi", async () => {
    // Personne ne porte `responsable_qualite` : le guichet qualité tombe sur
    // l'adresse de secours. Le message DOIT le dire.
    adminFindMany.mockResolvedValue([{ email: "direction@axion-ia.com", role: "admin" }]);
    poserCandidates([ligne("a", "cv_formateur_perime", "critique", "f1")]);

    const r = await notifierAlertesGroupees(MAINTENANT);

    expect(r.replis.length).toBeGreaterThan(0);
    const payload = enqueue.mock.calls[0]![3] as { repli?: string };
    expect(
      payload.repli,
      "Un repli silencieux redevient un canal global : le destinataire doit " +
        "apprendre qu'il reçoit ce message par défaut.",
    ).toBeTruthy();
  });

  it("le guichet formateur ne sort pas vers l'extérieur sans le drapeau", async () => {
    poserCandidates([ligne("a", "cv_formateur_perime", "critique", "f1")]);
    const r = await notifierAlertesGroupees(MAINTENANT);
    // Routé vers la qualité, avec le motif — pas vers le formateur.
    expect(enqueue.mock.calls.map((c) => c[1])).toContain("qualite@axion-ia.com");
    expect(r.replis.join(" ")).toContain("ALERTES_ECRIRE_AUX_FORMATEURS");
  });
});

describe("les cas où il ne se passe rien", () => {
  it("aucune candidate : aucun e-mail, aucune écriture", async () => {
    poserCandidates([]);
    const r = await notifierAlertesGroupees(MAINTENANT);
    expect(r).toEqual({ messages: 0, alertes: 0, sansGuichet: 0, replis: [] });
    expect(enqueue).not.toHaveBeenCalled();
    expect(alerteUpdateMany).not.toHaveBeenCalled();
  });

  it("stub de build : early-exit sans toucher Prisma", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const r = await notifierAlertesGroupees(MAINTENANT);
    expect(r.messages).toBe(0);
    expect(alerteFindMany).not.toHaveBeenCalled();
  });

  it("un code hors catalogue est compté, pas tu", async () => {
    poserCandidates([ligne("x", "code_inconnu_du_catalogue")]);
    const r = await notifierAlertesGroupees(MAINTENANT);
    expect(r.sansGuichet).toBe(1);
    expect(r.messages).toBe(0);
  });
});
