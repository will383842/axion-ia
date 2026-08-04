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
  genererOrganisationActionAction,
  genererConventionTripartiteAction,
  genererContratFormationAction,
  genererEmargementAction,
  genererReglementInterieurAction,
  genererLivretAccueilAction,
  genererPositionnementAction,
  genererSatisfactionAction,
  genererKitOpcoAction,
  genererLettreMissionAction,
  genererLettreMissionCadreAction,
  listerSessionsLettreCadreAction,
  genererConvocationAction,
  genererGrilleEvaluationAction,
  genererCertificatRealisationAction,
  genererKitCpfAction,
  genererKitFranceTravailAction,
  annulerDocumentAction,
} from "@/server/actions/qualiopi/documents";
import { genererAttestationAction } from "@/server/actions/qualiopi/evaluations";
import { genererFicheAdaptationAction } from "@/server/actions/qualiopi/exports-pdf";
import { GenererFactureButton } from "@/components/admin/qualiopi/GenererFactureButton";
import { PdfExportButton } from "@/components/admin/qualiopi/PdfExportButton";
import { formatDateFrShort } from "@/lib/format-date-fr";
import type { DocumentType } from "../../../../prisma/generated/client";
import { TriangleAlert } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

/** Stagiaire minimal pour le sélecteur (un enrollment = 1 stagiaire dans la session). */
export interface EnrollmentInfo {
  id: string;
  /** Permet de relier les pièces individuelles (DocumentGenere.traineeId). */
  traineeId?: string;
  nomStagiaire: string;
}

