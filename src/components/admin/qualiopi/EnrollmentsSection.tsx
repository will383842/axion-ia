"use client";
// use-client: état local (formulaire inscription, sélecteur statut, inline portail), useTransition, router.refresh().
/**
 * EnrollmentsSection — Section « Stagiaires » du hub session Qualiopi.
 *
 * - Liste les inscriptions de la session (statut, taux de présence, accès portail).
 * - Formulaire d&apos;inscription : sélecteur parmi les stagiaires disponibles
 *   (signature enrollTraineeAction = { sessionId, traineeId }).
 * - Par inscription : changement de statut (setEnrollmentStatutAction).
 * - Par inscription : génération accès portail (GenererPortailAccesButton) +
 *   révocation (revoquerPortailAccesAction).
 * - router.refresh() après chaque mutation.
 *
 * Tokens admin var(--color-admin-*) — ZÉRO hex.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GenererPortailAccesButton } from "@/components/admin/qualiopi/GenererPortailAccesButton";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T> = { data: T } | { error: string };

export type EnrollmentStatut = "planifiee" | "presente" | "abandon" | "exclu";

/** Accès portail sérialisé (champs non-sensibles uniquement). */
export interface PortailAccesSerialized {
  id: string;
  expiresAt: string; // ISO string
  revoked: boolean;
}

/** Inscription sérialisée transmise par le Server Component parent. */
export interface EnrollmentSerialized {
  id: string;
  trainee: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
  };
  statut: EnrollmentStatut;
  /** Null tant que non renseigné. */
  tauxPresencePct: number | null;
  /** Accès portail actif (non révoqué, non expiré) le plus récent — null si aucun. */
  portailAcces: PortailAccesSerialized | null;
}

/** Stagiaire disponible pour inscription (fourni par le Server Component). */
export interface TraineeSerialized {
  id: string;
  nom: string;
  prenom: string;
  email: string;
}

