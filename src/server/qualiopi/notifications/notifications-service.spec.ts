/**
 * Tests — notifications-service.ts (T15).
 *
 * Stratégie : mock @/lib/prisma + @/server/queue/queues.
 * Vérifie : appels enqueueEmail correct (template, to, locale, payload, jobId),
 * idempotence (jobId stable), early-exit stub, early-exit enrollment introuvable.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: {
      findUnique: vi.fn(),
      // Convocation (J4, 2026-08-15) : l'envoi pose `convocationEnvoyeeAt`,
      // l'ÉTAT qui rend le cron rattrapant.
      update: vi.fn(),
    },
    trainingSession: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      // 🔴 2026-08-24 — `update` MANQUAIT, et son absence n'était pas un oubli de
      // mock : la colonne n'existait pas. Le rappel J-7 ne laissait AUCUNE trace,
      // donc rien ne prouvait qu'il était parti. `envoyerRappelJ7` pose désormais
      // `rappelJ7EnvoyeAt`, et seulement quand TOUS les inscrits ont reçu leur
      // message. Un mock incomplet est un contrat rompu : on recopie la
      // signature, pas le minimum qui passe.
      update: vi.fn(),
    },
    alerteSysteme: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    portailAcces: {
      findFirst: vi.fn(),
    },
    emargementToken: {
      findFirst: vi.fn(),
    },
    // 🔴 Le rappel de la VEILLE (ADR 0048 §4.3) lit la trace DURABLE de son
    // propre envoi ici, et non une colonne d'état : son cron est horaire sur
    // une fenêtre de 30 h, et la déduplication BullMQ expire.
    emailLog: {
      findFirst: vi.fn(),
    },
    // Relances 2026-08-04 — lecture + trace (relanceCount/derniereRelanceAt).
    questionnaire: {
      findUnique: vi.fn(),
      update: vi.fn(),
      // envoyerAttestationDisponible compte les questionnaires en attente
      // pour ajouter (ou non) le paragraphe de rappel — 0 par défaut.
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

// Jeton d'émargement du rappel J-7 — créé seulement si aucun jeton vivant.
vi.mock("@/server/qualiopi/emargement/token-service", () => ({
  creerTokenInscription: vi.fn().mockResolvedValue({
    token: "e".repeat(80),
    tokenId: "tok-uuid-1",
    expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  }),
}));

// Mock portail-service.creerAcces (fall-through quand portailAcces.findFirst retourne null)
vi.mock("@/server/qualiopi/portail/portail-service", () => ({
  creerAcces: vi.fn().mockResolvedValue({
    id: "acces-uuid-1",
    token: "b".repeat(64),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  }),
}));

vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn().mockResolvedValue({ enqueued: true }),
}));

// 🔴 `D4-5-S1` — le double ne portait que `creerQuestionnaire`, et celle-ci
// rendait un JETON. Les deux ont changé : la création est idempotente et ne
// rend plus que l'identifiant (la base ne détient qu'une empreinte), et c'est
// `emettreLienQuestionnaire` qui frappe un jeton neuf au moment d'écrire le
// lien dans l'e-mail.
//
// ⚠️ Ce mock a rougi parce qu'il était INCOMPLET : la fonction manquante était
// `undefined`, l'appel levait, et les deux tests d'enquête entreprise
// tombaient. C'est le bon comportement — un double doit porter le contrat
// entier du module, pas le minimum qui passait hier.
vi.mock("@/server/qualiopi/satisfaction/satisfaction-service", () => ({
  creerQuestionnaire: vi.fn().mockResolvedValue({ id: "quest-uuid-1" }),
  emettreLienQuestionnaire: vi.fn().mockResolvedValue("c".repeat(48)),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports après mocks
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { creerAcces } from "@/server/qualiopi/portail/portail-service";
import { creerTokenInscription } from "@/server/qualiopi/emargement/token-service";
import {
  creerQuestionnaire,
  emettreLienQuestionnaire,
} from "@/server/qualiopi/satisfaction/satisfaction-service";
import {
  envoyerConvocation,
  envoyerRappelJ7,
  envoyerRappelJ1,
  envoyerSatisfactionJ1,
  envoyerSuiviJ30,
  envoyerAttestationDisponible,
  envoyerRelanceQuestionnaire,
  envoyerEnqueteEntreprise,
  notifierAlerteInterne,
} from "./notifications-service";

const mockPrisma = prisma as unknown as {
  enrollment: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  trainingSession: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    // ⚠️ LE CONTRAT SE ROMPT À DEUX ENDROITS, PAS UN : la fabrique `vi.mock`
    // ci-dessus fournit le double, mais c'est CE type qui décide de ce que le
    // test a le droit d'appeler. Ajouter la méthode à l'un sans l'autre donne
    // 350 fichiers de tests verts et un `tsc` rouge — mesuré le 2026-08-24.
    update: ReturnType<typeof vi.fn>;
  };
  alerteSysteme: {
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  portailAcces: { findFirst: ReturnType<typeof vi.fn> };
  emargementToken: { findFirst: ReturnType<typeof vi.fn> };
  emailLog: { findFirst: ReturnType<typeof vi.fn> };
  questionnaire: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};
const mockEnqueueEmail = enqueueEmail as ReturnType<typeof vi.fn>;
const mockCreerAcces = creerAcces as ReturnType<typeof vi.fn>;
const mockCreerQuestionnaire = creerQuestionnaire as ReturnType<typeof vi.fn>;
const mockEmettreLien = emettreLienQuestionnaire as ReturnType<typeof vi.fn>;
const mockCreerTokenInscription = creerTokenInscription as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ENROLLMENT_ID = "enr-uuid-1";
const SESSION_ID = "sess-uuid-1";
const ALERTE_ID = "alerte-uuid-1";

const TRAINEE_ID = "trainee-uuid-1";
const FAKE_TOKEN = "a".repeat(64);

const fakeEnrollmentBase = {
  id: ENROLLMENT_ID,
  trainee: { id: TRAINEE_ID, email: "jean@example.com", nom: "Dupont", prenom: "Jean" },
  session: {
    numero: "AXI-SESS-2026-001",
    titreSession: "Formation IA",
    dateDebut: new Date("2026-09-01T09:00:00Z"),
    dateFin: new Date("2026-09-02T17:00:00Z"),
    modalite: "presentiel",
  },
};

const fakeSessionWithEnrollments = {
  id: SESSION_ID,
  numero: "AXI-SESS-2026-001",
  titreSession: "Formation IA",
  dateDebut: new Date("2026-09-01T09:00:00Z"),
  dateFin: new Date("2026-09-02T17:00:00Z"),
  modalite: "presentiel",
  enrollments: [
    {
      id: ENROLLMENT_ID,
      trainee: { id: TRAINEE_ID, email: "jean@example.com", nom: "Dupont", prenom: "Jean" },
    },
    {
      id: "enr-uuid-2",
      trainee: { id: "trainee-uuid-2", email: "marie@example.com", nom: "Martin", prenom: "Marie" },
    },
  ],
};

const fakeAlerte = {
  id: ALERTE_ID,
  code: "emargement_manquant",
  niveau: "critique",
  titre: "Émargement manquant",
  message: "Session sans émargement 48h après.",
  cibleType: "TrainingSession",
  cibleId: "sess-uuid-1",
  createdAt: new Date("2026-06-06T10:00:00Z"),
};

// ─────────────────────────────────────────────────────────────────────────────
// envoyerConvocation
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerConvocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Par défaut : accès portail existant (idempotent)
    mockPrisma.portailAcces.findFirst.mockResolvedValue({ token: FAKE_TOKEN });
    mockPrisma.enrollment.update.mockResolvedValue({});
  });

  it("🔴 file INDISPONIBLE : `convocationEnvoyeeAt` n'est PAS posée", async () => {
    // Constat `D5-3-01`. C'est la reconstitution littérale de l'incident
    // « aucune convocation jamais envoyée en production ».
    //
    // `enqueueEmail` ne LÈVE pas quand la file est absente : elle RETOURNE
    // `{ enqueued: false }` (queues.ts:742). Cette valeur n'était pas lue, et
    // `convocationEnvoyeeAt` était posée quoi qu'il arrive.
    //
    // Or c'est précisément cette colonne qui rend le cron rattrapant : tant
    // qu'elle est nulle, l'inscription reste candidate. La poser sans envoi
    // écarte donc l'inscription DÉFINITIVEMENT — le stagiaire ne reçoit rien,
    // la base affirme le contraire, et l'indicateur 9 repose sur un horodatage
    // qui atteste d'un geste jamais accompli.
    //
    // ⚠️ Le commentaire du code disait l'intention JUSTE — « posée APRÈS
    // l'enqueue, poser avant ferait mentir la colonne si la file est
    // indisponible » — et se trompait sur le MÉCANISME : il supposait que
    // l'échec lèverait.
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    mockEnqueueEmail.mockResolvedValueOnce({ enqueued: false });

    await envoyerConvocation(ENROLLMENT_ID);

    expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
  });

  it("🔴 e-mail GARÉ en validation : `convocationEnvoyeeAt` n'est PAS posée non plus", async () => {
    // Second chemin, plus insidieux : si une règle `EmailAutomationSetting`
    // nomme `qualiopi-convocation` en mode validation, l'e-mail part en
    // corbeille et `enqueueEmail` rend `{ enqueued: false,
    // garePourValidation: true }` (queues.ts:768).
    //
    // Il PARTIRA peut-être — après approbation humaine. Mais il n'est pas parti.
    // Poser la date maintenant ferait exactement la même chose : écarter
    // l'inscription du rattrapage sur la foi d'un envoi qui n'a pas eu lieu.
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    mockEnqueueEmail.mockResolvedValueOnce({
      enqueued: false,
      garePourValidation: true,
      outboxId: "outbox-1",
    });

    await envoyerConvocation(ENROLLMENT_ID);

    expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
  });

  it("mise en file RÉUSSIE : la date est bien posée", async () => {
    // Témoin discriminant. Sans lui, une fonction qui ne poserait JAMAIS la date
    // passerait les deux tests ci-dessus — et le cron réenverrait la convocation
    // tous les jours, ce qui est le défaut symétrique.
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    mockEnqueueEmail.mockResolvedValueOnce({ enqueued: true });

    await envoyerConvocation(ENROLLMENT_ID);

    expect(mockPrisma.enrollment.update).toHaveBeenCalledOnce();
    const arg = mockPrisma.enrollment.update.mock.calls[0]![0] as {
      data: { convocationEnvoyeeAt?: Date };
    };
    expect(arg.data.convocationEnvoyeeAt).toBeInstanceOf(Date);
  });

  it("enqueue le bon template avec jobId stable", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerConvocation(ENROLLMENT_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(call[0]).toBe("qualiopi-convocation");
    expect(call[1]).toBe("jean@example.com");
    expect(call[2]).toBe("fr");
    expect((call[3] as Record<string, unknown>)["stagiairePrenomNom"]).toBe("Jean Dupont");
    // 🔴 CLÉ DE DATE OBLIGATOIRE (J4, 2026-08-15). L'assertion précédente exigeait
    // un jobId SANS clé de date — elle verrouillait le défaut au lieu de le
    // dénoncer. La convocation était le seul envoi à ne pas en porter, alors
    // qu'elle est le seul à porter une obligation réglementaire (ind. 9) : sans
    // elle, la déduplication BullMQ expire au min(7 jours, 1 000 jobs) et un
    // second envoi redevient possible sans que rien ne le dise.
    const jobId = (call[4] as { jobId?: string }).jobId ?? "";
    const suffixe = jobId.replace(`qualiopi-convocation-${ENROLLMENT_ID}-`, "");
    expect(jobId.startsWith(`qualiopi-convocation-${ENROLLMENT_ID}-`)).toBe(true);
    expect(suffixe, "la clé de date manque au jobId de la convocation").toHaveLength(8);
    expect(Number.isNaN(Number(suffixe))).toBe(false);

    // L'ÉTAT est posé APRÈS l'enqueue : c'est lui qui rend le cron rattrapant.
    expect(mockPrisma.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ENROLLMENT_ID },
        data: expect.objectContaining({ convocationEnvoyeeAt: expect.any(Date) }),
      }),
    );
  });

  it("lienPortail contient /portail/acces/ (pas /espace-stagiaire)", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerConvocation(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lienPortail = (call[3] as Record<string, unknown>)["lienPortail"] as string;
    expect(lienPortail).toContain("/portail/acces/");
    expect(lienPortail).not.toContain("/espace-stagiaire");
  });

  it("lienPortail utilise creerAcces en fail-soft si findFirst retourne null", async () => {
    mockPrisma.portailAcces.findFirst.mockResolvedValue(null);
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerConvocation(ENROLLMENT_ID);
    expect(mockCreerAcces).toHaveBeenCalledWith(TRAINEE_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lienPortail = (call[3] as Record<string, unknown>)["lienPortail"] as string;
    expect(lienPortail).toContain("/portail/acces/");
  });

  it("early-exit si enrollment introuvable", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    await envoyerConvocation(ENROLLMENT_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("formate le lieu réel quand la session a un lieu renseigné", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...fakeEnrollmentBase,
      session: {
        ...fakeEnrollmentBase.session,
        lieuType: "nos_locaux",
        lieuVille: "Grenoble",
      },
    });
    await envoyerConvocation(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lieu = (call[3] as Record<string, unknown>)["lieu"] as string;
    expect(lieu).toContain("Nos locaux");
    expect(lieu).toContain("Grenoble");
  });

  it("retombe sur « Voir convocation » quand aucun lieu n'est renseigné", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerConvocation(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect((call[3] as Record<string, unknown>)["lieu"]).toBe("Voir convocation");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerRappelJ7
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerRappelJ7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portailAcces.findFirst.mockResolvedValue({ token: FAKE_TOKEN });
    // Par défaut : aucun jeton d'émargement vivant → le rappel crée et inclut le lien.
    mockPrisma.emargementToken.findFirst.mockResolvedValue(null);
    mockCreerTokenInscription.mockResolvedValue({
      token: "e".repeat(80),
      tokenId: "tok-uuid-1",
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
  });

  it("aucun jeton vivant → le payload porte le lien d'émargement personnel", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lien = (call[3] as Record<string, unknown>)["lienEmargement"] as string;
    expect(lien).toContain("/fr/portail/emarger/");
    expect(lien).toContain("e".repeat(80));
  });

  // 🔴 Le cœur de la sémantique : un jeton ne se relit pas (hash seul) et toute
  // création révoque le précédent. Créer aveuglément tuerait un lien déjà
  // distribué par la console — le stagiaire cliquerait un lien mort le jour J.
  it("jeton vivant existant → PAS de création (le lien distribué reste le seul valide)", async () => {
    mockPrisma.emargementToken.findFirst.mockResolvedValue({ id: "tok-existant" });
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    expect(mockCreerTokenInscription).not.toHaveBeenCalled();
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect((call[3] as Record<string, unknown>)["lienEmargement"]).toBeUndefined();
  });

  // Fail-soft : journées non confirmées (TokenEmargementError) → le rappel J-7
  // part SANS lien plutôt que de ne pas partir. Retenir un rappel casserait
  // l'obligation d'information ; la console signale déjà le problème à l'admin.
  it("création de jeton en échec → l'e-mail part quand même, sans lien", async () => {
    mockCreerTokenInscription.mockRejectedValue(new Error("horaires_non_confirmes"));
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect((call[3] as Record<string, unknown>)["lienEmargement"]).toBeUndefined();
    // Le reste du payload est intact — le lien portail notamment.
    expect((call[3] as Record<string, unknown>)["lienPortail"]).toContain("/portail/acces/");
  });

  it("enqueue 1 email par enrollment (2 au total)", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
    const firstCall = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(firstCall[0]).toBe("qualiopi-rappel-j7");
    expect(firstCall[2]).toBe("fr");
  });

  it("lienPortail contient /portail/acces/ (pas /espace-stagiaire)", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lienPortail = (call[3] as Record<string, unknown>)["lienPortail"] as string;
    expect(lienPortail).toContain("/portail/acces/");
    expect(lienPortail).not.toContain("/espace-stagiaire");
  });

  it("early-exit si session introuvable", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(null);
    await envoyerRappelJ7(SESSION_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("jobId inclut enrollmentId + dateKey", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const options = call[4] as { jobId?: string };
    // dateKey = YYYYMMDD extrait de dateDebut 2026-09-01
    expect(options.jobId).toMatch(/^qualiopi-rappel-j7-enr-uuid-1-20260901$/);
  });

  it("formate le lieu réel dans le rappel quand renseigné", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      ...fakeSessionWithEnrollments,
      lieuType: "distanciel",
      lieuVisioUrl: "https://meet.google.com/abc-defg-hij",
    });
    await envoyerRappelJ7(SESSION_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lieu = (call[3] as Record<string, unknown>)["lieu"] as string;
    expect(lieu).toContain("Distanciel");
    expect(lieu).toContain("meet.google.com");
  });

  /**
   * 🔴 2026-08-24 — LE RAPPEL J-7 NE LAISSAIT AUCUNE TRACE, DONC AUCUNE PREUVE.
   *
   * `handleRappelJ7` était un PUR COMPTE À REBOURS : fenêtre [J-7,5 ; J-6,5] au
   * passage quotidien de 08:00 UTC, et aucune colonne d'état. Trois conséquences,
   * dont la troisième est celle qui compte devant un certificateur :
   *
   *   1. une session créée moins de 7,5 jours avant son début n'entrait JAMAIS
   *      dans la fenêtre — le cas ORDINAIRE, pas le cas limite ;
   *   2. un worker arrêté pendant le créneau perdait l'occurrence ;
   *   3. AUCUNE donnée ne permettait d'affirmer qu'un rappel était parti.
   *
   * Le critère 2 du RNQ porte sur l'information du bénéficiaire. Une preuve
   * inatteignable n'est pas une preuve.
   */
  it("🔴 tous les envois partis → la trace `rappelJ7EnvoyeAt` est posée", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);

    const parti = await envoyerRappelJ7(SESSION_ID);

    expect(parti).toBe(true);
    expect(
      mockPrisma.trainingSession.update,
      "aucune trace posée alors que les deux rappels sont partis : sans elle, " +
        "rien ne prouve à un certificateur que les stagiaires ont été informés, " +
        "et le cron repasserait indéfiniment sur la même session",
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ rappelJ7EnvoyeAt: expect.any(Date) }),
      }),
    );
  });

  /**
   * ⚠️ CE TEST GARDE DEUX CHOSES À LA FOIS, ET C'EST VOULU : l'ancien code
   * faisait `return false` au premier enqueue en échec, ce qui ABANDONNAIT les
   * inscrits suivants. Sur une session de dix, un message garé en corbeille pour
   * le premier privait les neuf autres de leur rappel — et le journal ne nommait
   * qu'une session, pas neuf personnes.
   */
  it("🔴 un envoi non parti → AUCUNE trace, et les inscrits SUIVANTS sont quand même servis", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    // Le PREMIER stagiaire échoue sans lever — exactement le comportement réel
    // quand une règle `EmailAutomationSetting` gare le message en corbeille.
    mockEnqueueEmail.mockResolvedValueOnce({ enqueued: false, garePourValidation: true });

    const parti = await envoyerRappelJ7(SESSION_ID);

    expect(parti).toBe(false);
    expect(
      mockPrisma.trainingSession.update,
      "une trace a été posée alors qu'un rappel n'est pas parti. La sélection du " +
        "cron se fait sur `rappelJ7EnvoyeAt: null` : cette écriture écarte la " +
        "session du rattrapage DÉFINITIVEMENT, et atteste une information qui " +
        "n'a pas été donnée",
    ).not.toHaveBeenCalled();
    expect(
      mockEnqueueEmail.mock.calls.length,
      "le second inscrit n'a pas été servi : un échec sur le premier ne doit " +
        "jamais priver les suivants de leur rappel",
    ).toBe(2);
  });

  it("🔴 une session SANS INSCRIT n'atteste rien", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      ...fakeSessionWithEnrollments,
      enrollments: [],
    });

    const parti = await envoyerRappelJ7(SESSION_ID);

    // Personne à prévenir : ne rien poser. Une session planifiée à J-7 sans
    // aucun stagiaire est un écart à traiter, pas un envoi réussi.
    expect(parti).toBe(false);
    expect(
      mockPrisma.trainingSession.update,
      "une trace de rappel a été posée sur une session qui n'a aucun inscrit : " +
        "elle atteste un envoi qui n'a eu aucun destinataire",
    ).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerSatisfactionJ1
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerSatisfactionJ1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portailAcces.findFirst.mockResolvedValue({ token: FAKE_TOKEN });
  });

  it("enqueue qualiopi-satisfaction-j1 avec lienQuestionnaire tokenisé", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerSatisfactionJ1(ENROLLMENT_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(call[0]).toBe("qualiopi-satisfaction-j1");
    const lienQuestionnaire = (call[3] as { lienQuestionnaire?: string }).lienQuestionnaire;
    expect(lienQuestionnaire).toContain("/portail/acces/");
    expect(lienQuestionnaire).not.toContain("/espace-stagiaire");
  });

  it("early-exit si enrollment introuvable", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    await envoyerSatisfactionJ1(ENROLLMENT_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("garantit le questionnaire satisfaction_chaud AVANT l'email (jamais de portail vide)", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerSatisfactionJ1(ENROLLMENT_ID);
    expect(mockCreerQuestionnaire).toHaveBeenCalledWith({
      enrollmentId: ENROLLMENT_ID,
      type: "satisfaction_chaud",
    });
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    // Le questionnaire est créé avant l'enqueue (ordre des invocations).
    const ordreQuestionnaire = mockCreerQuestionnaire.mock.invocationCallOrder[0] ?? Infinity;
    const ordreEmail = mockEnqueueEmail.mock.invocationCallOrder[0] ?? 0;
    expect(ordreQuestionnaire).toBeLessThan(ordreEmail);
  });

  it("n'envoie PAS l'email si la création du questionnaire échoue", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    mockCreerQuestionnaire.mockRejectedValueOnce(new Error("DB down"));
    await expect(envoyerSatisfactionJ1(ENROLLMENT_ID)).rejects.toThrow("DB down");
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerSuiviJ30
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerSuiviJ30", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portailAcces.findFirst.mockResolvedValue({ token: FAKE_TOKEN });
  });

  it("enqueue qualiopi-suivi-j30", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerSuiviJ30(ENROLLMENT_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(call[0]).toBe("qualiopi-suivi-j30");
  });

  it("lienPortail contient /portail/acces/ (pas /espace-stagiaire)", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerSuiviJ30(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lienPortail = (call[3] as Record<string, unknown>)["lienPortail"] as string;
    expect(lienPortail).toContain("/portail/acces/");
    expect(lienPortail).not.toContain("/espace-stagiaire");
  });

  it("garantit le questionnaire satisfaction_froid AVANT l'email", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerSuiviJ30(ENROLLMENT_ID);
    expect(mockCreerQuestionnaire).toHaveBeenCalledWith({
      enrollmentId: ENROLLMENT_ID,
      type: "satisfaction_froid",
    });
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
  });

  it("n'envoie PAS l'email si la création du questionnaire échoue", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    mockCreerQuestionnaire.mockRejectedValueOnce(new Error("DB down"));
    await expect(envoyerSuiviJ30(ENROLLMENT_ID)).rejects.toThrow("DB down");
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerAttestationDisponible
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerAttestationDisponible", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portailAcces.findFirst.mockResolvedValue({ token: FAKE_TOKEN });
  });

  it("libellé 'attestation de formation' quand attestationResultat = 'complete'", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...fakeEnrollmentBase,
      attestationResultat: "complete",
    });
    await envoyerAttestationDisponible(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect((call[3] as { typeDocument?: string }).typeDocument).toBe("attestation de formation");
  });

  it("libellé 'certificat de réalisation' quand attestationResultat = null", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...fakeEnrollmentBase,
      attestationResultat: null,
    });
    await envoyerAttestationDisponible(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect((call[3] as { typeDocument?: string }).typeDocument).toBe("certificat de réalisation");
  });

  it("jobId stable = qualiopi-attestation-disponible-{enrollmentId}", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...fakeEnrollmentBase,
      attestationResultat: "complete",
    });
    await envoyerAttestationDisponible(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const options = call[4] as { jobId?: string };
    expect(options.jobId).toBe(`qualiopi-attestation-disponible-${ENROLLMENT_ID}`);
  });

  it("lienPortail contient /portail/acces/ (pas /espace-stagiaire)", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...fakeEnrollmentBase,
      attestationResultat: "complete",
    });
    await envoyerAttestationDisponible(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lienPortail = (call[3] as Record<string, unknown>)["lienPortail"] as string;
    expect(lienPortail).toContain("/portail/acces/");
    expect(lienPortail).not.toContain("/espace-stagiaire");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// notifierAlerteInterne
// ─────────────────────────────────────────────────────────────────────────────

describe("notifierAlerteInterne", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Par défaut : claim atomique réussi (count=1) + enqueue OK.
    mockPrisma.alerteSysteme.updateMany.mockResolvedValue({ count: 1 });
    mockEnqueueEmail.mockResolvedValue({ enqueued: true });
  });

  it("enqueue qualiopi-alerte-interne vers destinataire interne", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(fakeAlerte);
    await notifierAlerteInterne(ALERTE_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(call[0]).toBe("qualiopi-alerte-interne");
    // Le destinataire doit être un email (pas une adresse stagiaire)
    expect(typeof call[1]).toBe("string");
    expect(call[1] as string).toMatch(/@/);
    expect((call[3] as { code?: string }).code).toBe("emargement_manquant");
    expect((call[4] as { jobId?: string }).jobId).toBe(`qualiopi-alerte-interne-${ALERTE_ID}`);
  });

  it("pose le claim atomique (notifiedAt) AVANT d'enqueuer, gardé sur non-notifiée", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(fakeAlerte);
    await notifierAlerteInterne(ALERTE_ID);
    expect(mockPrisma.alerteSysteme.updateMany).toHaveBeenCalledOnce();
    const claimArgs = mockPrisma.alerteSysteme.updateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(claimArgs.where).toMatchObject({ id: ALERTE_ID, notifiedAt: null, resolue: false });
    expect(claimArgs.data["notifiedAt"]).toBeInstanceOf(Date);
    // Le claim précède l'enqueue (ordre des invocations).
    const ordreClaim = mockPrisma.alerteSysteme.updateMany.mock.invocationCallOrder[0] ?? Infinity;
    const ordreEmail = mockEnqueueEmail.mock.invocationCallOrder[0] ?? 0;
    expect(ordreClaim).toBeLessThan(ordreEmail);
  });

  it("skip (pas d'email) si le claim retourne count=0 — alerte déjà notifiée", async () => {
    mockPrisma.alerteSysteme.updateMany.mockResolvedValue({ count: 0 });
    await notifierAlerteInterne(ALERTE_ID);
    // Court-circuit : ni lecture de l'alerte ni enqueue.
    expect(mockPrisma.alerteSysteme.findUnique).not.toHaveBeenCalled();
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("libère le verrou (notifiedAt=null) si l'enqueue échoue (enqueued=false)", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(fakeAlerte);
    mockEnqueueEmail.mockResolvedValue({ enqueued: false });
    await notifierAlerteInterne(ALERTE_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    // Fail-soft : pas de "notifiée sans email" → reset pour re-tenter au prochain cron.
    expect(mockPrisma.alerteSysteme.update).toHaveBeenCalledOnce();
    const resetArgs = mockPrisma.alerteSysteme.update.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(resetArgs.where).toMatchObject({ id: ALERTE_ID });
    expect(resetArgs.data).toMatchObject({ notifiedAt: null });
  });

  it("ne libère PAS le verrou quand l'enqueue réussit (enqueued=true)", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(fakeAlerte);
    await notifierAlerteInterne(ALERTE_ID);
    expect(mockPrisma.alerteSysteme.update).not.toHaveBeenCalled();
  });

  it("early-exit si alerte introuvable", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(null);
    await notifierAlerteInterne(ALERTE_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("libère le verrou ET propage si l'enqueue THROW (Redis transitoire)", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(fakeAlerte);
    mockEnqueueEmail.mockRejectedValue(new Error("Redis connection lost"));
    // L'exception remonte (handleAlertes la catch/log), mais le verrou est libéré
    // pour re-tenter au prochain cron (sinon "notifiée" sans email parti).
    await expect(notifierAlerteInterne(ALERTE_ID)).rejects.toThrow("Redis connection lost");
    expect(mockPrisma.alerteSysteme.update).toHaveBeenCalledOnce();
    const resetArgs = mockPrisma.alerteSysteme.update.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(resetArgs.where).toMatchObject({ id: ALERTE_ID });
    expect(resetArgs.data).toMatchObject({ notifiedAt: null });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerRelanceQuestionnaire + envoyerEnqueteEntreprise (2026-08-04)
// ─────────────────────────────────────────────────────────────────────────────

const QUESTIONNAIRE_ID = "quest-uuid-relance-1";

function fakeQuestionnaire(overrides: Record<string, unknown> = {}) {
  return {
    id: QUESTIONNAIRE_ID,
    type: "satisfaction_chaud",
    token: "c".repeat(48),
    envoyeAt: new Date("2026-08-01T08:00:00Z"),
    reponduAt: null,
    relanceCount: 0,
    enrollment: {
      trainee: { id: TRAINEE_ID, email: "jean@example.com", nom: "Dupont", prenom: "Jean" },
      session: {
        numero: "AXI-SESS-2026-001",
        titreSession: "Formation IA",
        dateFin: new Date("2026-07-31T17:00:00Z"),
        client: {
          contactNom: "Simone Blanc",
          contactEmail: "simone@investsun.example",
          raisonSociale: "SCI INVEST SUN",
        },
      },
    },
    ...overrides,
  };
}

describe("envoyerRelanceQuestionnaire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueueEmail.mockResolvedValue({ enqueued: true });
    // Portail : un accès vivant existe déjà.
    mockPrisma.portailAcces.findFirst.mockResolvedValue({
      token: "b".repeat(64),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    mockPrisma.questionnaire.update.mockResolvedValue({});
  });

  it("stagiaire → email de relance + trace incrémentée DANS LE MÊME GESTE", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(fakeQuestionnaire());

    await envoyerRelanceQuestionnaire(QUESTIONNAIRE_ID);

    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    const [template, to, , payload, opts] = mockEnqueueEmail.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      { jobId: string },
    ];
    expect(template).toBe("qualiopi-questionnaire-relance");
    expect(to).toBe("jean@example.com");
    expect(payload["libelleQuestionnaire"]).toBe("questionnaire de satisfaction");
    // Idempotence par NUMÉRO de relance : la relance 1 ne part qu'une fois,
    // la relance 2 garde un jobId distinct.
    expect(opts.jobId).toBe(`qualiopi-questionnaire-relance-${QUESTIONNAIRE_ID}-1`);

    expect(mockPrisma.questionnaire.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: QUESTIONNAIRE_ID },
        data: expect.objectContaining({ relanceCount: 1, derniereRelanceAt: expect.any(Date) }),
      }),
    );
  });

  it("entreprise → email au CONTACT CLIENT avec le lien de l'enquête publique", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(
      fakeQuestionnaire({ type: "satisfaction_entreprise", relanceCount: 1 }),
    );

    await envoyerRelanceQuestionnaire(QUESTIONNAIRE_ID);

    const [template, to, , payload, opts] = mockEnqueueEmail.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      { jobId: string },
    ];
    expect(template).toBe("qualiopi-enquete-entreprise");
    expect(to).toBe("simone@investsun.example");
    expect(String(payload["lienEnquete"])).toContain(`/fr/portail/enquete/${"c".repeat(48)}`);
    expect(opts.jobId).toBe(`qualiopi-enquete-entreprise-relance-${QUESTIONNAIRE_ID}-2`);
    expect(mockPrisma.questionnaire.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ relanceCount: 2 }) }),
    );
  });

  it("déjà répondu → AUCUN email, AUCUNE trace", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(
      fakeQuestionnaire({ reponduAt: new Date("2026-08-02T10:00:00Z") }),
    );
    await envoyerRelanceQuestionnaire(QUESTIONNAIRE_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
    expect(mockPrisma.questionnaire.update).not.toHaveBeenCalled();
  });

  it("jamais envoyé → AUCUN email (une relance suppose un envoi initial)", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(fakeQuestionnaire({ envoyeAt: null }));
    await envoyerRelanceQuestionnaire(QUESTIONNAIRE_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("entreprise SANS email de contact → sort sans toucher la trace", async () => {
    // 🔴 Le compteur ne compte que de VRAIS envois : incrémenter ici ferait
    // croire à l'auditeur qu'on a relancé quelqu'un qu'on ne peut pas joindre.
    mockPrisma.questionnaire.findUnique.mockResolvedValue(
      fakeQuestionnaire({
        type: "satisfaction_entreprise",
        enrollment: {
          trainee: { id: TRAINEE_ID, email: "jean@example.com", nom: "Dupont", prenom: "Jean" },
          session: {
            numero: "AXI-SESS-2026-001",
            titreSession: "Formation IA",
            dateFin: new Date("2026-07-31T17:00:00Z"),
            client: { contactNom: "X", contactEmail: null, raisonSociale: "SCI X" },
          },
        },
      }),
    );
    await envoyerRelanceQuestionnaire(QUESTIONNAIRE_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
    expect(mockPrisma.questionnaire.update).not.toHaveBeenCalled();
  });
});

describe("envoyerEnqueteEntreprise", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueueEmail.mockResolvedValue({ enqueued: true });
    // 🔴 `D4-5-S1` — la création ne rend plus de jeton. Le lien de l'e-mail
    // vient de l'ÉMISSION, qui en frappe un neuf et n'en garde que l'empreinte.
    mockCreerQuestionnaire.mockResolvedValue({ id: "quest-uuid-e1" });
    mockEmettreLien.mockResolvedValue("d".repeat(48));
  });

  it("crée (upsert) le questionnaire entreprise et écrit au contact client", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      numero: "AXI-SESS-2026-001",
      titreSession: "Formation IA",
      dateFin: new Date("2026-07-01T17:00:00Z"),
      client: {
        contactNom: "Simone Blanc",
        contactEmail: "simone@investsun.example",
        raisonSociale: "SCI INVEST SUN",
      },
      enrollments: [{ id: ENROLLMENT_ID }],
    });

    await envoyerEnqueteEntreprise(SESSION_ID);

    expect(mockCreerQuestionnaire).toHaveBeenCalledWith({
      enrollmentId: ENROLLMENT_ID,
      type: "satisfaction_entreprise",
    });
    const [template, to, , payload] = mockEnqueueEmail.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(template).toBe("qualiopi-enquete-entreprise");
    expect(to).toBe("simone@investsun.example");
    // 🔑 Le lien vient de l'ÉMISSION, plus de la création : c'est elle qui
    // frappe un jeton neuf et n'en garde que l'empreinte.
    expect(String(payload["lienEnquete"])).toContain(`/fr/portail/enquete/${"d".repeat(48)}`);
    expect(mockEmettreLien).toHaveBeenCalled();
  });

  it("sans inscription active → THROW (le cron doit journaliser, pas croire l'envoi fait)", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      numero: "AXI-SESS-2026-001",
      titreSession: "Formation IA",
      dateFin: new Date("2026-07-01T17:00:00Z"),
      client: { contactNom: "X", contactEmail: "x@y.example", raisonSociale: "SCI X" },
      enrollments: [],
    });
    await expect(envoyerEnqueteEntreprise(SESSION_ID)).rejects.toThrow(/inscription active/);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerRappelJ1 — le rappel de la VEILLE (ADR 0048 §4.3)
