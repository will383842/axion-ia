// Tour de France IA — les deux motifs de la charte, en SVG serveur (aucun JS).
//
// Repris de la maquette `will383842/tour-ia-site` (`TraceRoute.astro`,
// `Coche.astro`) : tracé en pointillé, coche terracotta. Le tracé du héros relie
// CINQ points VIDES — le seuil d'ouverture d'une ville —, sans numéro ni
// compteur : aucun chiffre inventé. Dimensions fixes (`width`/`height` +
// `viewBox`) : la place est réservée avant le rendu, CLS nul.

/** Le tracé du héros : 5 étapes vides reliées en pointillé, arrivée cochée. */
export function TraceHeros({ className = "" }: { className?: string }) {
  const points = [
    { x: 34, y: 216 },
    { x: 114, y: 136 },
    { x: 206, y: 186 },
    { x: 292, y: 96 },
    { x: 370, y: 132 },
  ];
  return (
    <svg
      className={className}
      width="440"
      height="280"
      viewBox="0 0 440 280"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="var(--color-border)" strokeWidth="1">
        <line x1="0" y1="56" x2="440" y2="56" />
        <line x1="0" y1="140" x2="440" y2="140" />
        <line x1="0" y1="224" x2="440" y2="224" />
      </g>
      <path
        d="M34 216 C 60 170, 80 132, 114 136 S 170 196, 206 186 S 252 92, 292 96 S 344 140, 370 132 S 400 70, 406 44"
        fill="none"
        stroke="var(--color-fg-soft)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0.5 9"
      />
      {points.map((p) => (
        <circle
          key={`${p.x}-${p.y}`}
          cx={p.x}
          cy={p.y}
          r="10"
          fill="var(--color-bg)"
          stroke="var(--color-fg)"
          strokeWidth="1.5"
        />
      ))}
      <g transform="translate(392 14)">
        <circle cx="14" cy="14" r="15" fill="var(--color-terracotta)" />
        <path
          d="M8.5 14.5l3.6 3.6 7.4-8"
          fill="none"
          stroke="var(--color-paper)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** La coche terracotta. `surSombre` : la teinte lisible sur mocha. */
export function Coche({
  taille = 24,
  surSombre = false,
  className = "",
}: {
  taille?: number;
  surSombre?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox="0 0 28 28"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="14"
        cy="14"
        r="13"
        fill={surSombre ? "var(--color-terracotta-on-mocha)" : "var(--color-terracotta)"}
      />
      <path
        d="M8.5 14.5l3.6 3.6 7.4-8"
        fill="none"
        stroke={surSombre ? "var(--color-mocha)" : "var(--color-paper)"}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
