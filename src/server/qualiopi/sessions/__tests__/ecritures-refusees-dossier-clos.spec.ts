/**
 * ADR 0060 — CHAQUE ÉCRITURE « VERROU » EST REFUSÉE SUR UN DOSSIER CLOS, SANS
 * RIEN ÉCRIRE ; ET PASSE SUR UN DOSSIER ROUVERT.
 *
 * Le test parcourt `ECRITURES_SESSION` : il ne teste pas une liste recopiée,
 * il teste le registre lui-même. Une action classée `verrou` sans appel qui
 * la déclenche ici fait rougir le premier test — impossible d'ajouter une
 * porte au registre sans prouver qu'elle ferme.
 *
 * Mécanique : Prisma est remplacé par un Proxy qui répond vide aux lectures et
 * CONSIGNE toute écriture (create, update, upsert, delete, $transaction…).
 * L'état du verrou est piloté (`clos` / `rouvert`) ; la résolution de la
 * session est court-circuitée. Sur `clos`, l'action doit rendre le refus et la
 * consigne rester vide ; sur `rouvert`, elle doit dépasser la garde.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const h = vi.hoisted(() => {
  process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
  const ecritures: string[] = [];
  /** Écritures qui doivent ÉCHOUER (la base refuse) — pour prouver l'atomicité. */
  const echecs = new Set<string>();
  const lectures = new Map<string, unknown>();
  const etat: { courant: "clos" | "rouvert" | "a_recueillir" } = { courant: "clos" };
  const ECRIT = /^(create|createMany|update|updateMany|upsert|delete|deleteMany)$/;
  const modeles = new Map<string, unknown>();
  function modele(nom: string): unknown {
    return new Proxy(
      {},
      {
        get(_c, methode) {
          if (typeof methode !== "string" || methode === "then") return undefined;
          return async (...args: unknown[]) => {
            const cle = `${nom}.${methode}`;
            if (ECRIT.test(methode)) {
              if (echecs.has(cle)) throw new Error(`échec simulé : ${cle}`);
              ecritures.push(cle);
              ecrituresDetail.push({ cle, args });
              return { id: "00000000-0000-4000-8000-0000000000ff" };
            }
            if (lectures.has(cle)) return lectures.get(cle);
            if (methode === "findMany" || methode === "groupBy") return [];
            if (methode === "count") return 0;
            if (methode === "aggregate") return { _sum: {}, _count: {} };
            return null;
          };
        },
      },
    );
  }
  const ecrituresDetail: Array<{ cle: string; args: unknown[] }> = [];
  const prisma: Record<string, unknown> = new Proxy(
    {},
    {
      get(_c, nom) {
        if (typeof nom !== "string" || nom === "then") return undefined;
        if (nom === "$transaction") {
          return async (arg: unknown) => {
            ecritures.push("$transaction");
            if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(prisma);
            return Promise.all(arg as unknown[]);
          };
        }
        if (nom === "$executeRaw" || nom === "$executeRawUnsafe") {
          return async () => {
            ecritures.push(nom);
            return 0;
          };
        }
        if (nom === "$queryRaw" || nom === "$queryRawUnsafe") return async () => [];
        if (!modeles.has(nom)) modeles.set(nom, modele(nom));
        return modeles.get(nom);
      },
    },
  );
  const connecte = { role: "super_admin" };
  return { ecritures, ecrituresDetail, echecs, lectures, etat, prisma, connecte };
});

