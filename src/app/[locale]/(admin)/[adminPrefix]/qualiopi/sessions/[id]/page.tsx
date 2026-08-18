/**
 * Admin — Qualiopi · Hub d&apos;une session de formation (T19 Cluster L2).
 *
 * Affiche l&apos;en-tête de la session (formation, dates, statut, client, financement)
 * + liens vers les sous-pages existantes (émargement / évaluations / financement)
 * + SessionLifecycleButtons pour piloter le cycle de vie.
 *
 * Sections de Vague 2 (E1 stagiaires, E2 documents, E3 questionnaires)
 * sont pré-câblées avec des ancres commentées — NON implémentées ici.
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { PreparationKitSession } from "@/components/admin/qualiopi/PreparationKitSession";
import { lirePreparation } from "@/server/qualiopi/kit-session/preparation";
import { genererSortiesAction, validerSortiesAction } from "@/server/actions/qualiopi/kit-session";
import { SessionLifecycleButtons } from "@/components/admin/qualiopi/SessionLifecycleButtons";
import { EnrollmentsSection } from "@/components/admin/qualiopi/EnrollmentsSection";
import { AssignFormateurForm } from "@/components/admin/qualiopi/AssignFormateurForm";
import { SessionLieuForm } from "@/components/admin/qualiopi/SessionLieuForm";
import { SessionDatesForm } from "@/components/admin/qualiopi/SessionDatesForm";
import { lieuValuesDepuisSession } from "@/components/admin/qualiopi/lieu-values";
import { parisDateISO, parisMinutesDuJour } from "@/server/qualiopi/presence/time";
import { compterJoursHorsPlage } from "@/server/qualiopi/sessions/requalification-dates";
import { InterEntreprisesSection } from "@/components/admin/qualiopi/InterEntreprisesSection";
import { listTrainers, isTrainerHabilite } from "@/server/qualiopi/trainers/trainers";
import { listClients } from "@/server/qualiopi/crm/clients";
import { DocumentsSection } from "@/components/admin/qualiopi/DocumentsSection";
import { DossierSessionButton } from "@/components/admin/qualiopi/DossierSessionButton";
import { SignatureDocument } from "@/components/espace-formateur/SignatureDocument";
import { viserReleveResponsablePedagogiqueAction } from "@/server/actions/qualiopi/releve-signature";
import { lireEtatSignatureReleveConsole } from "@/server/qualiopi/documents/signature/releve-queries";
import { contresignerLettreMissionAction } from "@/server/actions/qualiopi/lettre-mission-signature";
import { lireEtatSignatureLettreMissionConsole } from "@/server/qualiopi/documents/signature/lettre-mission-queries";
import { QuestionnairesSection } from "@/components/admin/qualiopi/QuestionnairesSection";
import { envoyerQuestionnaireAction } from "@/server/actions/qualiopi/questionnaires";
import {
  enrollTraineeAction,
  setEnrollmentStatutAction,
  setEnrollmentAdaptationsAction,
} from "@/server/actions/qualiopi/enrollments";
import {
  genererPortailAccesAction,
  revoquerPortailAccesAction,
} from "@/server/actions/qualiopi/portail";
import {
  genererQuestionnairesSessionAction,
  saisirReponsesQuestionnaireAction,
} from "@/server/actions/qualiopi/satisfaction";
import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { mentionTva } from "@/server/qualiopi/legal/tva";
import {
  PieceSignaturePanel,
  type SignatureApposeeVue,
} from "@/components/admin/qualiopi/PieceSignaturePanel";
import { circuitPour } from "@/server/qualiopi/documents/signature/parties-requises";
import {
  envoyerLienSignatureParEmailAction,
  emettreLienSignatureAction,
} from "@/server/actions/qualiopi/piece-lien-signature";
import { contresignerPieceAction } from "@/server/actions/qualiopi/piece-signature";
import { champsIdentiteManquants } from "@/server/qualiopi/documents/conformite";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import type { TrainingSessionStatut } from "../../../../../../../../prisma/generated/client";
import { AncresHubSession } from "@/features/admin-qualiopi/session-hub/AncresHubSession";
import { ancresVisibles, CLASSE_ANCRE_SECTION } from "@/features/admin-qualiopi/session-hub/ancres";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Session | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_LABELS: Record<TrainingSessionStatut, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
};

const MODALITE_LABELS: Record<string, string> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  hybride: "Hybride",
};

const FINANCEMENT_LABELS: Record<string, string> = {
  direct: "Direct (entreprise)",
  opco: "OPCO",
  cpf: "CPF / EDOF",
  france_travail: "France Travail",
  mixte: "Mixte",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDateFR(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Valeur pour `<input type="datetime-local">`, ancrée sur Europe/Paris.
 *
 * ⚠️ Calculée ICI, côté serveur, et pas dans le composant client : formater une
 * `Date` avec les accesseurs locaux donnerait un résultat différent au rendu
 * serveur et au rendu navigateur dès qu'un poste n'est pas à l'heure de Paris —
 * erreur d'hydratation, et surtout heure fausse affichée dans le champ.
 */
