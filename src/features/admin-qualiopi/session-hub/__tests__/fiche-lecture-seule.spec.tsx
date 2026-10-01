/**
 * 🔴 ADR 0060 — lot L2 : la fiche session en LECTURE SEULE quand le dossier est
 * clos, le bandeau d'état, « Rouvrir le dossier » et « Clore à nouveau ».
 *
 * Le constat de départ (audit UX du 30/09, AXI-SESS-2026-001, Réalisée,
 * attestation émise) : 77 boutons, dont une vingtaine modifiaient encore une
 * PREUVE d'une session terminée — dates, lieu, formateur, inscriptions, grille,
 * régénération des pièces, saisie du questionnaire à froid à la place du
 * stagiaire, annulation d'une convention signée.
 *
 * Ce que ce fichier verrouille :
 *  1. sur un dossier CLOS, aucun geste classé VERROU n'est rendu ;
 *  2. ce qui reste OUVERT (lecture, téléchargements, dossier ZIP, recueil
 *     entrant, contreseings dus, suivi financier) reste rendu ;
 *  3. TÉMOIN : les mêmes composants, dossier ouvert, rendent bien ces gestes —
 *     sans ce témoin, un libellé mal orthographié ferait passer (1) par le vide ;
 *  4. le bandeau dit MOT POUR MOT `texteEtatVerrou(etat)`, la source du ZIP ;
 *  5. « Rouvrir » : invisible sans habilitation, motif ≥ 10 caractères ;
 *  6. « Regénérer (forcer) » ne part jamais sans motif de rectification ;
 *  7. un refus `DOSSIER_CLOS` pendant une course s'affiche, sans écran d'erreur ;
 *  8. le cadre commun (layout) : lien client vers SA fiche, fil d'Ariane unique,
 *     plus aucun en-tête ni retour propre dans les sous-pages.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// ── Modules d'entrée/sortie ─────────────────────────────────────────────────

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const a = vi.hoisted(() => ({
  setSessionDatesAction: vi.fn(),
  genererAttestationAction: vi.fn(),
}));

const { action } = vi.hoisted(() => ({
  action: () => vi.fn(async () => ({ error: "non appelée" })),
}));
vi.mock("@/server/actions/qualiopi/sessions", () => ({
  setSessionDatesAction: (...x: unknown[]) => a.setSessionDatesAction(...x),
  setSessionLieuAction: action(),
  setSessionMontantAction: action(),
}));
vi.mock("@/server/actions/qualiopi/trainers", () => ({ assignTrainerToSessionAction: action() }));
vi.mock("@/server/actions/qualiopi/mission-formateur", () => ({
  consignerAccordHorsOutilAction: action(),
  renvoyerPropositionMissionAction: action(),
  declarerAbsenceFormateurAction: action(),
}));
vi.mock("@/server/actions/qualiopi/inter-entreprises", () => ({
  setSessionInterEntreprisesAction: action(),
  setEnrollmentFinancementAction: action(),
}));
vi.mock("@/server/actions/qualiopi/factures-inter", () => ({
  genererFactureParInscriptionAction: action(),
}));
vi.mock("@/server/actions/qualiopi/documents", () => ({
  genererConventionAction: action(),
  genererProgrammeAction: action(),
  genererOrganisationActionAction: action(),
  genererConventionTripartiteAction: action(),
  genererContratFormationAction: action(),
  genererEmargementAction: action(),
  genererReglementInterieurAction: action(),
  genererLivretAccueilAction: action(),
  genererPositionnementAction: action(),
  genererSatisfactionAction: action(),
  genererKitOpcoAction: action(),
  genererLettreMissionAction: action(),
  genererLettreMissionCadreAction: action(),
  listerSessionsLettreCadreAction: action(),
  genererConvocationAction: action(),
  genererGrilleEvaluationAction: action(),
  genererCertificatRealisationAction: action(),
  genererKitCpfAction: action(),
  genererKitFranceTravailAction: action(),
  genererAutorisationCaptationAction: action(),
  annulerDocumentAction: action(),
  relancerRemiseExemplaireAction: action(),
}));
vi.mock("@/server/actions/qualiopi/evaluations", () => ({
  genererAttestationAction: (...x: unknown[]) => a.genererAttestationAction(...x),
}));
vi.mock("@/server/actions/qualiopi/exports-pdf", () => ({
  genererFicheAdaptationAction: action(),
}));
vi.mock("@/server/actions/qualiopi/financements", () => ({
  setFinancementSessionAction: action(),
  validerAccordOpcoAction: action(),
  genererFactureFormationAction: action(),
  genererFacturePdfAction: action(),
}));
vi.mock("@/server/actions/qualiopi/audit-missions", () => ({ setAcompteAction: action() }));
vi.mock("@/server/actions/qualiopi/conformite", () => ({
  exporterDossierSessionAction: action(),
}));
// `verrou-dossier.ts` porte aussi les chargeurs Prisma : le client n'est jamais
// appelé par les fonctions pures testées ici.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  dateParis,
  messageDossierClos,
  texteEtatVerrou,
  verrouDossierActif,
  type EtatVerrouDossier,
} from "@/server/qualiopi/sessions/verrou-dossier";
import { DossierVerrouProvider } from "../DossierVerrouProvider";
import {
  BandeauVerrouDossier,
  MENTION_VERROU_COUPE,
  TITRE_MANQUES_FIGES,
  type GesteEncorePossible,
} from "../BandeauVerrouDossier";
import { SessionDatesForm } from "@/components/admin/qualiopi/SessionDatesForm";
import { SessionLieuForm } from "@/components/admin/qualiopi/SessionLieuForm";
import { AssignFormateurForm } from "@/components/admin/qualiopi/AssignFormateurForm";
import { MissionFormateurPanel } from "@/components/admin/qualiopi/MissionFormateurPanel";
import { InterEntreprisesSection } from "@/components/admin/qualiopi/InterEntreprisesSection";
import { PreparationKitSession } from "@/components/admin/qualiopi/PreparationKitSession";
import { EnrollmentsSection } from "@/components/admin/qualiopi/EnrollmentsSection";
import { DocumentsSection } from "@/components/admin/qualiopi/DocumentsSection";
import { QuestionnairesSection } from "@/components/admin/qualiopi/QuestionnairesSection";
import { SessionJoursEditor } from "@/components/admin/qualiopi/SessionJoursEditor";
import { LiensEmargement } from "@/components/admin/qualiopi/LiensEmargement";
import { GenererCreneauxButton } from "@/components/admin/qualiopi/GenererCreneauxButton";
import { EmargementGrid } from "@/components/admin/qualiopi/EmargementGrid";
import { ImportReleveForm } from "@/components/admin/qualiopi/ImportReleveForm";
import { EvaluationForm } from "@/components/admin/qualiopi/EvaluationForm";
import { GenererAttestationButton } from "@/components/admin/qualiopi/GenererAttestationButton";
import { SessionMontantForm } from "@/components/admin/qualiopi/SessionMontantForm";
import { SetFinancementForm } from "@/components/admin/qualiopi/SetFinancementForm";
import { PieceSignaturePanel } from "@/components/admin/qualiopi/PieceSignaturePanel";
import { GenererFactureButton } from "@/components/admin/qualiopi/GenererFactureButton";
import { AcompteFormationPanel } from "@/components/admin/qualiopi/AcompteFormationPanel";
import { DossierSessionButton } from "@/components/admin/qualiopi/DossierSessionButton";
import { EmargementGroupe } from "@/components/espace-formateur/EmargementGroupe";

// ── Jeu d'essai : AXI-SESS-2026-001, réalisée, attestation émise ────────────

const SESSION = "11111111-1111-4111-8111-111111111111";
const ENR = "22222222-2222-4222-8222-222222222222";
const TRAINEE = "33333333-3333-4333-8333-333333333333";
const TRAINER = "44444444-4444-4444-8444-444444444444";
const DEPUIS_CLOS = new Date("2026-09-20T10:00:00.000Z");
const CLOS: EtatVerrouDossier = { etat: "clos", depuis: DEPUIS_CLOS };
const ROUVERT: EtatVerrouDossier = {
  etat: "rouvert",
  depuis: new Date("2026-09-30T12:05:00.000Z"),
  par: "Williams Jullin",
  motif: "Taux de présence faux : relevé de connexion reçu après la clôture.",
};

const nop = vi.fn(async () => ({ error: "non appelée" }));

/** Toutes les pièces de la session sont DÉJÀ émises : c'est un dossier clos. */
const TYPES_SESSION = [
  "convention",
  "programme",
  "organisation_action",
  "emargement",
  "reglement_interieur",
  "livret_accueil",
  "positionnement",
  "satisfaction",
] as const;
const TYPES_STAGIAIRE = [
  "convocation",
  "grille_evaluation",
  "certificat_realisation",
  "attestation",
] as const;