const SESSION = "00000000-0000-4000-8000-000000000001";
const ENROLLMENT = "00000000-0000-4000-8000-000000000002";
const DOCUMENT = "00000000-0000-4000-8000-000000000003";
const CRENEAU = "00000000-0000-4000-8000-000000000004";
const TRAINER = "00000000-0000-4000-8000-000000000005";
const SIGNATURE = "00000000-0000-4000-8000-000000000006";
const QUESTIONNAIRE = "00000000-0000-4000-8000-000000000007";
const INCIDENT = "00000000-0000-4000-8000-000000000008";
const IMPORT = "00000000-0000-4000-8000-000000000009";
const ADMIN = "00000000-0000-4000-8000-00000000000a";

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("next/headers", () => ({
  headers: async () => new Map<string, string>(),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: () => undefined,
  captureMessage: vi.fn(),
  withScope: () => undefined,
  addBreadcrumb: () => undefined,
}));
vi.mock("@/server/actions/knowledge/_guards", () => {
  const s = async () => ({ userId: ADMIN, role: h.connecte.role, email: "dir@axion-ia.test" });
  return {
    requireAdminRead: s,
    requireAdminWrite: s,
    requireAdminPublish: s,
    requireAdminDelete: s,
    requireSuperAdmin: s,
  };
});
vi.mock("@/server/formateur/guard", () => ({
  requireFormateurAction: async () => ({ trainerId: TRAINER, userId: ADMIN }),
  requireFormateur: async () => ({ trainerId: TRAINER, userId: ADMIN }),
}));
vi.mock("@/server/qualiopi/sessions/verrou-dossier", async (importOriginal) => {
  const reel = await importOriginal<typeof import("../verrou-dossier")>();
  const depuis = new Date("2026-09-14T08:00:00Z");
  const etat = () =>
    h.etat.courant === "clos"
      ? ({ etat: "clos", depuis } as const)
      : h.etat.courant === "rouvert"
        ? ({
            etat: "rouvert",
            depuis,
            par: "Direction",
            motif: "Correction d'une coquille",
          } as const)
        : ({ etat: "a_recueillir", manquants: [] } as const);
  return {
    ...reel,
    resoudreSessionId: vi.fn(async () => SESSION),
    chargerEtatVerrou: vi.fn(async () => ({
      statut: "realisee",
      etat: etat(),
      entree: {
        statut: "realisee",
        realiseeLe: depuis,
        inscriptions: [],
        evenements: [],
        maintenant: new Date(),
      },
    })),
    chargerEtatsVerrou: vi.fn(
      async (ids: string[]) => new Map(ids.map((id) => [id, { statut: "realisee", etat: etat() }])),
    ),
  };
});

import { ECRITURES_SESSION, ecrituresDe } from "../verrou-dossier-registre";
import { chargerEtatVerrou } from "../verrou-dossier";
import * as Sentry from "@sentry/nextjs";

type Appel = () => Promise<unknown>;

