"use client";
// use-client: saisie interactive des pièces justificatives (ajout / valider /
// rejeter avec motif / supprimer), avec useTransition + router.refresh().

/**
 * TrainerDocumentsPanel — gestion des pièces justificatives d'un formateur.
 *
 * Complète la carte « Conformité documentaire » (qui, elle, ne fait que juger) :
 * ici on SAISIT les pièces qui alimentent ce jugement. Une pièce démarre
 * « en attente » et ne compte pour la conformité qu'une fois VALIDÉE par un
 * humain — d'où les boutons Valider / Rejeter distincts de la simple création.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createTrainerDocumentAction,
  validateTrainerDocumentAction,
  deleteTrainerDocumentAction,
} from "@/server/actions/qualiopi/trainer-documents";
import type {
  DocumentValidationStatutValue,
  TrainerDocumentTypeValue,
} from "@/server/qualiopi/trainers/conformite";
import { useConfirmation } from "@/components/admin/ui/useConfirmation";

export interface TrainerDocumentView {
  id: string;
  type: TrainerDocumentTypeValue;
  numeroPiece: string | null;
  fichierUrl: string | null;
  dateEmission: Date | null;
  dateExpiration: Date | null;
  statutValidation: DocumentValidationStatutValue;
  rejetMotif: string | null;
  createdAt: Date;
}

export interface TrainerDocumentsPanelProps {
  trainerId: string;
  documents: TrainerDocumentView[];
}

// Libellés pour un tableau (capitalisés) — les libellés de `conformite.ts` sont
// pensés pour des phrases inline (« le contrat de travail est absent »).
const TYPE_LABELS: Record<TrainerDocumentTypeValue, string> = {
  contrat_travail: "Contrat de travail",
  dpae: "DPAE (déclaration préalable à l'embauche)",
  attestation_vigilance_urssaf: "Attestation de vigilance URSSAF",
  kbis_avis_sirene: "Kbis / avis SIRENE",
  nda_sous_traitant: "NDA sous-traitant",
  attestation_qualiopi: "Attestation Qualiopi",
  assurance_rc_pro: "Assurance RC pro",
  contrat_sous_traitance: "Contrat de sous-traitance",
  cv: "CV",
  diplome: "Diplôme",
  certification: "Certification",
  autre: "Autre",
};

// Ordre du select : on met en tête les pièces les plus courantes du dossier.
const TYPE_ORDER: TrainerDocumentTypeValue[] = [
  "contrat_travail",
  "nda_sous_traitant",
  "kbis_avis_sirene",
  "contrat_sous_traitance",
  "attestation_vigilance_urssaf",
  "assurance_rc_pro",
  "attestation_qualiopi",
  "cv",
  "diplome",
  "certification",
  "dpae",
  "autre",
];

const STATUT_LABELS: Record<DocumentValidationStatutValue, string> = {
  en_attente: "En attente",
  valide: "Validé",
  rejete: "Rejeté",
};

/** Couleur du token admin selon le statut (pas de token `danger` : warning fait office). */
function statutColor(statut: DocumentValidationStatutValue): string {
  if (statut === "valide") return "var(--color-admin-success)";
  if (statut === "rejete") return "var(--color-admin-warning)";
  return "var(--color-admin-fg-muted)";
}

