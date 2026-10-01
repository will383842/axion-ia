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
 *    théorique — la SEULE liste de ce nom sur la fiche, construite par
 *    `gestesEncorePossibles`), les « Manques figés au moment de la clôture »
 *    (QUAL-FIL-01 : les étapes dues dont le geste est verrouillé, complément
 *    exact de la liste précédente — sans elles, un dossier incomplet se lisait
 *    « rien n'est en attente »), et « Rouvrir le dossier » — ou, sans
 *    l'habilitation, à qui s'adresser ;
 *  - `clos` avec l'interrupteur de secours posé (QUAL-VERROU-07) : l'état reste
 *    « clos » — l'interrupteur coupe le blocage, jamais la vérité — mais le
 *    bandeau ne dit plus « lecture seule » : il dit que le verrou est coupé et
 *    que les modifications ne sont pas inscrites au dossier ;
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
  verrouDossierActif,
  type EtatVerrouDossier,
} from "@/server/qualiopi/sessions/verrou-dossier";
import { RouvrirDossierForm, type RouvrirDossierFormProps } from "./RouvrirDossierForm";

import type { GesteEncorePossible } from "@/server/qualiopi/parcours/encore-possible";

export type { GesteEncorePossible };

export interface BandeauVerrouDossierProps {
  sessionId: string;
  etat: EtatVerrouDossier;
  /** `peutEngager(role, "rouvrir_dossier")`, calculé côté serveur. */
  peutRouvrir: boolean;
  /** `MOTIF_REFUS.rouvrir_dossier` : ce qu'on dit à qui n'a pas l'habilitation. */
  motifSansHabilitation: string;
  /** Gestes ouverts réellement dus (dossier clos seulement). */
  encorePossible: ReadonlyArray<GesteEncorePossible>;
  /**
   * Étapes dues bloquées par le verrou (`manquesFigesALaCloture`) — dossier
   * clos, verrou actif. Vide par défaut.
   */
  manquesFiges?: ReadonlyArray<string>;
  /**
   * `verrouDossierActif()`, lu CÔTÉ SERVEUR par le layout. Par défaut, le
   * composant (serveur) le lit lui-même : l'omettre ne peut jamais afficher
   * « lecture seule » sur un dossier dont le verrou est coupé.
   */
  verrouActif?: boolean;
  rouvrirAction: RouvrirDossierFormProps["rouvrirAction"];
  reverrouillerAction: RouvrirDossierFormProps["reverrouillerAction"];
}

/** QUAL-VERROU-07 — ce que dit le bandeau d'un dossier clos quand l'interrupteur est posé. */
export const MENTION_VERROU_COUPE =
  "Verrou coupé par l'interrupteur de secours : les modifications sont possibles et ne sont pas inscrites au dossier.";

/** QUAL-FIL-01 — titre de la liste des étapes dues bloquées par le verrou. */
export const TITRE_MANQUES_FIGES =
  "Manques figés au moment de la clôture — rouvrir le dossier pour les corriger";

const cadre =
  "mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border p-[var(--space-admin-4)]";

export function BandeauVerrouDossier({
  sessionId,
  etat,
  peutRouvrir,
  motifSansHabilitation,
  encorePossible,
  manquesFiges = [],
  verrouActif = verrouDossierActif(),
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
          Dossier clôturé le {dateParis(etat.depuis)}
          {verrouActif ? " — lecture seule" : ""}
        </p>
        {paragraphe}

        {!verrouActif && (
          <p
            role="status"
            data-verrou-coupe=""
            className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-warning)]"
          >
            {MENTION_VERROU_COUPE}
          </p>
        )}

        {verrouActif && manquesFiges.length > 0 && (
          <div className="mt-[var(--space-admin-3)]" data-manques-figes="">
            <p className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
              {TITRE_MANQUES_FIGES}
            </p>
            <ul className="mt-[var(--space-admin-1)] list-disc pl-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              {manquesFiges.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {verrouActif && (
          <div className="mt-[var(--space-admin-3)]">
            <p className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
              Encore possible
            </p>
            {encorePossible.length === 0 ? (
              <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                {manquesFiges.length > 0
                  ? "Aucun autre geste sans rouvrir le dossier. "
                  : "Rien n'est en attente. "}
                Lecture, téléchargements et dossier d&apos;audit restent disponibles.
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
        )}

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
