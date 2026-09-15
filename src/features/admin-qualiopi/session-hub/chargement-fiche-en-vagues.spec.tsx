/**
 * 🔴 La fiche session charge ses données EN VAGUES, jamais en cascade.
 *
 * ## Le défaut (mesuré le 2026-09-15)
 *
 * La page enchaînait **quatorze attentes successives** avant de rendre quoi que
 * ce soit : relevé, lettre de mission, session, régime de TVA, journées,
 * identité de l'organisme, mission, formateurs, clients, puis inscriptions et
 * pièces, signatures, circuit d'adaptation, précisions chiffrées, préparation
 * et échéances. Aucune de ces lectures n'attendait réellement la précédente,
 * sauf quatre qui ont besoin d'un résultat de la première vague.
 *
 * Chaque attente coûte un aller-retour complet vers la base. La page entière
 * est une seule frontière de chargement (`sessions/loading.tsx`) : tant que la
 * dernière lecture n'est pas revenue, AUCUN bouton de la fiche n'est
 * interactif — et chaque `router.refresh()` d'après clic rejoue la cascade.
 *
 * ## Ce que ce test mesure
 *
 * Il appelle la VRAIE page, lectures simulées. Chaque lecture ne rend sa
 * valeur qu'au tour suivant de la boucle d'événements, comme une requête. Une
 * « vague » est l'ensemble des lectures lancées avant qu'une précédente ne
 * revienne : en cascade, il y a autant de vagues que d'attentes ; en
 * parallèle, les lectures indépendantes partagent la même.
 *
 * Constaté avant correctif sur ce même test : **14 vagues**. Après : **2**.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Instrumentation des lectures ────────────────────────────────────────────

const journal: { nom: string; finsAuLancement: number }[] = [];
let fins = 0;
let ordreGarde = -1;

function lecture<T>(nom: string, valeur: () => T) {
  return vi.fn(async (..._args: unknown[]) => {
    journal.push({ nom, finsAuLancement: fins });
    await new Promise((r) => setTimeout(r, 0));
    fins += 1;
    return valeur();
  });
}

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TRAINER_ID = "22222222-2222-4222-8222-222222222222";
const TRAINEE_ID = "33333333-3333-4333-8333-333333333333";

let sessionTrouvee = true;

function sessionFixture() {
  return {
    id: SESSION_ID,
    numero: "AXI-SESS-TEST",
    titreSession: "Session de test",
    statut: "planifiee",
    modalite: "presentiel",
    dateDebut: new Date("2026-10-01T07:00:00.000Z"),
    dateFin: new Date("2026-10-02T15:00:00.000Z"),
    dureeReelleHeures: null,
    nbParticipantsPrevus: 4,
    nbParticipantsReels: null,
    montantHtCents: 120000,
    financementType: "direct",
    formateurPrincipalId: TRAINER_ID,
    interEntreprises: false,
    sessionParentId: null,
    sessionReporteeId: null,
    lieuType: null,
    lieuIntitule: null,
    lieuAdresse: null,
    lieuCodePostal: null,
    lieuVille: null,
    lieuSalle: null,
    lieuVisioUrl: null,
    contactSurPlaceNom: null,
    contactSurPlaceTelephone: null,
    consignesAcces: null,
    formation: {
      id: "f1",
      titre: "Formation",
      numero: "AXI-FORM-1",
      statut: "publiee",
      statutGeneration: null,
    },
    client: { id: "c1", raisonSociale: "Client", numero: "AXI-CLI-1", type: "entreprise" },
    _count: { enrollments: 1 },
  };
}

const m = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof vi.fn>>);

function installer() {
  m.releve = lecture("releve", () => null);
  m.lettre = lecture("lettre", () => null);
  m.session = lecture("session", () => (sessionTrouvee ? sessionFixture() : null));
  m.config = lecture("config", () => "assujetti");
  m.jours = lecture("jours", () => []);
  m.identite = lecture("identite", () => ({
    raisonSociale: "OF",
    nda: "11",
    qualiopi: "Q",
    siret: "12345678900011",
    adresseSiege: "a",
    adresseExercice: "a",
    email: "e@x.invalid",
    telephone: "0",
    site: "s",
  }));
  m.mission = lecture("mission", () => null);
  m.formateurs = lecture("formateurs", () => [
    { id: TRAINER_ID, prenom: "A", nom: "B", statut: "interne", formationIdsHabilites: ["f1"] },
  ]);
  m.clients = lecture("clients", () => []);
  m.inscriptions = lecture("inscriptions", () => [
    {
      id: "e1",
      statut: "planifiee",
      tauxPresencePct: null,
      adaptationsRealisees: null,
      sortieAt: null,
      sortieMotif: null,
      financementType: null,
      clientId: null,
      numeroDossierOpco: null,
      edofVerifieAt: null,
      montantHtCents: null,
      trainee: {
        id: TRAINEE_ID,
        nom: "N",
        prenom: "P",
        email: "p@x.invalid",
        situationHandicap: false,
        portailAcces: [],
      },
      questionnaires: [],
    },
  ]);
  m.pieces = lecture("pieces", () => [
    {
      id: "d1",
      type: "convention",
      numero: "AXI-DOC-1",
      pdfUrl: null,
      createdAt: new Date(),
      traineeId: null,
      metadata: null,
      annuleeAt: null,
      annuleeMotif: null,
      annuleePar: null,
      remplaceeParNumero: null,
      statutSignature: "en_attente",
      exemplaireSigneEnvoyeAt: null,
    },
  ]);
  m.stagiaires = lecture("stagiaires", () => []);
  m.compteStagiaires = lecture("compteStagiaires", () => 0);
  m.signatures = lecture("signatures", () => []);
  m.circuit = lecture("circuit", () => new Map());
  m.precisions = lecture("precisions", () => new Set());
  m.preparation = lecture("preparation", () => null);
  m.echeances = lecture("echeances", () => ({ parSession: new Map() }));
  m.garde = vi.fn(async () => {
    ordreGarde = journal.length;
    return { autorise: true, role: "super_admin", peutEcrire: true };
  });
}
installer();

// ── Modules d'entrée/sortie : simulés ───────────────────────────────────────

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
}));
vi.mock("@/server/auth/garde-page", () => ({ gardePage: (...a: unknown[]) => m.garde!(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: (...a: unknown[]) => m.session!(...a) },
    sessionJour: { findMany: (...a: unknown[]) => m.jours!(...a) },
    enrollment: { findMany: (...a: unknown[]) => m.inscriptions!(...a) },
    documentGenere: { findMany: (...a: unknown[]) => m.pieces!(...a) },
    documentSignature: { findMany: (...a: unknown[]) => m.signatures!(...a) },
  },
}));
vi.mock("@/server/qualiopi/documents/signature/releve-queries", () => ({
  lireEtatSignatureReleveConsole: (...a: unknown[]) => m.releve!(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/lettre-mission-queries", () => ({
  lireEtatSignatureLettreMissionConsole: (...a: unknown[]) => m.lettre!(...a),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: (...a: unknown[]) => m.config!(...a),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: (...a: unknown[]) => m.identite!(...a),
}));
vi.mock("@/server/qualiopi/trainers/mission-formateur", () => ({
  lireMissionCourante: (...a: unknown[]) => m.mission!(...a),
  LIBELLE_STATUT_MISSION: {},
}));
vi.mock("@/server/qualiopi/trainers/trainers", () => ({
  listTrainers: (...a: unknown[]) => m.formateurs!(...a),
  isTrainerHabilite: () => ({ ok: true }),
}));
vi.mock("@/server/qualiopi/crm/clients", () => ({
  listClients: (...a: unknown[]) => m.clients!(...a),
}));
vi.mock("@/server/qualiopi/trainees/trainees", () => ({
  listTrainees: (...a: unknown[]) => m.stagiaires!(...a),
  countTrainees: (...a: unknown[]) => m.compteStagiaires!(...a),
}));
vi.mock("@/server/qualiopi/adaptation/journal-consignation", () => ({
  lireCircuitAdaptation: (...a: unknown[]) => m.circuit!(...a),
}));
vi.mock("@/server/qualiopi/positionnement/precision-chiffree", () => ({
  stagiairesAvecPrecisionChiffree: (...a: unknown[]) => m.precisions!(...a),
}));
vi.mock("@/server/qualiopi/kit-session/preparation", () => ({
  lirePreparation: (...a: unknown[]) => m.preparation!(...a),
}));
vi.mock("@/server/qualiopi/parcours/echeances-service", () => ({
  prochainesEcheances: (...a: unknown[]) => m.echeances!(...a),
}));

// ── Server Actions et composants : jamais exécutés par ce rendu ─────────────

const action = () => ({});
vi.mock("@/server/actions/qualiopi/kit-session", () => ({
  genererSortiesAction: action,
  validerSortiesAction: action,
}));
vi.mock("@/server/actions/qualiopi/releve-signature", () => ({
  viserReleveResponsablePedagogiqueAction: action,
}));
vi.mock("@/server/actions/qualiopi/lettre-mission-signature", () => ({
  contresignerLettreMissionAction: action,
}));
vi.mock("@/server/actions/qualiopi/questionnaires", () => ({ envoyerQuestionnaireAction: action }));
vi.mock("@/server/actions/qualiopi/enrollments", () => ({
  enrollTraineeAction: action,
  setEnrollmentStatutAction: action,
  setEnrollmentAdaptationsAction: action,
}));
vi.mock("@/server/actions/qualiopi/portail", () => ({
  genererPortailAccesAction: action,
  revoquerPortailAccesAction: action,
}));
vi.mock("@/server/actions/qualiopi/satisfaction", () => ({
  genererQuestionnairesSessionAction: action,
  saisirReponsesQuestionnaireAction: action,
}));
vi.mock("@/server/actions/qualiopi/piece-lien-signature", () => ({
  envoyerLienSignatureParEmailAction: action,
  emettreLienSignatureAction: action,
  revoquerLiensSignatureAction: action,
}));
vi.mock("@/server/actions/qualiopi/piece-signature", () => ({ contresignerPieceAction: action }));

const Composant = () => null;
vi.mock("@/components/admin/ui/AdminPageShell", () => ({ AdminPageShell: Composant }));
vi.mock("@/components/admin/ui/AdminPageHeader", () => ({ AdminPageHeader: Composant }));
vi.mock("@/components/admin/ui/AccesRefuse", () => ({ AccesRefuse: Composant }));
vi.mock("@/components/admin/qualiopi/PreparationKitSession", () => ({
  PreparationKitSession: Composant,
}));
vi.mock("@/components/admin/qualiopi/SessionLifecycleButtons", () => ({
  SessionLifecycleButtons: Composant,
}));
vi.mock("@/components/admin/qualiopi/EnrollmentsSection", () => ({
  EnrollmentsSection: Composant,
}));
vi.mock("@/components/admin/qualiopi/AssignFormateurForm", () => ({
  AssignFormateurForm: Composant,
}));
vi.mock("@/components/admin/qualiopi/MissionFormateurPanel", () => ({
  MissionFormateurPanel: Composant,
}));
vi.mock("@/components/admin/qualiopi/SessionLieuForm", () => ({ SessionLieuForm: Composant }));
vi.mock("@/components/admin/qualiopi/SessionDatesForm", () => ({ SessionDatesForm: Composant }));
vi.mock("@/components/admin/qualiopi/InterEntreprisesSection", () => ({
  InterEntreprisesSection: Composant,
}));
vi.mock("@/components/admin/qualiopi/DocumentsSection", () => ({ DocumentsSection: Composant }));
vi.mock("@/components/admin/qualiopi/DossierSessionButton", () => ({
  DossierSessionButton: Composant,
}));
vi.mock("@/components/espace-formateur/SignatureDocument", () => ({
  SignatureDocument: Composant,
}));
vi.mock("@/components/admin/qualiopi/QuestionnairesSection", () => ({
  QuestionnairesSection: Composant,
}));
vi.mock("@/components/admin/qualiopi/PieceSignaturePanel", () => ({
  PieceSignaturePanel: Composant,
}));
vi.mock("@/features/admin-qualiopi/session-hub/AncresHubSession", () => ({
  AncresHubSession: Composant,
}));
vi.mock("@/features/admin-qualiopi/session-hub/ChecklistSession", () => ({
  ChecklistSession: Composant,
}));

const LECTURES = [
  "releve",
  "lettre",
  "session",
  "config",
  "jours",
  "identite",
  "mission",
  "formateurs",
  "clients",
  "inscriptions",
  "pieces",
  "stagiaires",
  "compteStagiaires",
  "signatures",
  "circuit",
  "precisions",
  "preparation",
  "echeances",
] as const;

async function rendre() {
  const { default: SessionHubPage } =
    await import("@/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page");
  return SessionHubPage({
    params: Promise.resolve({ locale: "fr", adminPrefix: "admin", id: SESSION_ID }),
    searchParams: Promise.resolve({}),
  });
}

beforeEach(() => {
  journal.length = 0;
  fins = 0;
  ordreGarde = -1;
  sessionTrouvee = true;
  installer();
});

describe("🔴 la fiche session charge ses données en vagues", () => {
  it("témoin — chaque lecture de la page est bien lancée, une seule fois", async () => {
    await rendre();
    // Sans ce témoin, une lecture retirée par mégarde rendrait le décompte des
    // vagues ci-dessous plus petit, donc « meilleur », en silence.
    for (const nom of LECTURES) {
      expect(
        journal.filter((j) => j.nom === nom),
        `la lecture « ${nom} » n'est plus lancée`,
      ).toHaveLength(1);
    }
  });

  it("la garde de rôle précède TOUTE lecture", async () => {
    await rendre();
    expect(ordreGarde).toBe(0);
  });

  it("au plus deux vagues : les lectures indépendantes partent ensemble", async () => {
    await rendre();
    const vagues = new Set(journal.map((j) => j.finsAuLancement));
    expect(
      vagues.size,
      `la page attend ${vagues.size} fois la base avant de rendre ; ordre : ` +
        journal.map((j) => `${j.nom}@${j.finsAuLancement}`).join(", "),
    ).toBeLessThanOrEqual(2);
  });

  it("la seconde vague ne porte QUE les lectures qui dépendent de la première", async () => {
    await rendre();
    const premiere = Math.min(...journal.map((j) => j.finsAuLancement));
    const seconde = journal
      .filter((j) => j.finsAuLancement !== premiere)
      .map((j) => j.nom)
      .sort();
    // mission ← formateur principal de la session ; signatures ← pièces ;
    // circuit et précisions ← inscriptions.
    expect(seconde).toEqual(["circuit", "mission", "precisions", "signatures"]);
  });

  it("une session introuvable rend toujours « introuvable »", async () => {
    sessionTrouvee = false;
    await expect(rendre()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
