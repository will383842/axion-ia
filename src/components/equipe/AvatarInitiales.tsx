import type { Categorie } from "@/lib/equipe";
import { jetonsDe, varCss } from "./couleurs-categorie";

/**
 * Avatar SVG à initiales : aucune requête réseau, dimensions portées par le conteneur (carré 1:1).
 * Fond = couleur de la catégorie (variante forte), lettres en ivoire, deux formes géométriques en motif.
 */
export function AvatarInitiales({
  initiales,
  nom,
  categorie,
  className,
  decoratif = false,
}: {
  initiales: string;
  nom: string;
  categorie: Categorie;
  className?: string;
  /** Vrai quand le nom est déjà écrit à côté : l'avatar est alors ignoré des lecteurs d'écran. */
  decoratif?: boolean;
}) {
  const j = jetonsDe(categorie);
  const taille = Array.from(initiales).length > 1 ? 34 : 46;
  return (
    <svg
      viewBox="0 0 100 100"
      {...(decoratif ? { "aria-hidden": true } : { role: "img", "aria-label": `Avatar de ${nom}` })}
      className={className ?? "h-full w-full"}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="100" height="100" fill={varCss(j.fort)} />
      <circle cx="88" cy="12" r="30" fill="var(--color-bg)" opacity="0.12" />
      <rect
        x="-14"
        y="72"
        width="44"
        height="44"
        fill="var(--color-bg)"
        opacity="0.1"
        transform="rotate(20 8 94)"
      />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--color-bg)"
        fontSize={taille}
        style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
        aria-hidden="true"
      >
        {initiales}
      </text>
    </svg>
  );
}
