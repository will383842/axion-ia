/**
 * Indicateur 10 — une NOUVELLE déclaration du besoin rouvre le circuit.
 *
 * Défaut relevé à la relecture de la PR 1095, rejoué ici de bout en bout :
 *
 *   1. une stagiaire répond « oui » au positionnement du portail → alerte
 *      `besoin_adaptation_declare` ;
 *   2. l'organisme consigne « aucune adaptation nécessaire » → alertes fermées ;
 *   3. plus tard, la même personne déclare un VRAI besoin depuis « mon compte »
 *      (ou la fiche est cochée en console).
 *
 * Avant : AUCUNE nouvelle alerte (le message ne dépendait que de l'identité, et
 * une sœur résolue au même message l'écartait), la règle balayée se taisait
 * (colonne non vide), l'indicateur 10 et la colonne « Adaptations » restaient
 * « consignés ». Le vrai besoin n'avait reçu aucune réponse, et rien ne le disait.
 *
 * ## Le banc
 *
 * Les VRAIES Server Actions (`soumettreSatisfactionPortailAction`,
 * `setEnrollmentAdaptationsAction`, `declarerHandicapAction`,
 * `updateTraineeAction`), le VRAI `creerOuDedup`, la VRAIE règle balayée, le VRAI
 * lecteur du circuit et le VRAI composant de la colonne tournent sur une base EN
 * MÉMOIRE. Seules les frontières sont doublées : cookie portail, chiffrement,
 * Telegram, versement des réponses du questionnaire.
 *
 * ⚠️ La base en mémoire n'interprète, dans un `where` d'inscription, que `id`,
 * `traineeId`, `adaptationsRealisees` et `AND`. Le filtre SQL du besoin déclaré
 * (un `OR` JSON), du statut et de la fenêtre de session est IGNORÉ : le banc ne
 * contient qu'une inscription active sur une session récente, et le code
 * confirme le besoin en mémoire (`besoinAdaptationDeclare`). Le filtre
 * `adaptationsRealisees`, lui, est honoré — c'est précisément celui qui rendait
 * l'ancienne règle aveugle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ─────────────────────────────────────────────────────────────────────────────
// Base en mémoire
// ─────────────────────────────────────────────────────────────────────────────

interface Stagiaire {
  id: string;
  prenom: string;
  nom: string;
  situationHandicap: boolean;
  handicapDetailsChiffre: string | null;
}
interface Inscription {
  id: string;
  traineeId: string;
  sessionId: string;
  statut: string;
  adaptationsRealisees: string | null;
}
interface Session {
  id: string;
  numero: string;
  dateDebut: Date;
  dateFin: Date;
}
interface Questionnaire {
  id: string;
  enrollmentId: string;
  type: string;
  reponses: Record<string, unknown>;
  reponduAt: Date | null;
}
interface Alerte {
  id: string;
  code: string;
  niveau: string;
  titre: string;
  message: string;
  cibleType: string | null;
  cibleId: string | null;
  resolue: boolean;
  resolueAt: Date | null;
}
interface Journal {
  action: string;
  targetType: string | null;
  targetId: string | null;
  changes: unknown;
  createdAt: Date;
}

const base = vi.hoisted(() => ({
  stagiaires: [] as unknown[],
  inscriptions: [] as unknown[],
  sessions: [] as unknown[],
  questionnaires: [] as unknown[],
  alertes: [] as unknown[],
  journal: [] as unknown[],
}));

const T = (): {
  stagiaires: Stagiaire[];
  inscriptions: Inscription[];
  sessions: Session[];
  questionnaires: Questionnaire[];
  alertes: Alerte[];
  journal: Journal[];
} => base as never;

type Where = Record<string, unknown>;

function correspondIdentifiant(valeur: string, filtre: unknown): boolean {
  if (filtre === undefined) return true;
  if (typeof filtre === "string") return valeur === filtre;
  const f = filtre as { not?: string; in?: string[] };
  if (f.not !== undefined && valeur === f.not) return false;
  if (f.in !== undefined && !f.in.includes(valeur)) return false;
  return true;
}

function inscriptionCorrespond(e: Inscription, where: Where): boolean {
  if (!correspondIdentifiant(e.id, where["id"])) return false;
  if (!correspondIdentifiant(e.traineeId, where["traineeId"])) return false;
  if ("adaptationsRealisees" in where) {
    const f = where["adaptationsRealisees"];
    if (f === null && e.adaptationsRealisees !== null) return false;
    if (f !== null && (f as { not?: unknown }).not === null && e.adaptationsRealisees === null) {
      return false;
    }
  }
  const et = where["AND"];
  if (Array.isArray(et) && !et.every((w) => inscriptionCorrespond(e, w as Where))) return false;
  return true;
}

function inscriptionHydratee(e: Inscription): Record<string, unknown> {
  const s = T().stagiaires.find((x) => x.id === e.traineeId) as Stagiaire;
  const session = T().sessions.find((x) => x.id === e.sessionId) as Session;
  return {
    ...e,
    trainee: { id: s.id, prenom: s.prenom, nom: s.nom, situationHandicap: s.situationHandicap },
    session: { numero: session.numero, dateDebut: session.dateDebut, dateFin: session.dateFin },
    questionnaires: T()
      .questionnaires.filter(
        (q) => q.enrollmentId === e.id && q.type === "positionnement" && q.reponduAt !== null,
      )
      .map((q) => ({ reponses: q.reponses, reponduAt: q.reponduAt })),
  };
}

function alerteCorrespond(a: Alerte, where: Where): boolean {
  if (where["code"] !== undefined && a.code !== where["code"]) return false;
  if (where["resolue"] !== undefined && a.resolue !== where["resolue"]) return false;
  if (where["message"] !== undefined && a.message !== where["message"]) return false;
  if ("cibleId" in where && !correspondIdentifiant(a.cibleId ?? "", where["cibleId"] ?? "")) {
    return false;
  }
  return true;
}

vi.mock("@/lib/prisma", () => {
  const b = base as never as ReturnType<typeof T>;
  return {
    prisma: {
      trainee: {
        // Des COPIES, comme Prisma : une lecture ne suit pas une écriture ultérieure.
        findUnique: async ({ where }: { where: { id: string } }) => {
          const s = b.stagiaires.find((x) => x.id === where.id);
          return s === undefined ? null : { ...s };
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Stagiaire> }) => {
          const s = b.stagiaires.find((x) => x.id === where.id);
          if (s === undefined) throw Object.assign(new Error("absent"), { code: "P2025" });
          Object.assign(s, data);
          return { ...s };
        },
      },
      questionnaire: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const q = b.questionnaires.find((x) => x.id === where.id);
          if (q === undefined) return null;
          const e = b.inscriptions.find((x) => x.id === q.enrollmentId) as Inscription;
          return { type: q.type, enrollment: { traineeId: e.traineeId } };
        },
      },
      enrollment: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const e = b.inscriptions.find((x) => x.id === where.id);
          return e === undefined ? null : { ...e };
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Inscription> }) => {
          const e = b.inscriptions.find((x) => x.id === where.id) as Inscription;
          Object.assign(e, data);
          return { traineeId: e.traineeId };
        },
        findMany: async ({ where }: { where: Where }) =>
          b.inscriptions.filter((e) => inscriptionCorrespond(e, where)).map(inscriptionHydratee),
      },
      alerteSysteme: {
        findFirst: async ({ where }: { where: Where }) =>
          b.alertes.find((a) => alerteCorrespond(a, where)) ?? null,
        findMany: async ({ where }: { where: Where }) =>
          b.alertes.filter((a) => alerteCorrespond(a, where)),
        create: async ({ data }: { data: Partial<Alerte> }) => {
          const a = {
            id: `alerte-${b.alertes.length + 1}`,
            cibleType: null,
            cibleId: null,
            resolue: false,
            resolueAt: null,
            ...data,
          } as Alerte;
          b.alertes.push(a);
          return a;
        },
        updateMany: async ({ where, data }: { where: Where; data: Partial<Alerte> }) => {
          const cibles = b.alertes.filter((a) => alerteCorrespond(a, where));
          for (const a of cibles) Object.assign(a, data);
          return { count: cibles.length };
        },
      },
      activityLog: {
        create: async ({ data }: { data: Partial<Journal> }) => {
          b.journal.push({
            action: data.action ?? "",
            targetType: data.targetType ?? null,
            targetId: data.targetId ?? null,
            changes: data.changes ?? null,
            createdAt: data.createdAt ?? new Date(),
          });
          return {};
        },
        findMany: async ({ where }: { where: Where }) =>
          b.journal
            .filter(
              (l) =>
                l.action === where["action"] &&
                l.targetType === where["targetType"] &&
                correspondIdentifiant(l.targetId ?? "", where["targetId"]),
            )
            .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime()),
      },
    },
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Frontières doublées
// ─────────────────────────────────────────────────────────────────────────────

const STAGIAIRE = "11111111-1111-4111-8111-111111111111";
const INSCRIPTION = "22222222-2222-4222-8222-222222222222";
const SESSION = "33333333-3333-4333-8333-333333333333";
const POSITIONNEMENT = "44444444-4444-4444-8444-444444444444";
const DETAIL_DE_SANTE = "Fauteuil roulant, salle au rez-de-chaussée";

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "admin-1", role: "super_admin" })),
  requireSuperAdmin: vi.fn(async () => ({ userId: "admin-1", role: "super_admin" })),
  requireHabilitation: vi.fn(async () => ({ userId: "admin-1", role: "super_admin" })),
  logQualiopiActivity: async (i: {
    action: string;
    targetType?: string;
    targetId?: string;
    changes?: unknown;
  }) => {
    (base as never as ReturnType<typeof T>).journal.push({
      action: i.action,
      targetType: i.targetType ?? null,
      targetId: i.targetId ?? null,
      changes: i.changes ?? null,
      createdAt: new Date(),
    });
  },
}));
vi.mock("@/server/qualiopi/portail/cookie", () => ({
  getPortailToken: vi.fn(async () => "jeton-cookie"),
  setPortailCookie: vi.fn(),
  clearPortailCookie: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/portail-service", () => ({
  verifierToken: vi.fn(async () => ({ traineeId: STAGIAIRE })),
  creerAcces: vi.fn(),
  revoquerAcces: vi.fn(),
  demanderAccesParEmail: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/rgpd-service", () => ({ creerDemandeRgpd: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn(async () => true) }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `enc:v1:${v.length}`,
  decryptPii: () => null,
}));
vi.mock("@/server/qualiopi/satisfaction/satisfaction-service", () => ({
  creerQuestionnaire: vi.fn(),
  // Le versement des réponses : même écriture que le service réel (réponses +
  // `reponduAt`), sans la transcription aux registres, hors sujet ici.
  soumettreReponses: async (input: {
    questionnaireId: string;
    reponses: Record<string, unknown>;
  }) => {
    const q = (base as never as ReturnType<typeof T>).questionnaires.find(
      (x) => x.id === input.questionnaireId,
    );
    if (q === undefined) return null;
    q.reponses = input.reponses;
    q.reponduAt = new Date();
    return { id: q.id };
  },
}));
// Mêmes doubles qu'`evaluateur.spec.ts` : ils rendent l'évaluateur (tiré par
// `alertes-service`) importable sans la chaîne d'authentification.
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));
vi.mock("@/server/qualiopi/documents/organisme", () => ({ getOrganismeIdentite: vi.fn() }));
vi.mock("@/server/qualiopi/financements/bareme-opco", () => ({ listBaremesEnVigueur: vi.fn() }));
vi.mock("@/server/qualiopi/trainers/documents", () => ({
  listTrainerDocuments: vi.fn(),
  cumulAnnuelFormateurCents: vi.fn(),
}));

import {
  declarerHandicapAction,
  soumettreSatisfactionPortailAction,
} from "@/server/actions/qualiopi/portail";
import { setEnrollmentAdaptationsAction } from "@/server/actions/qualiopi/enrollments";
import { updateTraineeAction } from "@/server/actions/qualiopi/trainees";
import { creerOuDedup } from "@/server/qualiopi/alertes/alertes-service";
import { construireAlerteBesoinAdaptation } from "@/server/qualiopi/alertes/besoin-adaptation";
import { regleAdaptationReponseNonConsignee } from "@/server/qualiopi/alertes/regle-adaptation-reponse";
import { EnrollmentsSection } from "@/components/admin/qualiopi/EnrollmentsSection";
import {
  REPONSE_AUCUNE_ADAPTATION,
  besoinAdaptationDeclare,
  etatReponseAdaptation,
  serialiserHorodatage,
  type EtatReponseAdaptation,
} from "@/server/qualiopi/adaptation/reponse-organisme";
import {
  compterReponsesRouvertes,
  lireCircuitAdaptation,
} from "@/server/qualiopi/adaptation/journal-consignation";

// ─────────────────────────────────────────────────────────────────────────────
// Lectures — les MÊMES que l'écran, la règle et le moteur
// ─────────────────────────────────────────────────────────────────────────────

const T1 = new Date("2026-09-20T08:00:00.000Z"); // « oui » au positionnement
const T2 = new Date("2026-09-22T08:00:00.000Z"); // « aucune adaptation nécessaire »
const T3 = new Date("2026-09-25T08:00:00.000Z"); // nouvelle déclaration
const T4 = new Date("2026-09-26T08:00:00.000Z"); // réponse reconsignée
const DEBUT_SESSION = new Date("2026-10-05T07:00:00.000Z");
const FIN_SESSION = new Date("2026-10-06T16:00:00.000Z");

function inscription(): Inscription {
  return T().inscriptions[0] as Inscription;
}

async function circuit() {
  const e = inscriptionHydratee(inscription()) as {
    questionnaires: { reponses: unknown; reponduAt: Date | null }[];
    trainee: { situationHandicap: boolean };
  };
  const horodatages = await lireCircuitAdaptation([
    {
      id: INSCRIPTION,
      traineeId: STAGIAIRE,
      finSession: FIN_SESSION,
      positionnements: e.questionnaires,
    },
  ]);
  const horodatage = horodatages.get(INSCRIPTION);
  if (horodatage === undefined) throw new Error("circuit non lu");
  const besoin = besoinAdaptationDeclare({
    situationHandicap: e.trainee.situationHandicap,
    reponsesPositionnements: e.questionnaires.map((q) => q.reponses),
    besoinAdaptationDeclareAt: null,
  });
  return { horodatage, besoin };
}

/** L'état de la colonne « Adaptations (ind. 10) », tel que la fiche session le calcule. */
async function etatColonne(): Promise<EtatReponseAdaptation> {
  const { horodatage, besoin } = await circuit();
  return etatReponseAdaptation(besoin, inscription().adaptationsRealisees, horodatage);
}

