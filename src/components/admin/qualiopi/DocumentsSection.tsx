"use client";
// use-client: sélecteur de stagiaire + useTransition pour chaque action de génération + affichage messages d'état.

/**
 * DocumentsSection — Vague 2, Cluster E2.
 *
 * Regroupe tous les boutons de génération documentaire de la session :
 *   - Session     : convention, convention_tripartite, emargement,
 *                   reglement_interieur, livret_accueil, positionnement,
 *                   satisfaction, kit_opco, lettre_mission.
 *   - Par stagiaire : convocation, grille_evaluation, certificat_realisation,
 *                     kit_cpf, kit_france_travail  (+ attestation via genererAttestationAction).
 *   - Financier   : facture (via GenererFactureButton).
 *
 * Affiche la liste des DocumentGenere existants avec numéro, type, date et
 * lien de téléchargement (pdfUrl).
 *
 * router.refresh() après chaque génération.
 * Zéro hex — tokens admin uniquement.
 * exactOptionalPropertyTypes : spread conditionnel.
 * Apostrophes JSX échappées (&apos;).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  genererConventionAction,
  genererProgrammeAction,
  genererConventionTripartiteAction,
  genererContratFormationAction,
  genererEmargementAction,
  genererReglementInterieurAction,
  genererLivretAccueilAction,
  genererPositionnementAction,
  genererSatisfactionAction,
  genererKitOpcoAction,
  genererLettreMissionAction,
  genererConvocationAction,
  genererGrilleEvaluationAction,
  genererCertificatRealisationAction,
  genererKitCpfAction,
  genererKitFranceTravailAction,
} from "@/server/actions/qualiopi/documents";
import { genererAttestationAction } from "@/server/actions/qualiopi/evaluations";
import { genererFicheAdaptationAction } from "@/server/actions/qualiopi/exports-pdf";
import { GenererFactureButton } from "@/components/admin/qualiopi/GenererFactureButton";
import { PdfExportButton } from "@/components/admin/qualiopi/PdfExportButton";
import type { DocumentType } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

/** Stagiaire minimal pour le sélecteur (un enrollment = 1 stagiaire dans la session). */
export interface EnrollmentInfo {
  id: string;
  nomStagiaire: string;
}

/** DocumentGenere sérialisé (dates converties en string côté serveur). */
export interface DocumentGenereInfo {
  id: string;
  type: DocumentType;
  numero: string;
  pdfUrl: string | null;
  createdAt: string;
  /**
   * Le PDF porte un filigrane SPÉCIMEN : l'identité de l'OF était incomplète au
   * moment de la génération. La pièce n'est PAS opposable.
   */
  estSpecimen?: boolean;
  /** Champs d'identité manquants — dit quoi renseigner pour régénérer. */
  champsManquants?: string[];
}

