"use client";
// use-client: état interactif local (cases présence + minutes) + useTransition pour la server action de sauvegarde.
/**
 * EmargementGrid — Grille créneaux × stagiaires pour la saisie de présence.
 *
 * Reçoit la liste des créneaux existants (déjà chargés côté serveur) et la
 * liste des enrollments. Permet de cocher présent/absent + saisir les minutes
 * réalisées. Submit → `saveEmargementAction`.
 *
 * "use client" : interactivité + appel Server Action.
 * Zéro appel DB côté client.
 */

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { DemiJourneeLabel } from "@/server/qualiopi/presence/types";
import { SEUIL_PARTIELLE_PCT } from "@/server/qualiopi/presence/taux";

// ─────────────────────────────────────────────────────────────────────────────
// Types props (serialisables depuis Server Component)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreneauRow {
  id: string;
  enrollmentId: string;
  date: string; // ISO "2026-06-10"
  demiJournee: DemiJourneeLabel;
  libelle: string;
  dureePrevueMinutes: number;
  dureeRealiseeMinutes: number;
  present: boolean;
}

export interface EnrollmentRow {
  id: string;
  traineeId: string;
  nom: string;
  prenom: string;
  email: string;
  tauxPresencePct: number | null;
}

export interface EmargementGridProps {
  sessionId: string;
  enrollments: EnrollmentRow[];
  creneaux: CreneauRow[];
  /** Seuil « présence complète » (config `seuil_presence_pct`, défaut 80). */
  seuilCompletePct: number;
  /**
   * Des journées ont-elles été déclarées ? L'état vide doit dire OÙ reprendre :
   * sans journées, générer les créneaux les déduit de la plage de dates, ce qui
   * est faux dès que les journées ne se suivent pas.
   */
  hasJours?: boolean;
  /** Appelée lors du submit. Doit matcher la signature AGENT B. */
  saveAction: (input: {
    sessionId: string;
    entries: Array<{
      enrollmentId: string;
      date: string;
      demiJournee: DemiJourneeLabel;
      present: boolean;
      dureeRealiseeMinutes?: number;
    }>;
  }) => Promise<{ data: { updated: number } } | { error: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DJ_LABELS: Record<DemiJourneeLabel, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  journee: "Journée",
};

/**
 * Couleur du taux. `seuilCompletePct` vient de la config Qualiopi
 * (`seuil_presence_pct`) : il était figé à 80 ici alors que l'attestation et le
 * récapitulatif de la page classifient avec le seuil configuré. Réglé à 90, un
 * taux de 85 % s'affichait vert dans la grille et « partielle » dix lignes plus
 * bas. Le plancher 60 % (« partielle ») est une constante métier, pas un réglage.
 */
function classifierCouleur(taux: number | null, seuilCompletePct: number): string {
  if (taux === null) return "text-[color:var(--color-admin-fg-muted)]";
  if (taux >= seuilCompletePct) return "text-[color:var(--color-admin-success)]";
  if (taux >= SEUIL_PARTIELLE_PCT) return "text-[color:var(--color-admin-warning)]";
  // `--color-admin-destructive` et non `--color-admin-error` : ce dernier n'est
  // défini nulle part dans admin.css, la déclaration était donc invalide et la
  // couleur héritée. Le taux le plus critique — celui qui refuse l'attestation —
  // s'affichait exactement comme un taux normal.
  return "text-[color:var(--color-admin-destructive)]";
}

// Clé unique par (enrollmentId, date, demiJournee)
function creneauKey(enrollmentId: string, date: string, dj: DemiJourneeLabel): string {
  return `${enrollmentId}|${date}|${dj}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

/** « 2026-06-10 » → « 10/06 ». La date complète reste en infobulle. */
function jourMois(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(d);
}

export function EmargementGrid({
  sessionId,
  enrollments,
  creneaux,
  seuilCompletePct,
  hasJours,
  saveAction,
}: EmargementGridProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // État local : map creneauKey → { present, dureeRealiseeMinutes }
  type CellState = { present: boolean; dureeMinutes: string };
  const initState = useMemo(() => {
    const m = new Map<string, CellState>();
    for (const c of creneaux) {
      m.set(creneauKey(c.enrollmentId, c.date, c.demiJournee), {
        present: c.present,
        dureeMinutes: String(c.dureeRealiseeMinutes),
      });
    }
    return m;
  }, [creneaux]);

  /**
   * SEULES les cellules modifiées et non encore enregistrées sont en état local.
   *
   * L'état affiché est DÉRIVÉ au rendu : `overrides.get(k) ?? initState.get(k)`.
   *
   * Pourquoi pas un `useState(initState)` comme avant : `useState` ne lit son
   * argument qu'au PREMIER montage. Après un `router.refresh()` — déclenché ici
   * même après chaque sauvegarde, et par Next au retour de focus — la grille
   * affichait indéfiniment son état initial. Invisible tant que l'admin était
   * seul à écrire, destructeur dès que la présence peut changer ailleurs (import
   * de relevé, second administrateur, future signature électronique) : la grille
   * périmée réécrasait ces valeurs à la sauvegarde suivante.
   *
   * Pourquoi pas un `useEffect` de resynchronisation : il corrigerait l'affichage
   * mais DÉTRUIRAIT la saisie en cours — 60 cases cochées effacées par un
   * rafraîchissement. Et un `setState` dans un effet est refusé par le linter,
   * à raison : l'état dérivé est la bonne réponse.
   *
   * Résultat : le serveur est toujours la source de vérité, sauf sur les cellules
   * que l'admin vient de toucher.
   */
  const [overrides, setOverrides] = useState<Map<string, CellState>>(new Map());

  const cells = useMemo(() => {
    if (overrides.size === 0) return initState;
    const merged = new Map(initState);
    for (const [k, v] of overrides) merged.set(k, v);
    return merged;
  }, [initState, overrides]);

  // Colonnes = créneaux distincts (date × demiJournee)
  const colonnes = useMemo(() => {
    const seen = new Set<string>();
    const cols: Array<{ date: string; demiJournee: DemiJourneeLabel; libelle: string }> = [];
    for (const c of creneaux) {
      const k = `${c.date}|${c.demiJournee}`;
      if (!seen.has(k)) {
        seen.add(k);
        cols.push({ date: c.date, demiJournee: c.demiJournee, libelle: c.libelle });
      }
    }
    return cols;
  }, [creneaux]);

  function togglePresent(enrollmentId: string, date: string, dj: DemiJourneeLabel) {
    const k = creneauKey(enrollmentId, date, dj);
    setOverrides((prev) => {
      const next = new Map(prev);
      // Valeur courante = override s'il existe, sinon donnée serveur.
      const cur = prev.get(k) ?? initState.get(k) ?? { present: false, dureeMinutes: "0" };
      next.set(k, { ...cur, present: !cur.present });
      return next;
    });
  }

  function setDuree(enrollmentId: string, date: string, dj: DemiJourneeLabel, value: string) {
    const k = creneauKey(enrollmentId, date, dj);
    setOverrides((prev) => {
      const next = new Map(prev);
      const cur = prev.get(k) ?? initState.get(k) ?? { present: false, dureeMinutes: "0" };
      next.set(k, { ...cur, dureeMinutes: value });
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Construire entries à partir des enrollments × colonnes
    const entries: Array<{
      enrollmentId: string;
      date: string;
      demiJournee: DemiJourneeLabel;
      present: boolean;
      dureeRealiseeMinutes?: number;
    }> = [];

    for (const enrollment of enrollments) {
      for (const col of colonnes) {
        const k = creneauKey(enrollment.id, col.date, col.demiJournee);
        const cell = cells.get(k);
        if (cell) {
          const parsed = parseInt(cell.dureeMinutes, 10);
          entries.push({
            enrollmentId: enrollment.id,
            date: col.date,
            demiJournee: col.demiJournee,
            present: cell.present,
            // ⚠️ On envoie TOUJOURS la durée, y compris case décochée.
            //
            // Auparavant le champ était omis dès que `present` était faux, et le
            // serveur le remplaçait alors par 0. Or `present` est DÉRIVÉ pour un
            // créneau importé (réalisé ≥ 50 % du prévu) : un stagiaire connecté
            // 100 min sur 420 a `present = false` sans être absent. Un simple
            // clic « Enregistrer », même sans rien modifier, effaçait ses
            // 100 minutes — la seule trace de sa connexion, sur un enregistrement
            // à valeur probante.
            //
            // L'état de la cellule porte déjà la valeur serveur pour les cases
            // non touchées : la renvoyer telle quelle est neutre, et décocher
            // reste une correction explicite possible.
            ...(!isNaN(parsed) && parsed >= 0 ? { dureeRealiseeMinutes: parsed } : {}),
          });
        }
      }
    }

    startTransition(async () => {
      const result = await saveAction({ sessionId, entries });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg(
          `${result.data.updated} ligne${result.data.updated > 1 ? "s" : ""} mise${result.data.updated > 1 ? "s" : ""} à jour.`,
        );
        // Les modifications sont persistées : elles cessent d'être « locales ».
        // Sans ce reset, elles resteraient prioritaires sur toute donnée serveur
        // ultérieure et la grille ne se resynchroniserait plus jamais.
        setOverrides(new Map());
        router.refresh();
      }
    });
  }

  if (creneaux.length === 0) {
    // 🔴 UI 2026-07-27 — ce message renvoyait vers « Générer les créneaux » sans
    // dire que les JOURNÉES viennent d'abord. Sans journées déclarées, la
    // génération déduit les créneaux de la plage de dates — ce que le code
    // qualifie lui-même de faux dès que les journées ne se suivent pas. On
    // envoyait donc l'utilisateur produire une feuille d'émargement fausse.
    return (
      <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
        {hasJours === false ? (
          <>
            <strong>Commencez par déclarer les journées</strong> réellement animées, plus haut sur
            cette page. Sans elles, les créneaux seraient déduits de la plage de dates — donc faux
            dès que les journées ne se suivent pas, et la feuille d&apos;émargement avec.
          </>
        ) : (
          <>Aucun créneau généré. Utilisez le bouton « Générer les créneaux » ci-dessus.</>
        )}
      </p>
    );
  }

  const inputCls =
    "w-16 rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-1 py-0.5 text-center text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const thCls =
    "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";
  const tdCls = "px-[var(--space-admin-3)] py-[var(--space-admin-2)] align-middle";

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-[var(--space-admin-4)] overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
        <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
          <thead className="border-b border-[color:var(--color-admin-border)]">
            <tr>
              <th className={thCls}>Stagiaire</th>
              {colonnes.map((col) => (
                <th key={`${col.date}|${col.demiJournee}`} className={thCls}>
                  {/* 🔴 En-tête de colonne en ISO brut : « 2026-06-10 ». Sur une
                      feuille d'émargement, que l'auditrice recoupe avec des
                      pièces papier françaises. */}
                  <div title={col.date}>{jourMois(col.date)}</div>
                  <div className="font-normal tracking-normal normal-case">
                    {DJ_LABELS[col.demiJournee]}
                  </div>
                </th>
              ))}
              <th className={thCls}>Taux</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enrollment) => (
              <tr
                key={enrollment.id}
                className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
              >
                {/* Stagiaire */}
                <td className={tdCls}>
                  <div className="font-medium whitespace-nowrap">
                    {enrollment.prenom} {enrollment.nom}
                  </div>
                  <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                    {enrollment.email}
                  </div>
                </td>

                {/* Cases présence par créneau */}
                {colonnes.map((col) => {
                  const k = creneauKey(enrollment.id, col.date, col.demiJournee);
                  const cell = cells.get(k);
                  // Créneau peut ne pas exister (enrollment ajouté après génération)
                  if (!cell) {
                    return (
                      <td key={k} className={tdCls}>
                        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                          —
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={k} className={tdCls}>
                      <div className="flex flex-col items-center gap-1">
                        <input
                          type="checkbox"
                          checked={cell.present}
                          onChange={() => togglePresent(enrollment.id, col.date, col.demiJournee)}
                          disabled={isPending}
                          aria-label={`Présent ${enrollment.prenom} ${enrollment.nom} ${col.libelle}`}
                          className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
                        />
                        {cell.present && (
                          <input
                            type="number"
                            min="0"
                            max="999"
                            value={cell.dureeMinutes}
                            onChange={(ev) =>
                              setDuree(enrollment.id, col.date, col.demiJournee, ev.target.value)
                            }
                            disabled={isPending}
                            aria-label={`Minutes ${enrollment.prenom} ${enrollment.nom} ${col.libelle}`}
                            className={inputCls}
                          />
                        )}
                      </div>
                    </td>
                  );
                })}

                {/* Taux présence */}
                <td className={tdCls}>
                  <span className={classifierCouleur(enrollment.tauxPresencePct, seuilCompletePct)}>
                    {enrollment.tauxPresencePct !== null ? `${enrollment.tauxPresencePct} %` : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}

      <button type="submit" disabled={isPending} className="admin-button">
        {isPending ? "Enregistrement…" : "Enregistrer l'émargement"}
      </button>
    </form>
  );
}
