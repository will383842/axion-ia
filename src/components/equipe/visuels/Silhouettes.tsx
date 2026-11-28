/**
 * Pictogramme décoratif : 1 à 3 silhouettes de taille croissante.
 * SVG en ligne, masqué aux lecteurs d'écran : le sens est porté par le texte HTML voisin.
 */
export function Silhouettes({ nombre, className }: { nombre: 1 | 2 | 3; className?: string }) {
  const tailles = [14, 17, 20].slice(0, nombre);
  return (
    <svg
      viewBox="0 0 64 28"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {tailles.map((t, i) => {
        const cx = 12 + i * 20;
        return (
          <g key={t}>
            <circle cx={cx} cy={28 - t - 4} r={t / 4.2} />
            <path d={`M${cx - t / 2.4} 28a${t / 2.4} ${t / 1.6} 0 0 1 ${t / 1.2} 0z`} />
          </g>
        );
      })}
    </svg>
  );
}