export interface DocumentsSectionProps {
  sessionId: string;
  enrollments: EnrollmentInfo[];
  documentsExistants: DocumentGenereInfo[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

const DOC_LABELS: Record<DocumentType, string> = {
  cv_formateur: "Fiche formateur (ind. 21)",
  convention: "Convention de formation (L.6353-1)",
  programme: "Programme de l'action (annexe convention)",
  convention_tripartite: "Convention tripartite (OPCO)",
  contrat: "Contrat de formation (L.6353-3, particulier)",
  convocation: "Convocation",
  emargement: "Feuille d'émargement",
  releve_connexion: "Relevé de connexion",
  positionnement: "Questionnaire de positionnement",
  grille_evaluation: "Grille d'évaluation",
  satisfaction: "Questionnaire de satisfaction",
  attestation: "Attestation de réalisation",
  attestation_partielle: "Attestation partielle",
  certificat_realisation: "Certificat de réalisation (R.6313-3)",
  facture: "Facture",
  devis: "Devis",
  avoir: "Avoir",
  kit_opco: "Kit OPCO",
  kit_cpf: "Kit CPF / EDOF",
  kit_france_travail: "Kit France Travail",
  lettre_mission: "Lettre de mission formateur",
  reglement_interieur: "Règlement intérieur (L.6352-3)",
  livret_accueil: "Livret d'accueil stagiaire",
  protocole_afest: "Protocole individuel AFEST (D.6313-3-1)",
  inventaire_moyens: "Inventaire des moyens pédagogiques",
  contrat_sous_traitance: "Contrat de sous-traitance (indicateur 27)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : bouton générique session-level
// ─────────────────────────────────────────────────────────────────────────────

interface SessionDocButtonProps {
  label: string;
  action: (input: {
    sessionId: string;
  }) => Promise<{ data: { documentId: string; numero: string } } | { error: string }>;
  sessionId: string;
  onDone: (numero: string) => void;
}

function SessionDocButton({
  label,
  action,
  sessionId,
  onDone,
}: SessionDocButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await action({ sessionId });
      if ("error" in result) {
        setError(result.error);
      } else {
        const msg = `${label} — n° ${result.data.numero} généré.`;
        setSuccess(msg);
        onDone(result.data.numero);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-1)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="admin-button"
        aria-label={`Générer : ${label}`}
      >
        {isPending ? "Génération…" : label}
      </button>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          {success}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : convention (seul document de session paramétrable)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La convention porte une CLAUSE que les autres documents n'ont pas : l'acompte.
 * Le gabarit l'acceptait depuis le 2026-07-27 mais aucun écran ne le
 * transmettait — toute convention sortait à 30 %, y compris régularisée après
 * la tenue de l'action, où « acompte à la signature » n'a plus d'objet.
 *
 * Champ vide = 30 % (usage commercial, comportement historique). `0` = payable
 * en totalité à réception de facture. Pas de plafond B2B (cf. gabarit) — le
 * plafond L.6353-6 ne concerne que le contrat B2C, qui a son propre calcul.
 */
function ConventionDocButton({
  sessionId,
  onDone,
}: {
  sessionId: string;
  onDone: (numero: string) => void;
}): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [acompte, setAcompte] = useState("");

  function handleClick() {
    setError(null);
    setSuccess(null);
    // Validation locale AVANT l'action : « 150 » renverrait un « Données
    // invalides » générique — dire la borne ici, devant le champ fautif.
    let acomptePercent: number | undefined;
    if (acompte.trim() !== "") {
      const n = Number(acompte);
      if (!Number.isInteger(n) || n < 0 || n > 100) {
        setError("Acompte : entier entre 0 et 100 (vide = 30 %).");
        return;
      }
      acomptePercent = n;
    }
    startTransition(async () => {
      const result = await genererConventionAction({
        sessionId,
        ...(acomptePercent !== undefined ? { acomptePercent } : {}),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        const msg = `Convention de formation — n° ${result.data.numero} généré.`;
        setSuccess(msg);
        onDone(result.data.numero);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-1)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="admin-button"
        aria-label="Générer : Convention de formation"
      >
        {isPending ? "Génération…" : "Convention de formation"}
      </button>
      <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        <span>Acompte (%)</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={acompte}
          onChange={(e) => setAcompte(e.target.value)}
          disabled={isPending}
          placeholder="30"
          aria-label="Acompte à la signature en pourcentage (vide = 30, 0 = payable en totalité)"
          className="w-16 rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[2px] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)] focus:ring-1 focus:ring-[color:var(--color-admin-accent)] focus:outline-none"
        />
        <span>0 = totalité à réception de facture</span>
      </label>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          {success}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : bouton générique enrollment-level
// ─────────────────────────────────────────────────────────────────────────────

interface EnrollmentDocButtonProps {
  label: string;
  action: (input: { enrollmentId: string }) => Promise<
    // `avertissement` : le document EST produit, mais il lui manque une mention
    // que le logiciel ne peut pas fabriquer seul (cf. médiation de la
    // consommation sur le contrat individuel). Distinct d'une erreur — le
    // travail a abouti — mais ça ne doit pas se perdre dans un message vert.
    | { data: { documentId: string; numero: string; avertissement?: string | undefined } }
    | { data: { resultat: "complete" | "partielle" | "aucune"; documentId: string | null } }
    | { error: string }
  >;
  enrollmentId: string;
  onDone: (msg: string) => void;
}

function EnrollmentDocButton({
  label,
  action,
  enrollmentId,
  onDone,
}: EnrollmentDocButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setSuccess(null);
    setWarning(null);
    startTransition(async () => {
      const result = await action({ enrollmentId });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      let msg: string;
      if ("numero" in result.data) {
        msg = `${label} — n° ${result.data.numero} généré.`;
        // Affiché à part, en ambre, et NON fondu dans le message de succès :
        // une réserve noyée dans une confirmation verte ne se lit pas.
        if ("avertissement" in result.data && result.data.avertissement) {
          setWarning(result.data.avertissement);
        }
      } else {
        // attestation : resultat = complete | partielle | aucune
        const r = result.data as { resultat: string; documentId: string | null };
        msg = `Attestation : ${r.resultat}${r.documentId ? ` (doc ${r.documentId.slice(0, 8)})` : ""}.`;
      }
      setSuccess(msg);
      onDone(msg);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-1)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="admin-button"
        aria-label={`Générer : ${label}`}
      >
        {isPending ? "Génération…" : label}
      </button>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          {success}
        </p>
      )}
      {warning && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]"
        >
          ⚠️ {warning}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentsSection({
  sessionId,
  enrollments,
  documentsExistants,
}: DocumentsSectionProps): React.ReactElement {
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>(
    enrollments[0]?.id ?? "",
  );

  // État global pour les messages de succès cross-groupe
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);

  // ── Styles ──────────────────────────────────────────────────────────────

  const sectionHeadCls =
    "text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)] uppercase tracking-wide";

  const cardCls =
    "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";

  const selectCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  // ── Helpers ─────────────────────────────────────────────────────────────

  function handleDone(msg: string) {
    setLastSuccess(msg);
  }

  const hasEnrollments = enrollments.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-[var(--space-admin-6)]">
      {/* ── 1. Documents de session ──────────────────────────────────────── */}
      <div className={cardCls}>
        <h3 className={sectionHeadCls}>Session</h3>
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Documents communs à toute la session (convention, émargement, livret…).
        </p>
        <div className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-2 lg:grid-cols-3">
          <ConventionDocButton sessionId={sessionId} onDone={handleDone} />
          {/*
            Placé juste après la convention, et pas en fin de grille : c'est son
            annexe pédagogique, la convention la référence nommément en section
            « Documents annexés ». Les deux se génèrent ensemble ou la première
            promet une pièce qui n'accompagne pas.
          */}
          <SessionDocButton
            label="Programme de l'action"
            action={genererProgrammeAction}
            sessionId={sessionId}
            onDone={handleDone}
          />
          <SessionDocButton
            label="Convention tripartite (OPCO)"
            action={genererConventionTripartiteAction}
            sessionId={sessionId}
            onDone={handleDone}
          />
          <SessionDocButton
            label="Feuille d'émargement"
            action={genererEmargementAction}
            sessionId={sessionId}
            onDone={handleDone}
          />
          <SessionDocButton
            label="Règlement intérieur"
            action={genererReglementInterieurAction}
            sessionId={sessionId}
            onDone={handleDone}
          />
          <SessionDocButton
            label="Livret d'accueil"
            action={genererLivretAccueilAction}
            sessionId={sessionId}
            onDone={handleDone}
          />
          <SessionDocButton
            label="Questionnaire de positionnement"
            action={genererPositionnementAction}
            sessionId={sessionId}
            onDone={handleDone}
          />
          <SessionDocButton
            label="Questionnaire de satisfaction"
            action={genererSatisfactionAction}
            sessionId={sessionId}
            onDone={handleDone}
          />
          <SessionDocButton
            label="Kit OPCO"
            action={genererKitOpcoAction}
            sessionId={sessionId}
            onDone={handleDone}
          />
          <SessionDocButton
            label="Lettre de mission formateur"
            action={genererLettreMissionAction}
            sessionId={sessionId}
            onDone={handleDone}
          />
        </div>
      </div>

      {/* ── 2. Documents par stagiaire ───────────────────────────────────── */}
      <div className={cardCls}>
        <h3 className={sectionHeadCls}>Par stagiaire</h3>
        {!hasEnrollments ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucun stagiaire inscrit à cette session.
          </p>
        ) : (
          <>
            <div className="mb-[var(--space-admin-4)]">
              <label
                htmlFor="docs-stagiaire-select"
                className="mb-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
              >
                Stagiaire sélectionné
              </label>
              <select
                id="docs-stagiaire-select"
                value={selectedEnrollmentId}
                onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                className={selectCls}
              >
                {enrollments.map((enr) => (
                  <option key={enr.id} value={enr.id}>
                    {enr.nomStagiaire}
                  </option>
                ))}
              </select>
            </div>

            {selectedEnrollmentId !== "" && (
              <div className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-2 lg:grid-cols-3">
                <EnrollmentDocButton
                  label="Convocation"
                  action={genererConvocationAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                />
                <EnrollmentDocButton
                  label="Grille d'évaluation"
                  action={genererGrilleEvaluationAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                />
                <EnrollmentDocButton
                  label="Certificat de réalisation (R.6313-3)"
                  action={genererCertificatRealisationAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                />
                <EnrollmentDocButton
                  label="Kit CPF / EDOF"
                  action={genererKitCpfAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                />
                <EnrollmentDocButton
                  label="Kit France Travail"
                  action={genererKitFranceTravailAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                />
                <EnrollmentDocButton
                  label="Attestation de réalisation"
                  action={genererAttestationAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                />
                <EnrollmentDocButton
                  label="Contrat de formation (particulier, L.6353-3)"
                  action={genererContratFormationAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                />
                {/* Export d'état (pas un document officiel numéroté) : fiche
                    d'adaptation individuelle (A16/A9), téléchargée en PDF. */}
                <PdfExportButton
                  label="Fiche d'adaptation individuelle (PDF)"
                  input={{ enrollmentId: selectedEnrollmentId }}
                  action={genererFicheAdaptationAction}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 3. Financier ─────────────────────────────────────────────────── */}
      <div className={cardCls}>
        <h3 className={sectionHeadCls}>Financier</h3>
        <GenererFactureButton sessionId={sessionId} />
      </div>

      {/* ── Message de succès global ─────────────────────────────────────── */}
      {lastSuccess && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          Dernier document généré : {lastSuccess}
        </p>
      )}

      {/* ── 4. Documents existants ───────────────────────────────────────── */}
      <div className={cardCls}>
        <h3 className={sectionHeadCls}>Documents générés</h3>
        {documentsExistants.length === 0 ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucun document généré pour cette session.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
              <thead>
                <tr className="border-b border-[color:var(--color-admin-border)] text-left text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                  <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)]">Type</th>
                  <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)]">Numéro</th>
                  <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)]">Date</th>
                  <th className="pb-[var(--space-admin-2)]">PDF</th>
                </tr>
              </thead>
              <tbody>
                {documentsExistants.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-[color:var(--color-admin-border)] last:border-0"
                  >
                    <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-4)] text-[color:var(--color-admin-fg)]">
                      {DOC_LABELS[doc.type] ?? doc.type}
                      {/* 🔴 UI 2026-07-27 — un SPÉCIMEN était indiscernable d'une
                          pièce valable : même numéro, même date, même lien. On ne
                          s'en apercevait qu'en ouvrant le PDF, voire jamais si on
                          l'envoyait au client sans le rouvrir. */}
                      {doc.estSpecimen === true && (
                        <span
                          title={
                            (doc.champsManquants ?? []).length > 0
                              ? `Non opposable — identité de l'organisme incomplète : ${(doc.champsManquants ?? []).join(", ")}. Renseignez ces champs dans Configuration, puis régénérez le document.`
                              : "Non opposable — identité de l'organisme incomplète."
                          }
                          className="ml-[var(--space-admin-2)] rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-destructive-soft)] px-[var(--space-admin-2)] py-[2px] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-destructive-fg)] uppercase"
                        >
                          Spécimen
                        </span>
                      )}
                    </td>
                    <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-4)] font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {doc.numero}
                    </td>
                    <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-4)] text-[color:var(--color-admin-fg-muted)]">
                      {new Date(doc.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-[var(--space-admin-2)]">
                      {/* 🔴 2026-08-01 — le lien pointait sur `doc.pdfUrl`, c'est-à-dire
                          l'URL R2 pré-signée `X-Amz-Expires=900` calculée UNE FOIS à la
                          génération et figée en base. Quinze minutes plus tard, tout
                          document du registre répondait
                          `<Error><Code>ExpiredRequest</Code></Error>` — donc en pratique
                          TOUS, puisqu'on revient les chercher des jours après. Un registre
                          documentaire dont aucune pièce ne se télécharge n'est pas un
                          registre.
                          `/api/qualiopi/documents/[id]` re-signe à la demande et existait
                          déjà pour exactement ça ; seul `GenererFactureButton` l'utilisait.
                          `pdfUrl` reste testé, mais comme témoin que l'upload R2 a bien eu
                          lieu (`storeAndSignPdf` renvoie null si R2 n'est pas configuré) —
                          plus jamais comme cible du lien. */}
                      {doc.pdfUrl !== null && doc.pdfUrl !== undefined && doc.pdfUrl !== "" ? (
                        <a
                          href={`/api/qualiopi/documents/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[color:var(--color-admin-accent)] underline underline-offset-2 hover:opacity-80"
                          aria-label={`Télécharger ${DOC_LABELS[doc.type] ?? doc.type} n° ${doc.numero}`}
                        >
                          Télécharger
                        </a>
                      ) : (
                        <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