function formulaire(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

const MOTIF = "Correction d'une erreur de saisie constatée";

/**
 * Comment appeler chaque action classée `verrou`, avec une entrée qui passe sa
 * validation. `prepare` pose les lectures qu'une garde CONDITIONNELLE doit voir
 * pour s'appliquer (une pièce vivante existe déjà, etc.).
 */
const APPELS: Record<string, { appel: Appel; prepare?: () => void }> = {
  setSessionLieuAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/sessions")).setSessionLieuAction({
        id: SESSION,
        lieuVille: "Lyon",
      } as never),
  },
  setSessionDatesAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/sessions")).setSessionDatesAction({
        id: SESSION,
        dateDebut: new Date("2026-09-10"),
        dateFin: new Date("2026-09-11"),
      }),
  },
  setSessionMontantAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/sessions")).setSessionMontantAction({
        id: SESSION,
        montantHtCents: 100000,
      }),
  },
  saveSessionJoursAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/session-jours")).saveSessionJoursAction({
        sessionId: SESSION,
        jours: [{ date: "2026-09-10", heureDebut: "09:00", heureFin: "17:00" }],
      }),
  },
  setSessionInterEntreprisesAction: {
    appel: async () =>
      (
        await import("@/server/actions/qualiopi/inter-entreprises")
      ).setSessionInterEntreprisesAction({ sessionId: SESSION, interEntreprises: true }),
  },
  setEnrollmentFinancementAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/inter-entreprises")).setEnrollmentFinancementAction({
        enrollmentId: ENROLLMENT,
        financementType: "opco",
      }),
  },
  setFinancementSessionAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/financements")).setFinancementSessionAction({
        sessionId: SESSION,
        financementType: "direct",
      }),
  },
  reportSessionAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/sessions-recurrentes")).reportSessionAction({
        sessionId: SESSION,
        nouvelleDateDebut: new Date("2026-10-10"),
        nouvelleDateFin: new Date("2026-10-11"),
        motif: MOTIF,
      } as never),
  },
  assignTrainerToSessionAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/trainers")).assignTrainerToSessionAction({
        sessionId: SESSION,
        trainerId: null,
      }),
  },
  declarerAbsenceFormateurAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/mission-formateur")).declarerAbsenceFormateurAction({
        sessionId: SESSION,
        trainerId: TRAINER,
        fait: "desistement",
      }),
  },
  consignerAccordHorsOutilAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/mission-formateur")).consignerAccordHorsOutilAction({
        sessionId: SESSION,
        trainerId: TRAINER,
        motif: MOTIF,
      }),
  },
  enrollTraineeAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/enrollments")).enrollTraineeAction({
        sessionId: SESSION,
        traineeId: TRAINER,
      }),
  },
  setEnrollmentStatutAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/enrollments")).setEnrollmentStatutAction({
        id: ENROLLMENT,
        statut: "abandon",
        motif: MOTIF,
      }),
  },
  setEnrollmentAdaptationsAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/enrollments")).setEnrollmentAdaptationsAction({
        id: ENROLLMENT,
        adaptationsRealisees: "Salle accessible",
      }),
  },
  updateEnrollmentPresenceAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/enrollments")).updateEnrollmentPresenceAction({
        id: ENROLLMENT,
        tauxPresencePct: 100,
      }),
  },
  saveEmargementAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/presence")).saveEmargementAction({
        sessionId: SESSION,
        entries: [
          { enrollmentId: ENROLLMENT, date: "2026-09-10", demiJournee: "matin", present: true },
        ],
      }),
  },
  setPresenceCreneauManualAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/presence")).setPresenceCreneauManualAction({
        creneauId: CRENEAU,
        present: true,
        dureeRealiseeMinutes: 210,
      }),
  },
  generateSessionCreneauxAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/presence")).generateSessionCreneauxAction({
        sessionId: SESSION,
      }),
  },
  importReleveConnexionAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/presence")).importReleveConnexionAction({
        sessionId: SESSION,
        plateforme: "zoom",
        fileName: "releve.csv",
        content: "nom;duree",
      } as never),
  },
  genererReleveConnexionDocumentAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/presence")).genererReleveConnexionDocumentAction({
        importId: IMPORT,
      }),
  },
  emettreLiensSessionAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/emargement-liens")).emettreLiensSessionAction({
        sessionId: SESSION,
      }),
  },
  envoyerLiensEmargementAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/emargement-liens")).envoyerLiensEmargementAction({
        sessionId: SESSION,
      }),
  },
  revoquerSignatureEmargementAction: {
    appel: async () =>
      (
        await import("@/server/actions/qualiopi/emargement-revocation")
      ).revoquerSignatureEmargementAction({ signatureId: SIGNATURE, motif: MOTIF }),
  },
  revoquerSignatureEmargementFormAction: {
    appel: async () =>
      (
        await import("@/server/actions/qualiopi/emargement-revocation")
      ).revoquerSignatureEmargementFormAction(
        formulaire({
          signatureId: SIGNATURE,
          motif: MOTIF,
          retour: "/fr/admin/qualiopi/mode-auditeur/emargement",
        }),
      ),
  },
  signerPourStagiaireAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/emargement-formateur")).signerPourStagiaireAction({
        sessionId: SESSION,
        creneauId: CRENEAU,
        methode: "confirmation_accessible",
        nomConfirme: "Simone Blanc",
      }),
  },
  createEvaluationAcquisAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/evaluations")).createEvaluationAcquisAction({
        enrollmentId: ENROLLMENT,
        type: "finale",
        dateEvaluation: "2026-09-11",
        competences: [{ libelle: "Objectif 1", note: 3 }],
      }),
  },
  genererAttestationAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/evaluations")).genererAttestationAction({
        enrollmentId: ENROLLMENT,
        force: true,
        rectificationMotif: MOTIF,
      }),
  },
  saisirReponsesQuestionnaireAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/satisfaction")).saisirReponsesQuestionnaireAction({
        questionnaireId: QUESTIONNAIRE,
        reponses: { q1: "oui" },
        noteGlobale: 4,
      }),
  },
  genererQuestionnairesSessionAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/satisfaction")).genererQuestionnairesSessionAction({
        sessionId: SESSION,
      }),
  },
  genererConventionAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererConventionAction({
        sessionId: SESSION,
      }),
  },
  genererConventionTripartiteAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererConventionTripartiteAction({
        sessionId: SESSION,
      }),
  },
  genererContratFormationAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererContratFormationAction({
        enrollmentId: ENROLLMENT,
      }),
  },
  genererConvocationAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererConvocationAction({
        enrollmentId: ENROLLMENT,
      }),
  },
  genererEmargementAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererEmargementAction({
        sessionId: SESSION,
      }),
  },
  genererPositionnementAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererPositionnementAction({
        sessionId: SESSION,
      }),
  },
  genererGrilleEvaluationAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererGrilleEvaluationAction({
        enrollmentId: ENROLLMENT,
      }),
  },
  genererSatisfactionAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererSatisfactionAction({
        sessionId: SESSION,
      }),
  },
  genererLettreMissionAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererLettreMissionAction({
        sessionId: SESSION,
      }),
  },
  genererReglementInterieurAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererReglementInterieurAction({
        sessionId: SESSION,
      }),
  },
  genererProgrammeAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererProgrammeAction({
        sessionId: SESSION,
      }),
  },
  genererOrganisationActionAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererOrganisationActionAction({
        sessionId: SESSION,
      }),
  },
  genererLivretAccueilAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererLivretAccueilAction({
        sessionId: SESSION,
      }),
  },
  genererAutorisationCaptationAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererAutorisationCaptationAction({
        enrollmentId: ENROLLMENT,
      }),
  },
  genererCertificatRealisationAction: {
    prepare: pieceVivanteExiste,
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererCertificatRealisationAction({
        enrollmentId: ENROLLMENT,
        rectificationMotif: MOTIF,
      }),
  },
  genererKitOpcoAction: {
    prepare: pieceVivanteExiste,
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererKitOpcoAction({
        sessionId: SESSION,
      }),
  },
  genererKitCpfAction: {
    prepare: pieceVivanteExiste,
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererKitCpfAction({
        enrollmentId: ENROLLMENT,
      }),
  },
  genererKitFranceTravailAction: {
    prepare: pieceVivanteExiste,
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).genererKitFranceTravailAction({
        enrollmentId: ENROLLMENT,
      }),
  },
  annulerDocumentAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/documents")).annulerDocumentAction({
        documentId: DOCUMENT,
        motif: MOTIF,
      }),
  },
  revoquerSignatureAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/signature-revocation")).revoquerSignatureAction(
        formulaire({
          signatureId: SIGNATURE,
          motif: MOTIF,
          retour: "/fr/admin/qualiopi/mode-auditeur/signatures",
        }),
      ),
  },
  genererSortiesAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/kit-session")).genererSortiesAction({
        sessionId: SESSION,
      }),
  },
  validerSortiesAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/kit-session")).validerSortiesAction({
        sessionId: SESSION,
      }),
  },
  supprimerIncidentAction: {
    appel: async () =>
      (await import("@/server/actions/qualiopi/incidents")).supprimerIncidentAction({
        id: INCIDENT,
      }),
  },
};

