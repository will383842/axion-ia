"use client";
// use-client: édition inline d'une revue de direction (date, statut, décisions, plan d'actions suivi) via useTransition + Server Action.

/**
 * RevueDirectionRowActions — Édition d'une revue de direction (T19).
 *
 * Bouton « Modifier » ouvre un panneau d'édition inline : date, statut,
 * **décisions** et **plan d'actions suivi** → updateRevueDirectionAction.
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
 * ── Le SUIVI des actions (2026-08-23) ───────────────────────────────────────
 * Le trou restant était le suivi. Le plan d'actions était un `<textarea>` de
 * texte libre dont le `placeholder` proposait « Action — responsable —
 * échéance » : **une suggestion de mise en forme, jamais une donnée**. Rien en
 * base, rien à l'export PDF, rien que le moteur de conformité puisse compter.
 * L'auditeur qui demande « et cette action-là, où en est-elle ? » n'obtenait
 * qu'une ligne de texte identique à celle de l'an dernier.
 *
 * Chaque action porte désormais ses quatre champs de suivi — responsable,
 * échéance, statut, date de clôture — saisis dans des champs réels. C'est ce
 * que l'indicateur 32 (⭐ NC majeure) appelle « mettre en œuvre », et c'est ce
 * que `evaluerCouvertureOff32` mesure : la même forme, lue par le même module.
 *
 * ── Préservation de la provenance ───────────────────────────────────────────
 * Une entrée reportée automatiquement porte `source` et `ajouteAt`. Elles sont
 * conservées telles quelles dans l'objet édité, et affichées sous l'action :
 * l'origine d'un constat est exactement ce que l'auditeur vérifie.
 *
 * "use client" : useState/useTransition + appel Server Action.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { updateRevueDirectionAction } from "@/server/actions/qualiopi/revue-direction";
import {
  LIBELLES_STATUT_ACTION,
  STATUTS_ACTION_AMELIORATION,
  normaliserPlanActions,
  type ActionAmelioration,
  type StatutActionAmelioration,
} from "@/server/qualiopi/revues/plan-actions";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const microLabelCls =
  "block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] mb-1";

/**
 * Libellé affichable d'une entrée `decisions`.
 *
 * Mêmes clés que `resumeJsonListe` de `registres-pdf.ts` et que
 * `normaliserActionAmelioration` — si les trois divergeaient, l'écran, le PDF et
 * le moteur de conformité ne compteraient pas les mêmes lignes.
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
 * Reconstruit la liste des décisions depuis le texte saisi, en **réutilisant
 * l'objet d'origine** quand le libellé n'a pas bougé — c'est ce qui préserve
 * `source` et `ajouteAt` des constats reportés automatiquement.
 */
function versListe(texte: string, origine: readonly unknown[]): unknown[] {
  const restants = origine.filter((x) => libelleEntree(x).trim().length > 0);
  return texte
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((ligne) => {
      const i = restants.findIndex((x) => libelleEntree(x).trim() === ligne);
      if (i !== -1) return restants.splice(i, 1)[0];
      return { decision: ligne, source: "saisie manuelle", ajouteAt: new Date().toISOString() };
    });
}

/** Une action neuve, non suivie : c'est à l'opérateur de la confier et de la dater. */
function actionVierge(): ActionAmelioration {
  return {
    action: "",
    source: "saisie manuelle",
    ajouteAt: new Date().toISOString(),
    responsable: "",
    echeance: null,
    statut: "a_faire",
    clotureAt: null,
  };
}

