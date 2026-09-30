/**
 * 🔴 LA CHECKLIST D'UNE SESSION — les seize étapes, sur le hub.
 *
 * ## Le défaut
 *
 * Le parcours d'une session existe déjà : seize étapes, chacune avec son
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

import type { EtapeParcours, RepliParcours } from "@/server/qualiopi/parcours/session-parcours";
import type { EtatEtape } from "@/server/qualiopi/parcours/etat-echeance";
import { hrefEtape } from "@/server/qualiopi/parcours/cible-etape";
import {
  etapeBloqueeParLeVerrou,
  gesteDirectPossibleSurDossierClos,
  MENTION_GESTE_VERROUILLE,
} from "@/server/qualiopi/parcours/etape-dossier-clos";
import { GesteEtape } from "./GesteEtape";

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
  sessionId,
  prefixeSessions,
  repliee = null,
  fige = false,
}: {
  readonly etapes: ReadonlyArray<EtapeParcours>;
  readonly fait: number;
  readonly total: number;
  /** Pour construire le lien de chaque étape (`hrefEtape`). */
  readonly sessionId: string;
  /** Préfixe de la liste des sessions, p. ex. `/fr/admin/qualiopi/sessions`. */
  readonly prefixeSessions: string;
  /**
   * Session annulée ou reportée : le parcours est REPLIÉ. 🔴 Audit du
   * 30/09/2026 — la filiation n'était rendue nulle part sur la fiche.
   * Relecture L3 : le bandeau du dossier dit déjà « Session annulée / reportée :
   * hors du parcours » ; la checklist n'ajoute que ce qu'il ne dit pas — la
   * session de remplacement —, et ne rend rien sinon.
   */
  readonly repliee?: RepliParcours | null;
  /**
   * ADR 0060 — `dossierFige(etat)` : dossier CLOS et verrou actif. Une étape
   * restée due dont le geste est verrouillé n'est alors plus PROPOSÉE (ni
   * « Aller à », ni description du geste) : l'écran d'arrivée ne montre plus
   * ce bouton, et le serveur le refuserait (`etape-dossier-clos.ts`).
   */
  readonly fige?: boolean;
}) {
  if (repliee !== null) {
    if (repliee.remplacement === null) return null;
    return (
      <p
        role="status"
        className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
      >
        Remplacée par la session {repliee.remplacement} : le parcours se suit sur sa fiche.
      </p>
    );
  }
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
        {etapes.map((e) => {
          const bloquee = etapeBloqueeParLeVerrou(e, fige);
          return (
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
                  {e.mention} · {bloquee ? MENTION_GESTE_VERROUILLE : e.geste}
                </span>
                {/*
                🔴 LE LIEN QUI MANQUAIT — défaut vécu par Will le 2026-09-04 :
                « je n'ai pas trouvé le bouton pour contresigner ». Puis audit
                UX du 30/09/2026 : le lien menait au bloc « Sous-pages », d'où
                il fallait encore choisir la sous-page et y chercher le bouton.

                Le lien mène désormais EN UN CLIC à la section qui porte le
                geste, sur la fiche (à l'onglet de sa phase) ou directement sur
                la sous-page (`hrefEtape`).

                - étape à faire : « Aller à … » — le chemin du geste ;
                - étape faite : « Voir » — relire la preuve, sans rien refaire ;
                - sans objet : rien, il n'y a rien à voir.
              */}
                {bloquee ? (
                  <>
                    {" "}
                    {/* Dossier clos : on peut LIRE la section, plus y agir. */}
                    <a
                      href={hrefEtape(sessionId, e, prefixeSessions)}
                      className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline"
                      aria-label={`Voir : ${e.libelle} (${e.cible.libelle})`}
                    >
                      Voir
                    </a>
                  </>
                ) : e.etat !== "fait" && e.etat !== "sans_objet" ? (
                  <>
                    {" "}
                    <a
                      href={hrefEtape(sessionId, e, prefixeSessions)}
                      className="text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-accent)] underline"
                    >
                      Aller à : {e.cible.libelle} →
                    </a>
                  </>
                ) : e.etat === "fait" ? (
                  <>
                    {" "}
                    <a
                      href={hrefEtape(sessionId, e, prefixeSessions)}
                      className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline"
                      aria-label={`Voir : ${e.libelle} (${e.cible.libelle})`}
                    >
                      Voir
                    </a>
                  </>
                ) : null}
                {/* Le geste SIMPLE, posé d'ici : relancer, générer un accès.
                  Jamais un acte habilité — ceux-là n'ont pas de `gesteDirect`. */}
                {e.gesteDirect !== undefined &&
                !bloquee &&
                (!fige || gesteDirectPossibleSurDossierClos(e.gesteDirect)) &&
                e.etat !== "fait" &&
                e.etat !== "sans_objet" ? (
                  <GesteEtape geste={e.gesteDirect} />
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
          );
        })}
      </ol>
    </>
  );
}