/** Une pièce vivante du même type existe déjà : le geste est une RÉGÉNÉRATION. */
function pieceVivanteExiste(): void {
  h.lectures.set("enrollment.findUnique", { sessionId: SESSION, traineeId: TRAINER });
  h.lectures.set("documentGenere.count", 1);
}

/** Exécute l'appel ; une exception (redirection comprise) devient un résultat lisible. */
async function executer(appel: Appel): Promise<string> {
  try {
    const r = await appel();
    return JSON.stringify(r ?? null);
  } catch (err) {
    return `THROW:${err instanceof Error ? err.message : String(err)}`;
  }
}

function estRefusDossierClos(sortie: string): boolean {
  return (
    sortie.includes("DOSSIER_CLOS") ||
    sortie.includes("Dossier clos le") ||
    sortie.includes("dossier_clos")
  );
}

beforeEach(() => {
  h.connecte.role = "super_admin";
  h.ecritures.length = 0;
  h.ecrituresDetail.length = 0;
  h.echecs.clear();
  h.lectures.clear();
  vi.mocked(chargerEtatVerrou).mockClear();
});

describe("ADR 0060 — écritures VERROU sur un dossier clos", () => {
  const verrou = ecrituresDe("verrou");

  it("chaque action classée « verrou » a un appel de test (le registre ne s'étend pas sans preuve)", () => {
    const sansAppel = verrou.map((e) => e.action).filter((a) => !(a in APPELS));
    expect(sansAppel).toEqual([]);
    const enTrop = Object.keys(APPELS).filter((a) => !verrou.some((e) => e.action === a));
    expect(enTrop, "appels de test pour des actions qui ne sont plus « verrou »").toEqual([]);
  });

  it.each(verrou.map((e) => [e.action, e] as const))(
    "%s — dossier CLOS : refus DOSSIER_CLOS et aucune écriture",
    async (action) => {
      h.etat.courant = "clos";
      const cas = APPELS[action];
      if (cas === undefined) throw new Error(`pas d'appel pour ${action}`);
      cas.prepare?.();
      const sortie = await executer(cas.appel);
      expect(estRefusDossierClos(sortie), `${action} a rendu : ${sortie.slice(0, 300)}`).toBe(true);
      expect(h.ecritures, `${action} a écrit malgré le verrou`).toEqual([]);
    },
    30_000,
  );

  it.each(verrou.map((e) => [e.action, e] as const))(
    "%s — dossier ROUVERT : la garde laisse passer",
    async (action) => {
      h.etat.courant = "rouvert";
      const cas = APPELS[action];
      if (cas === undefined) throw new Error(`pas d'appel pour ${action}`);
      cas.prepare?.();
      const sortie = await executer(cas.appel);
      expect(
        estRefusDossierClos(sortie),
        `${action} refusé sur un dossier rouvert : ${sortie.slice(0, 300)}`,
      ).toBe(false);
      // La garde a bien été CONSULTÉE : une action qui ne l'appelle pas passerait
      // aussi ce test, et le premier l'aurait déjà vue.
      expect(vi.mocked(chargerEtatVerrou), action).toHaveBeenCalled();
    },
    30_000,
  );
});