/** DocumentGenere sérialisé (dates converties en string côté serveur). */
export interface DocumentGenereInfo {
  id: string;
  type: DocumentType;
  numero: string;
  pdfUrl: string | null;
  createdAt: string;
  /** Stagiaire couvert par une pièce individuelle — null pour les pièces de session. */
  traineeId?: string | null;
  /**
   * Le PDF porte un filigrane SPÉCIMEN : l'identité de l'OF était incomplète au
   * moment de la génération. La pièce n'est PAS opposable.
   */
  estSpecimen?: boolean;
  /** Champs d'identité manquants — dit quoi renseigner pour régénérer. */
  champsManquants?: string[];
  /**
   * La pièce porte au moins une signature électronique non révoquée. La preuve
   * vit dans `document_signatures`, pas dans le PDF scellé du registre : sans ce
   * flag, l'exemplaire signé n'était téléchargeable que depuis le panneau de
   * signature, et le registre laissait croire que la pièce n'était pas signée.
   */
  aSignatures?: boolean;
  /**
   * La pièce a été ANNULÉE au registre : elle existe toujours, elle ne fait
   * plus foi. Un numéro ne se supprime pas d'une série continue, et une pièce
   * signée encore moins — elle s'annule, avec son motif.
   */
  annuleeAt?: string | null;
  annuleeMotif?: string | null;
  annuleePar?: string | null;
  /**
   * Numéro de la pièce qui REMPLACE celle-ci. Sans ce contre-lien, l'auditeur
   * qui ouvre la pièce périmée n'a aucun moyen d'apprendre qu'elle est morte :
   * il faudrait déjà connaître la nouvelle, donc avoir la réponse avant la
   * question.
   */
  remplaceeParNumero?: string | null;
  /** Numéro de la pièce que celle-ci rectifie, lu depuis `metadata.rectifie`. */
  rectifieNumero?: string | null;
  rectifieMotif?: string | null;
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
  organisation_action: "Organisation de l'action (R.6351-5)",
  autorisation_captation: "Autorisation de captation (image et voix)",
  liste_formateurs: "Liste des formateurs (R.6351-5, ind. 21)",
  protocole_afest: "Protocole individuel AFEST (D.6313-3-1)",
  inventaire_moyens: "Inventaire des moyens pédagogiques",
  contrat_sous_traitance: "Contrat de sous-traitance (indicateur 27)",
  procedure_sous_traitance: "Procédure de sous-traitance (indicateur 27)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : bouton générique session-level
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Motif de RECTIFICATION — demandé à toute régénération
// ─────────────────────────────────────────────────────────────────────────────

/** Aligné sur le schéma Zod des actions ET sur la contrainte CHECK en base. */
const MOTIF_RECTIFICATION_MIN = 10;

/**
 * Régénérer une pièce, c'est en corriger une autre : on demande pourquoi.
 *
 * 🔴 Audit pré-visite 2026-08-04. Sans motif, une régénération sortait
 * filigranée « COPIE » — y compris quand on la refaisait précisément parce que
 * l'original était faux. Restait à choisir devant l'auditeur entre un original
 * illisible et une copie exacte. Avec motif, la pièce neuve sort en ORIGINAL et
 * déclare au registre ce qu'elle remplace et pourquoi.
 *
 * ⚠️ Champ INLINE, jamais `window.prompt` : une boîte de dialogue native bloque
 * la page (et l'automatisation du navigateur avec), et son texte n'est ni
 * traduisible ni accessible.
 */
function useMotifRectification(dejaGenereLe: string | undefined): {
  /** La pièce existe déjà → une régénération doit être motivée. */
  requis: boolean;
  ouvert: boolean;
  motif: string;
  valide: boolean;
  ouvrir: () => void;
  fermer: () => void;
  /** Argument à fusionner dans l'entrée de l'action. */
  argument: { rectificationMotif?: string };
  champ: (labelPiece: string) => React.ReactElement | null;
} {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const requis = dejaGenereLe !== undefined && dejaGenereLe !== "";
  const valide = motif.trim().length >= MOTIF_RECTIFICATION_MIN;

  return {
    requis,
    ouvert,
    motif,
    valide,
    ouvrir: () => setOuvert(true),
    fermer: () => {
      setOuvert(false);
      setMotif("");
    },
    argument: requis && valide ? { rectificationMotif: motif.trim() } : {},
    champ: (labelPiece: string) =>
      !ouvert ? null : (
        <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-xs)]">
          <span className="text-[color:var(--color-admin-fg-muted)]">
            Pourquoi refaire cette pièce ? Le motif est porté au registre et lu par l’auditeur.
          </span>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={2}
            required
            minLength={MOTIF_RECTIFICATION_MIN}
            placeholder="Rendu illisible sur les lignes de pièces constitutives — mise en page corrigée."
            aria-label={`Motif de rectification de ${labelPiece}`}
            className="admin-input"
          />
          {!valide && motif.trim().length > 0 && (
            <span className="text-[color:var(--color-admin-fg-muted)]">
              {MOTIF_RECTIFICATION_MIN} caractères minimum.
            </span>
          )}
        </label>
      ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Annulation d'une pièce au registre
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Annule une pièce : elle reste au registre, elle cesse de faire foi.
 *
 * 🔴 Ce bouton ne SUPPRIME rien, et c'est le point. Un numéro est alloué dans
 * une série continue (CGI, art. 242 nonies A ann. II) : le retirer laisse un
 * trou, et un trou dans une série documentaire est ce qu'un contrôle relève.
 * La pièce peut en outre porter une signature réelle — `AXI-DOC-2026-007`, qui
 * motive cette fonctionnalité, est signée. Une contradiction laissée en place
 * est un constat ; la même, annulée et motivée, montre un processus qui se
 * corrige.
 *
 * ⚠️ Pas de `window.confirm` : une boîte native bloque la page entière. La
 * confirmation, c'est la saisie du motif — qui est de toute façon obligatoire.
 */
function AnnulerDocumentButton({
  documentId,
  numero,
  libelle,
}: {
  documentId: string;
  numero: string;
  libelle: string;
}): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [error, setError] = useState<string | null>(null);
  const valide = motif.trim().length >= MOTIF_RECTIFICATION_MIN;

  function handleAnnuler() {
    setError(null);
    startTransition(async () => {
      const result = await annulerDocumentAction({ documentId, motif: motif.trim() });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOuvert(false);
      setMotif("");
      router.refresh();
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="mt-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline underline-offset-2 hover:opacity-80"
        aria-label={`Annuler au registre : ${libelle} n° ${numero}`}
      >
        Annuler cette pièce
      </button>
    );
  }

  return (
    <div className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-1)]">
      <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-xs)]">
        <span className="text-[color:var(--color-admin-fg-muted)]">
          Motif de l’annulation de {numero} — porté au registre et lu par l’auditeur.
        </span>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={2}
          required
          minLength={MOTIF_RECTIFICATION_MIN}
          aria-label={`Motif d'annulation de ${libelle} n° ${numero}`}
          className="admin-input"
        />
      </label>
      <span className="flex flex-wrap gap-[var(--space-admin-2)]">
        <button
          type="button"
          onClick={handleAnnuler}
          disabled={isPending || !valide}
          className="admin-button-danger"
        >
          {isPending ? "Annulation…" : "Confirmer l’annulation"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOuvert(false);
            setMotif("");
            setError(null);
          }}
          className="admin-button-ghost"
        >
          Renoncer
        </button>
      </span>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}