export interface EnrollmentsSectionProps {
  sessionId: string;
  enrollments: EnrollmentSerialized[];
  /** Tous les stagiaires existants — utilisés comme options du sélecteur d&apos;inscription. */
  availableTrainees: TraineeSerialized[];
  /** Server Actions injectées par le parent (Server Component). */
  enrollAction: (input: {
    sessionId: string;
    traineeId: string;
  }) => Promise<ActionResult<{ id: string }>>;
  setStatutAction: (input: {
    id: string;
    statut: EnrollmentStatut;
  }) => Promise<ActionResult<{ id: string }>>;
  genererPortailAction: (input: {
    traineeId: string;
    joursValidite?: number;
  }) => Promise<ActionResult<{ id: string; token: string; url: string; expiresAt: Date }>>;
  revoquerPortailAction: (input: { id: string }) => Promise<ActionResult<{ id: string }>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_LABELS: Record<EnrollmentStatut, string> = {
  planifiee: "Planifiée",
  presente: "Présente",
  abandon: "Abandon",
  exclu: "Exclu(e)",
};

const STATUT_OPTIONS: Array<{ value: EnrollmentStatut; label: string }> = [
  { value: "planifiee", label: "Planifiée" },
  { value: "presente", label: "Présente" },
  { value: "abandon", label: "Abandon" },
  { value: "exclu", label: "Exclu(e)" },
];

function statutColor(s: EnrollmentStatut): string {
  if (s === "presente") return "text-[color:var(--color-admin-success)]";
  if (s === "abandon" || s === "exclu") return "text-[color:var(--color-admin-error)]";
  return "text-[color:var(--color-admin-fg-muted)]";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : ligne stagiaire
// ─────────────────────────────────────────────────────────────────────────────

interface EnrollmentRowProps {
  enrollment: EnrollmentSerialized;
  setStatutAction: EnrollmentsSectionProps["setStatutAction"];
  genererPortailAction: EnrollmentsSectionProps["genererPortailAction"];
  revoquerPortailAction: EnrollmentsSectionProps["revoquerPortailAction"];
  onMutated: () => void;
}

function EnrollmentRow({
  enrollment,
  setStatutAction,
  genererPortailAction,
  revoquerPortailAction,
  onMutated,
}: EnrollmentRowProps): React.ReactElement {
  const [isPendingStatut, startStatut] = useTransition();
  const [isPendingRevoke, startRevoke] = useTransition();
  const [statutError, setStatutError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const inputCls =
    "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  function handleStatutChange(newStatut: string) {
    const statut = newStatut as EnrollmentStatut;
    setStatutError(null);
    startStatut(async () => {
      const res = await setStatutAction({ id: enrollment.id, statut });
      if ("error" in res) {
        setStatutError(res.error);
      } else {
        onMutated();
      }
    });
  }

  function handleRevoquer(portailId: string) {
    setRevokeError(null);
    startRevoke(async () => {
      const res = await revoquerPortailAction({ id: portailId });
      if ("error" in res) {
        setRevokeError(res.error);
      } else {
        onMutated();
      }
    });
  }

  const tdCls =
    "px-[var(--space-admin-3)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

  return (
    <tr className="border-b border-[color:var(--color-admin-border)] last:border-b-0">
      {/* Identité */}
      <td className={tdCls}>
        <p className="font-medium">
          {enrollment.trainee.prenom} {enrollment.trainee.nom}
        </p>
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {enrollment.trainee.email}
        </p>
      </td>

      {/* Statut */}
      <td className={tdCls}>
        <select
          value={enrollment.statut}
          onChange={(e) => handleStatutChange(e.target.value)}
          disabled={isPendingStatut}
          aria-label={`Statut de ${enrollment.trainee.prenom} ${enrollment.trainee.nom}`}
          className={inputCls}
        >
          {STATUT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {statutError && (
          <p
            role="alert"
            className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
          >
            {statutError}
          </p>
        )}
        {/* Affichage statut coloré en complément */}
        <p
          className={`mt-1 text-[length:var(--text-admin-xs)] font-semibold ${statutColor(enrollment.statut)}`}
        >
          {STATUT_LABELS[enrollment.statut]}
        </p>
      </td>

      {/* Taux de présence */}
      <td className={tdCls}>
        {enrollment.tauxPresencePct !== null ? (
          <span className="font-medium">{enrollment.tauxPresencePct}&nbsp;%</span>
        ) : (
          <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
        )}
      </td>

      {/* Accès portail */}
      <td className={tdCls}>
        <div className="space-y-[var(--space-admin-2)]">
          {/* Générer un nouvel accès */}
          <GenererPortailAccesButton
            traineeId={enrollment.trainee.id}
            genererAction={genererPortailAction}
          />

          {/* Accès portail actif : affichage + révocation */}
          {enrollment.portailAcces !== null && !enrollment.portailAcces.revoked && (
            <div className="mt-[var(--space-admin-2)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-2)]">
              <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                Accès actif — expire le{" "}
                {new Date(enrollment.portailAcces.expiresAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (enrollment.portailAcces !== null) {
                    handleRevoquer(enrollment.portailAcces.id);
                  }
                }}
                disabled={isPendingRevoke}
                className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] underline-offset-2 hover:underline disabled:opacity-50"
              >
                {isPendingRevoke ? "Révocation…" : "Révoquer l’accès"}
              </button>
              {revokeError && (
                <p
                  role="alert"
                  className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
                >
                  {revokeError}
                </p>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulaire d&apos;inscription
// ─────────────────────────────────────────────────────────────────────────────

interface EnrollFormProps {
  sessionId: string;
  availableTrainees: TraineeSerialized[];
  alreadyEnrolledIds: Set<string>;
  enrollAction: EnrollmentsSectionProps["enrollAction"];
  onEnrolled: () => void;
}

function EnrollForm({
  sessionId,
  availableTrainees,
  alreadyEnrolledIds,
  enrollAction,
  onEnrolled,
}: EnrollFormProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filtrer les stagiaires déjà inscrits
  const candidates = availableTrainees.filter((t) => !alreadyEnrolledIds.has(t.id));

  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedTraineeId) {
      setError("Veuillez sélectionner un stagiaire.");
      return;
    }

    startTransition(async () => {
      const res = await enrollAction({ sessionId, traineeId: selectedTraineeId });
      if ("error" in res) {
        setError(res.error);
      } else {
        setSuccessMsg("Stagiaire inscrit avec succès.");
        setSelectedTraineeId("");
        onEnrolled();
      }
    });
  }

  if (candidates.length === 0) {
    return (
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Tous les stagiaires disponibles sont déjà inscrits à cette session.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
      <div className="min-w-[16rem] flex-1">
        <label htmlFor="enroll-trainee-select" className={labelCls}>
          Stagiaire
        </label>
        <select
          id="enroll-trainee-select"
          value={selectedTraineeId}
          onChange={(e) => setSelectedTraineeId(e.target.value)}
          disabled={isPending}
          className={inputCls}
        >
          <option value="">— Choisir un stagiaire</option>
          {candidates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.prenom} {t.nom} ({t.email})
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={isPending || !selectedTraineeId} className="admin-button">
        {isPending ? "Inscription…" : "Inscrire"}
      </button>

      {error && (
        <p
          role="alert"
          className="w-full text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="w-full text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function EnrollmentsSection({
  sessionId,
  enrollments,
  availableTrainees,
  enrollAction,
  setStatutAction,
  genererPortailAction,
  revoquerPortailAction,
}: EnrollmentsSectionProps): React.ReactElement {
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  const alreadyEnrolledIds = new Set(enrollments.map((e) => e.trainee.id));

  const thCls =
    "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <div className="space-y-[var(--space-admin-6)]">
      {/* ── Liste des inscriptions ───────────────────────────────────────── */}
      {enrollments.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucun stagiaire inscrit pour le moment.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)]">
              <tr>
                <th className={thCls}>Stagiaire</th>
                <th className={thCls}>Statut</th>
                <th className={thCls}>Présence</th>
                <th className={thCls}>Accès portail</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enrollment) => (
                <EnrollmentRow
                  key={enrollment.id}
                  enrollment={enrollment}
                  setStatutAction={setStatutAction}
                  genererPortailAction={genererPortailAction}
                  revoquerPortailAction={revoquerPortailAction}
                  onMutated={refresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Formulaire d&apos;inscription ────────────────────────────────── */}
      <div>
        <h3 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
          Inscrire un stagiaire
        </h3>
        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
          <EnrollForm
            sessionId={sessionId}
            availableTrainees={availableTrainees}
            alreadyEnrolledIds={alreadyEnrolledIds}
            enrollAction={enrollAction}
            onEnrolled={refresh}
          />
        </div>
      </div>
    </div>
  );
}