function pourInputDateTimeLocal(d: Date): string {
  const minutes = parisMinutesDuJour(d);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${parisDateISO(d)}T${hh}:${mm}`;
}

function statutColor(s: TrainingSessionStatut): string {
  if (s === "realisee") return "text-[color:var(--color-admin-success)]";
  if (s === "annulee" || s === "reportee") return "text-[color:var(--color-admin-error)]";
  if (s === "en_cours") return "text-[color:var(--color-admin-warning)]";
  return "text-[color:var(--color-admin-fg-muted)]";
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function SessionHubPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const userSession = await auth();
  const role = userSession?.user?.role;
  if (!userSession?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  // État de signature du relevé de connexion, lu APRÈS la garde de rôle.
  // `null` quand la session n'a pas de relevé — cas NORMAL du présentiel.
  const etatReleveConsole = await lireEtatSignatureReleveConsole(id, role);

  // Contreseing de la lettre de mission formateur, même règle de lecture.
  // `null` quand aucune lettre n'a été générée — la section Documents ci-dessous
  // porte le bouton qui la génère.
  const etatLettreConsole = await lireEtatSignatureLettreMissionConsole(id, role);

  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      statut: true,
      modalite: true,
      dateDebut: true,
      dateFin: true,
      dureeReelleHeures: true,
      nbParticipantsPrevus: true,
      nbParticipantsReels: true,
      montantHtCents: true,
      financementType: true,
      formateurPrincipalId: true,
      interEntreprises: true,
      sessionParentId: true,
      sessionReporteeId: true,
      lieuType: true,
      lieuIntitule: true,
      lieuAdresse: true,
      lieuCodePostal: true,
      lieuVille: true,
      lieuSalle: true,
      lieuVisioUrl: true,
      formation: {
        select: {
          id: true,
          titre: true,
          numero: true,
          statut: true,
          statutGeneration: true,
        },
      },
      client: {
        select: {
          id: true,
          raisonSociale: true,
          numero: true,
          // 🔴 Lot 1ter §5 — PARTICULIER ≠ PROFESSIONNEL, et ce n'est pas de
          // l'ergonomie : un particulier signe un CONTRAT L.6353-3, pas une
          // convention L.6353-1. Sans ce champ, l'écran proposait les deux.
          type: true,
        },
      },
      _count: {
        select: { enrollments: true },
      },
    },
  });

  if (!trainingSession) notFound();

  const mentionTvaSession = mentionTva(await getQualiopiConfig("regime_tva"));

  // 🔴 DIVERGENCE PLAGE ↔ JOURNÉES, rendue visible en permanence.
  //
  // Corriger les dates d'une session ne décale PAS les `SessionJour` — décision
  // et ses trois raisons dans `sessions/requalification-dates.ts`. Le prix de
  // cette décision est une divergence possible ; une divergence silencieuse est
  // un piège, donc on la compte à chaque rendu et l'écran la dit.
  const joursDeclaresSession = await prisma.sessionJour.findMany({
    where: { sessionId: id },
    select: { date: true },
  });
  const joursHorsPlageSession = compterJoursHorsPlage({
    // `@db.Date` stocke minuit UTC : `toISOString` redonne le jour civil.
    joursISO: joursDeclaresSession.map((j) => j.date.toISOString().slice(0, 10)),
    debutISO: parisDateISO(trainingSession.dateDebut),
    finISO: parisDateISO(trainingSession.dateFin),
  });

  // 🔴 UI 2026-07-27 — l'écran ne prévenait JAMAIS que les documents sortiraient
  // en SPÉCIMEN. On le découvrait en ouvrant le PDF, une fois généré — ou pas du
  // tout si on l'envoyait au client sans le rouvrir.
  // On l'annonce AVANT de générer, avec la liste exacte de ce qui manque.
  const identiteOf = await getOrganismeIdentite();
  const champsManquantsConvention = champsIdentiteManquants(identiteOf, "convention");

  // ── Formateurs assignables (R9) — habilitation calculée sur la formation ───
  const allTrainers = await listTrainers({ actifOnly: true });
  // Lot 1ter §2 — une lettre de mission suppose DEUX personnes. Le statut
  // `dirigeant` existe dans le registre des formateurs ; on ne devine pas par
  // comparaison de noms, ce qui serait faux au premier homonyme.
  const formateurEstLeDirigeant =
    trainingSession.formateurPrincipalId !== null &&
    allTrainers.some(
      (t) => t.id === trainingSession.formateurPrincipalId && t.statut === "dirigeant",
    );
  const clientType = trainingSession.client?.type ?? null;

  const formateurOptions = allTrainers.map((t) => ({
    id: t.id,
    label: `${t.prenom} ${t.nom}${t.statut === "sous_traitant" ? " (sous-traitant)" : ""}`,
    habilite: isTrainerHabilite(t, trainingSession.formation.id).ok,
  }));

  // ── Inter-entreprises (R-INTER) — clients payeurs sélectionnables ──────────
  const clientsForInter = (await listClients()).map((c) => ({
    id: c.id,
    label: c.raisonSociale,
  }));

  // ── Données des sections (Vague 2) ────────────────────────────────────────
  const [enrollmentsRaw, documentsRaw, traineesRaw] = await Promise.all([
    prisma.enrollment.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        statut: true,
        tauxPresencePct: true,
        adaptationsRealisees: true,
        // Financement par participant (R-INTER)
        financementType: true,
        clientId: true,
        numeroDossierOpco: true,
        edofVerifieAt: true,
        montantHtCents: true,
        trainee: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            portailAcces: {
              where: { revoked: false },
              orderBy: { expiresAt: "desc" },
              take: 1,
              select: { id: true, expiresAt: true, revoked: true },
            },
          },
        },
        questionnaires: {
          select: {
            id: true,
            token: true,
            type: true,
            reponduAt: true,
            // « jamais envoyé » ≠ « envoyé, sans réponse » : la colonne existait
            // et n'était lue nulle part, l'écran ne pouvait pas les distinguer.
            envoyeAt: true,
            noteGlobale: true,
          },
        },
      },
    }),
    prisma.documentGenere.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        numero: true,
        pdfUrl: true,
        createdAt: true,
        // Finitions 2026-08-02 : permet à DocumentsSection de savoir quel
        // stagiaire une pièce individuelle (convocation, certificat…) couvre —
        // le bouton « déjà généré » ne doit s'allumer que pour LE stagiaire
        // sélectionné, pas dès qu'une convocation existe pour n'importe qui.
        traineeId: true,
        // Porte `{ specimen: true, champsManquants: [...] }` quand l'identité de
        // l'OF est incomplète (documents-service), et `{ rectifie: {...} }`
        // quand la pièce en remplace une autre.
        metadata: true,
        // Sort de la pièce : annulée au registre, et/ou remplacée par une
        // rectification. Sans ces trois colonnes, une pièce morte était
        // indiscernable d'une pièce valable — même ligne, même lien.
        annuleeAt: true,
        annuleeMotif: true,
        annuleePar: true,
        remplaceeParNumero: true,
      },
    }),
    prisma.trainee.findMany({
      where: { deletedAt: null },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      select: { id: true, nom: true, prenom: true, email: true },
    }),
  ]);

  // ── Pièces CONTRACTUELLES de la session et leurs signatures ──
  //
  // 🔴 Source de vérité = les lignes `document_signatures`, jamais le statut
  // dérivé porté par la pièce. Afficher le second sans le premier reproduirait
  // le défaut que ce chantier retire partout : une case « signé » sans
  // signataire, sans horodatage et sans empreinte.
  //
  // ⚠️ Filtré par le SSOT : `circuitPour` rend `null` pour une convocation, une
  // attestation ou une facture — ce sont des pièces ÉMISES, pas des engagements
  // négociés. Leur proposer un lien de signature n'aurait aucun sens.
  // 🔴 `annuleeAt === null` — une pièce ANNULÉE ne se signe plus. [2026-08-04]
  //
  // Constaté en production : après annulation de la convention
  // `AXI-DOC-2026-003`, le panneau continuait d'afficher « Envoyer au client »
  // et « Signer pour l'organisme ». On pouvait donc faire signer à la cliente
  // une pièce que l'organisme venait de déclarer sans valeur — et le panneau ne
  // disait même pas qu'elle était annulée.
  const piecesSignables = documentsRaw.filter(
    (d) => circuitPour(d.type) !== null && d.annuleeAt === null,
  );
  const signaturesParPiece = new Map<string, SignatureApposeeVue[]>();
  if (piecesSignables.length > 0) {
    const lignes = await prisma.documentSignature.findMany({
      where: { documentGenereId: { in: piecesSignables.map((d) => d.id) }, revokedAt: null },
      select: {
        id: true,
        documentGenereId: true,
        partie: true,
        signataireNom: true,
        signataireQualite: true,
        signeAt: true,
        selfHash: true,
        methode: true,
      },
      // ⚠️ Même tri que la chaîne (`createdAt`, puis `id`) : trier sur `signeAt`
      // afficherait un ordre pouvant différer de celui du chaînage.
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    for (const l of lignes) {
      const liste = signaturesParPiece.get(l.documentGenereId) ?? [];
      liste.push({
        id: l.id,
        partie: l.partie,
        signataireNom: l.signataireNom,
        signataireQualite: l.signataireQualite,
        signeAtLisible: l.signeAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
        empreinte: l.selfHash,
        methode: l.methode,
      });
      signaturesParPiece.set(l.documentGenereId, liste);
    }
  }

  const enrollmentsSerialized = enrollmentsRaw.map((e) => {
    const acces = e.trainee.portailAcces[0];
    return {
      id: e.id,
      statut: e.statut,
      tauxPresencePct: e.tauxPresencePct,
      adaptationsRealisees: e.adaptationsRealisees,
      trainee: {
        id: e.trainee.id,
        nom: e.trainee.nom,
        prenom: e.trainee.prenom,
        email: e.trainee.email,
      },
      portailAcces: acces
        ? { id: acces.id, expiresAt: acces.expiresAt.toISOString(), revoked: acces.revoked }
        : null,
    };
  });

  // 🔴 UI 2026-07-27 — un document SPÉCIMEN était indiscernable d'une pièce
  // valable dans cette liste.
  //
  // Tant que le SIRET et le NDA ne sont pas renseignés, chaque convention,
  // contrat et facture sort avec un filigrane SPÉCIMEN et un bandeau — mais
  // l'écran affichait un numéro, une date et un lien, exactement comme une pièce
  // opposable. On ne s'en apercevait qu'en ouvrant le PDF, voire jamais si on
  // l'envoyait au client sans le rouvrir.
  const documentsSerialized = documentsRaw.map((d) => {
    const meta = d.metadata as {
      specimen?: boolean;
      champsManquants?: string[];
      rectifie?: { numero?: string; motif?: string };
    } | null;
    return {
      id: d.id,
      type: d.type,
      numero: d.numero,
      pdfUrl: d.pdfUrl,
      createdAt: d.createdAt.toISOString(),
      traineeId: d.traineeId,
      estSpecimen: meta?.specimen === true,
      champsManquants: meta?.champsManquants ?? [],
      annuleeAt: d.annuleeAt ? d.annuleeAt.toISOString() : null,
      annuleeMotif: d.annuleeMotif,
      annuleePar: d.annuleePar,
      remplaceeParNumero: d.remplaceeParNumero,
      rectifieNumero: meta?.rectifie?.numero ?? null,
      rectifieMotif: meta?.rectifie?.motif ?? null,
      // `signaturesParPiece` ne contient que les signatures non révoquées : le
      // registre propose l'exemplaire signé dès qu'une preuve existe, au lieu de
      // le cacher dans le seul panneau de signature.
      aSignatures: (signaturesParPiece.get(d.id) ?? []).length > 0,
    };
  });

  const enrollmentsLight = enrollmentsRaw.map((e) => ({
    id: e.id,
    traineeId: e.trainee.id,
    nomStagiaire: `${e.trainee.prenom} ${e.trainee.nom}`,
  }));

  // Inter-entreprises (R-INTER) : financement par inscription
  const interEnrollments = enrollmentsRaw.map((e) => ({
    id: e.id,
    traineeNom: `${e.trainee.prenom} ${e.trainee.nom}`,
    financementType: e.financementType,
    clientId: e.clientId,
    numeroDossierOpco: e.numeroDossierOpco,
    edofVerifie: e.edofVerifieAt != null,
    montantHtEuros: e.montantHtCents != null ? e.montantHtCents / 100 : null,
  }));

  const questionnairesSerialized = enrollmentsRaw.flatMap((e) =>
    e.questionnaires.map((q) => ({
      id: q.id,
      token: q.token,
      traineeNom: `${e.trainee.prenom} ${e.trainee.nom}`,
      type: q.type,
      reponduAt: q.reponduAt ? q.reponduAt.toISOString() : null,
      envoyeAt: q.envoyeAt ? q.envoyeAt.toISOString() : null,
      noteGlobale: q.noteGlobale,
    })),
  );

  const base = `/${locale}/${adminPrefix}/qualiopi/sessions`;
  const sessionBase = `${base}/${id}`;
  // Ce que la session attend encore de nous. Deduit, jamais coche.
  const preparationKit = await lirePreparation(id);
  const dateValidation = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

  const sectionHeadCls =
    "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";
  const infoLabelCls =
    "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
  const infoValueCls =
    "mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
  const subLinkCls =
    "flex items-center gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-accent)] transition-colors hover:bg-[color:var(--color-admin-surface)]";

  return (
    <AdminPageShell width="wide">
      {/* ── Fil d&apos;Ariane ─────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-4)] flex items-center gap-[var(--space-admin-3)]">
        <Link
          href={base}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Sessions
        </Link>
        {trainingSession.formation && (
          <>
            <span className="text-[color:var(--color-admin-fg-muted)]">/</span>
            <Link
              href={`/${locale}/${adminPrefix}/qualiopi/formations/${trainingSession.formation.id}`}
              className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
            >
              Formation {trainingSession.formation.numero}
            </Link>
          </>
        )}
      </div>

      {champsManquantsConvention.length > 0 && (
        <div
          role="status"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)] p-[var(--space-admin-4)]"
        >
          <p className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-destructive-fg)]">
            Les documents générés sortiront en SPÉCIMEN
          </p>
          <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            L&apos;identité de l&apos;organisme est incomplète :{" "}
            <strong>{champsManquantsConvention.join(", ")}</strong>. Convention, contrat et facture
            porteront un filigrane et ne seront pas opposables — un organisme certificateur les
            refuse. Renseignez ces champs dans <em>Configuration</em>, puis régénérez les pièces
            déjà produites : elles ne se corrigent pas toutes seules.
          </p>
        </div>
      )}

      <AdminPageHeader
        title={trainingSession.titreSession ?? trainingSession.formation.titre}
        description={`Session ${trainingSession.numero} · ${formatDateFR(trainingSession.dateDebut)} → ${formatDateFR(trainingSession.dateFin)}`}
        meta={
          <span
            className={`text-[length:var(--text-admin-sm)] font-semibold ${statutColor(trainingSession.statut as TrainingSessionStatut)}`}
          >
            {STATUT_LABELS[trainingSession.statut as TrainingSessionStatut] ??
              trainingSession.statut}
          </span>
        }
      />

      {/* Sommaire interne : dix sections, aucun moyen d'en atteindre une sans
          tout dérouler. Les ancres conditionnelles ne sont listées que si leur
          section est réellement rendue — un lien mort apprend à ne plus faire
          confiance à la barre. */}
      <AncresHubSession
        ancres={ancresVisibles(
          preparationKit !== null && preparationKit.aPreparer ? ["preparation-kit"] : [],
        )}
      />

      {/* ── En-tête de la session ─────────────────────────────────────────── */}
      <section id="infos" className={`mb-[var(--space-admin-8)] ${CLASSE_ANCRE_SECTION}`}>
        <h2 className={sectionHeadCls}>Informations générales</h2>
        <div className="grid grid-cols-2 gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] sm:grid-cols-4">
          {/* Formation */}
          <div>
            <p className={infoLabelCls}>Formation</p>
            <p className={infoValueCls}>
              <Link
                href={`/${locale}/${adminPrefix}/qualiopi/formations/${trainingSession.formation.id}`}
                className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
              >
                {trainingSession.formation.numero}
              </Link>
            </p>
            <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {trainingSession.formation.titre}
            </p>
          </div>

          {/* Modalité */}
          <div>
            <p className={infoLabelCls}>Modalité</p>
            <p className={infoValueCls}>
              {MODALITE_LABELS[trainingSession.modalite] ?? trainingSession.modalite}
            </p>
          </div>

          {/* Participants */}
          <div>
            <p className={infoLabelCls}>Participants</p>
            <p className={infoValueCls}>
              {trainingSession._count.enrollments} inscrits / {trainingSession.nbParticipantsPrevus}{" "}
              prévus
            </p>
            {trainingSession.nbParticipantsReels !== null && (
              <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {trainingSession.nbParticipantsReels} réels
              </p>
            )}
          </div>

          {/* Montant HT */}
          <div>
            <p className={infoLabelCls}>Montant HT</p>
            <p className={infoValueCls}>
              {(trainingSession.montantHtCents / 100).toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
              })}
            </p>
            {/* Vérification E2E 2026-07-26 — cet écran affirmait « Exonéré TVA »
                en dur, juste sous un Montant HT que le PDF facture à 20 %. La
                mention suit désormais `qualiopi.regime_tva` et disparaît en
                régime assujetti, comme sur les documents. */}
            {mentionTvaSession !== null && (
              <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {mentionTvaSession}
              </p>
            )}
          </div>

          {/* Client */}
          {trainingSession.client !== null && (
            <div>
              <p className={infoLabelCls}>Client</p>
              <p className={infoValueCls}>
                <Link
                  href={`/${locale}/${adminPrefix}/qualiopi/clients`}
                  className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                >
                  {trainingSession.client.numero}
                </Link>
              </p>
              <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {trainingSession.client.raisonSociale}
              </p>
            </div>
          )}

          {/* Financement */}
          <div>
            <p className={infoLabelCls}>Financement</p>
            <p className={infoValueCls}>
              {trainingSession.financementType !== null
                ? (FINANCEMENT_LABELS[trainingSession.financementType] ??
                  trainingSession.financementType)
                : "Non défini"}
            </p>
          </div>

          {/* Durée réelle */}
          {trainingSession.dureeReelleHeures !== null && (
            <div>
              <p className={infoLabelCls}>Durée réelle</p>
              <p className={infoValueCls}>{trainingSession.dureeReelleHeures} h</p>
            </div>
          )}

          {/* Session parente (récurrence) */}
          {trainingSession.sessionParentId !== null && (
            <div>
              <p className={infoLabelCls}>Session parente</p>
              <p className={infoValueCls}>
                <Link
                  href={`${base}/${trainingSession.sessionParentId}`}
                  className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                >
                  Voir la session parente
                </Link>
              </p>
            </div>
          )}

          {/* Session reportée */}
          {trainingSession.sessionReporteeId !== null && (
            <div>
              <p className={infoLabelCls}>Reporte la session</p>
              <p className={infoValueCls}>
                <Link
                  href={`${base}/${trainingSession.sessionReporteeId}`}
                  className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                >
                  Voir la session d&apos;origine
                </Link>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Cycle de vie ─────────────────────────────────────────────────── */}
      <section id="cycle-de-vie" className={`mb-[var(--space-admin-8)] ${CLASSE_ANCRE_SECTION}`}>
        <h2 className={sectionHeadCls}>Cycle de vie</h2>
        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
          <SessionLifecycleButtons
            sessionId={id}
            statut={trainingSession.statut as TrainingSessionStatut}
            baseSessions={base}
          />
        </div>
      </section>

      {/* ── Dates de déroulement ───────────────────────────────────────────
          🔴 Rangé ICI, avec le lieu, et surtout PAS dans « Cycle de vie » : les
          dates sont un ATTRIBUT de la session, le report est un ÉVÉNEMENT qui
          crée une seconde session et laisse la première « Reportée » au
          registre. Voisiner avec les boutons de report ferait choisir le
          marteau-pilon pour une faute de frappe. */}
      <section id="dates" className={`mb-[var(--space-admin-8)] ${CLASSE_ANCRE_SECTION}`}>
        <h2 className={sectionHeadCls}>Dates de déroulement</h2>
        <SessionDatesForm
          sessionId={id}
          initialDateDebut={pourInputDateTimeLocal(trainingSession.dateDebut)}
          initialDateFin={pourInputDateTimeLocal(trainingSession.dateFin)}
          joursHorsPlage={joursHorsPlageSession}
          nbJoursDeclares={joursDeclaresSession.length}
          hrefJournees={`${sessionBase}/emargement`}
        />
      </section>

      {/* ── Lieu de déroulement (convention L.6353-1 · Qualiopi off.9) ────── */}
      <section id="lieu" className={`mb-[var(--space-admin-8)] ${CLASSE_ANCRE_SECTION}`}>
        <h2 className={sectionHeadCls}>Lieu de déroulement</h2>
        <SessionLieuForm sessionId={id} initial={lieuValuesDepuisSession(trainingSession)} />
      </section>

      {/* ── Formateur principal (R9 — assignation bloquée si non habilité) ─── */}
      <section id="formateur" className={`mb-[var(--space-admin-8)] ${CLASSE_ANCRE_SECTION}`}>
        <h2 className={sectionHeadCls}>Formateur principal</h2>
        <AssignFormateurForm
          sessionId={id}
          currentTrainerId={trainingSession.formateurPrincipalId}
          trainers={formateurOptions}
        />
      </section>

      {/* ── Inter-entreprises (R-INTER — financement/facture par participant) ─ */}
      <section
        id="inter-entreprises"
        className={`mb-[var(--space-admin-8)] ${CLASSE_ANCRE_SECTION}`}
      >
        <h2 className={sectionHeadCls}>Inter-entreprises</h2>
        <InterEntreprisesSection
          sessionId={id}
          interEntreprises={trainingSession.interEntreprises}
          enrollments={interEnrollments}
          clients={clientsForInter}
        />
      </section>

      {/* ── Préparation du kit — ce qu'il reste à faire pour cette session ──
          Placé AVANT les sous-pages : c'est le premier geste après une vente,
          et le seul que rien ne rappelait jusqu'ici. */}
      {preparationKit !== null && preparationKit.aPreparer ? (
        <section
          id="preparation-kit"
          className={`mb-[var(--space-admin-8)] ${CLASSE_ANCRE_SECTION}`}
        >
          <PreparationKitSession
            sessionId={id}
            etape={preparationKit.etape}
            aFaire={preparationKit.aFaire}
            nbSorties={preparationKit.nbSorties}
            valideLe={
              preparationKit.valideLe ? dateValidation.format(preparationKit.valideLe) : null
            }
            hrefRelecture={`${sessionBase}/kit`}
            genererAction={genererSortiesAction}
            validerAction={validerSortiesAction}
          />
        </section>
      ) : null}

      {/* ── Navigation vers les sous-pages ──────────────────────────────── */}
      <section id="sous-pages" className={`mb-[var(--space-admin-8)] ${CLASSE_ANCRE_SECTION}`}>
        <h2 className={sectionHeadCls}>Sous-pages</h2>
        <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4">
          <Link href={`${sessionBase}/emargement`} className={subLinkCls}>
            <span>Émargement</span>
          </Link>
          <Link href={`${sessionBase}/evaluations`} className={subLinkCls}>
            <span>Évaluations</span>
          </Link>
          <Link href={`${sessionBase}/financement`} className={subLinkCls}>
            <span>Financement</span>
          </Link>
          {/* Le nécessaire de séance vit au niveau de la FORMATION (kit projeté
              + supports générés) : on y mène depuis la session, là où on
              prépare l'animation. */}
          <Link
            href={`/${locale}/${adminPrefix}/qualiopi/formations/${trainingSession.formation.id}/animer`}
            className={subLinkCls}
          >
            <span>Tout pour animer (formation)</span>
          </Link>
        </div>
      </section>

      {/* SECTION: stagiaires */}
      {/*
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       * VAGUE 2 — Cluster E1 : Inscriptions + accès portail stagiaires
       * Implémenter : EnrollmentsSection (lister / inscrire / changer statut)
       * + GenererPortailAccesButton (+ revoquer) par stagiaire.
       * Câble : enrollTraineeAction, setEnrollmentStatutAction,
       *         genererPortailAccesAction, revoquerPortailAccesAction.
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       */}
      <section id="stagiaires" className={`mb-[var(--space-admin-8)] ${CLASSE_ANCRE_SECTION}`}>
        <h2 className={sectionHeadCls}>Stagiaires</h2>
        <EnrollmentsSection
          sessionId={id}
          enrollments={enrollmentsSerialized}
          availableTrainees={traineesRaw}
          enrollAction={enrollTraineeAction}
          setStatutAction={setEnrollmentStatutAction}
          setAdaptationsAction={setEnrollmentAdaptationsAction}
          genererPortailAction={genererPortailAccesAction}
          revoquerPortailAction={revoquerPortailAccesAction}
        />
      </section>

      {/* SECTION: documents */}
      {/*
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       * VAGUE 2 — Cluster E2 : Documents (14 types)
       * Implémenter : DocumentsSection — boutons appelant generer<X>Action
       * (convention, convocation, emargement, certificat_realisation, etc.)
       * regroupés par catégorie (session / pédagogie / financeurs).
       * Affiche les DocumentGenere existants + lien de téléchargement PDF.
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       */}
      <section id="documents" className={`mb-[var(--space-admin-8)] ${CLASSE_ANCRE_SECTION}`}>
        <h2 className={sectionHeadCls}>Documents</h2>

        {/* Dossier d'audit de la session — REMONTÉ ici (2026-08-05) : le bouton
            n'était monté QUE sur la sous-page émargement, alors que « le dossier
            de cette session » est la demande d'auditeur type ; il doit être
            atteignable depuis la page principale de la session. Mêmes props que
            sur emargement/page.tsx. */}
        <div className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
          <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Un ZIP rangé sous le numéro de cette session : ses documents, sa feuille
            d&apos;émargement, et la vérification d&apos;intégrité de chaque chaîne de signatures.
            C&apos;est ce que vous remettez à un auditeur qui demande « le dossier de cette session
            ».
          </p>
          <DossierSessionButton sessionId={id} />
        </div>

        <DocumentsSection
          sessionId={id}
          enrollments={enrollmentsLight}
          documentsExistants={documentsSerialized}
          // Lot 1ter §2/§5 — ce que ce dossier appelle reellement. Sans lui, les
          // ~20 boutons de generation s affichaient TOUS, sur TOUTES les
          // sessions : Kit OPCO sur un financement direct, Contrat de formation
          // (particulier) sur un client entreprise.
          contexte={{
            financement: trainingSession.financementType,
            typeClient: clientType,
            statut: trainingSession.statut,
            formateurEstLeDirigeant,
          }}
        />

        {/* Signature des pièces CONTRACTUELLES.

            Sans ce bloc, `emettreLienSignatureAction` et `contresignerPieceAction`
            n'étaient appelables par personne : les cinq circuits seraient restés
            du code de signature écrit, testé et inatteignable — le défaut que ce
            chantier a déjà trouvé trois fois. */}
        {piecesSignables.length > 0 && (
          <div className="mt-[var(--space-admin-6)] space-y-[var(--space-admin-4)]">
            <h3 className="text-[length:var(--text-admin-sm)] font-semibold">
              Signature des pièces contractuelles
            </h3>
            {piecesSignables.map((d) => {
              const circuit = circuitPour(d.type)!;
              return (
                <PieceSignaturePanel
                  key={d.id}
                  documentGenereId={d.id}
                  numero={d.numero}
                  pieceLibelle={circuit.libelle}
                  parties={circuit.parties}
                  signatures={signaturesParPiece.get(d.id) ?? []}
                  emettreAction={emettreLienSignatureAction}
                  contresignerAction={contresignerPieceAction}
                  envoyerParEmailAction={envoyerLienSignatureParEmailAction}
                />
              );
            })}
          </div>
        )}

        {/*
          Visa du responsable pédagogique sur le relevé de connexion.

          ⚠️ Rendu SEULEMENT si un relevé existe : une session présentielle n'en
          a pas, et un bloc vide se lirait comme une pièce manquante.

          Le composant est celui de l'espace formateur, RÉUTILISÉ tel quel. Deux
          écrans de signature divergeraient sur ce qu'ils affichent comme signé,
          et l'un finirait par contredire l'autre sur la même pièce.
        */}
        {etatReleveConsole !== null && (
          <div className="mt-[var(--space-admin-6)]">
            <SignatureDocument
              documentGenereId={etatReleveConsole.documentGenereId}
              titrePiece="Relevé de connexion"
              numero={etatReleveConsole.numero}
              parties={etatReleveConsole.parties}
              peutAgir={etatReleveConsole.peutAgir}
              mentions={etatReleveConsole.mentions}
              plafondProbant={etatReleveConsole.plafondProbant}
              libelleBouton="Viser le relevé"
              labelSignature="Visa du responsable pédagogique"
              signerAction={viserReleveResponsablePedagogiqueAction}
            />
          </div>
        )}

        {/*
          Contreseing de la LETTRE DE MISSION FORMATEUR.

          C'est la contrepartie du bouton « Lettre de mission formateur » de la
          section ci-dessus : la pièce s'y génère, elle se contresigne ici. Les
          deux cadres au stylo du §7 du modèle existaient depuis toujours sans
          que rien ne les remplisse.

          ⚠️ Rendu SEULEMENT si une lettre existe : un bloc vide se lirait comme
          une pièce manquante alors qu'elle n'a simplement pas été demandée.

          Le composant est celui de l'espace formateur, RÉUTILISÉ tel quel. Deux
          écrans de signature divergeraient sur ce qu'ils affichent comme signé,
          et l'un finirait par contredire l'autre sur la même pièce.
        */}
        {etatLettreConsole !== null && (
          <div className="mt-[var(--space-admin-6)]">
            {/* Une lettre-CADRE couvrant cette session s'affiche et se
                contresigne ici comme une lettre de session — en le disant. */}
            {etatLettreConsole.estCadre && (
              <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Lettre-cadre {etatLettreConsole.periodeLisible ?? ""} — elle couvre cette session
                parmi d&apos;autres ; une seule signature du formateur vaut pour toutes.
              </p>
            )}
            <SignatureDocument
              documentGenereId={etatLettreConsole.documentGenereId}
              titrePiece={
                etatLettreConsole.estCadre
                  ? "Lettre de mission-cadre"
                  : "Lettre de mission formateur"
              }
              numero={etatLettreConsole.numero}
              parties={etatLettreConsole.parties}
              peutAgir={etatLettreConsole.peutAgir}
              motifBlocage={etatLettreConsole.motifBlocage}
              mentions={etatLettreConsole.mentions}
              plafondProbant={etatLettreConsole.plafondProbant}
              libelleBouton="Contresigner la lettre de mission"
              labelSignature="Signature pour l'organisme de formation"
              signerAction={contresignerLettreMissionAction}
            />
          </div>
        )}
      </section>

      {/* SECTION: questionnaires */}
      {/*
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       * VAGUE 2 — Cluster E3 : Questionnaires de satisfaction
       * Implémenter : QuestionnairesSection — générer les questionnaires
       * (genererQuestionnairesSessionAction) + saisir les réponses
       * (saisirReponsesQuestionnaireAction) par stagiaire.
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       */}
      <section id="questionnaires" className={`mb-[var(--space-admin-8)] ${CLASSE_ANCRE_SECTION}`}>
        <h2 className={sectionHeadCls}>Questionnaires de satisfaction</h2>
        <QuestionnairesSection
          sessionId={id}
          questionnaires={questionnairesSerialized}
          genererAction={genererQuestionnairesSessionAction}
          saisirReponsesAction={saisirReponsesQuestionnaireAction}
          envoyerAction={envoyerQuestionnaireAction}
        />
      </section>
    </AdminPageShell>
  );
}
