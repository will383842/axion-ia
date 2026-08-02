"use client";
// use-client: formulaire interactif (création réclamation + réponse) + useTransition pour les server actions.

/**
 * ReclamationForm — Formulaire de création d'une réclamation Qualiopi.
 * ReclamationReponseForm — Formulaire de réponse + changement de statut.
 *
 * "use client" : interactivité locale + appel Server Actions.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  creerReclamationAction,
  repondreReclamationAction,
  setStatutReclamationAction,
} from "@/server/actions/qualiopi/reclamations";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ReclamationSource = "stagiaire" | "client" | "financeur" | "autre";
type ReclamationStatut = "nouvelle" | "en_cours" | "resolue" | "cloturee";

const SOURCE_LABELS: Record<ReclamationSource, string> = {
  stagiaire: "Stagiaire",
  client: "Client (entreprise)",
  financeur: "Financeur / OPCO",
  autre: "Autre",
};

const STATUT_LABELS: Record<ReclamationStatut, string> = {
  nouvelle: "Nouvelle",
  en_cours: "En cours",
  resolue: "Résolue",
  cloturee: "Clôturée",
};

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const fieldCls = "flex flex-col gap-1";

// ─────────────────────────────────────────────────────────────────────────────
// Formulaire création
// ─────────────────────────────────────────────────────────────────────────────

export interface ReclamationFormProps {
  creerAction: typeof creerReclamationAction;
}

export function ReclamationForm({ creerAction }: ReclamationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [source, setSource] = useState<ReclamationSource>("stagiaire");
  const [reclamantNom, setReclamantNom] = useState("");
  const [reclamantEmail, setReclamantEmail] = useState("");
  const [objet, setObjet] = useState("");
  const [description, setDescription] = useState("");
  const [gravite, setGravite] = useState("");
  const [dateReception, setDateReception] = useState(() => new Date().toISOString().slice(0, 10));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await creerAction({
        source,
        reclamantNom,
        ...(reclamantEmail ? { reclamantEmail } : {}),
        objet,
        description,
        ...(gravite ? { gravite } : {}),
        dateReception: new Date(dateReception),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg(`Réclamation ${result.data.numero} enregistrée.`);
        setReclamantNom("");
        setReclamantEmail("");
        setObjet("");
        setDescription("");
        setGravite("");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-6)]"
    >
      <h3 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Nouvelle réclamation
      </h3>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        {/* Source */}
        <div className={fieldCls}>
          <label htmlFor="reclamationform-origine" className={labelCls}>
            Origine
          </label>
          <select
            id="reclamationform-origine"
            value={source}
            onChange={(e) => setSource(e.target.value as ReclamationSource)}
            disabled={isPending}
            className={inputCls}
          >
            {(Object.keys(SOURCE_LABELS) as ReclamationSource[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {/* Date réception */}
        <div className={fieldCls}>
          <label htmlFor="reclamationform-date-de-reception" className={labelCls}>
            Date de réception
          </label>
          <input
            id="reclamationform-date-de-reception"
            type="date"
            value={dateReception}
            onChange={(e) => setDateReception(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>

        {/* Réclamant nom */}
        <div className={fieldCls}>
          <label htmlFor="reclamationform-nom-du-reclamant" className={labelCls}>
            Nom du réclamant
          </label>
          <input
            id="reclamationform-nom-du-reclamant"
            type="text"
            value={reclamantNom}
            onChange={(e) => setReclamantNom(e.target.value)}
            disabled={isPending}
            required
            maxLength={200}
            placeholder="Nom Prénom"
            className={inputCls}
          />
        </div>

        {/* Réclamant email */}
        <div className={fieldCls}>
          <label htmlFor="reclamationform-email-facultatif" className={labelCls}>
            Email (facultatif)
          </label>
          <input
            id="reclamationform-email-facultatif"
            type="email"
            value={reclamantEmail}
            onChange={(e) => setReclamantEmail(e.target.value)}
            disabled={isPending}
            maxLength={255}
            placeholder="contact@exemple.fr"
            className={inputCls}
          />
        </div>

        {/* Gravité */}
        <div className={fieldCls}>
          <label htmlFor="reclamationform-gravite-facultatif" className={labelCls}>
            Gravité (facultatif)
          </label>
          <select
            id="reclamationform-gravite-facultatif"
            value={gravite}
            onChange={(e) => setGravite(e.target.value)}
            disabled={isPending}
            className={inputCls}
          >
            <option value="">— Non précisée —</option>
            <option value="mineure">Mineure</option>
            <option value="majeure">Majeure</option>
            <option value="critique">Critique</option>
          </select>
        </div>
      </div>

      {/* Objet */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label htmlFor="reclamationform-objet-de-la-reclamation" className={labelCls}>
          Objet de la réclamation
        </label>
        <input
          id="reclamationform-objet-de-la-reclamation"
          type="text"
          value={objet}
          onChange={(e) => setObjet(e.target.value)}
          disabled={isPending}
          required
          maxLength={300}
          placeholder="Résumé en une phrase"
          className={inputCls}
        />
      </div>

      {/* Description */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label htmlFor="reclamationform-description-detaillee" className={labelCls}>
          Description détaillée
        </label>
        <textarea
          id="reclamationform-description-detaillee"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
          required
          rows={4}
          className={inputCls}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}

      <button type="submit" disabled={isPending} className="admin-button mt-[var(--space-admin-4)]">
        {isPending ? "Enregistrement..." : "Enregistrer la réclamation"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulaire réponse + statut
// ─────────────────────────────────────────────────────────────────────────────

export interface ReclamationReponseFormProps {
  reclamationId: string;
  statutActuel: ReclamationStatut;
  repondreAction: typeof repondreReclamationAction;
  setStatutAction: typeof setStatutReclamationAction;
}

export function ReclamationReponseForm({
  reclamationId,
  statutActuel,
  repondreAction,
  setStatutAction,
}: ReclamationReponseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [reponse, setReponse] = useState("");
  const [actionsCorrectives, setActionsCorrectives] = useState("");
  const [nouveauStatut, setNouveauStatut] = useState<ReclamationStatut>(statutActuel);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      // Réponse d'abord si renseignée
      if (reponse.trim()) {
        const r = await repondreAction({
          id: reclamationId,
          reponse,
          ...(actionsCorrectives.trim() ? { actionsCorrectives } : {}),
        });
        if ("error" in r) {
          setError(r.error);
          return;
        }
      }

      // Changement de statut si modifié
      if (nouveauStatut !== statutActuel) {
        const r = await setStatutAction({ id: reclamationId, statut: nouveauStatut });
        if ("error" in r) {
          setError(r.error);
          return;
        }
      }

      setSuccessMsg("Réclamation mise à jour.");
      setReponse("");
      setActionsCorrectives("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-5)]"
    >
      <h4 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
        Traitement de la réclamation
      </h4>

      {/* Statut */}
      <div className={`mb-[var(--space-admin-3)] ${fieldCls}`}>
        <label htmlFor="reclamationform-statut" className={labelCls}>
          Statut
        </label>
        <select
          id="reclamationform-statut"
          value={nouveauStatut}
          onChange={(e) => setNouveauStatut(e.target.value as ReclamationStatut)}
          disabled={isPending}
          className={inputCls}
        >
          {(Object.keys(STATUT_LABELS) as ReclamationStatut[]).map((s) => (
            <option key={s} value={s}>
              {STATUT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Réponse */}
      <div className={`mb-[var(--space-admin-3)] ${fieldCls}`}>
        <label htmlFor="reclamationform-reponse-apportee" className={labelCls}>
          Réponse apportée
        </label>
        <textarea
          id="reclamationform-reponse-apportee"
          value={reponse}
          onChange={(e) => setReponse(e.target.value)}
          disabled={isPending}
          rows={3}
          placeholder="Décrire la réponse donnée au réclamant…"
          className={inputCls}
        />
      </div>

      {/* Actions correctives */}
      <div className={`mb-[var(--space-admin-3)] ${fieldCls}`}>
        <label htmlFor="reclamationform-actions-correctives-facultatif" className={labelCls}>
          Actions correctives (facultatif)
        </label>
        <textarea
          id="reclamationform-actions-correctives-facultatif"
          value={actionsCorrectives}
          onChange={(e) => setActionsCorrectives(e.target.value)}
          disabled={isPending}
          rows={2}
          placeholder="Mesures prises pour éviter la récurrence…"
          className={inputCls}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}

      <button type="submit" disabled={isPending} className="admin-button">
        {isPending ? "Enregistrement..." : "Mettre à jour"}
      </button>
    </form>
  );
}