/** Date FR courte, ou « — » si absente. Les props Date sont revivifiées par RSC. */
function formatDate(d: Date | null): string {
  if (d === null) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export function TrainerDocumentsPanel(props: TrainerDocumentsPanelProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { demander, dialogue } = useConfirmation();

  // Formulaire d'ajout.
  const [type, setType] = useState<TrainerDocumentTypeValue>("contrat_travail");
  const [numeroPiece, setNumeroPiece] = useState("");
  const [fichierUrl, setFichierUrl] = useState("");
  const [dateEmission, setDateEmission] = useState("");
  const [dateExpiration, setDateExpiration] = useState("");
  const [notes, setNotes] = useState("");

  // Rejet : la ligne en cours de rejet + son motif (obligatoire côté action).
  const [rejetPourId, setRejetPourId] = useState<string | null>(null);
  const [rejetMotif, setRejetMotif] = useState("");

  function run(fn: () => Promise<{ error: string } | { data: unknown }>, ok: string): void {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if ("error" in r) setError(r.error);
      else {
        setMsg(ok);
        router.refresh();
      }
    });
  }

  function ajouter(): void {
    run(
      () =>
        createTrainerDocumentAction({
          trainerId: props.trainerId,
          type,
          // Champs vides → l'action les traite comme absents (Zod).
          numeroPiece: numeroPiece.trim() === "" ? undefined : numeroPiece.trim(),
          fichierUrl: fichierUrl.trim() === "" ? undefined : fichierUrl.trim(),
          dateEmission: dateEmission === "" ? undefined : dateEmission,
          dateExpiration: dateExpiration === "" ? undefined : dateExpiration,
          notes: notes.trim() === "" ? undefined : notes.trim(),
        }),
      "Pièce enregistrée (en attente de validation).",
    );
    // On vide la saisie de façon optimiste ; le refresh réaffiche la liste à jour.
    setNumeroPiece("");
    setFichierUrl("");
    setDateEmission("");
    setDateExpiration("");
    setNotes("");
  }

  function confirmerRejet(id: string): void {
    if (rejetMotif.trim() === "") {
      setError("Un motif est requis pour rejeter une pièce.");
      return;
    }
    run(
      () =>
        validateTrainerDocumentAction({ id, statutValidation: "rejete", rejetMotif: rejetMotif }),
      "Pièce rejetée.",
    );
    setRejetPourId(null);
    setRejetMotif("");
  }

  return (
    <div className="admin-card mb-[var(--space-admin-5)]">
      {dialogue}
      <h2 className="admin-h2">Pièces justificatives</h2>
      <p className="admin-meta mb-[var(--space-admin-4)]">
        Une pièce ne compte pour la conformité qu&apos;une fois <strong>validée</strong>. Le rejet
        exige un motif.
      </p>

      {error && (
        <p
          role="alert"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {msg && (
        <p
          role="status"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {msg}
        </p>
      )}

      {/* Liste des pièces */}
      {props.documents.length === 0 ? (
        <p className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune pièce enregistrée pour ce formateur.
        </p>
      ) : (
        <div className="mb-[var(--space-admin-5)] overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
            <thead>
              <tr className="text-left text-[color:var(--color-admin-fg-muted)]">
                <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">Type</th>
                <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">N° pièce</th>
                <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">Émission</th>
                <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">Expiration</th>
                <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">Statut</th>
                <th className="py-[var(--space-admin-2)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.documents.map((d) => (
                <tr
                  key={d.id}
                  className="border-t border-[color:var(--color-admin-border)] align-top"
                >
                  <td className="py-[var(--space-admin-3)] pr-[var(--space-admin-3)]">
                    {d.fichierUrl ? (
                      <a
                        href={d.fichierUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[color:var(--color-admin-accent)] underline"
                      >
                        {TYPE_LABELS[d.type]}
                      </a>
                    ) : (
                      TYPE_LABELS[d.type]
                    )}
                    {d.statutValidation === "rejete" && d.rejetMotif && (
                      <span className="mt-1 block text-[color:var(--color-admin-warning)]">
                        Motif : {d.rejetMotif}
                      </span>
                    )}
                  </td>
                  <td className="py-[var(--space-admin-3)] pr-[var(--space-admin-3)]">
                    {d.numeroPiece ?? "—"}
                  </td>
                  <td className="py-[var(--space-admin-3)] pr-[var(--space-admin-3)]">
                    {formatDate(d.dateEmission)}
                  </td>
                  <td className="py-[var(--space-admin-3)] pr-[var(--space-admin-3)]">
                    {formatDate(d.dateExpiration)}
                  </td>
                  <td className="py-[var(--space-admin-3)] pr-[var(--space-admin-3)]">
                    <span style={{ color: statutColor(d.statutValidation) }}>
                      {STATUT_LABELS[d.statutValidation]}
                    </span>
                  </td>
                  <td className="py-[var(--space-admin-3)]">
                    {rejetPourId === d.id ? (
                      <div className="flex flex-col gap-[var(--space-admin-2)]">
                        <input
                          value={rejetMotif}
                          onChange={(e) => setRejetMotif(e.target.value)}
                          disabled={isPending}
                          maxLength={500}
                          placeholder="Motif du rejet (obligatoire)"
                          aria-label="Motif du rejet"
                          className="admin-input"
                        />
                        <div className="flex flex-wrap gap-[var(--space-admin-2)]">
                          <button
                            type="button"
                            disabled={isPending}
                            className="admin-button"
                            onClick={() => confirmerRejet(d.id)}
                          >
                            Confirmer le rejet
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            className="admin-button-ghost"
                            onClick={() => {
                              setRejetPourId(null);
                              setRejetMotif("");
                            }}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-[var(--space-admin-2)]">
                        {d.statutValidation !== "valide" && (
                          <button
                            type="button"
                            disabled={isPending}
                            className="admin-button"
                            onClick={() =>
                              run(
                                () =>
                                  validateTrainerDocumentAction({
                                    id: d.id,
                                    statutValidation: "valide",
                                  }),
                                "Pièce validée.",
                              )
                            }
                          >
                            Valider
                          </button>
                        )}
                        {d.statutValidation !== "rejete" && (
                          <button
                            type="button"
                            disabled={isPending}
                            className="admin-button-ghost"
                            onClick={() => {
                              setRejetPourId(d.id);
                              setRejetMotif("");
                              setError(null);
                            }}
                          >
                            Rejeter
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isPending}
                          className="admin-button-ghost"
                          style={{ color: "var(--color-admin-warning)" }}
                          onClick={() => {
                            demander(
                              {
                                titre: "Supprimer définitivement cette pièce ?",
                                description:
                                  "Les pièces d'un formateur prouvent sa compétence à un auditeur (ind. 21). La suppression reste tracée au journal, mais la pièce, elle, ne revient pas.",
                                destructif: true,
                                libelleConfirmer: "Supprimer",
                              },
                              () =>
                                run(
                                  () => deleteTrainerDocumentAction({ id: d.id }),
                                  "Pièce supprimée.",
                                ),
                            );
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulaire d'ajout */}
      <h3 className="admin-h3 mb-[var(--space-admin-3)]">Ajouter une pièce</h3>
      <div className="admin-detail-grid">
        <label className="flex flex-col gap-[var(--space-admin-1)]">
          <span className="admin-meta">Type de pièce</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TrainerDocumentTypeValue)}
            disabled={isPending}
            className="admin-input"
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-[var(--space-admin-1)]">
          <span className="admin-meta">N° de pièce</span>
          <input
            value={numeroPiece}
            onChange={(e) => setNumeroPiece(e.target.value)}
            disabled={isPending}
            maxLength={60}
            placeholder="Facultatif"
            className="admin-input"
          />
        </label>

        <label className="flex flex-col gap-[var(--space-admin-1)]">
          <span className="admin-meta">URL du fichier</span>
          <input
            type="url"
            value={fichierUrl}
            onChange={(e) => setFichierUrl(e.target.value)}
            disabled={isPending}
            maxLength={2000}
            placeholder="https://…"
            className="admin-input"
          />
        </label>

        <label className="flex flex-col gap-[var(--space-admin-1)]">
          <span className="admin-meta">Date d&apos;émission</span>
          <input
            type="date"
            value={dateEmission}
            onChange={(e) => setDateEmission(e.target.value)}
            disabled={isPending}
            className="admin-input"
          />
        </label>

        <label className="flex flex-col gap-[var(--space-admin-1)]">
          <span className="admin-meta">Date d&apos;expiration</span>
          <input
            type="date"
            value={dateExpiration}
            onChange={(e) => setDateExpiration(e.target.value)}
            disabled={isPending}
            className="admin-input"
          />
        </label>

        <label className="flex flex-col gap-[var(--space-admin-1)]">
          <span className="admin-meta">Notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isPending}
            maxLength={2000}
            placeholder="Facultatif"
            className="admin-input"
          />
        </label>
      </div>

      <div className="mt-[var(--space-admin-4)]">
        <button type="button" disabled={isPending} className="admin-button" onClick={ajouter}>
          {isPending ? "…" : "Ajouter la pièce"}
        </button>
      </div>
    </div>
  );
}
