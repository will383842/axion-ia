/**
 * Espace formateur — la liste de ce qui presse sur ses formations.
 *
 * ## Pourquoi un composant PROPRE, et pas le rendu de la console
 *
 * La page « À traiter » de la console rend déjà une liste d'échéances. Elle n'a
 * pourtant **jamais été extraite en composant** : son balisage est inline dans
 * la page, et il est écrit dans l'autre langue visuelle du dépôt —
 * `var(--color-admin-*)`, `var(--space-admin-*)`, `AdminPageShell`,
 * `AdminButton`. L'espace formateur, lui, vit sur les jetons du site public
 * (`bg-paper`, `text-mocha`, `border-border`).
 *
 * Extraire un composant partagé imposerait donc l'un des deux systèmes à
 * l'autre, ou ajouterait une couche de paramétrage de couleurs à un endroit où
 * il n'y a rien à partager que huit lignes de JSX. Et surtout, les deux listes
 * ne disent pas la même chose : la console affiche un geste d'admin et un lien
 * vers le DOSSIER de session ; ici on affiche un geste de formateur et un lien
 * vers SA formation. Ce n'est pas le même écran avec un autre thème.
 *
 * 🔴 Ce qui EST partagé, et qui devait l'être, c'est le CALCUL :
 * `prochainesEcheances`. Le rendu, non. Une duplication de balisage se voit ;
 * une duplication de calcul ment en silence.
 *
 * ## Ce qui n'est jamais rendu ici
 *
 * Aucun nom de stagiaire, aucun email, aucune donnée d'inscription : seulement
 * l'étape, son état en toutes lettres, et l'identité de la session. Les
 * `avancement` restent des compteurs `n/m` — un dénombrement ne désigne
 * personne.
 */

import Link from "next/link";
import { CalendarClock } from "lucide-react";

import type { EcheanceFormateur } from "@/server/formateur/echeances-formateur";
import { FORMATEUR_SESSIONS_PATH } from "@/server/formateur/collectif-labels";

export interface EcheancesFormateurProps {
  readonly echeances: ReadonlyArray<EcheanceFormateur>;
}

/**
 * Plafond d'affichage. Au-delà, on DIT combien il en reste : une liste coupée
 * en silence se lit comme une liste complète.
 */
const PLAFOND_LIGNES = 15;

export function EcheancesFormateur({ echeances }: EcheancesFormateurProps): React.ReactElement {
  const visibles = echeances.slice(0, PLAFOND_LIGNES);
  const reste = echeances.length - visibles.length;

  return (
    <section className="space-y-4">
      <h2 className="text-fg-muted flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
        <CalendarClock className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        Sur vos formations
      </h2>
      <p className="text-fg-soft text-sm leading-relaxed">
        Ce qui attend un geste de votre part, toutes vos formations confondues. Vous n&apos;y
        trouverez que ce que vous pouvez traiter vous-même : les pièces contractuelles et les envois
        restent à la charge de l&apos;organisme.
      </p>

      {/* La chronologie EST un ordre : une liste ordonnée, pas une pile de div.
          Le lecteur d'écran annonce « 1 sur 4 ». */}
      <ol className="bg-paper shadow-card list-none rounded-xl p-0">
        {visibles.map((e) => (
          <li
            key={`${e.sessionId}-${e.cle}`}
            className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-mocha text-sm font-medium">
                {e.libelle}
                {e.avancement !== undefined && e.avancement.total > 0 ? (
                  <span className="text-fg-muted font-normal">
                    {" "}
                    — {e.avancement.fait}/{e.avancement.total}
                  </span>
                ) : null}
              </p>
              <p className="text-fg-muted mt-0.5 text-xs">
                {e.numero} · {e.titre}
              </p>
              {/* 🔴 L'état est dans le TEXTE, jamais dans la seule couleur
                  (WCAG 1.4.1) : « rattrapable avant le … » et « hors délai :
                  +N j » ne se confondent pas, même en noir et blanc. */}
              <p className="text-fg-soft mt-1 text-xs leading-relaxed">
                {e.mention} · {e.geste}
              </p>
            </div>
            {/* Encadré, jamais un texte souligné : une action se voit comme une
                cible cliquable, pas comme un lien de bas de page. */}
            <Link
              href={`${FORMATEUR_SESSIONS_PATH}/${e.sessionId}`}
              className="border-border text-mocha hover:bg-sand shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
            >
              Ouvrir la formation
            </Link>
          </li>
        ))}
      </ol>

      {reste > 0 && (
        <p className="text-fg-muted text-xs">
          {reste} autre{reste > 1 ? "s" : ""} point{reste > 1 ? "s" : ""} à traiter — voir le détail
          formation par formation.
        </p>
      )}
    </section>
  );
}