const STATUTS_CLOS: readonly StatutActionAmelioration[] = ["faite", "abandonnee"];

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
  const [actions, setActions] = useState<ActionAmelioration[]>(() =>
    normaliserPlanActions(revue.planActions as unknown[]),
  );

  function patcherAction(index: number, patch: Partial<ActionAmelioration>): void {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function retirerAction(index: number): void {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  const sansResponsable = actions.filter(
    (a) => a.action.trim().length > 0 && a.responsable.trim().length === 0,
  ).length;
  const sansEcheance = actions.filter(
    (a) => a.action.trim().length > 0 && a.echeance === null,
  ).length;

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAction({
        id: revue.id,
        dateRevue: new Date(dateRevue),
        statut,
        decisions: versListe(decisionsRaw, revue.decisions),
        // Les lignes sans libellé sont écartées ici comme côté serveur : une
        // ligne qu'on vient d'ajouter et qu'on n'a pas remplie n'est pas une action.
        planActions: actions.filter((a) => a.action.trim().length > 0),
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
      className="flex w-full max-w-2xl flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
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
            Seule une revue « Validée » couvre l&apos;indicateur 32 — l&apos;export des registres
            marque les autres comme non couvrantes.
          </p>
        )}
        {statut === "validee" && (sansResponsable > 0 || sansEcheance > 0) && (
          <p className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
            La validation sera refusée tant qu&apos;une action reste sans responsable
            {sansResponsable > 0 ? ` (${sansResponsable})` : ""} ou sans échéance
            {sansEcheance > 0 ? ` (${sansEcheance})` : ""} : une action que personne ne porte
            n&apos;est pas une mesure mise en œuvre.
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

      {/* ── Plan d'actions : une action = une ligne suivie jusqu'à sa clôture ── */}
      {/* `min-w-0` + `min-inline-size:0` : la feuille de style du NAVIGATEUR pose
          `min-inline-size: min-content` sur tout `<fieldset>`, ce qui l'empêche de
          rétrécir et pousse la page hors de l'écran (défaut payé le 2026-08-22 sur
          le formulaire de candidature). */}
      <fieldset className="min-w-0 border-0 p-0 [min-inline-size:0]">
        <legend className={labelCls}>Plan d&apos;actions d&apos;amélioration</legend>

        {actions.length === 0 && (
          <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
            Aucune action d&apos;amélioration. L&apos;indicateur 32 porte sur la mise en œuvre de
            mesures, pas sur la tenue de la revue.
          </p>
        )}

        <ul className="flex flex-col gap-[var(--space-admin-3)]">
          {actions.map((a, i) => {
            const idBase = `revuedirection-action-${i}`;
            const close = STATUTS_CLOS.includes(a.statut);
            return (
              <li
                key={idBase}
                className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-3)]"
              >
                <label htmlFor={`${idBase}-libelle`} className={microLabelCls}>
                  Action décidée
                </label>
                <input
                  id={`${idBase}-libelle`}
                  type="text"
                  value={a.action}
                  onChange={(e) => patcherAction(i, { action: e.target.value })}
                  disabled={isPending}
                  placeholder="Ce qui doit être fait"
                  className={inputCls}
                />

                <div className="mt-[var(--space-admin-2)] grid grid-cols-1 gap-[var(--space-admin-2)] sm:grid-cols-2">
                  <div className="min-w-0">
                    <label htmlFor={`${idBase}-responsable`} className={microLabelCls}>
                      Responsable
                    </label>
                    <input
                      id={`${idBase}-responsable`}
                      type="text"
                      value={a.responsable}
                      onChange={(e) => patcherAction(i, { responsable: e.target.value })}
                      disabled={isPending}
                      placeholder="Qui la porte"
                      className={inputCls}
                    />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={`${idBase}-echeance`} className={microLabelCls}>
                      Échéance
                    </label>
                    <input
                      id={`${idBase}-echeance`}
                      type="date"
                      value={a.echeance ?? ""}
                      onChange={(e) =>
                        patcherAction(i, {
                          echeance: e.target.value.length > 0 ? e.target.value : null,
                        })
                      }
                      disabled={isPending}
                      className={inputCls}
                    />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={`${idBase}-statut`} className={microLabelCls}>
                      État
                    </label>
                    <select
                      id={`${idBase}-statut`}
                      value={a.statut}
                      onChange={(e) => {
                        const suivant = e.target.value as StatutActionAmelioration;
                        patcherAction(i, {
                          statut: suivant,
                          // Passer en « faite »/« abandonnée » propose la date du
                          // jour ; revenir en arrière efface la clôture, sinon une
                          // action rouverte resterait datée comme close.
                          clotureAt: STATUTS_CLOS.includes(suivant)
                            ? (a.clotureAt ?? new Date().toISOString().slice(0, 10))
                            : null,
                        });
                      }}
                      disabled={isPending}
                      className={inputCls}
                    >
                      {STATUTS_ACTION_AMELIORATION.map((s) => (
                        <option key={s} value={s}>
                          {LIBELLES_STATUT_ACTION[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {close && (
                    <div className="min-w-0">
                      <label htmlFor={`${idBase}-cloture`} className={microLabelCls}>
                        Date de clôture
                      </label>
                      <input
                        id={`${idBase}-cloture`}
                        type="date"
                        value={a.clotureAt ?? ""}
                        onChange={(e) =>
                          patcherAction(i, {
                            clotureAt: e.target.value.length > 0 ? e.target.value : null,
                          })
                        }
                        disabled={isPending}
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-[var(--space-admin-2)] flex flex-wrap items-center justify-between gap-[var(--space-admin-2)]">
                  <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                    {a.source.length > 0 ? `Origine : ${a.source}` : "Origine non renseignée"}
                    {a.ajouteAt.length > 0 ? ` · ajoutée le ${a.ajouteAt.slice(0, 10)}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => retirerAction(i)}
                    disabled={isPending}
                    className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline"
                  >
                    Retirer cette action
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => setActions((prev) => [...prev, actionVierge()])}
          disabled={isPending}
          className="mt-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] transition-opacity hover:opacity-80"
        >
          Ajouter une action
        </button>

        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Les constats reportés depuis un autre écran gardent leur origine et leur date
          d&apos;ajout.
        </p>
      </fieldset>

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
