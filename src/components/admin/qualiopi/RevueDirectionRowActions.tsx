"use client";
// use-client: édition inline d'une revue de direction (date + statut) via useTransition + Server Action.

/**
 * RevueDirectionRowActions — Édition d'une revue de direction (T19).
 *
 * Bouton « Modifier » ouvre un panneau d'édition inline : date, statut,
 * **décisions** et **plan d'actions** → updateRevueDirectionAction.
 *
 * ── Pourquoi les deux champs JSON sont éditables ici (2026-08-03) ────────────
 * Ils ne l'étaient pas, et l'en-tête de ce fichier affirmait qu'ils étaient
 * « capturés à la création / via les outils dédiés ». C'était faux sur les deux
 * points : le formulaire de création ne saisit qu'année/date/participants, et le
 * seul outil dédié (`reporterEnRevueDirectionAction`) reporte un constat DEPUIS
 * un autre écran — registres qui peuvent être vides.
 *
 * Résultat constaté en production : une revue existait, datée, archivée, avec
 * `decisions = []` et `planActions = []`, et **aucun chemin d'interface pour la
 * remplir**. `updateRevueDirectionAction` acceptait pourtant les deux champs
 * depuis toujours. Fonctionnalité complète, testée, sans appelant.
 *
 * L'indicateur 32 (non graduable) exige des décisions et un plan d'actions
 * tracés : le trou d'interface valait non-conformité majeure.
 *
 * ── Préservation de la provenance ───────────────────────────────────────────
 * Une entrée reportée automatiquement porte `{ action, source, ajouteAt }`. Un
 * aller-retour naïf par du texte écraserait `source` et `ajouteAt`, donc la
 * traçabilité de l'origine du constat — exactement ce que l'auditeur vérifie.
 * On ne reconstruit donc un objet QUE si le libellé de la ligne a changé ; sinon
 * l'objet d'origine est réutilisé tel quel.
 *
 * "use client" : useState/useTransition + appel Server Action.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { updateRevueDirectionAction } from "@/server/actions/qualiopi/revue-direction";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";

/**
 * Libellé affichable d'une entrée `decisions` / `planActions`.
 *
 * Mêmes clés que `resumeJsonListe` de `registres-pdf.ts` — si les deux
 * divergeaient, l'écran et le PDF d'export ne montreraient pas la même chose.
 */
function libelleEntree(x: unknown): string {
  if (typeof x === "string") return x;
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const cle of ["libelle", "titre", "action", "nom", "decision"]) {
      const v = o[cle];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return "";
}

/** Une entrée par ligne, les lignes vides sont ignorées. */
function versTexte(liste: readonly unknown[]): string {
  return liste
    .map(libelleEntree)
    .filter((s) => s.trim().length > 0)
    .join("\n");
}

/**
 * Reconstruit la liste depuis le texte saisi, en **réutilisant l'objet d'origine**
 * quand le libellé n'a pas bougé — c'est ce qui préserve `source` et `ajouteAt`
 * des constats reportés automatiquement.
 */
function versListe(texte: string, origine: readonly unknown[], cle: "decision" | "action"): unknown[] {
  const restants = origine.filter((x) => libelleEntree(x).trim().length > 0);
  return texte
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((ligne) => {
      const i = restants.findIndex((x) => libelleEntree(x).trim() === ligne);
      if (i !== -1) return restants.splice(i, 1)[0];
      return { [cle]: ligne, source: "saisie manuelle", ajouteAt: new Date().toISOString() };
    });
}

export interface RevueDirectionRowActionsProps {
  revue: {
    id: string;
    dateRevue: Date;
    statut: string;
    decisions: readonly unknown[];
    planActions: readonly unknown[];
  };
  updateAction: typeof updateRevueDirectionAction;
}

export function RevueDirectionRowActions({
  revue,
  updateAction,
}: RevueDirectionRowActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateRevue, setDateRevue] = useState(() => revue.dateRevue.toISOString().slice(0, 10));
  const [statut, setStatut] = useState(revue.statut);
  const [decisionsRaw, setDecisionsRaw] = useState(() => versTexte(revue.decisions));
  const [planActionsRaw, setPlanActionsRaw] = useState(() => versTexte(revue.planActions));

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAction({
        id: revue.id,
        dateRevue: new Date(dateRevue),
        statut,
        decisions: versListe(decisionsRaw, revue.decisions, "decision"),
        planActions: versListe(planActionsRaw, revue.planActions, "action"),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] transition-opacity hover:opacity-80"
      >
        Modifier
      </button>
    );
  }

  return (
    <form
      onSubmit={handleUpdate}
      className="flex w-full max-w-sm flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
    >
      <div>
        <label htmlFor="revuedirectionrowactions-date-de-la-revue" className={labelCls}>
          Date de la revue
        </label>
        <input
          id="revuedirectionrowactions-date-de-la-revue"
          type="date"
          value={dateRevue}
          onChange={(e) => setDateRevue(e.target.value)}
          disabled={isPending}
          required
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="revuedirectionrowactions-statut" className={labelCls}>
          Statut
        </label>
        <select
          id="revuedirectionrowactions-statut"
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          disabled={isPending}
          className={inputCls}
        >
          <option value="brouillon">Brouillon</option>
          <option value="validee">Validée</option>
          <option value="archivee">Archivée</option>
        </select>
        {statut !== "validee" && (
          <p className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
            Seule une revue « Validée » couvre l&apos;indicateur 32 — l&apos;export des
            registres marque les autres comme non couvrantes.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="revuedirectionrowactions-decisions" className={labelCls}>
          Décisions (une par ligne)
        </label>
        <textarea
          id="revuedirectionrowactions-decisions"
          value={decisionsRaw}
          onChange={(e) => setDecisionsRaw(e.target.value)}
          disabled={isPending}
          rows={4}
          placeholder={"Décision prise en revue\nAutre décision"}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="revuedirectionrowactions-plan-actions" className={labelCls}>
          Plan d&apos;actions (une par ligne)
        </label>
        <textarea
          id="revuedirectionrowactions-plan-actions"
          value={planActionsRaw}
          onChange={(e) => setPlanActionsRaw(e.target.value)}
          disabled={isPending}
          rows={4}
          placeholder={"Action — responsable — échéance\nAutre action — responsable — échéance"}
          className={inputCls}
        />
        <p className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Les constats reportés depuis un autre écran gardent leur source et leur date tant que
          leur libellé n&apos;est pas modifié.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      <div className="flex items-center gap-[var(--space-admin-2)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isPending}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
