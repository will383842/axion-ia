"use client";
// use-client: boutons de cycle de vie déclenchant des server actions (startGenerationAction, validateFormationAction, publishFormationAction, publierIndicateursAction) + router.refresh().

/**
 * FormationLifecycleButtons — Boutons d&apos;action sur le cycle de vie d&apos;une formation.
 *
 * Affichage conditionnel selon `statut`, `statutGeneration` et `validatedAt` :
 *
 * - « Lancer la génération IA »  → statuts relançables (intention / structure_generee /
 *   contenu_evalue), appelle `startGenerationAction`.
 * - « Valider (humain) »         → non encore validée (`validatedAt === null`),
 *   appelle `validateFormationAction`.
 * - « Publier »                  → validée + non publiée, appelle `publishFormationAction`.
 * - « Publier les indicateurs »  → publiée, formulaire minimal, appelle
 *   `publierIndicateursAction`.
 *
 * Chaque action est suivie d&apos;un `router.refresh()`.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  validateFormationAction,
  publishFormationAction,
  publierIndicateursAction,
  archiveFormationAction,
  duplicateFormationAction,
  resetGenerationStatusAction,
} from "@/server/actions/qualiopi/formations";
import { startGenerationAction } from "@/server/actions/qualiopi/engine";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FormationStatutGeneration =
  | "intention"
  | "structure_generee"
  | "contenu_evalue"
  | "structure_validee"
  | "contenu_genere"
  | "contenu_valide"
  | "assemble"
  | "publie"
  | "archive";

type FormationStatut = "actif" | "publie" | "archive";

export interface FormationLifecycleButtonsProps {
  formationId: string;
  statut: FormationStatut;
  statutGeneration: FormationStatutGeneration;
  /** Null si la validation humaine n'a pas encore été faite. */
  validatedAt: Date | null;
  /** Score de réussite actuel (pour aide contextuelle). */
  ratioPratiquePct: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Statuts relançables pour la génération IA
// ─────────────────────────────────────────────────────────────────────────────

const RELANCABLE_STATUTS: FormationStatutGeneration[] = [
  "intention",
  "structure_generee",
  "contenu_evalue",
];

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : formulaire publication indicateurs
// ─────────────────────────────────────────────────────────────────────────────

interface IndicateursFormProps {
  formationId: string;
  onDone: () => void;
}

