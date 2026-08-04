"use client";
// use-client: formulaire de création d'appréciation (sélects + textarea + date) avec useTransition.
/**
 * AppreciationForm — Formulaire de création d&apos;une appréciation admin (off.30).
 *
 * Permet de saisir :
 *   - Source (stagiaire / entreprise / financeur / formateur)
 *   - Note /5 (facultatif)
 *   - Commentaire (facultatif)
 *   - Date de l&apos;appréciation
 *   - traineeId / enrollmentId / clientId (optionnels)
 *
 * Submit → `creerAppreciationAction`.
 * Tokens admin var(--color-admin-*) — espace admin uniquement.
 */

import { useState, useTransition } from "react";
import { AdminBlocRepliable } from "@/components/admin/ui/AdminBlocRepliable";

type ActionResult<T> = { data: T } | { error: string };

type AppreciationSource = "stagiaire" | "entreprise" | "financeur" | "formateur";

const SOURCE_OPTIONS: Array<{ value: AppreciationSource; label: string }> = [
  { value: "stagiaire", label: "Stagiaire" },
  { value: "entreprise", label: "Entreprise" },
  { value: "financeur", label: "Financeur" },
  { value: "formateur", label: "Formateur" },
];

interface OptionRattachement {
  id: string;
  libelle: string;
}

interface AppreciationFormProps {
  /** Listes de rattachement — remplacent la saisie d UUID a la main. */
  stagiaires: ReadonlyArray<OptionRattachement>;
  inscriptions: ReadonlyArray<OptionRattachement>;
  clients: ReadonlyArray<OptionRattachement>;
  creerAction: (input: {
    source: AppreciationSource;
    enrollmentId?: string;
    traineeId?: string;
    clientId?: string;
    note?: number;
    commentaire?: string;
    dateAppreciation: Date;
  }) => Promise<ActionResult<{ id: string }>>;
}

export function AppreciationForm({
  creerAction,
  stagiaires,
  inscriptions,
  clients,
}: AppreciationFormProps): React.ReactElement {
  const [source, setSource] = useState<AppreciationSource>("stagiaire");
  const [note, setNote] = useState<string>("");
  const [commentaire, setCommentaire] = useState("");
  const [dateAppreciation, setDateAppreciation] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [traineeId, setTraineeId] = useState("");
  const [enrollmentId, setEnrollmentId] = useState("");
  const [clientId, setClientId] = useState("");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const labelCls =
    "mb-1 block text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)]";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessId(null);

    const noteVal = note.trim() ? parseInt(note, 10) : undefined;
    if (noteVal !== undefined && (isNaN(noteVal) || noteVal < 1 || noteVal > 5)) {
      setError("La note doit être un entier entre 1 et 5.");
      return;
    }

    const dateVal = new Date(dateAppreciation);
    if (isNaN(dateVal.getTime())) {
      setError("Date invalide.");
      return;
    }

    startTransition(async () => {
      const result = await creerAction({
        source,
        dateAppreciation: dateVal,
        ...(noteVal !== undefined ? { note: noteVal } : {}),
        ...(commentaire.trim() ? { commentaire: commentaire.trim() } : {}),
        ...(traineeId.trim() ? { traineeId: traineeId.trim() } : {}),
        ...(enrollmentId.trim() ? { enrollmentId: enrollmentId.trim() } : {}),
        ...(clientId.trim() ? { clientId: clientId.trim() } : {}),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessId(result.data.id);
        // Reset form
        setNote("");
        setCommentaire("");
        setTraineeId("");
        setEnrollmentId("");
        setClientId("");
        setDateAppreciation(new Date().toISOString().slice(0, 10));
      }
    });
  }

  return (
    // Replié par défaut (décision Will, 2026-08-03) : le registre s'ouvre sur
    // ce qui est ENREGISTRÉ, pas sur un formulaire vide. Cf. AdminBlocRepliable.
    <AdminBlocRepliable titre="+ Nouvelle appréciation">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
          {/* Source */}
          <div>
            <label className={labelCls} htmlFor="app-source">
              Source *
            </label>
            <select
              id="app-source"
              value={source}
              onChange={(e) => setSource(e.target.value as AppreciationSource)}
              disabled={isPending}
              className={inputCls}
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className={labelCls} htmlFor="app-date">
              Date *
            </label>
            <input
              id="app-date"
              type="date"
              value={dateAppreciation}
              onChange={(e) => setDateAppreciation(e.target.value)}
              disabled={isPending}
              required
              className={inputCls}
            />
          </div>

          {/* Note */}
          <div>
            <label className={labelCls} htmlFor="app-note">
              Note /5 (facultatif)
            </label>
            <input
              id="app-note"
              type="number"
              min={1}
              max={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isPending}
              placeholder="1 à 5"
              className={inputCls}
            />
          </div>

          {/* 🔴 Ces trois champs demandaient de COLLER un UUID à la main, avec
              « xxxxxxxx-xxxx-… » en exemple. Personne ne connaît l'UUID d'un
              stagiaire : ils restaient vides, et l'appréciation ne se
              rattachait à rien. Ce sont désormais des listes ; l'identifiant
              reste la valeur transmise, il a juste cessé d'être saisi. */}
          <div>
            <label className={labelCls} htmlFor="app-trainee-id">
              Stagiaire concerné (facultatif)
            </label>
            <select
              id="app-trainee-id"
              value={traineeId}
              onChange={(e) => setTraineeId(e.target.value)}
              disabled={isPending || stagiaires.length === 0}
              className={inputCls}
            >
              <option value="">
                {stagiaires.length === 0 ? "— aucun stagiaire enregistré —" : "— aucun —"}
              </option>
              {stagiaires.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.libelle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="app-enrollment-id">
              Inscription concernée (facultatif)
            </label>
            <select
              id="app-enrollment-id"
              value={enrollmentId}
              onChange={(e) => setEnrollmentId(e.target.value)}
              disabled={isPending || inscriptions.length === 0}
              className={inputCls}
            >
              <option value="">
                {inscriptions.length === 0 ? "— aucune inscription —" : "— aucune —"}
              </option>
              {inscriptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.libelle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="app-client-id">
              Client concerné (facultatif)
            </label>
            <select
              id="app-client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isPending || clients.length === 0}
              className={inputCls}
            >
              <option value="">
                {clients.length === 0 ? "— aucun client enregistré —" : "— aucun —"}
              </option>
              {clients.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.libelle}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Commentaire (pleine largeur) */}
        <div className="mt-[var(--space-admin-4)]">
          <label className={labelCls} htmlFor="app-commentaire">
            Commentaire (facultatif)
          </label>
          <textarea
            id="app-commentaire"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            disabled={isPending}
            rows={3}
            maxLength={5000}
            className={inputCls}
            placeholder="Retour libre…"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
          >
            {error}
          </p>
        )}

        {successId && (
          <p
            role="status"
            className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
          >
            Appréciation enregistrée.
          </p>
        )}

        <div className="mt-[var(--space-admin-4)]">
          <button type="submit" disabled={isPending} className="admin-button">
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </AdminBlocRepliable>
  );
}