describe("ADR 0060 — écritures OUVERTES et ENTRANTES : jamais bloquées par le verrou", () => {
  const RACINE = join(process.cwd(), "src", "server", "actions", "qualiopi");

  function corps(fichier: string, action: string): string {
    const source = readFileSync(join(RACINE, fichier), "utf-8");
    const debut = source.search(
      new RegExp(`^export\\s+(?:async\\s+)?function\\s+${action}\\b`, "m"),
    );
    if (debut < 0) throw new Error(`${fichier}#${action} introuvable`);
    const suite = source.slice(debut + 10).search(/^export\s+(?:async\s+)?function\s+/m);
    return suite < 0 ? source.slice(debut) : source.slice(debut, debut + 10 + suite);
  }

  it.each(
    ECRITURES_SESSION.filter((e) => e.decision !== "verrou").map((e) => [e.action, e] as const),
  )("%s n'appelle pas la garde du verrou", (_a, e) => {
    expect(corps(e.fichier, e.action)).not.toMatch(/assertDossierOuvert/);
  });

  const OUVERTES: Array<[string, Appel]> = [
    [
      "soumission du questionnaire à froid par le portail",
      async () =>
        (await import("@/server/actions/qualiopi/portail")).soumettreSatisfactionPortailAction({
          questionnaireId: QUESTIONNAIRE,
          reponses: { q1: "oui" },
          noteGlobale: 5,
        } as never),
    ],
    [
      "contreseing restant",
      async () =>
        (await import("@/server/actions/qualiopi/piece-signature")).contresignerPieceAction({
          documentId: DOCUMENT,
        } as never),
    ],
    [
      "facture",
      async () =>
        (await import("@/server/actions/qualiopi/financements")).genererFactureFormationAction({
          sessionId: SESSION,
          destinataire: "entreprise",
          ventilation: "forfait",
        } as never),
    ],
    [
      "acompte",
      async () =>
        (await import("@/server/actions/qualiopi/audit-missions")).setAcompteAction({
          sessionId: SESSION,
          montantEuros: 300,
          recu: true,
        } as never),
    ],
    [
      "traitement d'une demande RGPD",
      async () =>
        (await import("@/server/actions/qualiopi/appreciations")).traiterDemandeRgpdAction({
          id: QUESTIONNAIRE,
          statut: "traitee",
        } as never),
    ],
    [
      "révocation des liens d'émargement",
      async () =>
        (await import("@/server/actions/qualiopi/emargement-liens")).revoquerLiensSessionAction({
          sessionId: SESSION,
        } as never),
    ],
    [
      "première émission du certificat de réalisation",
      async () =>
        (await import("@/server/actions/qualiopi/documents")).genererCertificatRealisationAction({
          enrollmentId: ENROLLMENT,
        }),
    ],
    [
      "première émission de l'attestation",
      async () =>
        (await import("@/server/actions/qualiopi/evaluations")).genererAttestationAction({
          enrollmentId: ENROLLMENT,
        }),
    ],
    [
      "financement : statut OPCO",
      async () =>
        (await import("@/server/actions/qualiopi/financements")).setFinancementSessionAction({
          sessionId: SESSION,
          opcoStatut: "accord_recu",
        } as never),
    ],
  ];

  it.each(OUVERTES)(
    "%s — passe sur un dossier CLOS",
    async (_titre, appel) => {
      h.etat.courant = "clos";
      const sortie = await executer(appel);
      expect(estRefusDossierClos(sortie), sortie.slice(0, 300)).toBe(false);
    },
    30_000,
  );

  it("supprimerStagiaire (droit à l'effacement) ne connaît pas le verrou", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "server", "qualiopi", "portail", "rgpd-service.ts"),
      "utf-8",
    );
    expect(source).not.toMatch(/verrou-dossier|assertDossierOuvert/);
  });
});