/** La colonne RENDUE par le composant de la fiche session. */
async function rendreColonne() {
  const { horodatage, besoin } = await circuit();
  const ok = vi.fn(async () => ({ data: { id: INSCRIPTION } }));
  return render(
    <EnrollmentsSection
      sessionId={SESSION}
      debutSession={DEBUT_SESSION.toISOString()}
      enrollments={[
        {
          id: INSCRIPTION,
          trainee: { id: STAGIAIRE, nom: "Test", prenom: "Alice", email: "alice@exemple.test" },
          statut: "planifiee",
          tauxPresencePct: null,
          adaptationsRealisees: inscription().adaptationsRealisees,
          besoinAdaptationDeclare: besoin,
          circuitAdaptation: serialiserHorodatage(horodatage),
          sortieAt: null,
          sortieMotif: null,
          portailAcces: null,
        },
      ]}
      availableTrainees={[]}
      enrollAction={ok}
      setStatutAction={ok}
      setAdaptationsAction={ok}
      genererPortailAction={vi.fn()}
      revoquerPortailAction={ok}
    />,
  );
}

const alertesGeste = (): Alerte[] =>
  T().alertes.filter((a) => a.code === "besoin_adaptation_declare" && a.cibleId === STAGIAIRE);

/** `declarerHandicapAction` détache la création de l'alerte : on laisse la file se vider. */
async function laisserPartir(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
}

