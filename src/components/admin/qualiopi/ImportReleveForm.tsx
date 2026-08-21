"use client";
// use-client: lecture du fichier CSV côté client (file.text()) + état du rapport d'import + server action.
/**
 * ImportReleveForm — Formulaire d'import du relevé de connexion distanciel.
 *
 * - Sélection de la plateforme (Zoom / Teams / Meet / Autre).
 * - `<input type="file">` accept=".csv,.tsv,.txt".
 * - Lecture du fichier en texte côté client (`file.text()`).
 * - Appel `importReleveConnexionAction` → affiche rapport matched/unmatched.
 *
 * "use client" : interactivité fichier + appel Server Action.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlateformeLabel } from "@/server/qualiopi/presence/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportReleveFormProps {
  sessionId: string;
  importAction: (input: {
    sessionId: string;
    plateforme: PlateformeLabel;
    fileName: string;
    content: string;
  }) => Promise<
    | {
        data: {
          importId: string;
          nbMatched: number;
          nbUnmatched: number;
          unmatched: Array<{ nom: string; email: string | null; dureeMinutes: number }>;
        };
      }
    | { error: string }
  >;
  /**
   * 🔴 `D2-3-C3` (2026-08-21) — CETTE ACTION N'ÉTAIT APPELÉE DE NULLE PART.
   *
   * `genererReleveConnexionDocumentAction` était écrite et testée. Ce formulaire
   * affichait la référence d'import en police mono… et n'offrait aucun moyen
   * d'en produire le relevé. Le document était donc **impossible à obtenir**.
   *
   * ⚠️ Ce n'est pas un PDF de confort. Le relevé de connexion porte, en toutes
   * lettres, la phrase « Ce document remplace la feuille d'émargement pour les
   * formations dispensées à distance » : c'est LA pièce qu'un OPCO réclame pour
   * financer une action distancielle, et celle que le dossier d'audit attend.
   *
   * Sans ce bouton, la chaîne distancielle s'arrêtait une marche avant la fin :
   * l'import calculait bien le taux, mais la preuve archivée n'existait pas.
   */
  genererReleveAction: (input: {
    importId: string;
  }) => Promise<{ data: { documentId: string; numero: string } } | { error: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const PLATEFORMES: Array<{ value: PlateformeLabel; label: string }> = [
  { value: "zoom", label: "Zoom" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "meet", label: "Google Meet" },
  { value: "autre", label: "Autre" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function ImportReleveForm({
  sessionId,
  importAction,
  genererReleveAction,
}: ImportReleveFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // ⚠️ Transition SÉPARÉE de celle de l'import : sans elle, générer le relevé
  // remettrait le formulaire d'import en « Import en cours… » et redonnerait à
  // penser qu'on ré-importe le fichier.
  const [enCoursReleve, demarrerReleve] = useTransition();
  const [numeroReleve, setNumeroReleve] = useState("");
  const [erreurReleve, setErreurReleve] = useState("");
  const [plateforme, setPlateforme] = useState<PlateformeLabel>("zoom");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rapport, setRapport] = useState<{
    importId: string;
    nbMatched: number;
    nbUnmatched: number;
    unmatched: Array<{ nom: string; email: string | null; dureeMinutes: number }>;
  } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
    setRapport(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Veuillez sélectionner un fichier.");
      return;
    }
    setError(null);
    setRapport(null);

    startTransition(async () => {
      let content: string;
      try {
        content = await file.text();
      } catch {
        setError("Impossible de lire le fichier. Vérifiez qu'il s'agit d'un fichier texte valide.");
        return;
      }

      const result = await importAction({
        sessionId,
        plateforme,
        fileName: file.name,
        content,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setRapport(result.data);
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
  const selectCls =
    "mt-1 block w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const fileCls =
    "mt-1 block w-full text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] file:mr-4 file:rounded file:border-0 file:bg-[color:var(--color-admin-surface)] file:px-[var(--space-admin-3)] file:py-[var(--space-admin-2)] file:text-[length:var(--text-admin-sm)] file:font-medium file:text-[color:var(--color-admin-fg)]";

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h3 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Importer un relevé de connexion
      </h3>

      <form onSubmit={handleSubmit} className="space-y-[var(--space-admin-4)]">
        {/* Sélection plateforme */}
        <div>
          <label htmlFor="import-plateforme" className={labelCls}>
            Plateforme
          </label>
          <select
            id="import-plateforme"
            value={plateforme}
            onChange={(e) => setPlateforme(e.target.value as PlateformeLabel)}
            disabled={isPending}
            className={selectCls}
          >
            {PLATEFORMES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sélection fichier */}
        <div>
          <label htmlFor="import-file" className={labelCls}>
            Fichier rapport de présence
          </label>
          <input
            id="import-file"
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileChange}
            disabled={isPending}
            className={fileCls}
          />
          <p className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Formats acceptés : CSV, TSV, TXT. Taille max recommandée : 5 Mo.
          </p>
        </div>

        {/* Erreur */}
        {error && (
          <p
            role="alert"
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
          >
            Erreur : {error}
          </p>
        )}

        {/* Bouton submit */}
        <button type="submit" disabled={isPending || !file} className="admin-button">
          {isPending ? "Import en cours…" : "Importer le relevé"}
        </button>
      </form>

      {/* Rapport post-import */}
      {rapport && (
        <div className="mt-[var(--space-admin-5)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]">
          <h4 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
            Rapport d&apos;import
          </h4>
          <div className="flex gap-[var(--space-admin-5)] text-[length:var(--text-admin-sm)]">
            <div>
              <span className="font-semibold text-[color:var(--color-admin-success)]">
                {rapport.nbMatched}
              </span>{" "}
              <span className="text-[color:var(--color-admin-fg-muted)]">rapprochés</span>
            </div>
            <div>
              <span
                className={
                  rapport.nbUnmatched > 0
                    ? "font-semibold text-[color:var(--color-admin-warning)]"
                    : "text-[color:var(--color-admin-fg-muted)]"
                }
              >
                {rapport.nbUnmatched}
              </span>{" "}
              <span className="text-[color:var(--color-admin-fg-muted)]">non rapprochés</span>
            </div>
          </div>

          {rapport.unmatched.length > 0 && (
            <div className="mt-[var(--space-admin-3)]">
              <p className="mb-1 text-[length:var(--text-admin-xs)] font-medium tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                Participants non rapprochés
              </p>
              <ul className="space-y-1">
                {rapport.unmatched.map((u, i) => (
                  <li
                    key={i}
                    className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)]"
                  >
                    <span className="font-medium">{u.nom}</span>
                    {u.email && (
                      <span className="ml-1 text-[color:var(--color-admin-fg-muted)]">
                        ({u.email})
                      </span>
                    )}{" "}
                    — {u.dureeMinutes} min
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Référence import : <span className="font-mono">{rapport.importId}</span>
          </p>

          <div className="mt-[var(--space-admin-3)]">
            <button
              type="button"
              disabled={enCoursReleve}
              onClick={() => {
                setErreurReleve("");
                demarrerReleve(() => {
                  void genererReleveAction({ importId: rapport.importId }).then((res) => {
                    if ("error" in res) {
                      setErreurReleve(res.error);
                      return;
                    }
                    setNumeroReleve(res.data.numero);
                    router.refresh();
                  });
                });
              }}
              className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] disabled:opacity-50"
            >
              {enCoursReleve ? "Génération…" : "Générer le relevé de connexion (PDF)"}
            </button>
            {numeroReleve !== "" && (
              <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]">
                {/* Le NUMÉRO, pas « c'est fait » : c'est lui qu'on cite dans un
                    dossier de financement, et le voir confirme que la pièce est
                    numérotée au registre. */}
                {`Relevé ${numeroReleve} généré — il remplace la feuille d'émargement pour cette session à distance.`}
              </p>
            )}
            {erreurReleve !== "" && (
              <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]">
                {erreurReleve}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