function documents() {
  const base = {
    pdfUrl: "https://r2.invalid/x.pdf",
    createdAt: "2026-09-10T10:00:00.000Z",
    annuleeAt: null,
    statutSignature: "non_requise",
  };
  return [
    ...TYPES_SESSION.map((type, i) => ({
      ...base,
      id: `d-s-${i}`,
      type,
      numero: `AXI-DOC-2026-0${10 + i}`,
      traineeId: null,
    })),
    ...TYPES_STAGIAIRE.map((type, i) => ({
      ...base,
      id: `d-t-${i}`,
      type,
      numero: `AXI-DOC-2026-0${30 + i}`,
      traineeId: TRAINEE,
    })),
    // Une convention signée dont l'exemplaire n'est pas encore remis.
    {
      ...base,
      id: "d-signee",
      type: "convention",
      numero: "AXI-DOC-2026-001",
      traineeId: null,
      aSignatures: true,
      statutSignature: "signee",
      exemplaireSigneEnvoyeAt: null,
    },
  ] as never;
}

/** La fiche et ses sous-pages, composants d'écriture compris. */
function Fiche(): React.ReactElement {
  return (
    <>
      <SessionDatesForm
        sessionId={SESSION}
        initialDateDebut="2026-09-15T09:00"
        initialDateFin="2026-09-16T17:00"
        joursHorsPlage={0}
        nbJoursDeclares={2}
        hrefJournees="#"
      />
      <SessionLieuForm
        sessionId={SESSION}
        modalite="presentiel"
        initial={{
          lieuType: "nos_locaux",
          lieuIntitule: "Salle Lumière",
          lieuAdresse: "1 rue de la Paix",
          lieuCodePostal: "69001",
          lieuVille: "Lyon",
          lieuSalle: "",
          lieuVisioUrl: "",
          contactSurPlaceNom: "",
          contactSurPlaceTelephone: "",
          consignesAcces: "",
        }}
      />
      <AssignFormateurForm
        sessionId={SESSION}
        currentTrainerId={TRAINER}
        trainers={[{ id: TRAINER, label: "Marie Curie", habilite: true }]}
      />
      <MissionFormateurPanel
        sessionId={SESSION}
        trainerId={TRAINER}
        trainerNom="Marie Curie"
        etat="sans réponse."
        enAttente={false}
        sessionAVenir={false}
        absencePossible
        accordConsignable
      />
      <InterEntreprisesSection
        sessionId={SESSION}
        interEntreprises
        clients={[{ id: "c1", label: "ACME" }]}
        enrollments={[
          {
            id: ENR,
            traineeNom: "Ada Lovelace",
            financementType: "direct",
            clientId: "c1",
            numeroDossierOpco: null,
            edofVerifie: false,
            montantHtEuros: 100,
          },
        ]}
      />
      <PreparationKitSession
        sessionId={SESSION}
        etape="a_generer"
        aFaire="Produire les sorties de démonstration."
        nbSorties={0}
        valideLe={null}
        hrefRelecture="#"
        genererAction={nop as never}
        validerAction={nop as never}
      />
      <EnrollmentsSection
        sessionId={SESSION}
        debutSession="2026-09-15T07:00:00.000Z"
        enrollments={[
          {
            id: ENR,
            trainee: { id: TRAINEE, nom: "Lovelace", prenom: "Ada", email: "ada@x.invalid" },
            statut: "presente",
            tauxPresencePct: 100,
            adaptationsRealisees: null,
            besoinAdaptationDeclare: true,
            sortieAt: null,
            sortieMotif: null,
            portailAcces: { id: "p1", expiresAt: "2026-12-31T00:00:00.000Z", revoked: false },
          },
        ]}
        availableTrainees={[
          { id: "t-libre", nom: "Hopper", prenom: "Grace", email: "grace@x.invalid" },
        ]}
        enrollAction={nop as never}
        setStatutAction={nop as never}
        setAdaptationsAction={nop as never}
        genererPortailAction={nop as never}
        revoquerPortailAction={nop as never}
      />
      <DocumentsSection
        sessionId={SESSION}
        enrollments={[{ id: ENR, traineeId: TRAINEE, nomStagiaire: "Ada Lovelace" }]}
        documentsExistants={documents()}
        contexte={{ financement: "direct", typeClient: "entreprise", statut: "realisee" }}
      />
      <QuestionnairesSection
        sessionId={SESSION}
        debutSession="2026-09-15T07:00:00.000Z"
        questionnaires={[
          {
            id: "q-froid",
            traineeNom: "Ada Lovelace",
            type: "satisfaction_froid",
            reponduAt: null,
            envoyeAt: "2026-09-20T08:00:00.000Z",
            noteGlobale: null,
            positionnement: null,
            precisionSurFicheStagiaire: false,
          },
        ]}
        genererAction={nop as never}
        saisirReponsesAction={nop as never}
        envoyerAction={nop as never}
      />
      <SessionJoursEditor
        sessionId={SESSION}
        hasCreneaux
        joursInitiaux={[
          { date: "2026-09-15", heureDebut: "09:00", heureFin: "17:00", horairesConfirmes: true },
        ]}
        saveAction={nop as never}
      />
      <LiensEmargement
        sessionId={SESSION}
        hasCreneaux
        emettreAction={nop as never}
        revoquerAction={nop as never}
        envoyerAction={nop as never}
      />
      <GenererCreneauxButton sessionId={SESSION} hasCreneaux genererAction={nop as never} />
      <EmargementGrid
        sessionId={SESSION}
        seuilCompletePct={100}
        enrollments={[
          {
            id: ENR,
            traineeId: TRAINEE,
            nom: "Lovelace",
            prenom: "Ada",
            email: "ada@x.invalid",
            tauxPresencePct: 100,
          },
        ]}
        creneaux={[
          {
            id: "c-1",
            enrollmentId: ENR,
            date: "2026-09-15",
            demiJournee: "matin",
            libelle: "15/09 matin",
            dureePrevueMinutes: 210,
            dureeRealiseeMinutes: 210,
            present: true,
          },
        ]}
        saveAction={nop as never}
      />
      <ImportReleveForm
        sessionId={SESSION}
        importAction={nop as never}
        genererReleveAction={nop as never}
      />
      <EvaluationForm
        enrollmentId={ENR}
        objectifsPedagogiques={["Rédiger une consigne"]}
        createAction={nop as never}
      />
      <GenererAttestationButton
        enrollmentId={ENR}
        dejaGeneree
        genererAction={(x) => a.genererAttestationAction(x)}
      />
      <SessionMontantForm
        sessionId={SESSION}
        initialMontantHtCents={10000}
        piecesFinancieres={1}
        hrefDocuments="#"
      />
      <SetFinancementForm
        sessionId={SESSION}
        financementType="opco"
        opcoStatut="demande_en_cours"
        opcoSubrogation={false}
        numeroDossierOpco="2026-ATLAS-1"
        ftDispositif={null}
        cpfPayeurResteCharge={null}
        conventionTripartiteSigneeAt={null}
        ftPoeiOffreEmploiNumero={null}
        ftPoeiAccordFinancementAt={null}
        ftPoeiEngagementSigneAt={null}
      />
      <PieceSignaturePanel
        documentGenereId="d-signable"
        numero="AXI-DOC-2026-002"
        pieceLibelle="Convention de formation"
        parties={["client", "axionia"]}
        signatures={[]}
        emettreAction={nop as never}
        contresignerAction={nop as never}
        envoyerParEmailAction={nop as never}
        revoquerLiensAction={nop as never}
      />
      <GenererFactureButton sessionId={SESSION} />
      <AcompteFormationPanel
        sessionId={SESSION}
        montantCents={null}
        dateVersement=""
        recu={false}
        moyen=""
      />
      <DossierSessionButton sessionId={SESSION} />
    </>
  );
}