async function etapes1et2(): Promise<void> {
  // 1. « oui » au positionnement du portail.
  vi.setSystemTime(T1);
  const r1 = await soumettreSatisfactionPortailAction({
    questionnaireId: POSITIONNEMENT,
    reponses: { besoinAdaptation: true, besoinAdaptationRepondu: true, attentes: "Progresser" },
  });
  expect(r1).toEqual({ data: { id: POSITIONNEMENT } });
  expect(alertesGeste().filter((a) => !a.resolue)).toHaveLength(1);

  // 2. l'organisme consigne « aucune adaptation nécessaire », puis décoche la fiche
  //    (cas réel : l'échange n'a révélé aucun besoin).
  vi.setSystemTime(T2);
  await setEnrollmentAdaptationsAction({
    id: INSCRIPTION,
    adaptationsRealisees: "",
    aucuneAdaptationNecessaire: true,
  });
  await updateTraineeAction({ id: STAGIAIRE, situationHandicap: false });
  expect(alertesGeste().every((a) => a.resolue)).toBe(true);
  expect(await etatColonne()).toBe("consignee");
  expect(await compterReponsesRouvertes({})).toBe(0);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  const b = T();
  b.stagiaires.splice(0, Infinity, {
    id: STAGIAIRE,
    prenom: "Alice",
    nom: "Test",
    situationHandicap: false,
    handicapDetailsChiffre: null,
  });
  b.sessions.splice(0, Infinity, {
    id: SESSION,
    numero: "AXI-SESS-TEST",
    dateDebut: DEBUT_SESSION,
    dateFin: FIN_SESSION,
  });
  b.inscriptions.splice(0, Infinity, {
    id: INSCRIPTION,
    traineeId: STAGIAIRE,
    sessionId: SESSION,
    statut: "planifiee",
    adaptationsRealisees: null,
  });
  b.questionnaires.splice(0, Infinity, {
    id: POSITIONNEMENT,
    enrollmentId: INSCRIPTION,
    type: "positionnement",
    reponses: {},
    reponduAt: null,
  });
  b.alertes.splice(0, Infinity);
  b.journal.splice(0, Infinity);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// ─────────────────────────────────────────────────────────────────────────────
// Scénario
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 ind. 10 — une nouvelle déclaration rouvre le circuit (relecture de la PR 1095)", () => {
  it("« mon compte » après « aucune adaptation nécessaire » : alerte, ind. 10 non couvert, colonne à consigner, réponse conservée", async () => {
    await etapes1et2();

    // 3. la même personne déclare un vrai besoin depuis « mon compte ».
    vi.setSystemTime(T3);
    expect(await declarerHandicapAction({ besoin: DETAIL_DE_SANTE })).toEqual({
      data: { ok: true },
    });
    await laisserPartir();

    // ── L'alerte est LEVÉE, pas écartée par le dédoublonnage. ──
    const ouvertes = alertesGeste().filter((a) => !a.resolue);
    expect(ouvertes).toHaveLength(1);
    expect(alertesGeste()).toHaveLength(2); // la première, résolue, reste en base
    // 🔴 Aucun contenu de santé dans l'alerte ni dans le journal.
    expect(JSON.stringify(T().alertes)).not.toContain("Fauteuil");
    expect(JSON.stringify(T().journal)).not.toContain("Fauteuil");

    // ── L'indicateur 10 ne compte plus la réponse comme couvrant le besoin. ──
    expect(await etatColonne()).toBe("a_consigner");
    expect(await compterReponsesRouvertes({})).toBe(1);

    // ── La réponse HISTORIQUE est conservée : colonne et journal intacts. ──
    expect(inscription().adaptationsRealisees).toBe(REPONSE_AUCUNE_ADAPTATION);
    expect(
      T().journal.filter(
        (l) => l.action === "qualiopi.enrollment.adaptations" && l.targetId === INSCRIPTION,
      ),
    ).toHaveLength(1);

    // ── La colonne « Adaptations (ind. 10) » repasse « réponse à consigner ». ──
    const { unmount } = await rendreColonne();
    expect(screen.getByText(/réponse à consigner/)).toBeTruthy();
    expect(screen.getByText(/Nouvelle déclaration le/)).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      REPONSE_AUCUNE_ADAPTATION,
    );
    const confirmer = screen.getByRole("button", { name: "Confirmer cette réponse" });
    expect((confirmer as HTMLButtonElement).disabled).toBe(false);
    unmount();

    // ── La règle balayée : muette tant que l'alerte du geste est ouverte… ──
    expect(await regleAdaptationReponseNonConsignee(T3)).toEqual([]);
    // …et prend le relais si l'alerte est fermée à la main sans rien consigner.
    for (const a of ouvertes) a.resolue = true;
    const relais = await regleAdaptationReponseNonConsignee(T3);
    expect(relais.map((c) => c.cibleId)).toEqual([INSCRIPTION]);
    expect(relais[0]?.message).toContain("APRÈS la dernière réponse consignée");
    expect(relais[0]?.message).not.toContain("Fauteuil");

    // 4. l'organisme reconsigne (confirme la réponse après échange) : le circuit
    //    se referme, et la nouvelle réponse est datée.
    for (const a of ouvertes) a.resolue = false;
    vi.setSystemTime(T4);
    await setEnrollmentAdaptationsAction({
      id: INSCRIPTION,
      adaptationsRealisees: "",
      aucuneAdaptationNecessaire: true,
    });
    expect(alertesGeste().every((a) => a.resolue)).toBe(true);
    expect(await etatColonne()).toBe("consignee");
    expect(await compterReponsesRouvertes({})).toBe(0);
    expect(await regleAdaptationReponseNonConsignee(T4)).toEqual([]);
  });

  it("🔑 non-régression : la MÊME déclaration ne fabrique pas de doublon, ouverte ou résolue", async () => {
    await etapes1et2();

    // Double envoi, au même instant : une seule alerte ouverte.
    vi.setSystemTime(T3);
    await declarerHandicapAction({ besoin: DETAIL_DE_SANTE });
    await declarerHandicapAction({ besoin: DETAIL_DE_SANTE });
    await laisserPartir();
    expect(alertesGeste().filter((a) => !a.resolue)).toHaveLength(1);

    // Traitée, puis la même déclaration redite : écartée.
    for (const a of alertesGeste()) a.resolue = true;
    const alerte = construireAlerteBesoinAdaptation({
      prenom: "Alice",
      nom: "Test",
      declareLe: T3,
    });
    const recree = await creerOuDedup({
      code: "besoin_adaptation_declare",
      niveau: "important",
      titre: alerte.titre,
      message: alerte.message,
      cibleType: "Trainee",
      cibleId: STAGIAIRE,
    });
    expect(recree).toBeNull();
    expect(alertesGeste()).toHaveLength(2);
  });

  it("la fiche cochée en CONSOLE après la réponse rouvre aussi le circuit — la règle balayée le dit", async () => {
    await etapes1et2();

    vi.setSystemTime(T3);
    await updateTraineeAction({ id: STAGIAIRE, situationHandicap: true });
    expect(await etatColonne()).toBe("a_consigner");
    const candidates = await regleAdaptationReponseNonConsignee(T3);
    expect(candidates.map((c) => c.cibleId)).toEqual([INSCRIPTION]);

    // Réenregistrer la fiche SANS changer la case n'est pas une déclaration.
    vi.setSystemTime(T4);
    await setEnrollmentAdaptationsAction({
      id: INSCRIPTION,
      adaptationsRealisees: "",
      aucuneAdaptationNecessaire: true,
    });
    await updateTraineeAction({ id: STAGIAIRE, situationHandicap: true, fonction: "Cheffe" });
    expect(await etatColonne()).toBe("consignee");
  });

  it("une déclaration faite APRÈS la fin de la session ne rouvre pas son dossier", async () => {
    await etapes1et2();
    vi.setSystemTime(new Date(FIN_SESSION.getTime() + 24 * 60 * 60 * 1000));
    await declarerHandicapAction({ besoin: DETAIL_DE_SANTE });
    await laisserPartir();
    expect(await etatColonne()).toBe("consignee");
  });
});