function IndicateursForm({ formationId, onDone }: IndicateursFormProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [libelle, setLibelle] = useState("Taux de réussite");
  const [valeur, setValeur] = useState<number | "">("");
  const [unite, setUnite] = useState("%");
  const [annee, setAnnee] = useState<number | "">(new Date().getFullYear());
  const [methodeCalcul, setMethodeCalcul] = useState("");
  const [error, setError] = useState<string | null>(null);

  const labelCls =
    "block text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (valeur === "") {
      setError("La valeur est requise.");
      return;
    }
    if (!methodeCalcul.trim()) {
      setError("La méthode de calcul est requise.");
      return;
    }
    if (annee === "") {
      setError("L'année est requise.");
      return;
    }

    startTransition(async () => {
      const result = await publierIndicateursAction({
        formationId,
        indicateurs: [
          {
            libelle: libelle.trim(),
            valeur: valeur as number,
            unite: unite.trim(),
            annee: annee as number,
          },
        ],
        methodeCalcul: methodeCalcul.trim(),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        onDone();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-[var(--space-admin-4)] space-y-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
    >
      <p className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
        Publier un indicateur de résultats (off.1/2 Qualiopi)
      </p>

      <div className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-2">
        <div>
          <label htmlFor="ind-libelle" className={labelCls}>
            Libellé
          </label>
          <input
            id="ind-libelle"
            type="text"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            maxLength={200}
            required
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="ind-valeur" className={labelCls}>
            Valeur
          </label>
          <input
            id="ind-valeur"
            type="number"
            step="0.01"
            value={valeur}
            onChange={(e) => setValeur(e.target.value === "" ? "" : parseFloat(e.target.value))}
            required
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="ind-unite" className={labelCls}>
            Unité
          </label>
          <input
            id="ind-unite"
            type="text"
            value={unite}
            onChange={(e) => setUnite(e.target.value)}
            maxLength={50}
            required
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="ind-annee" className={labelCls}>
            Année
          </label>
          <input
            id="ind-annee"
            type="number"
            value={annee}
            onChange={(e) => setAnnee(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
            min={2020}
            max={2100}
            required
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="ind-methode" className={labelCls}>
          Méthode de calcul
        </label>
        <textarea
          id="ind-methode"
          value={methodeCalcul}
          onChange={(e) => setMethodeCalcul(e.target.value)}
          rows={3}
          required
          maxLength={2000}
          placeholder="Décrivez la méthode de calcul de l'indicateur…"
          className={inputCls}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-[var(--space-admin-3)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Publication…" : "Publier l’indicateur"}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function FormationLifecycleButtons({
  formationId,
  statut,
  statutGeneration,
  validatedAt,
  ratioPratiquePct,
}: FormationLifecycleButtonsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showIndicateursForm, setShowIndicateursForm] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const isArchive = statut === "archive" || statutGeneration === "archive";
  // Cul-de-sacs du moteur : statuts que startGenerationAction refuse et que le
  // worker traite en no-op — seul resetGenerationStatusAction en sort.
  const isResetable = ["publie", "assemble", "contenu_valide", "contenu_genere"].includes(
    statutGeneration,
  );

  function handleResetGeneration() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await resetGenerationStatusAction(formationId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setConfirmReset(false);
        setInfo(result.data.avertissement);
        router.refresh();
      }
    });
  }

  function handleDuplicate() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await duplicateFormationAction(formationId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setInfo(
          `Formation dupliquée — n° ${result.data.numero}. La copie repart en « intention » (non validée) ; retrouvez-la dans la liste des formations.`,
        );
        router.refresh();
      }
    });
  }

  function handleArchive() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await archiveFormationAction(formationId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setConfirmArchive(false);
        router.refresh();
      }
    });
  }

  function handleAction(fn: () => Promise<{ error: string } | { data: unknown }>) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await fn();
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  const btnCls = "admin-button";
  const btnDisabledCls = "admin-button opacity-50 cursor-not-allowed";

  if (isArchive) {
    return (
      <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Formation archivée — aucune action disponible.
        </p>
      </div>
    );
  }

  const canStartGeneration = RELANCABLE_STATUTS.includes(statutGeneration);
  const canValidate = validatedAt === null && statutGeneration !== "intention";
  const canPublish = validatedAt !== null && statutGeneration !== "publie";
  const canPublishIndicateurs = statutGeneration === "publie";

  return (
    <div className="space-y-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h3 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Actions de cycle de vie
      </h3>

      <div className="flex flex-wrap gap-[var(--space-admin-3)]">
        {/* Lancer la génération IA */}
        {canStartGeneration && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleAction(() => startGenerationAction({ formationId }))}
            className={isPending ? btnDisabledCls : btnCls}
          >
            {isPending ? "En cours…" : "Lancer la génération IA"}
          </button>
        )}

        {/* Ré-enrichir — sort du cul-de-sac publie/assemble pour repasser par le
            moteur (pilote qualité). 2 temps : l'avertissement de
            non-planifiabilité est affiché AVANT confirmation. */}
        {isResetable && !isArchive && (
          <>
            {!confirmReset ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setConfirmReset(true);
                }}
                className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)] hover:border-[color:var(--color-admin-accent)] hover:text-[color:var(--color-admin-accent)] disabled:opacity-50"
              >
                Ré-enrichir (moteur IA)
              </button>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-[var(--space-admin-2)]">
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                  La formation sortira du sélecteur de sessions et de la page publique jusqu&apos;à
                  revalidation + republication. Continuer ?
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleResetGeneration}
                  className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] disabled:opacity-50"
                >
                  {isPending ? "…" : "Confirmer le ré-enrichissement"}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setConfirmReset(false)}
                  className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] disabled:opacity-50"
                >
                  Annuler
                </button>
              </span>
            )}
          </>
        )}

        {/* Dupliquer — repart en « intention », non validée (cf. garde d'édition) */}
        <button
          type="button"
          disabled={isPending}
          onClick={handleDuplicate}
          className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)] hover:border-[color:var(--color-admin-accent)] hover:text-[color:var(--color-admin-accent)] disabled:opacity-50"
        >
          Dupliquer
        </button>

        {/* Archiver — retire du catalogue actif (2 temps) */}
        {!confirmArchive ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setError(null);
              setInfo(null);
              setConfirmArchive(true);
            }}
            className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)] hover:border-[color:var(--color-admin-error)] disabled:opacity-50"
          >
            Archiver
          </button>
        ) : (
          <span className="inline-flex items-center gap-[var(--space-admin-2)]">
            <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Retirer du catalogue actif ?
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleArchive}
              className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-error)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] disabled:opacity-50"
            >
              {isPending ? "…" : "Confirmer l'archivage"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmArchive(false)}
              className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] disabled:opacity-50"
            >
              Annuler
            </button>
          </span>
        )}

        {/* Valider (humain) */}
        {canValidate && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleAction(() => validateFormationAction(formationId))}
            className={isPending ? btnDisabledCls : btnCls}
          >
            {isPending ? "En cours…" : "Valider (humain)"}
          </button>
        )}

        {/* Publier */}
        {canPublish && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleAction(() => publishFormationAction(formationId))}
            className={isPending ? btnDisabledCls : btnCls}
          >
            {isPending ? "Publication…" : "Publier"}
          </button>
        )}

        {/* Publier les indicateurs */}
        {canPublishIndicateurs && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setShowIndicateursForm((v) => !v)}
            className={btnCls}
          >
            {showIndicateursForm ? "Annuler indicateurs" : "Publier les indicateurs"}
          </button>
        )}
      </div>

      {/* Aide contextuelle : ratio pratique manquant */}
      {canValidate && ratioPratiquePct === null && (
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
          Le ratio pratique n&apos;est pas encore défini. Il sera requis pour la publication.
        </p>
      )}

      {/* Aide contextuelle : validation non faite */}
      {!canValidate && validatedAt === null && !canStartGeneration && !isArchive && (
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          La génération IA doit avancer avant de pouvoir valider la formation.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {info && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          {info}
        </p>
      )}

      {/* Formulaire publication indicateurs */}
      {showIndicateursForm && (
        <IndicateursForm
          formationId={formationId}
          onDone={() => {
            setShowIndicateursForm(false);
            setInfo("Indicateurs publiés.");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