//
// 🔴 Il n'existait pas. `formateur-rappel-j1` oui, `qualiopi-rappel-j7` oui,
// mais rien entre J-7 et la séance pour le PARTICIPANT — et c'est le seul
// message qui puisse lui donner la manière d'entrer.
// ─────────────────────────────────────────────────────────────────────────────

/** Session distancielle avec deux inscrits — la forme que rend Prisma. */
function sessionDistanciel(over: Record<string, unknown> = {}) {
  return {
    ...fakeSessionWithEnrollments,
    modalite: "distanciel",
    lieuType: "distanciel",
    lieuIntitule: null,
    lieuAdresse: null,
    lieuCodePostal: null,
    lieuVille: null,
    lieuSalle: null,
    lieuVisioUrl: "https://meet.google.com/abc-defg-hij",
    ...over,
  };
}

describe("envoyerRappelJ1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portailAcces.findFirst.mockResolvedValue({ token: FAKE_TOKEN });
    // Aucun jeton d'émargement vivant → le rappel en met un en circulation.
    mockPrisma.emargementToken.findFirst.mockResolvedValue(null);
    // Aucune trace d'envoi antérieure : le rappel n'est pas encore parti.
    mockPrisma.emailLog.findFirst.mockResolvedValue(null);
    mockEnqueueEmail.mockResolvedValue({ enqueued: true });
    mockCreerTokenInscription.mockResolvedValue({
      token: "e".repeat(80),
      tokenId: "tok-uuid-1",
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
    mockCreerAcces.mockResolvedValue({
      id: "acces-uuid-1",
      token: "b".repeat(64),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });
  });

  it("🔴 PORTE LE LIEN DE CONNEXION EN ENTIER — c'est la raison d'être de ce message", async () => {
    // Le défaut fermé : la convocation passe le lieu par `formatLieu`, qui
    // réduit l'URL à son seul hôte. Le stagiaire recevait « meet.google.com »
    // et n'avait aucune manière d'entrer.
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionDistanciel());

    const ok = await envoyerRappelJ1(SESSION_ID);

    expect(ok).toBe(true);
    const payload = (mockEnqueueEmail.mock.calls[0] as unknown[])[3] as Record<string, unknown>;
    expect(payload["lienVisio"]).toBe("https://meet.google.com/abc-defg-hij");
    // ⚠️ ET LE CONTRE-TÉMOIN : `lieu`, qui part aussi sur la pièce archivée,
    // continue de n'en montrer QUE l'hôte. Les deux comportements doivent
    // coexister — sans cette assertion, remettre le lien complet PARTOUT
    // passerait, et c'est exactement ce que la réduction de `formatLieu` évite.
    expect(payload["lieu"]).toBe("Distanciel — meet.google.com");
    expect(String(payload["lieu"])).not.toContain("abc-defg-hij");
  });

  it("n'invente PAS de lien quand la session n'en porte pas", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      sessionDistanciel({ lieuVisioUrl: null }),
    );
    await envoyerRappelJ1(SESSION_ID);
    const payload = (mockEnqueueEmail.mock.calls[0] as unknown[])[3] as Record<string, unknown>;
    expect(payload["lienVisio"]).toBeUndefined();
  });

  it("ignore une valeur qui n'est pas une URL — « à venir » ne se clique pas", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      sessionDistanciel({ lieuVisioUrl: "lien Zoom à venir" }),
    );
    await envoyerRappelJ1(SESSION_ID);
    const payload = (mockEnqueueEmail.mock.calls[0] as unknown[])[3] as Record<string, unknown>;
    expect(payload["lienVisio"]).toBeUndefined();
  });

  it("🔴 un premier échec ne prive PAS les suivants — `continue`, jamais `return false`", async () => {
    // Le correctif du 2026-08-24 sur le rappel J-7 : sur une session de dix, un
    // message garé en corbeille pour le premier privait les neuf autres.
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionDistanciel());
    mockEnqueueEmail
      .mockResolvedValueOnce({ enqueued: false, garePourValidation: true })
      .mockResolvedValueOnce({ enqueued: true });

    const ok = await envoyerRappelJ1(SESSION_ID);

    // Le second inscrit a bien été servi…
    expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
    // …et l'échec du premier n'est pas avalé pour autant.
    expect(ok).toBe(false);
  });

  it("une erreur LEVÉE sur un stagiaire ne prive pas non plus les suivants", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionDistanciel());
    mockEnqueueEmail
      .mockRejectedValueOnce(new Error("relais injoignable"))
      .mockResolvedValueOnce({ enqueued: true });

    const ok = await envoyerRappelJ1(SESSION_ID);

    expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
    expect(ok).toBe(false);
  });

  it("porte une clé d'idempotence de DATE, dérivée du DÉBUT de session", async () => {
    // Pas du jour courant : trente passages horaires doivent produire trente
    // fois la même clé, sinon la file ne dédoublonne rien.
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionDistanciel());
    await envoyerRappelJ1(SESSION_ID);
    const options = (mockEnqueueEmail.mock.calls[0] as unknown[])[4] as { jobId?: string };
    expect(options.jobId).toBe(`qualiopi-rappel-j1-${ENROLLMENT_ID}-20260901`);
  });

  it("🔴 NE RENVOIE PAS ce que le journal dit déjà parti", async () => {
    // La déduplication BullMQ expire au min(7 jours, 1 000 jobs). Sur un cron
    // HORAIRE, s'y fier seul ferait recevoir trente fois « c'est demain ».
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionDistanciel());
    mockPrisma.emailLog.findFirst.mockResolvedValue({ id: "log-1" });

    const ok = await envoyerRappelJ1(SESSION_ID);

    expect(mockEnqueueEmail).not.toHaveBeenCalled();
    // Rien à renvoyer n'est pas un échec : les deux inscrits ont leur message.
    expect(ok).toBe(true);
  });

  it("le journal est interrogé par le jobId, pas par l'inscription", async () => {
    // Interroger par inscription confondrait ce rappel avec tous les autres
    // e-mails de la même personne, et le rappel ne partirait jamais.
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionDistanciel());
    await envoyerRappelJ1(SESSION_ID);
    const where = (mockPrisma.emailLog.findFirst.mock.calls[0]?.[0] as { where: { jobId: string } })
      .where;
    expect(where.jobId).toBe(`qualiopi-rappel-j1-${ENROLLMENT_ID}-20260901`);
  });

  it("un journal ILLISIBLE n'empêche pas le rappel de partir", async () => {
    // Le déséquilibre des deux fautes commande le repli : un doublon est
    // désagréable, une absence la veille d'une séance à distance est un trou
    // dans la preuve d'assiduité.
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionDistanciel());
    mockPrisma.emailLog.findFirst.mockRejectedValue(new Error("base muette"));

    const ok = await envoyerRappelJ1(SESSION_ID);

    expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
    expect(ok).toBe(true);
  });

  it("émet le gabarit `qualiopi-rappel-j1` à CHAQUE inscrit actif", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionDistanciel());
    await envoyerRappelJ1(SESSION_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
    for (const call of mockEnqueueEmail.mock.calls as unknown[][]) {
      expect(call[0]).toBe("qualiopi-rappel-j1");
      expect(call[2]).toBe("fr");
    }
    expect((mockEnqueueEmail.mock.calls[0] as unknown[])[1]).toBe("jean@example.com");
    expect((mockEnqueueEmail.mock.calls[1] as unknown[])[1]).toBe("marie@example.com");
  });

  it("lie le jeton d'émargement à l'adresse du stagiaire (ADR 0048 §4.1)", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionDistanciel());
    await envoyerRappelJ1(SESSION_ID);
    expect(mockCreerTokenInscription).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: ENROLLMENT_ID,
        destinataireEmail: "jean@example.com",
      }),
    );
  });

  it("session sans inscrit → rien n'est envoyé, et ce n'est PAS un succès", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionDistanciel({ enrollments: [] }));
    const ok = await envoyerRappelJ1(SESSION_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
    expect(ok).toBe(false);
  });

  it("session introuvable → `false`, sans rien enfiler", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(null);
    expect(await envoyerRappelJ1("inconnue")).toBe(false);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("N'ÉCRIT AUCUNE trace sur la session — la preuve vit dans `email_logs`", async () => {
    // Une colonne de plus redirait ce que le journal dit, et ferait échouer le
    // cron du worker pendant l'heure où il tourne devant sa propre migration
    // (cf. AGENTS.md, « le worker atterrit ~50 min AVANT l'app »).
    mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionDistanciel());
    await envoyerRappelJ1(SESSION_ID);
    expect(mockPrisma.trainingSession.update).not.toHaveBeenCalled();
  });
});