function rendreFiche(etat: "clos" | "rouvert" | "en_cours") {
  return render(
    <DossierVerrouProvider fige={etat === "clos"} etat={etat}>
      <Fiche />
    </DossierVerrouProvider>,
  );
}

const texte = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
function boutons(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll("button")];
}
function boutonsActifs(container: HTMLElement, motif: RegExp): HTMLButtonElement[] {
  return boutons(container).filter((b) => !b.disabled && motif.test(texte(b)));
}
function presents(container: HTMLElement, motif: RegExp): Element[] {
  return [...container.querySelectorAll("button, a")].filter((b) => motif.test(texte(b)));
}

/** Les gestes VERROU nommés par la spécification du lot L2. */
const INTERDITS: ReadonlyArray<readonly [string, RegExp]> = [
  ["Modifier les dates", /^Modifier les dates$/],
  ["Enregistrer le lieu et la modalité", /^Enregistrer le lieu et la modalité$/],
  ["Assigner", /^Assigner$/],
  ["Retirer", /^Retirer/],
  ["Déclarer une absence", /^Déclarer une absence$/],
  ["Consigner l'accord", /^Consigner l.accord/],
  ["Inscrire", /^Inscrire$/],
  ["Enregistrer la sortie", /^Enregistrer la sortie$/],
  ["Aucune adaptation nécessaire", /^Aucune adaptation nécessaire/],
  ["Enregistrer l'émargement", /^Enregistrer l'émargement$/],
  ["Enregistrer / Confirmer les journées", /^(Enregistrer|Confirmer) (les|ces) journées$/],
  ["Générer / Régénérer les créneaux", /^(Générer|Régénérer) les créneaux$/],
  ["Émettre les liens", /^(Émettre les liens|Réémettre)$/],
  ["Envoyer les liens par e-mail", /^Envoyer les liens par e-mail$/],
  ["Importer le relevé", /^Importer le relevé$/],
  ["Enregistrer l'évaluation", /^Enregistrer l'évaluation$/],
  ["Regénérer (forcer)", /^Regénérer \(forcer\)$/],
  ["Saisir les réponses", /^Saisir les réponses$/],
  ["Générer les questionnaires", /^Générer les questionnaires de la session$/],
  ["Annuler cette pièce", /^Annuler cette pièce$/],
  ["Produire les sorties", /^Produire les sorties$/],
  ["Enregistrer (financement de l'inscrit)", /^Enregistrer$/],
  ["Modifier le montant HT", /^Modifier le montant HT$/],
  // Tous les `generer*` de DocumentsSection, pièces de session et par stagiaire.
  ["Convention de formation", /^Convention de formation/],
  ["Programme de l'action", /^Programme de l'action/],
  ["Organisation de l'action", /^Organisation de l'action/],
  ["Feuille d'émargement", /^Feuille d'émargement/],
  ["Règlement intérieur", /^Règlement intérieur/],
  ["Livret d'accueil", /^Livret d'accueil/],
  ["Questionnaire de positionnement", /^Questionnaire de positionnement/],
  ["Questionnaire de satisfaction", /^Questionnaire de satisfaction/],
  ["Convocation", /^Convocation/],
  ["Grille d'évaluation", /^Grille d'évaluation/],
  ["Certificat de réalisation", /^Certificat de réalisation/],
  ["Attestation de réalisation", /^Attestation de réalisation/],
];

/** Ce qui reste possible sur un dossier clos (spécification L2). */
const OUVERTS: ReadonlyArray<readonly [string, RegExp]> = [
  ["Dossier d'audit ZIP", /^Dossier d'audit de la session$/],
  ["Ouvrir", /^Ouvrir$/],
  ["Enregistrer (téléchargement)", /^Enregistrer$/],
  ["Exemplaire signé", /^Exemplaire signé$/],
  ["Relancer la remise", /^Relancer la remise$/],
  ["Renvoyer le lien (questionnaire à froid)", /^Renvoyer le lien$/],
  ["Générer un accès portail", /^Générer un accès portail$/],
  ["Révoquer l'accès", /^Révoquer l.accès$/],
  ["Couper les liens en circulation", /^Couper les liens en circulation$/],
  ["Révoquer tous les liens", /^Révoquer tous les liens$/],
  ["Signer pour l'organisme", /^Signer pour l'organisme$/],
  ["Générer la facture", /^Générer la facture$/],
  ["Générer facture (par inscrit)", /^Générer facture$/],
  ["Enregistrer l'acompte", /^Enregistrer l'acompte$/],
  ["Marquer accord OPCO reçu", /^Marquer accord OPCO reçu$/],
];

beforeEach(() => {
  refresh.mockReset();
  a.setSessionDatesAction.mockReset();
  a.genererAttestationAction.mockReset();
});
afterEach(cleanup);

// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 dossier CLOS — aucun geste VERROU n'est rendu actif", () => {
  it.each(INTERDITS)("« %s » n'est pas proposé", (_nom, motif) => {
    const { container } = rendreFiche("clos");
    const trouves = presents(container, motif).filter(
      // Les liens « Enregistrer » du registre des pièces TÉLÉCHARGENT : ce sont
      // des <a>, pas des gestes d'écriture. Seul le bouton est interdit.
      (el) => el.tagName === "BUTTON" && !(el as HTMLButtonElement).disabled,
    );
    expect(trouves.map(texte)).toEqual([]);
  });

  it("le type de financement est figé, le n° de dossier OPCO reste modifiable", () => {
    rendreFiche("clos");
    expect((screen.getByLabelText("Type de financement") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Numéro de dossier OPCO") as HTMLInputElement).disabled).toBe(
      false,
    );
  });

  it("les formulaires deviennent des RÉSUMÉS en lecture : les valeurs restent lisibles", () => {
    const { container } = rendreFiche("clos");
    const t = texte(container);
    expect(t).toContain("15/09/2026 à 09:00");
    expect(t).toContain("1 rue de la Paix, 69001 Lyon");
    expect(t).toContain("Marie Curie");
    expect(t).toContain("Présent · 210 min");
    expect(container.querySelectorAll("[data-dossier-clos]").length).toBeGreaterThan(0);
  });
});

describe("🟢 dossier CLOS — ce qui reste ouvert reste rendu", () => {
  it.each(OUVERTS)("« %s » reste disponible", (_nom, motif) => {
    const { container } = rendreFiche("clos");
    const trouves = presents(container, motif).filter(
      (el) => el.tagName === "A" || !(el as HTMLButtonElement).disabled,
    );
    expect(trouves.length).toBeGreaterThan(0);
  });

  it("la première émission d'un certificat reste offerte (financeur qui la réclame tard)", () => {
    const docs = (documents() as unknown as Array<{ type: string }>).filter(
      (d) => d.type !== "certificat_realisation",
    );
    const { container } = render(
      <DossierVerrouProvider fige etat="clos">
        <DocumentsSection
          sessionId={SESSION}
          enrollments={[{ id: ENR, traineeId: TRAINEE, nomStagiaire: "Ada Lovelace" }]}
          documentsExistants={docs as never}
          contexte={{ financement: "direct", typeClient: "entreprise", statut: "realisee" }}
        />
      </DossierVerrouProvider>,
    );
    expect(boutonsActifs(container, /^Certificat de réalisation/)).toHaveLength(1);
    // …mais aucune autre génération.
    expect(boutonsActifs(container, /^Convocation/)).toHaveLength(0);
  });
});

describe("TÉMOIN — dossier ouvert : les mêmes gestes SONT rendus", () => {
  // Sans ce témoin, un libellé mal recopié ferait passer le test des interdits
  // par le vide : « introuvable » et « masqué » ont la même sortie.
  const RENDUS_SANS_INTERACTION = INTERDITS.filter(([nom]) => nom !== "Enregistrer la sortie");
  it.each(RENDUS_SANS_INTERACTION)("« %s » est rendu", (_nom, motif) => {
    const { container } = rendreFiche("en_cours");
    const rendus = presents(container, motif).filter((el) => el.tagName === "BUTTON");
    expect(rendus.length).toBeGreaterThan(0);
  });

  it("le dossier clos rend nettement moins de contrôles actifs que le dossier ouvert", () => {
    // Le grief d'origine : « des boutons de partout ». Compté sur le même jeu.
    const actifs = (etat: "clos" | "en_cours") => {
      const { container, unmount } = rendreFiche(etat);
      const n = [...container.querySelectorAll("button, input, select, textarea")].filter(
        (el) => !(el as HTMLButtonElement).disabled,
      ).length;
      unmount();
      return n;
    };
    const ouvert = actifs("en_cours");
    const clos = actifs("clos");
    expect(clos).toBeLessThan(ouvert / 2);
  });

  it("après réouverture (état `rouvert`), les formulaires redeviennent éditables", () => {
    const { container } = rendreFiche("rouvert");
    expect(boutonsActifs(container, /^Assigner$/)).toHaveLength(1);
    expect(presents(container, /^Modifier les dates$/)).toHaveLength(1);
    expect(presents(container, /^Enregistrer l'émargement$/)).toHaveLength(1);
    expect(container.querySelectorAll("[data-dossier-clos]")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("le bandeau dit MOT POUR MOT ce que dit le dossier d'audit", () => {
  function bandeau(etat: EtatVerrouDossier, peutRouvrir = true) {
    return render(
      <BandeauVerrouDossier
        sessionId={SESSION}
        etat={etat}
        peutRouvrir={peutRouvrir}
        motifSansHabilitation="Rouvrir un dossier est réservé à la direction."
        encorePossible={[{ libelle: "1 questionnaire à froid en attente", href: "#q" }]}
        rouvrirAction={nop as never}
        reverrouillerAction={nop as never}
      />,
    );
  }

  it.each<[string, EtatVerrouDossier]>([
    ["clos", CLOS],
    ["rouvert", ROUVERT],
    [
      "a_recueillir",
      {
        etat: "a_recueillir",
        manquants: [
          { enrollmentId: ENR, stagiaire: "Ada Lovelace", raison: "attestation_absente" },
        ],
      },
    ],
  ])("état %s : texte STRICTEMENT égal à texteEtatVerrou(etat)", (_n, etat) => {
    const { container } = bandeau(etat);
    const p = container.querySelector("[data-texte-verrou]");
    expect(p?.textContent).toBe(texteEtatVerrou(etat));
  });

  it("clos : titre daté, encart « Encore possible », bouton « Rouvrir le dossier »", () => {
    bandeau(CLOS);
    expect(
      screen.getByText(`Dossier clôturé le ${dateParis(DEPUIS_CLOS)} — lecture seule`),
    ).toBeTruthy();
    expect(screen.getByText("Encore possible")).toBeTruthy();
    expect(screen.getByRole("link", { name: "1 questionnaire à froid en attente" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rouvrir le dossier" })).toBeTruthy();
  });

  it("rien à dire en préparation ni en cours : pas de bandeau", () => {
    expect(bandeau({ etat: "en_cours" }).container).toBeEmptyDOMElement();
  });
});

describe("🔴 QUAL-FIL-01 — un dossier clos incomplet ne se lit pas « complet »", () => {
  function bandeauClos(manquesFiges: string[], encorePossible: GesteEncorePossible[] = []) {
    return render(
      <BandeauVerrouDossier
        sessionId={SESSION}
        etat={CLOS}
        peutRouvrir
        motifSansHabilitation=""
        encorePossible={encorePossible}
        manquesFiges={manquesFiges}
        verrouActif
        rouvrirAction={nop as never}
        reverrouillerAction={nop as never}
      />,
    );
  }

  it("les étapes dues bloquées par le verrou sont listées sous « Manques figés »", () => {
    const { container } = bandeauClos(["Évaluation finale", "Satisfaction à chaud (2/3)"]);
    expect(screen.getByText(TITRE_MANQUES_FIGES)).toBeTruthy();
    const liste = container.querySelector("[data-manques-figes] ul");
    expect([...(liste?.querySelectorAll("li") ?? [])].map(texte)).toEqual([
      "Évaluation finale",
      "Satisfaction à chaud (2/3)",
    ]);
    // Plus de « Rien n'est en attente » : ce serait laisser croire le dossier complet.
    expect(texte(container)).not.toContain("Rien n'est en attente");
    expect(texte(container)).toContain("Aucun autre geste sans rouvrir le dossier.");
  });

  it("dossier clos complet : pas de liste de manques figés", () => {
    const { container } = bandeauClos([]);
    expect(container.querySelector("[data-manques-figes]")).toBeNull();
    expect(texte(container)).toContain("Rien n'est en attente.");
  });
});

describe("🔴 QUAL-VERROU-07 — l'interrupteur de secours se voit sur le bandeau", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function bandeauServeur() {
    // Comme le layout : l'information est lue CÔTÉ SERVEUR par `verrouDossierActif()`.
    return render(
      <BandeauVerrouDossier
        sessionId={SESSION}
        etat={CLOS}
        peutRouvrir
        motifSansHabilitation=""
        encorePossible={[]}
        manquesFiges={["Évaluation finale"]}
        verrouActif={verrouDossierActif()}
        rouvrirAction={nop as never}
        reverrouillerAction={nop as never}
      />,
    );
  }

  it("QUALIOPI_VERROU_DOSSIER=off : l'état reste « clos », le bandeau dit que le verrou est coupé", () => {
    vi.stubEnv("QUALIOPI_VERROU_DOSSIER", "off");
    const { container } = bandeauServeur();
    expect(container.querySelector("[data-etat-verrou]")?.getAttribute("data-etat-verrou")).toBe(
      "clos",
    );
    expect(screen.getByText(`Dossier clôturé le ${dateParis(DEPUIS_CLOS)}`)).toBeTruthy();
    expect(texte(container)).not.toContain("lecture seule");
    expect(screen.getByRole("status").textContent).toBe(
      "Verrou coupé par l'interrupteur de secours : les modifications sont possibles et ne sont pas inscrites au dossier.",
    );
    expect(MENTION_VERROU_COUPE).toBe(screen.getByRole("status").textContent);
  });

  it("sans la variable (défaut) : « lecture seule », aucune mention de l'interrupteur", () => {
    vi.stubEnv("QUALIOPI_VERROU_DOSSIER", "");
    const { container } = bandeauServeur();
    expect(texte(container)).toContain("— lecture seule");
    expect(container.querySelector("[data-verrou-coupe]")).toBeNull();
  });

  it("prop omise : le bandeau lit lui-même l'interrupteur, jamais « lecture seule » à tort", () => {
    vi.stubEnv("QUALIOPI_VERROU_DOSSIER", "OFF");
    const { container } = render(
      <BandeauVerrouDossier
        sessionId={SESSION}
        etat={CLOS}
        peutRouvrir={false}
        motifSansHabilitation=""
        encorePossible={[]}
        rouvrirAction={nop as never}
        reverrouillerAction={nop as never}
      />,
    );
    expect(texte(container)).not.toContain("lecture seule");
    expect(container.querySelector("[data-verrou-coupe]")).not.toBeNull();
  });
});

describe("Rouvrir le dossier", () => {
  it("INVISIBLE sans l'habilitation `rouvrir_dossier` — un texte dit à qui s'adresser", () => {
    render(
      <BandeauVerrouDossier
        sessionId={SESSION}
        etat={CLOS}
        peutRouvrir={false}
        motifSansHabilitation="Rouvrir un dossier est réservé à la direction."
        encorePossible={[]}
        rouvrirAction={nop as never}
        reverrouillerAction={nop as never}
      />,
    );
    expect(screen.queryByRole("button", { name: /Rouvrir/ })).toBeNull();
    expect(screen.getByText(/Adressez-vous à la direction/)).toBeTruthy();
  });

  it("le bouton de validation reste désactivé tant que le motif fait moins de 10 caractères ou que le mot de passe est vide", async () => {
    const rouvrir = vi.fn(async () => ({
      data: { sessionId: SESSION, depuis: "2026-09-30T12:05:00.000Z" },
    }));
    render(
      <BandeauVerrouDossier
        sessionId={SESSION}
        etat={CLOS}
        peutRouvrir
        motifSansHabilitation=""
        encorePossible={[]}
        rouvrirAction={rouvrir}
        reverrouillerAction={nop as never}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Rouvrir le dossier" }));
    const valider = screen.getByRole("button", { name: "Rouvrir avec ce motif" });
    const champ = screen.getByLabelText("Motif de la réouverture (obligatoire)");
    expect((valider as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(champ, { target: { value: "  123456789  " } });
    expect(screen.getByText("9 / 10 caractères au minimum")).toBeTruthy();
    expect((valider as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(champ, { target: { value: "Relevé tardif" } });
    // Motif valide, mot de passe vide : toujours désactivé.
    expect((valider as HTMLButtonElement).disabled).toBe(true);
    const mdp = screen.getByLabelText("Mot de passe de sécurité (obligatoire)") as HTMLInputElement;
    expect(mdp.type).toBe("password");
    fireEvent.change(mdp, { target: { value: "secret-de-test" } });
    expect((valider as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(valider);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(rouvrir).toHaveBeenCalledWith({
      sessionId: SESSION,
      motif: "Relevé tardif",
      motDePasse: "secret-de-test",
    });
  });

  it("mot de passe refusé : le refus du serveur s'affiche, le champ se vide, le dossier reste clos", async () => {
    const refus = "Mot de passe de sécurité incorrect. Le dossier reste clos.";
    const rouvrir = vi.fn(async () => ({ error: refus }));
    render(
      <BandeauVerrouDossier
        sessionId={SESSION}
        etat={CLOS}
        peutRouvrir
        motifSansHabilitation=""
        encorePossible={[]}
        rouvrirAction={rouvrir}
        reverrouillerAction={nop as never}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Rouvrir le dossier" }));
    fireEvent.change(screen.getByLabelText("Motif de la réouverture (obligatoire)"), {
      target: { value: "Relevé tardif" },
    });
    const mdp = screen.getByLabelText("Mot de passe de sécurité (obligatoire)") as HTMLInputElement;
    fireEvent.change(mdp, { target: { value: "mauvais" } });
    fireEvent.click(screen.getByRole("button", { name: "Rouvrir avec ce motif" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(refus));
    expect(mdp.value).toBe("");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rouvert : bandeau « Rouvert le … par … : motif » et « Clore à nouveau » qui dit ce qui manque", async () => {
    const manque =
      "Le dossier ne peut pas être clos : 1 élément manque — Ada Lovelace — attestation à émettre.";
    const clore = vi.fn(async () => ({ error: manque }));
    const { container } = render(
      <BandeauVerrouDossier
        sessionId={SESSION}
        etat={ROUVERT}
        peutRouvrir
        motifSansHabilitation=""
        encorePossible={[]}
        rouvrirAction={nop as never}
        reverrouillerAction={clore}
      />,
    );
    const t = texte(container);
    expect(t).toContain("Williams Jullin");
    expect(t).toContain("relevé de connexion reçu après la clôture");
    fireEvent.click(screen.getByRole("button", { name: "Clore à nouveau" }));
    expect((await screen.findByRole("alert")).textContent).toBe(manque);
    expect(clore).toHaveBeenCalledWith({ sessionId: SESSION });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("« Regénérer (forcer) » ne part JAMAIS sans motif de rectification (D7)", () => {
  function rendre(dejaGeneree = true) {
    return render(
      <GenererAttestationButton
        enrollmentId={ENR}
        dejaGeneree={dejaGeneree}
        genererAction={(x) => a.genererAttestationAction(x)}
      />,
    );
  }

  it("le clic OUVRE le motif ; rien ne part avant 10 caractères", async () => {
    a.genererAttestationAction.mockResolvedValue({
      data: { resultat: "complete", documentId: "d-new" },
    });
    rendre();
    fireEvent.click(screen.getByRole("button", { name: "Regénérer (forcer)" }));
    expect(a.genererAttestationAction).not.toHaveBeenCalled();
    const confirmer = screen.getByRole("button", { name: "Regénérer avec ce motif" });
    expect((confirmer as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Motif de la rectification/), {
      target: { value: "Taux corrigé après import du relevé" },
    });
    fireEvent.click(confirmer);
    await waitFor(() => expect(a.genererAttestationAction).toHaveBeenCalledTimes(1));
    expect(a.genererAttestationAction).toHaveBeenCalledWith({
      enrollmentId: ENR,
      force: true,
      rectificationMotif: "Taux corrigé après import du relevé",
    });
  });

  it("aucun appel ne porte `force` sans `rectificationMotif`", async () => {
    a.genererAttestationAction.mockResolvedValue({
      error: "Preuves manquantes : évaluation finale. Vous pouvez attester en écrivant pourquoi.",
    });
    rendre(false);
    fireEvent.click(screen.getByRole("button", { name: "Générer l'attestation" }));
    await screen.findByRole("alert");
    // La soupape d'une PREMIÈRE émission n'est pas une régénération.
    const champ = await screen.findByLabelText(/Pourquoi attester malgré ces manques/);
    fireEvent.change(champ, { target: { value: "Évaluation papier archivée au dossier client." } });
    fireEvent.click(screen.getByRole("button", { name: "Attester en assumant les manques" }));
    await waitFor(() => expect(a.genererAttestationAction).toHaveBeenCalledTimes(2));
    for (const [appel] of a.genererAttestationAction.mock.calls as Array<[{ force?: boolean }]>) {
      if (appel.force === true) expect(appel).toHaveProperty("rectificationMotif");
    }
    expect(a.genererAttestationAction.mock.calls[1]![0]).not.toHaveProperty("force");
  });
});

describe("un refus DOSSIER_CLOS pendant une course s'affiche, sans écran d'erreur", () => {
  it("le message du serveur est rendu tel quel", async () => {
    const message = messageDossierClos(new Date("2026-09-20T10:00:00.000Z"));
    a.setSessionDatesAction.mockResolvedValue({
      ok: false,
      code: "DOSSIER_CLOS",
      message,
      error: message,
    });
    render(
      <SessionDatesForm
        sessionId={SESSION}
        initialDateDebut="2026-09-15T09:00"
        initialDateFin="2026-09-16T17:00"
        joursHorsPlage={0}
        nbJoursDeclares={2}
        hrefJournees="#"
      />,
    );
    fireEvent.change(screen.getByLabelText("Date et heure de fin"), {
      target: { value: "2026-09-16T18:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Modifier les dates" }));
    expect((await screen.findByRole("alert")).textContent).toBe(message);
  });
});

describe("écran formateur : « Faire signer » un stagiaire est masqué sur un dossier clos", () => {
  const demi = [
    {
      cle: "k1",
      date: "2026-09-15",
      demiJournee: "matin" as const,
      jourLisible: "15 septembre",
      demiJourneeLisible: "matin",
      horaires: "9 h – 12 h 30",
      formateurNom: "Marie Curie",
      commencee: true,
      contresigneeParMoi: false,
      mentions: [],
      mentionsContresignature: [],
      lignes: [
        {
          creneauId: "c-1",
          stagiaireNom: "Ada Lovelace",
          statut: "presente",
          etat: "signable" as const,
        },
      ],
    },
  ];

  it("le message remplace le bouton ; la contresignature reste", () => {
    const { container } = render(
      <EmargementGroupe
        sessionId={SESSION}
        demiJournees={demi}
        signerAction={nop as never}
        contresignerAction={nop as never}
        signaturePourStagiaireFermee="Le dossier de cette session est clos."
      />,
    );
    expect(presents(container, /^Faire signer$/)).toHaveLength(0);
    expect(screen.getByText("Le dossier de cette session est clos.")).toBeTruthy();
    expect(texte(container)).toContain("Non signé");
  });

  it("la page formateur transmet l'état du verrou", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/[locale]/espace-formateur/sessions/[id]/page.tsx"),
      "utf8",
    );
    expect(src).toContain("chargerEtatVerrou(id)");
    expect(src).toContain("signaturePourStagiaireFermee={signaturePourStagiaireFermee}");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("cadre commun : un seul en-tête, un seul fil d'Ariane", () => {
  const DOSSIER = "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]";
  const lire = (f: string) => readFileSync(join(process.cwd(), DOSSIER, f), "utf8");
  const sansCommentaires = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

  it("le layout porte le bandeau, le Provider et le lien vers la FICHE du client", () => {
    const layout = sansCommentaires(lire("layout.tsx"));
    expect(layout).toContain("<BandeauVerrouDossier");
    expect(layout).toContain("<DossierVerrouProvider");
    // Lecture mémoïsée (`cache`) : la fiche la relit sans seconde requête.
    expect(layout).toContain("lireEtatVerrouFiche(id)");
    expect(layout).toContain("href={`${base}/clients/${session.client.id}`}");
  });

  it.each([
    "page.tsx",
    "emargement/page.tsx",
    "evaluations/page.tsx",
    "financement/page.tsx",
    "kit/page.tsx",
  ])("%s n'a plus d'en-tête ni de retour propre", (f) => {
    const src = sansCommentaires(lire(f));
    expect(src).not.toContain("<AdminPageHeader");
    expect(src).not.toContain("<AdminPageShell");
    expect(src).not.toMatch(/Retour à (la session|l&apos;émargement)/);
    expect(src).not.toContain("← Sessions");
  });

  it("le lien Client de la fiche mène à la fiche du client, plus à la liste", () => {
    const src = sansCommentaires(lire("page.tsx"));
    expect(src).toContain("qualiopi/clients/${trainingSession.client.id}");
    expect(src).not.toMatch(/qualiopi\/clients`\}/);
  });
});