interface SessionDocButtonProps {
  label: string;
  action: (input: {
    sessionId: string;
    rectificationMotif?: string;
  }) => Promise<{ data: { documentId: string; numero: string } } | { error: string }>;
  sessionId: string;
  onDone: (numero: string) => void;
  /**
   * Date FR de la dernière génération de ce type de pièce pour la session.
   * Présente → le bouton passe en ghost « … — régénérer » : le primary reste
   * réservé aux pièces encore à produire (finitions console 2026-08-02).
   */
  dejaGenereLe?: string | undefined;
}

function SessionDocButton({
  label,
  action,
  sessionId,
  onDone,
  dejaGenereLe,
}: SessionDocButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const rect = useMotifRectification(dejaGenereLe);

  function handleClick() {
    // Première frappe sur une pièce DÉJÀ produite : on ouvre le motif au lieu
    // de régénérer. Sans cette étape, la pièce ressortait filigranée « COPIE ».
    if (rect.requis && !rect.ouvert) {
      rect.ouvrir();
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await action({ sessionId, ...rect.argument });
      if ("error" in result) {
        setError(result.error);
      } else {
        const msg = `${label} — n° ${result.data.numero} généré.`;
        setSuccess(msg);
        onDone(result.data.numero);
        rect.fermer();
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-1)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || (rect.ouvert && !rect.valide)}
        className={dejaGenereLe ? "admin-button-ghost" : "admin-button"}
        aria-label={
          dejaGenereLe
            ? `Régénérer : ${label} (dernière génération le ${dejaGenereLe})`
            : `Générer : ${label}`
        }
      >
        {isPending
          ? "Génération…"
          : rect.ouvert
            ? `Rectifier : ${label}`
            : dejaGenereLe
              ? `${label} · génération du ${dejaGenereLe} — régénérer`
              : label}
      </button>
      {rect.champ(label)}
      {rect.ouvert && (
        <button type="button" onClick={rect.fermer} className="admin-button-ghost self-start">
          Annuler
        </button>
      )}
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
// Sous-composant : lettre de mission (session seule OU lettre-cadre)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Décision Will 2026-08-01 : « les deux, au choix au moment de générer ».
 *
 * - « Cette session seule » : le bouton historique, inchangé.
 * - « Lettre-cadre » : UNE lettre couvrant les formations cochées d'une
 *   période — une seule signature du sous-traitant. À 200 formateurs, une
 *   signature par session ne tient pas.
 *
 * Le formulaire cadre se déplie sous le bouton : dates → « Chercher » liste les
 * formations du formateur principal sur la période (revalidées côté serveur,
 * la liste cliente n'est jamais crue) → cases cochées → génération.
 */
/** Prestation candidate telle que renvoyée par l'action de liste. */
interface PrestationCandidate {
  id: string;
  numero: string;
  titre: string;
  du: string;
  au: string;
}

/** Un groupe de cases à cocher (formations, coachings ou audits). */
function GroupePrestations({
  titre,
  prefixe,
  items,
  cochees,
  setCochees,
}: {
  titre: string;
  prefixe: string;
  items: PrestationCandidate[];
  cochees: Set<string>;
  setCochees: React.Dispatch<React.SetStateAction<Set<string>>>;
}): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-[var(--space-admin-1)]">
      <p className="text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-fg)]">
        {titre}
      </p>
      <ul className="flex flex-col gap-[var(--space-admin-1)]">
        {items.map((p) => {
          const cle = `${prefixe}:${p.id}`;
          return (
            <li key={p.id}>
              <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]">
                <input
                  type="checkbox"
                  checked={cochees.has(cle)}
                  onChange={(e) => {
                    setCochees((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(cle);
                      else next.delete(cle);
                      return next;
                    });
                  }}
                />
                <span>
                  {p.titre}
                  {p.numero ? ` · ${p.numero}` : ""} · du {p.du} au {p.au}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LettreMissionButtons({
  sessionId,
  onDone,
  dejaGenereLe,
}: {
  sessionId: string;
  onDone: (numero: string) => void;
  /** Cf. SessionDocButton — transmis au bouton « cette session ». */
  dejaGenereLe?: string | undefined;
}): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [formateur, setFormateur] = useState<string | null>(null);
  // Trois familles de prestations, cochables indépendamment : formations
  // collectives, coachings AFEST 1-to-1, audits (Will 2026-08-01).
  const [candidates, setCandidates] = useState<{
    sessions: PrestationCandidate[];
    coachings: PrestationCandidate[];
    audits: PrestationCandidate[];
  } | null>(null);
  const [cochees, setCochees] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function chercher() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await listerSessionsLettreCadreAction({ sessionId, dateDebut, dateFin });
      if ("error" in res) {
        setError(res.error);
        setCandidates(null);
        return;
      }
      setFormateur(res.data.formateur);
      setCandidates({
        sessions: res.data.sessions,
        coachings: res.data.coachings,
        audits: res.data.audits,
      });
      // Toutes cochées par défaut : le cas nominal est « tout ce que ce
      // formateur anime sur la période », décocher est l'exception.
      setCochees(
        new Set([
          ...res.data.sessions.map((s) => `s:${s.id}`),
          ...res.data.coachings.map((c) => `c:${c.id}`),
          ...res.data.audits.map((a) => `a:${a.id}`),
        ]),
      );
    });
  }

  function generer() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const ids = [...cochees];
      const res = await genererLettreMissionCadreAction({
        sessionId,
        dateDebut,
        dateFin,
        sessionIds: ids.filter((k) => k.startsWith("s:")).map((k) => k.slice(2)),
        coachingIds: ids.filter((k) => k.startsWith("c:")).map((k) => k.slice(2)),
        auditIds: ids.filter((k) => k.startsWith("a:")).map((k) => k.slice(2)),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSuccess(`Lettre-cadre — n° ${res.data.numero} générée.`);
      onDone(res.data.numero);
      setOuvert(false);
      setCandidates(null);
      router.refresh();
    });
  }

  const total =
    candidates === null
      ? 0
      : candidates.sessions.length + candidates.coachings.length + candidates.audits.length;

  return (
    <div className="flex flex-col gap-[var(--space-admin-1)]">
      <SessionDocButton
        label="Lettre de mission formateur (cette session)"
        action={genererLettreMissionAction}
        sessionId={sessionId}
        onDone={onDone}
        dejaGenereLe={dejaGenereLe}
      />
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        className="admin-button"
        aria-expanded={ouvert}
      >
        {ouvert ? "Fermer la lettre-cadre" : "Lettre-cadre (plusieurs sessions)…"}
      </button>
      {ouvert && (
        <div className="flex flex-col gap-[var(--space-admin-2)] rounded border border-[color:var(--color-admin-border)] p-[var(--space-admin-2)]">
          <div className="flex flex-wrap items-end gap-[var(--space-admin-2)]">
            <label className="flex flex-col text-[length:var(--text-admin-xs)]">
              Du
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="admin-input"
              />
            </label>
            <label className="flex flex-col text-[length:var(--text-admin-xs)]">
              Au
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="admin-input"
              />
            </label>
            <button
              type="button"
              onClick={chercher}
              disabled={isPending || dateDebut === "" || dateFin === ""}
              className="admin-button"
            >
              {isPending ? "Recherche…" : "Chercher les prestations"}
            </button>
          </div>
          {candidates !== null && total === 0 && (
            <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Aucune prestation de ce formateur sur cette période.
            </p>
          )}
          {candidates !== null && total > 0 && (
            <>
              <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                Prestations de {formateur} sur la période — décochez celles à exclure :
              </p>
              <GroupePrestations
                titre="Formations collectives"
                prefixe="s"
                items={candidates.sessions}
                cochees={cochees}
                setCochees={setCochees}
              />
              <GroupePrestations
                titre="Coachings 1-to-1 / AFEST"
                prefixe="c"
                items={candidates.coachings}
                cochees={cochees}
                setCochees={setCochees}
              />
              <GroupePrestations
                titre="Audits"
                prefixe="a"
                items={candidates.audits}
                cochees={cochees}
                setCochees={setCochees}
              />
              <button
                type="button"
                onClick={generer}
                disabled={isPending || cochees.size === 0}
                className="admin-button"
              >
                {isPending
                  ? "Génération…"
                  : `Générer la lettre-cadre (${cochees.size} prestation${cochees.size > 1 ? "s" : ""})`}
              </button>
            </>
          )}
          {error && (
            <p
              role="alert"
              className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
            >
              {error}
            </p>
          )}
        </div>
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
  dejaGenereLe,
}: {
  sessionId: string;
  onDone: (numero: string) => void;
  /** Cf. SessionDocButton. */
  dejaGenereLe?: string | undefined;
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
        className={dejaGenereLe ? "admin-button-ghost" : "admin-button"}
        aria-label={
          dejaGenereLe
            ? `Régénérer : Convention de formation (dernière génération le ${dejaGenereLe})`
            : "Générer : Convention de formation"
        }
      >
        {isPending
          ? "Génération…"
          : dejaGenereLe
            ? `Convention de formation · génération du ${dejaGenereLe} — régénérer`
            : "Convention de formation"}
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
  action: (input: { enrollmentId: string; rectificationMotif?: string }) => Promise<
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
  /** Cf. SessionDocButton — dernière génération pour LE stagiaire sélectionné. */
  dejaGenereLe?: string | undefined;
}

function EnrollmentDocButton({
  label,
  action,
  enrollmentId,
  onDone,
  dejaGenereLe,
}: EnrollmentDocButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const rect = useMotifRectification(dejaGenereLe);

  function handleClick() {
    // Cf. SessionDocButton : régénérer, c'est rectifier — donc dire pourquoi.
    if (rect.requis && !rect.ouvert) {
      rect.ouvrir();
      return;
    }
    setError(null);
    setSuccess(null);
    setWarning(null);
    startTransition(async () => {
      const result = await action({ enrollmentId, ...rect.argument });
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
        // Le résultat sortait en enum, suivi de huit caractères d'UUID nu :
        // « Attestation : partielle (doc 3f2a91bc). » Ni l'un ni l'autre ne
        // dit ce qui a été produit ni pourquoi.
        const RESULTAT_ATTESTATION: Record<string, string> = {
          complete: "Attestation complète générée.",
          partielle: "Attestation partielle générée — présence insuffisante.",
          aucune: "Aucune attestation : les conditions ne sont pas remplies.",
        };
        msg = RESULTAT_ATTESTATION[r.resultat] ?? `Attestation : « ${r.resultat} ».`;
      }
      setSuccess(msg);
      onDone(msg);
      rect.fermer();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-1)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || (rect.ouvert && !rect.valide)}
        className={dejaGenereLe ? "admin-button-ghost" : "admin-button"}
        aria-label={
          dejaGenereLe
            ? `Régénérer : ${label} (dernière génération le ${dejaGenereLe})`
            : `Générer : ${label}`
        }
      >
        {isPending
          ? "Génération…"
          : rect.ouvert
            ? `Rectifier : ${label}`
            : dejaGenereLe
              ? `${label} · génération du ${dejaGenereLe} — régénérer`
              : label}
      </button>
      {rect.champ(label)}
      {rect.ouvert && (
        <button type="button" onClick={rect.fermer} className="admin-button-ghost self-start">
          Annuler
        </button>
      )}
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
          <TriangleAlert
            size={14}
            aria-hidden="true"
            className="inline-block shrink-0 align-[-0.125em]"
          />{" "}
          {warning}
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

  // ── Hiérarchie « déjà généré » (finitions console 2026-08-02) ────────────
  //
  // Le mur de CTA mettait toutes les pièces au même niveau : impossible de
  // voir d'un coup d'œil ce qui restait à produire. Une pièce déjà générée
  // passe son bouton en ghost « … — régénérer » ; le primary reste réservé
  // aux pièces manquantes. `documentsExistants` arrive trié createdAt DESC
  // (page session) : la première occurrence d'un type est la plus récente.
  //
  // Deux index séparés : pièces de session (traineeId null) par type, pièces
  // individuelles par `type:traineeId` — une convocation générée pour Alice ne
  // doit pas éteindre le bouton quand Bob est sélectionné.
  const dernierSessionParType = new Map<DocumentType, string>();
  const dernierStagiaireParType = new Map<string, string>();
  for (const doc of documentsExistants) {
    // Une pièce ANNULÉE ne compte pas comme « déjà générée ». Sinon le bouton
    // resterait en « régénérer » et réclamerait un motif de rectification pour
    // une pièce dont il n'existe plus de version valable à rectifier : la
    // suivante est un premier original, pas une correction.
    if (doc.annuleeAt != null) continue;
    const dateFr = formatDateFrShort(doc.createdAt);
    if (doc.traineeId) {
      const cle = `${doc.type}:${doc.traineeId}`;
      if (!dernierStagiaireParType.has(cle)) dernierStagiaireParType.set(cle, dateFr);
    } else if (!dernierSessionParType.has(doc.type)) {
      dernierSessionParType.set(doc.type, dateFr);
    }
  }
  const selectedTraineeId = enrollments.find((e) => e.id === selectedEnrollmentId)?.traineeId;
  /** Date de dernière génération d'une pièce individuelle pour le stagiaire sélectionné. */
  function genereStagiaireLe(...types: ReadonlyArray<DocumentType>): string | undefined {
    if (!selectedTraineeId) return undefined;
    for (const t of types) {
      const dateFr = dernierStagiaireParType.get(`${t}:${selectedTraineeId}`);
      if (dateFr !== undefined) return dateFr;
    }
    return undefined;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-[var(--space-admin-6)]">
      {/* ── 1. Documents de session ──────────────────────────────────────── */}
      <div className={cardCls}>
        <h3 className={sectionHeadCls}>Session</h3>
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Documents communs à toute la session (convention, émargement, livret…).
        </p>
        {/* 2026-08-02 — ces boutons GÉNÈRENT, ils ne téléchargent pas. Faute de
            le dire, on cliquait « Convention de formation » pour récupérer la
            convention existante et on obtenait une pièce neuve, filigranée COPIE,
            datée du jour — puis on la joignait à un dossier officiel en croyant
            tenir l'original. L'avertissement n'apparaît que s'il y a déjà des
            pièces : sur une session vierge, il n'y a rien à confondre. */}
        {documentsExistants.length > 0 && (
          <p className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Ces boutons créent une <strong>nouvelle</strong> pièce : regénérer un type déjà présent
            produit une COPIE filigranée, jamais l&apos;original. Pour retrouver une pièce déjà
            émise, utilisez la liste « Documents générés » ci-dessous.
          </p>
        )}
        <div className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-2 lg:grid-cols-3">
          <ConventionDocButton
            sessionId={sessionId}
            onDone={handleDone}
            dejaGenereLe={dernierSessionParType.get("convention")}
          />
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
            dejaGenereLe={dernierSessionParType.get("programme")}
          />
          {/* Avec le programme, les deux pièces descriptives de l'art. R.6351-5 :
              le programme dit CE QUI est enseigné, celle-ci dit QUAND, OÙ et
              COMMENT (calendrier session_jours, rythme, lieu, encadrement). */}
          <SessionDocButton
            label="Organisation de l'action"
            action={genererOrganisationActionAction}
            sessionId={sessionId}
            onDone={handleDone}
          />
          <SessionDocButton
            label="Convention tripartite (OPCO)"
            action={genererConventionTripartiteAction}
            sessionId={sessionId}
            onDone={handleDone}
            dejaGenereLe={dernierSessionParType.get("convention_tripartite")}
          />
          <SessionDocButton
            label="Feuille d'émargement"
            action={genererEmargementAction}
            sessionId={sessionId}
            onDone={handleDone}
            dejaGenereLe={dernierSessionParType.get("emargement")}
          />
          <SessionDocButton
            label="Règlement intérieur"
            action={genererReglementInterieurAction}
            sessionId={sessionId}
            onDone={handleDone}
            dejaGenereLe={dernierSessionParType.get("reglement_interieur")}
          />
          <SessionDocButton
            label="Livret d'accueil"
            action={genererLivretAccueilAction}
            sessionId={sessionId}
            onDone={handleDone}
            dejaGenereLe={dernierSessionParType.get("livret_accueil")}
          />
          <SessionDocButton
            label="Questionnaire de positionnement"
            action={genererPositionnementAction}
            sessionId={sessionId}
            onDone={handleDone}
            dejaGenereLe={dernierSessionParType.get("positionnement")}
          />
          <SessionDocButton
            label="Questionnaire de satisfaction"
            action={genererSatisfactionAction}
            sessionId={sessionId}
            onDone={handleDone}
            dejaGenereLe={dernierSessionParType.get("satisfaction")}
          />
          <SessionDocButton
            label="Kit OPCO"
            action={genererKitOpcoAction}
            sessionId={sessionId}
            onDone={handleDone}
            dejaGenereLe={dernierSessionParType.get("kit_opco")}
          />
          <LettreMissionButtons
            sessionId={sessionId}
            onDone={handleDone}
            dejaGenereLe={dernierSessionParType.get("lettre_mission")}
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
                  dejaGenereLe={genereStagiaireLe("convocation")}
                />
                <EnrollmentDocButton
                  label="Grille d'évaluation"
                  action={genererGrilleEvaluationAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                  dejaGenereLe={genereStagiaireLe("grille_evaluation")}
                />
                <EnrollmentDocButton
                  label="Certificat de réalisation (R.6313-3)"
                  action={genererCertificatRealisationAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                  dejaGenereLe={genereStagiaireLe("certificat_realisation")}
                />
                <EnrollmentDocButton
                  label="Kit CPF / EDOF"
                  action={genererKitCpfAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                  dejaGenereLe={genereStagiaireLe("kit_cpf")}
                />
                <EnrollmentDocButton
                  label="Kit France Travail"
                  action={genererKitFranceTravailAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                  dejaGenereLe={genereStagiaireLe("kit_france_travail")}
                />
                <EnrollmentDocButton
                  label="Attestation de réalisation"
                  action={genererAttestationAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                  dejaGenereLe={genereStagiaireLe("attestation", "attestation_partielle")}
                />
                <EnrollmentDocButton
                  label="Contrat de formation (particulier, L.6353-3)"
                  action={genererContratFormationAction}
                  enrollmentId={selectedEnrollmentId}
                  onDone={handleDone}
                  dejaGenereLe={genereStagiaireLe("contrat")}
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
                      {/* UI 2026-07-27 — un SPÉCIMEN était indiscernable d'une
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
                      {/* 2026-08-04 — une pièce annulée restait indiscernable
                          d'une pièce valable au registre : même ligne, même
                          lien, rien ne disait qu'elle ne fait plus foi. Le
                          motif est affiché ICI et pas en infobulle : c'est
                          exactement ce que l'auditeur vient lire. */}
                      {typeof doc.annuleeAt === "string" && (
                        <>
                          <span className="ml-[var(--space-admin-2)] rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-destructive-soft)] px-[var(--space-admin-2)] py-[2px] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-destructive-fg)] uppercase">
                            Annulée
                          </span>
                          <span className="mt-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                            {`Annulée le ${new Date(doc.annuleeAt).toLocaleDateString("fr-FR")}`}
                            {doc.annuleePar ? ` par ${doc.annuleePar}` : ""}
                            {doc.annuleeMotif ? ` — ${doc.annuleeMotif}` : ""}
                          </span>
                        </>
                      )}
                      {typeof doc.remplaceeParNumero === "string" &&
                        doc.remplaceeParNumero !== "" && (
                          <span className="mt-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                            Remplacée par {doc.remplaceeParNumero}
                          </span>
                        )}
                      {typeof doc.rectifieNumero === "string" && doc.rectifieNumero !== "" && (
                        <span className="mt-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                          Rectifie {doc.rectifieNumero}
                          {doc.rectifieMotif ? ` — ${doc.rectifieMotif}` : ""}
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
                      {/* 2026-08-01 — le lien pointait sur `doc.pdfUrl`, c'est-à-dire
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
                        <span className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                          <a
                            href={`/api/qualiopi/documents/${doc.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-button-ghost"
                            aria-label={`Télécharger ${DOC_LABELS[doc.type] ?? doc.type} n° ${doc.numero}`}
                          >
                            Télécharger
                          </a>
                          {/* 2026-08-02 — le registre sert l'ORIGINAL SCELLÉ, cadres de
                              signature vides : c'est voulu (l'empreinte signée ne doit
                              jamais bouger), mais l'exemplaire portant les signatures
                              n'était accessible que depuis le panneau de signature plus
                              bas. On cherchait « la convention signée » ici, on tombait
                              sur des cadres vides, et on la joignait telle quelle à un
                              dossier officiel. */}
                          {doc.aSignatures === true && (
                            <a
                              href={`/api/qualiopi/pieces/${doc.id}/exemplaire-signe`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[color:var(--color-admin-accent)] underline underline-offset-2 hover:opacity-80"
                              aria-label={`Télécharger l'exemplaire signé de ${DOC_LABELS[doc.type] ?? doc.type} n° ${doc.numero}`}
                            >
                              Exemplaire signé
                            </a>
                          )}
                        </span>
                      ) : (
                        <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                      )}
                      {doc.annuleeAt == null && (
                        <AnnulerDocumentButton
                          documentId={doc.id}
                          numero={doc.numero}
                          libelle={DOC_LABELS[doc.type] ?? doc.type}
                        />
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
