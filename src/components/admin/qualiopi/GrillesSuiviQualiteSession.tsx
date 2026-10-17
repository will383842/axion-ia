/**
 * Console — les grilles de suivi qualité des intervenants RATTACHÉES À UNE SESSION
 * (Qualiopi ind. 21), sur la page « Évaluations des acquis ». Lecture seule : la saisie se
 * fait depuis la fiche du formateur (Suivi qualité), où la grille est aussi rangée.
 *
 * Composant serveur ; rendu seulement si `formateurs.suivi_qualite` est allumé et que le
 * rôle porte l'acte `habiliter_formateur` (la page passe `null` sinon).
 */

import Link from "next/link";

import type { GrilleConsole } from "@/server/qualiopi/formateurs-independants/suivi-qualite/console";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const LIBELLE: Record<GrilleConsole["type"], string> = {
  observation: "Observation de la 1re mission",
  evaluation_mission: "Évaluation après mission",
  reevaluation: "Réévaluation annuelle",
};

export interface GrillesSuiviQualiteSessionProps {
  /** `/<locale>/<adminPrefix>` */
  readonly base: string;
  readonly grilles: ReadonlyArray<
    GrilleConsole & { readonly trainerId: string; readonly formateur: string }
  >;
}

export function GrillesSuiviQualiteSession({
  base,
  grilles,
}: GrillesSuiviQualiteSessionProps): React.ReactElement {
  const texte = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const discret = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
  return (
    <section
      id="suivi-qualite-intervenants"
      className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <h3 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Suivi qualité des intervenants (ind. 21)
      </h3>
      {grilles.length === 0 ? (
        <p className={discret}>Aucune grille rattachée à cette session.</p>
      ) : (
        <ul className="space-y-[var(--space-admin-2)]">
          {grilles.map((g) => (
            <li key={g.id} className={texte}>
              <Link
                href={`${base}/qualiopi/formateurs/${g.trainerId}/suivi-qualite#grilles`}
                className="underline"
              >
                {g.formateur}
              </Link>{" "}
              — {LIBELLE[g.type]}
              {g.numero > 1 ? ` (saisie n° ${g.numero})` : ""} :{" "}
              {(g.moyenneCentiemes / 100).toFixed(2).replace(".", ",")}/5{" "}
              <span className={discret}>
                · le {dateFmt.format(g.dateEvaluation)} · signée par {g.auteurNom}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
