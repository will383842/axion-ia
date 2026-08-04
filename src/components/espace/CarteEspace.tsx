/**
 * Carte des espaces connectés — stagiaire, formateur, ressources.
 *
 * ## Pourquoi un composant plutôt que des classes recopiées
 *
 * Les trois espaces répétaient `border-border bg-paper rounded-xl border` à
 * l'identique, page après page. Chaque copie était juste ; le risque n'était pas
 * la faute mais la DÉRIVE — c'est exactement ce qui a laissé les tables de
 * libellés diverger ailleurs dans ce dépôt. Un seul composant, un seul rendu.
 *
 * ## Ce qui change visuellement
 *
 * 🔴 Le design system définit `--shadow-card`, `--shadow-elevated` et
 * `--shadow-subtle` depuis l'origine — et **aucun composant ne les utilisait**.
 * Toute l'interface était donc plate alors que la profondeur était déjà
 * outillée. C'est une bonne part de ce qui la faisait paraître datée.
 *
 * On passe donc à : angles plus généreux (`rounded-xl`), ombre douce plutôt
 * qu'un trait à 1 px, et un liseré d'accent optionnel pour signaler ce qui
 * demande une action.
 *
 * ## Aucun coût de rendu
 *
 * Composant serveur pur, sans état ni gestionnaire d'événement : il n'ajoute
 * pas un octet au bundle client. L'ombre et le rayon sont statiques — rien
 * n'est calculé après le montage, donc `CLS = 0` tient.
 */

import type { LucideIcon } from "lucide-react";

export interface CarteEspaceProps {
  /** Titre de la carte. Omis, l'en-tête entier disparaît. */
  titre?: string;
  /** Ligne d'explication sous le titre. */
  description?: string;
  /** Troisième ligne, plus discrète — contexte (nom de session, date…). */
  meta?: string;
  icone?: LucideIcon;
  /**
   * `action` — la carte appelle à faire quelque chose : liseré terracotta à
   * gauche et en-tête teinté. À réserver à ce qui attend vraiment le lecteur,
   * sinon plus rien ne ressort.
   *
   * `calme` — informative. C'est le défaut.
   */
  ton?: "calme" | "action";
  children?: React.ReactNode;
  className?: string;
}

export function CarteEspace({
  titre,
  description,
  meta,
  icone: Icone,
  ton = "calme",
  children,
  className,
}: CarteEspaceProps): React.ReactElement {
  const estAction = ton === "action";
  return (
    <article
      className={[
        "bg-paper shadow-card overflow-hidden rounded-xl",
        // Le liseré est une bordure GAUCHE épaisse, pas un pseudo-élément :
        // la carte n'a pas de bordure sur les autres côtés, donc rien ne se
        // décale entre les deux tons.
        estAction ? "border-terracotta border-l-4" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {titre ? (
        <div
          className={[
            "px-5 py-4 sm:px-6",
            estAction ? "bg-terracotta-soft/40" : "",
            children ? "" : "pb-5",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="flex items-start gap-3">
            {Icone ? (
              <span
                aria-hidden="true"
                className={[
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  estAction ? "bg-terracotta text-mocha-fg" : "bg-sand text-mocha",
                ].join(" ")}
              >
                <Icone className="size-4.5" strokeWidth={1.9} />
              </span>
            ) : null}
            <div className="min-w-0">
              <h3 className="text-mocha font-serif text-lg leading-tight font-semibold">{titre}</h3>
              {description ? (
                <p className="text-fg-soft mt-1 text-sm leading-snug">{description}</p>
              ) : null}
              {meta ? <p className="text-fg-muted mt-2 text-xs">{meta}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
      {children ? <div className="px-5 py-5 sm:px-6">{children}</div> : null}
    </article>
  );
}

/**
 * Tuile de statistique — un chiffre qui se lit d'un coup d'œil.
 *
 * `tabular-nums` n'est pas cosmétique : sans lui, un compteur qui passe de 9 à
 * 10 change la largeur du bloc et décale ce qui suit.
 */
export function TuileEspace({
  valeur,
  libelle,
  icone: Icone,
  accent = false,
}: {
  valeur: string | number;
  libelle: string;
  icone?: LucideIcon;
  accent?: boolean;
}): React.ReactElement {
  return (
    <div
      className={[
        "shadow-subtle rounded-xl px-4 py-4",
        accent ? "bg-terracotta-soft/50" : "bg-paper",
      ].join(" ")}
    >
      {Icone ? (
        <Icone
          className={accent ? "text-terracotta-deep size-5" : "text-fg-muted size-5"}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      ) : null}
      <p className="text-mocha mt-2 font-serif text-2xl leading-none font-semibold tabular-nums">
        {valeur}
      </p>
      <p className="text-fg-soft mt-1 text-sm leading-snug">{libelle}</p>
    </div>
  );
}