describe("interrupteur de secours QUALIOPI_VERROU_DOSSIER=off (revue #1245)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(ecrituresDe("verrou").map((e) => [e.action, e] as const))(
    "%s — dossier CLOS, interrupteur coupé : la garde laisse passer et SIGNALE l'écriture",
    async (action) => {
      vi.stubEnv("QUALIOPI_VERROU_DOSSIER", "off");
      vi.mocked(Sentry.captureMessage).mockClear();
      h.etat.courant = "clos";
      const cas = APPELS[action];
      if (cas === undefined) throw new Error(`pas d'appel pour ${action}`);
      cas.prepare?.();
      const sortie = await executer(cas.appel);
      expect(
        estRefusDossierClos(sortie),
        `${action} refusé malgré l'interrupteur : ${sortie.slice(0, 300)}`,
      ).toBe(false);
      expect(vi.mocked(Sentry.captureMessage), action).toHaveBeenCalledWith(
        expect.stringContaining("verrou coupé"),
        expect.objectContaining({ level: "warning" }),
      );
    },
    30_000,
  );

  it("saisie à la place du stagiaire sur un dossier « à recueillir » : permise quand le verrou est coupé", async () => {
    vi.stubEnv("QUALIOPI_VERROU_DOSSIER", "off");
    h.etat.courant = "a_recueillir";
    const { saisirReponsesQuestionnaireAction } =
      await import("@/server/actions/qualiopi/satisfaction");
    const r = await saisirReponsesQuestionnaireAction({
      questionnaireId: QUESTIONNAIRE,
      reponses: { q1: "oui" },
    });
    expect(JSON.stringify(r)).not.toMatch(/ne se saisissent plus/);
  });
});

