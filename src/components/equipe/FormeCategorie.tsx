import type { FormePoint } from "@/lib/equipe";

/** Forme SVG (viewBox 0 0 12 12) : la forme porte l'information, la couleur la redouble. */
export function FormeCategorie({
  forme,
  couleur,
  taille = 12,
  contour,
}: {
  forme: FormePoint;
  couleur: string;
  taille?: number;
  /** Couleur d'un contour de 1,5 unité (en repère 12) (la carte : ivoire, pour détacher la forme du fond). */
  contour?: string;
}) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
      style={contour ? { overflow: "visible" } : undefined}
      stroke={contour}
      strokeWidth={contour ? 1.5 : undefined}
      strokeLinejoin={contour ? "round" : undefined}
    >
      {forme === "rond" && <circle cx="6" cy="6" r="5.5" fill={couleur} />}
      {forme === "carre" && <rect x="0.5" y="0.5" width="11" height="11" fill={couleur} />}
      {forme === "triangle" && <polygon points="6,0.5 11.5,11 0.5,11" fill={couleur} />}
      {forme === "losange" && <polygon points="6,0 12,6 6,12 0,6" fill={couleur} />}
      {forme === "hexagone" && (
        <polygon points="3,0.8 9,0.8 12,6 9,11.2 3,11.2 0,6" fill={couleur} />
      )}
    </svg>
  );
}
