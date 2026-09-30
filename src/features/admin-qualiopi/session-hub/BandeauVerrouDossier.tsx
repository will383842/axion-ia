/**
 * 🔴 ADR 0060 — le bandeau d'état du dossier, en tête de la fiche session ET de
 * ses quatre sous-pages (posé par `sessions/[id]/layout.tsx`).
 *
 * ## Une seule vérité, deux lecteurs
 *
 * Le texte principal est `texteEtatVerrou(etat)` MOT POUR MOT : c'est la même
 * fonction qui écrit l'état dans le dossier d'audit remis au certificateur.
 * L'écran ne reformule rien — deux formulations feraient deux vérités, et
 * l'auditeur lirait l'une pendant que la direction lit l'autre.
 *
 * ## Ce qu'il montre, selon l'état
 *
 *  - `clos` : « Dossier clôturé le … — lecture seule », le texte, l'encart
 *    « Encore possible » (les gestes ouverts RÉELLEMENT dus, jamais la liste
 *    théorique), et « Rouvrir le dossier » — ou, sans l'habilitation, à qui
 *    s'adresser ;
 *  - `rouvert` : bandeau orange, le texte (date, auteur, motif), et « Clore à
 *    nouveau » ;
 *  - `a_recueillir`, `hors_parcours` : le texte seul, pour information ;
 *  - `en_preparation`, `en_cours` : rien. Tout est modifiable, un bandeau de
 *    plus serait du bruit sur une fiche qui en a déjà trop.
 *
 * Composant SERVEUR (aucun état) : il est rendu par le layout, qui a déjà lu
 * l'état. Seul le formulaire de réouverture est un composant client.
 */

import {
  dateParis,
  texteEtatVerrou,
  type EtatVerrouDossier,
} from "@/server/qualiopi/sessions/verrou-dossier";
import { RouvrirDossierForm, type RouvrirDossierFormProps } from "./RouvrirDossierForm";

/** Un geste encore ouvert ET dû sur un dossier clos, avec l'endroit où le faire. */
export interface GesteEncorePossible {
  readonly libelle: string;
  readonly href: string;
}

export interface BandeauVerrouDossierProps {
  sessionId: string;
  etat: EtatVerrouDossier;
  /** `peutEngager(role, "rouvrir_dossier")`, calculé côté serveur. */
  peutRouvrir: boolean;
  /** `MOTIF_REFUS.rouvrir_dossier` : ce qu'on dit à qui n'a pas l'habilitation. */
  motifSansHabilitation: string;
  /** Gestes ouverts réellement dus (dossier clos seulement). */
  encorePossible: ReadonlyArray<GesteEncorePossible>;
  rouvrirAction: RouvrirDossierFormProps["rouvrirAction"];
  reverrouillerAction: RouvrirDossierFormProps["reverrouillerAction"];
}

const cadre =
  "mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border p-[var(--space-admin-4)]";

export function BandeauVerrouDossier({
  sessionId,
  etat,
  peutRouvrir,
  motifSansHabilitation,
  encorePossible,
  rouvrirAction,
  reverrouillerAction,
}: BandeauVerrouDossierProps): React.ReactElement | null {
  if (etat.etat === "en_preparation" || etat.etat === "en_cours") return null;

  const texte = texteEtatVerrou(etat);
  const paragraphe = (
    <p
      data-texte-verrou=""
      className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
    >
      {texte}
    </p>
  );

  if (etat.etat === "clos") {
    return (
      <section
        aria-label="État du dossier"
        data-etat-verrou="clos"
        className={`${cadre} border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)]`}
      >
        <p className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Dossier clôturé le {dateParis(etat.depuis)} — lecture seule
        </p>
        {paragraphe}

        <div className="mt-[var(--space-admin-3)]">
          <p className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
            Encore possible
          </p>
          {encorePossible.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Rien n&apos;est en attente. Lecture, téléchargements et dossier d&apos;audit restent
              disponibles.
            </p>
          ) : (
            <ul className="mt-[var(--space-admin-1)] list-disc pl-[var(--space-admin-5)] text-[length:var(--text-admin-sm)]">
              {encorePossible.map((g) => (
                <li key={g.libelle}>
                  <a
                    href={g.href}
                    className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                  >
                    {g.libelle}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {peutRouvrir ? (
          <RouvrirDossierForm
            sessionId={sessionId}
            mode="rouvrir"
            rouvrirAction={rouvrirAction}
            reverrouillerAction={reverrouillerAction}
          />
        ) : (
          <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Pour corriger ce dossier, il faut le rouvrir. {motifSansHabilitation} Adressez-vous à la
            direction.
          </p>
        )}
      </section>
    );
  }

  if (etat.etat === "rouvert") {
    return (
      <section
        aria-label="État du dossier"
        data-etat-verrou="rouvert"
        className={`${cadre} border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-warning-subtle)]`}
      >
        <p className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-warning)]">
          Dossier rouvert
        </p>
        {paragraphe}
        {peutRouvrir ? (
          <RouvrirDossierForm
            sessionId={sessionId}
            mode="clore"
            rouvrirAction={rouvrirAction}
            reverrouillerAction={reverrouillerAction}
          />
        ) : (
          <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            La direction clôt à nouveau le dossier une fois la correction faite.
          </p>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label="État du dossier"
      data-etat-verrou={etat.etat}
      className={`${cadre} border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]`}
    >
      {paragraphe}
    </section>
  );
}