describe("ADR 0060 — saisie des réponses par l'organisme (indicateur 30)", () => {
  it("refusée sur un dossier « à recueillir » (session réalisée) : seul le stagiaire répond", async () => {
    h.etat.courant = "a_recueillir";
    const { saisirReponsesQuestionnaireAction } =
      await import("@/server/actions/qualiopi/satisfaction");
    const r = await saisirReponsesQuestionnaireAction({
      questionnaireId: QUESTIONNAIRE,
      reponses: { q1: "oui" },
    });
    expect(JSON.stringify(r)).toMatch(/ne se saisissent plus/);
    expect(h.ecritures).toEqual([]);
  });

  it("autorisée sur un dossier rouvert, elle écrit origine_reponse = organisme", async () => {
    h.etat.courant = "rouvert";
    h.lectures.set("questionnaire.findUnique", {
      id: QUESTIONNAIRE,
      type: "satisfaction_froid",
      reponduAt: null,
      reponses: {},
      enrollment: {
        id: ENROLLMENT,
        traineeId: TRAINER,
        trainee: { prenom: "Simone", nom: "Blanc" },
        session: { clientId: null, titreSession: "Session", dateDebut: new Date("2026-09-10") },
      },
    });
    const { saisirReponsesQuestionnaireAction } =
      await import("@/server/actions/qualiopi/satisfaction");
    await saisirReponsesQuestionnaireAction({
      questionnaireId: QUESTIONNAIRE,
      reponses: { q1: "oui" },
    });
    const maj = h.ecrituresDetail.find((e) => e.cle === "questionnaire.update");
    expect(maj, "le questionnaire n'a pas été écrit").toBeDefined();
    expect((maj?.args[0] as { data: { origineReponse?: string } }).data.origineReponse).toBe(
      "organisme",
    );
  });
});

describe("ADR 0060 (D7) — corrections d'intégrité", () => {
  it("« Regénérer (forcer) » l'attestation sans motif de rectification est refusé", async () => {
    h.etat.courant = "rouvert";
    const { genererAttestationAction } = await import("@/server/actions/qualiopi/evaluations");
    const r = await genererAttestationAction({ enrollmentId: ENROLLMENT, force: true });
    expect(JSON.stringify(r)).toMatch(/rectification/);
    expect(h.ecritures).toEqual([]);
  });

  it("le retour d'une inscription sortie vers un statut actif exige un motif", async () => {
    h.etat.courant = "rouvert";
    h.lectures.set("enrollment.findUnique", {
      statut: "abandon",
      sortieAt: new Date("2026-09-10"),
      sortieMotif: "Maladie",
    });
    const { setEnrollmentStatutAction } = await import("@/server/actions/qualiopi/enrollments");
    const r = await setEnrollmentStatutAction({ id: ENROLLMENT, statut: "presente" });
    expect(JSON.stringify(r)).toMatch(/redevient actif/);
    expect(h.ecritures).toEqual([]);
  });

  it("le retour sortie → actif écrit l'ANCIEN motif de sortie au journal AVANT l'effacement", async () => {
    h.etat.courant = "rouvert";
    h.lectures.set("enrollment.findUnique", {
      statut: "abandon",
      sortieAt: new Date("2026-09-10"),
      sortieMotif: "Maladie",
    });
    const { setEnrollmentStatutAction } = await import("@/server/actions/qualiopi/enrollments");
    await setEnrollmentStatutAction({
      id: ENROLLMENT,
      statut: "presente",
      motif: "Erreur de saisie : la stagiaire était présente",
    });
    const ordre = h.ecrituresDetail.map((e) => e.cle);
    const iJournal = ordre.indexOf("activityLog.create");
    const iEffacement = ordre.indexOf("enrollment.update");
    expect(iJournal).toBeGreaterThanOrEqual(0);
    expect(iEffacement).toBeGreaterThan(iJournal);
    const journal = h.ecrituresDetail[iJournal]?.args[0] as {
      data: { action: string; changes: { avant: { sortieMotif: string } } };
    };
    expect(journal.data.action).toBe("qualiopi.enrollment.retour_de_sortie");
    expect(journal.data.changes.avant.sortieMotif).toBe("Maladie");
  });

  it("annuler une pièce SIGNÉE exige l'habilitation « revoquer_signature »", async () => {
    h.etat.courant = "rouvert";
    h.connecte.role = "responsable_qualite";
    h.lectures.set("documentSignature.count", 1);
    const { annulerDocumentAction } = await import("@/server/actions/qualiopi/documents");
    const r = await annulerDocumentAction({ documentId: DOCUMENT, motif: MOTIF });
    expect(JSON.stringify(r)).toMatch(/signature/);
    expect(JSON.stringify(r)).toMatch(/direction/);
    expect(h.ecritures).toEqual([]);
  });

  it("revoquerSignatureAction (pièces) exige « revoquer_signature »", async () => {
    h.etat.courant = "rouvert";
    h.connecte.role = "secretaire";
    const { revoquerSignatureAction } =
      await import("@/server/actions/qualiopi/signature-revocation");
    const sortie = await executer(() =>
      revoquerSignatureAction(
        formulaire({
          signatureId: SIGNATURE,
          motif: MOTIF,
          retour: "/fr/admin/qualiopi/mode-auditeur/signatures",
        }),
      ),
    );
    expect(sortie).toContain("revocation=role_insuffisant");
    expect(h.ecritures).toEqual([]);
    const source = readFileSync(
      join(process.cwd(), "src", "server", "actions", "qualiopi", "signature-revocation.ts"),
      "utf-8",
    );
    expect(source).not.toMatch(/await requireAdminWrite\(\)/);
  });
});

