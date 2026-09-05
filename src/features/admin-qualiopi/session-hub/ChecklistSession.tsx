/**
 * 🔴 LA CHECKLIST D'UNE SESSION — les quatorze étapes, sur le hub.
 *
 * ## Le défaut
 *
 * Le parcours d'une session existe déjà : quatorze étapes, chacune avec son
 * état, sa mention et son geste. Mais il n'était rendu **nulle part sur la
 * session elle-même** — seulement en agrégat sur « À traiter », et seulement
 * pour les étapes qui appellent une action.
 *
 * Conséquence : on ouvre un dossier et on ne sait pas où il en est. Il faut
 * inspecter chaque bloc — documents, émargement, évaluations, questionnaires —
 * et reconstituer de tête ce que le serveur avait déjà calculé.
 *
 * ## Pourquoi les étapes FAITES sont affichées aussi
 *
 * ⚠️ « À traiter » ne montre que ce qui reste. Sur le hub, montrer uniquement
 * les manques transformerait la page en liste de reproches, et surtout
 * priverait de la seule information qu'on vient chercher avant un audit :
 * **est-ce que ce dossier est complet ?** Une checklist dont les lignes faites
 * disparaissent ne répond jamais oui.
 *
 * ## L'état est dans le TEXTE
 *
 * 🔴 Jamais dans la seule couleur (WCAG 1.4.1). Chaque ligne porte sa mention
 * en toutes lettres — « rattrapable avant le … », « hors délai : +N j » — et la
 * couleur ne fait que doubler. La règle vient du dépôt, et « À traiter »
 * l'applique déjà.
 */

import type { EtapeParcours } from "@/server/qualiopi/parcours/session-parcours";
import type { EtatEtape } from "@/server/qualiopi/parcours/etat-echeance";

/**
 * Marqueur textuel de tête de ligne.
 *
 * ⚠️ Ce n'est PAS une décoration : c'est ce qui permet de balayer la liste des
 * yeux. Il reste doublé par la mention, qui dit l'état en toutes lettres.
 */
const MARQUEUR: Record<EtatEtape, string> = {
  fait: "✓",
  a_faire: "•",
  rattrapable: "!",
  hors_delai: "✕",
  sans_objet: "–",
  indetermine: "?",
};

/** Intitulé de l'état, lu par les lecteurs d'écran à la place du marqueur. */
const LIBELLE_ETAT: Record<EtatEtape, string> = {
  fait: "Fait",
  a_faire: "À faire",
  rattrapable: "Rattrapable",
  hors_delai: "Hors délai",
  sans_objet: "Sans objet",
  indetermine: "Indéterminé",
};

const COULEUR: Record<EtatEtape, string> = {
  fait: "text-[color:var(--color-admin-success)]",
  a_faire: "text-[color:var(--color-admin-fg-muted)]",
  rattrapable: "text-[color:var(--color-admin-warning)]",
  hors_delai: "text-[color:var(--color-admin-danger)]",
  sans_objet: "text-[color:var(--color-admin-fg-muted)]",
  indetermine: "text-[color:var(--color-admin-fg-muted)]",
};

export function ChecklistSession({
  etapes,
  fait,
  total,
}: {
  readonly etapes: ReadonlyArray<EtapeParcours>;
  readonly fait: number;
  readonly total: number;
}) {
  // Pas de parcours calculé (session hors périmètre, ou lecture en échec) : on
  // n'affiche RIEN plutôt qu'une checklist vide. Une liste vide se lirait comme
  // « aucune obligation », ce qui est le contraire de la vérité.
  if (etapes.length === 0) return null;

  return (
    <>
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {fait} étape{fait > 1 ? "s" : ""} sur {total} — les étapes sans objet pour cette session
        sont indiquées comme telles.
      </p>
      {/* Une liste ORDONNÉE : le parcours est une chronologie, pas un sac. Le
          lecteur d'écran annonce « 3 sur 14 ». */}
      <ol className="list-none space-y-[var(--space-admin-2)] p-0">
        {etapes.map((e) => (
          <li
            key={e.cle}
            className="flex gap-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-3)]"
          >
            <span aria-hidden="true" className={`shrink-0 font-semibold ${COULEUR[e.etat]}`}>
              {MARQUEUR[e.etat]}
            </span>
            <span className="min-w-0">
              <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                {/* 🔴 L'intitulé de l'état est DIT, pas seulement coloré : le
                    marqueur est masqué aux lecteurs d'écran, cette mention le
                    remplace. */}
                <span className="sr-only">{LIBELLE_ETAT[e.etat]} — </span>
                <strong>{e.libelle}</strong>
                {e.avancement ? (
                  <span className="text-[color:var(--color-admin-fg-muted)]">
                    {" "}
                    ({e.avancement.fait}/{e.avancement.total})
                  </span>
                ) : null}
              </span>
              <br />
              <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {e.mention} · {e.geste}
              </span>
              {/*
                🔴 LE LIEN QUI MANQUAIT — défaut vécu par Will le 2026-09-04 :
                « je n'ai pas trouvé le bouton pour contresigner ». Le suivi
                nommait un bloc « Signatures » qui s'appelle en réalité
                « Signature des pièces contractuelles », et un bouton
                « Contresigner » qui s'appelle « Signer pour l'organisme ».

                Même exacte, la phrase n'aurait pas suffi : la fiche fait plus
                de 4 000 px et empile douze blocs. Décrire un endroit sur une
                page qu'il faut parcourir aux yeux, c'est ne pas le dire.

                Le lien n'est offert que sur ce qui RESTE à faire : sur une
                étape close il n'y a rien à aller poser, et l'afficher partout
                noierait les trois lignes qui comptent sous quinze liens
                identiques.
              */}
              {e.ancre !== undefined && e.etat !== "fait" && e.etat !== "sans_objet" ? (
                <>
                  {" "}
                  <a
                    href={`#${e.ancre.id}`}
                    className="text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-accent)] underline"
                  >
                    Aller au {e.ancre.libelle} →
                  </a>
                </>
              ) : null}
              {e.avertissement ? (
                <>
                  <br />
                  <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                    {e.avertissement}
                  </span>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