describe("ADR 0060 — revue de la PR #1245 : contournements et traces", () => {
  const SESSION_OUVERTE = "00000000-0000-4000-8000-0000000000b2";

  it("🔴 saveEmargementAction : une inscription d'une AUTRE session (close) ne passe pas sous la garde d'une session ouverte", async () => {
    // S2 est ouverte (la garde laisse passer) ; l'inscription appartient à S1,
    // close : la base ne la rend donc pas parmi les inscriptions de S2.
    h.etat.courant = "rouvert";
    h.lectures.set("trainingSession.findUnique", {
      id: SESSION_OUVERTE,
      dateDebut: new Date("2026-09-10T07:00:00Z"),
      enrollments: [],
    });
    const { saveEmargementAction } = await import("@/server/actions/qualiopi/presence");
    const r = await saveEmargementAction({
      sessionId: SESSION_OUVERTE,
      entries: [
        { enrollmentId: ENROLLMENT, date: "2026-09-10", demiJournee: "matin", present: false },
      ],
    });
    expect(JSON.stringify(r)).toMatch(/n'appartient pas à cette session/);
    expect(h.ecritures, "aucun créneau, aucun taux, aucun journal").toEqual([]);
  });

  it("saveEmargementAction : les inscriptions de la session gardée s'enregistrent (témoin)", async () => {
    h.etat.courant = "rouvert";
    h.lectures.set("trainingSession.findUnique", {
      id: SESSION,
      dateDebut: new Date("2026-09-10T07:00:00Z"),
      enrollments: [{ id: ENROLLMENT }],
    });
    const { saveEmargementAction } = await import("@/server/actions/qualiopi/presence");
    const r = await saveEmargementAction({
      sessionId: SESSION,
      entries: [
        { enrollmentId: ENROLLMENT, date: "2026-09-10", demiJournee: "matin", present: true },
      ],
    });
    expect(JSON.stringify(r)).not.toMatch(/n'appartient pas/);
    expect(h.ecritures).toContain("presenceCreneau.upsert");
  });

  it("🔴 retour sortie → actif : si la trace de l'ancienne sortie ne s'écrit pas, la sortie n'est PAS effacée", async () => {
    h.etat.courant = "rouvert";
    h.lectures.set("enrollment.findUnique", {
      statut: "abandon",
      sortieAt: new Date("2026-09-10"),
      sortieMotif: "Maladie",
    });
    h.echecs.add("activityLog.create");
    const { setEnrollmentStatutAction } = await import("@/server/actions/qualiopi/enrollments");
    const r = await setEnrollmentStatutAction({
      id: ENROLLMENT,
      statut: "presente",
      motif: "Erreur de saisie : la stagiaire était présente",
    });
    expect(JSON.stringify(r)).toMatch(/error/);
    expect(h.ecritures, "la sortie ne s'efface pas sans sa trace").not.toContain(
      "enrollment.update",
    );
  });

  it("retour sortie → actif : trace et effacement dans la MÊME transaction", async () => {
    h.etat.courant = "rouvert";
    h.lectures.set("enrollment.findUnique", {
      statut: "abandon",
      sortieAt: new Date("2026-09-10"),
      sortieMotif: "Maladie",
    });
    const { setEnrollmentStatutAction } = await import("@/server/actions/qualiopi/enrollments");
    await setEnrollmentStatutAction({
      id: ENROLLMENT,
      statut: "presente",
      motif: "Erreur de saisie : la stagiaire était présente",
    });
    const i = h.ecritures.indexOf("$transaction");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(h.ecritures.slice(i + 1, i + 3)).toEqual(["activityLog.create", "enrollment.update"]);
  });
});
