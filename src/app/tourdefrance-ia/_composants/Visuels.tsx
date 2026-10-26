// Tour de France IA — les illustrations de la landing, en SVG serveur (aucun JS).
//
// Toutes originales, dessinées ici : aucune photo de banque d'images, aucune
// génération externe. Dimensions fixes (`width`/`height` + `viewBox`) : la place
// est réservée avant le rendu, CLS nul. Les animations sont en CSS
// (`tour.module.css`) et s'éteignent sous `prefers-reduced-motion`.
//
// 🔑 Aucun texte visible dans ces dessins : le texte vit dans `contenu.ts`, seul
// fichier relu par le test des mots interdits. La carte ne nomme AUCUNE ville et
// n'affiche aucun chiffre : ses points sont des villes POSSIBLES, et le seul
// point qui se remplit illustre le principe (5 entreprises, l'étape s'ouvre).

import styles from "../tour.module.css";

type PropsSvg = { className?: string };

const DECORATIF = { "aria-hidden": true, focusable: false } as const;

/** La jauge du héros : cinq points qui se remplissent, puis la coche. */
export function Jauge({ className = "" }: PropsSvg) {
  return (
    <svg
      className={`${styles.jauge} ${className}`}
      width="132"
      height="24"
      viewBox="0 0 132 24"
      {...DECORATIF}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={10 + i * 20} cy="12" r="7" className={styles.jaugePoint} />
      ))}
      <g className={styles.jaugeCoche} transform="translate(108 0)">
        <circle cx="12" cy="12" r="11" />
        <path d="M7 12.5l3.2 3.2 6.6-7" />
      </g>
    </svg>
  );
}

// Contour simplifié de la France métropolitaine et de la Corse (projection
// équirectangulaire grossière, tracée à la main) — stylisé, pas cartographique.
const FRANCE =
  "M212 11 230 22 262 40 281 46 308 70 325 73 358 90 375 93 364 112 357 148 340 154 316 196 336 198 342 216 330 248 342 284 356 300 342 310 330 324 311 328 294 320 274 316 258 310 235 322 231 336 234 354 216 358 193 352 165 344 137 340 106 322 96 317 105 308 112 268 111 228 113 204 87 180 76 160 56 148 24 140 13 118 25 104 48 98 70 110 90 106 102 106 101 84 91 64 109 64 115 76 151 74 151 64 179 52 190 36 190 16Z";
const CORSE = "M409 332 413 348 409 396 403 397 386 376 392 348Z";

/** Villes POSSIBLES, sans nom : simples repères répartis sur le territoire. */
const POINTS = [
  { x: 168, y: 92 },
  { x: 262, y: 82 },
  { x: 318, y: 132 },
  { x: 92, y: 140 },
  { x: 150, y: 214 },
  { x: 282, y: 236 },
  { x: 168, y: 300 },
  { x: 300, y: 300 },
];
/** Le point qui illustre le principe : il se remplit jusqu'à 5, puis s'ouvre. */
const DEMO = { x: 226, y: 170 };

/** La carte de France stylisée. `titreId` : l'id du texte alternatif (`<title>`). */
export function CarteFrance({
  className = "",
  titre,
  titreId,
  surSombre = false,
}: PropsSvg & { titre: string; titreId: string; surSombre?: boolean }) {
  return (
    <svg
      className={`${styles.carte} ${surSombre ? styles.carteSombre : ""} ${className}`}
      width="430"
      height="410"
      viewBox="0 0 430 410"
      role="img"
      aria-labelledby={titreId}
    >
      <title id={titreId}>{titre}</title>
      <g className={styles.carteFond}>
        <path d={FRANCE} />
        <path d={CORSE} />
      </g>
      <path
        className={styles.carteTrace}
        d="M92 140 C 120 110, 140 96, 168 92 S 236 70, 262 82 S 306 108, 318 132 S 250 160, 226 170 S 170 190, 150 214 S 150 280, 168 300 S 260 320, 300 300 S 296 250, 282 236"
      />
      {POINTS.map((p) => (
        <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r="6" className={styles.cartePoint} />
      ))}
      <g transform={`translate(${DEMO.x} ${DEMO.y})`}>
        <circle r="26" className={styles.carteHalo} />
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (-90 + i * 72) * (Math.PI / 180);
          return (
            <circle
              key={i}
              cx={Math.round(Math.cos(a) * 17 * 10) / 10}
              cy={Math.round(Math.sin(a) * 17 * 10) / 10}
              r="4.5"
              className={styles.carteEntreprise}
            />
          );
        })}
        <circle r="8" className={styles.carteVille} />
      </g>
    </svg>
  );
}

/** Les illustrations des trois temps de la journée (48 × 48, trait). */
export function IllustrationMoment({ index }: { index: number }) {
  const communs = {
    width: 48,
    height: 48,
    viewBox: "0 0 48 48",
    className: styles.picto,
    ...DECORATIF,
  };
  if (index === 0) {
    // Matin : un soleil qui se lève derrière une loupe (l'audit).
    return (
      <svg {...communs}>
        <path d="M6 34h36" />
        <path d="M12 34a12 12 0 0 1 24 0" className={styles.pictoAccent} />
        <path d="M24 12v-4M10.5 19.5l-2.8-2.8M37.5 19.5l2.8-2.8" />
        <circle cx="30" cy="30" r="6" />
        <path d="M34.5 34.5l5 5" />
      </svg>
    );
  }
  if (index === 1) {
    // Après-midi : un écran et deux personnes (la formation).
    return (
      <svg {...communs}>
        <rect x="10" y="8" width="28" height="18" rx="2" />
        <path d="M16 15h10M16 20h16" className={styles.pictoAccent} />
        <circle cx="16" cy="33" r="3.5" />
        <circle cx="32" cy="33" r="3.5" />
        <path d="M9 42a7 7 0 0 1 14 0M25 42a7 7 0 0 1 14 0" />
      </svg>
    );
  }
  // Vendredi soir : deux verres qui trinquent (la soirée réseau).
  return (
    <svg {...communs}>
      <path d="M13 10h10l-1 10a4 4 0 0 1-8 0z" />
      <path d="M25 10h10l-1 10a4 4 0 0 1-8 0z" />
      <path d="M18 24v12M30 24v12M14 36h8M26 36h8" />
      <path d="M24 4v3M18 6l1.5 2.5M30 6l-1.5 2.5" className={styles.pictoAccent} />
    </svg>
  );
}

/** Les trois constats du problème : dispersion, essais isolés, question. */
export function IllustrationConstat({ index }: { index: number }) {
  const communs = {
    width: 40,
    height: 40,
    viewBox: "0 0 40 40",
    className: styles.picto,
    ...DECORATIF,
  };
  if (index === 0) {
    return (
      <svg {...communs}>
        <rect x="5" y="7" width="12" height="10" rx="2" />
        <rect x="23" y="5" width="12" height="10" rx="2" />
        <rect x="7" y="23" width="12" height="10" rx="2" />
        <rect x="23" y="21" width="12" height="10" rx="2" className={styles.pictoAccent} />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg {...communs}>
        <circle cx="10" cy="12" r="4" />
        <circle cx="30" cy="12" r="4" />
        <path d="M3 30a7 7 0 0 1 14 0M23 30a7 7 0 0 1 14 0" />
        <path d="M20 8v26" strokeDasharray="2 4" className={styles.pictoAccent} />
      </svg>
    );
  }
  return (
    <svg {...communs}>
      <circle cx="20" cy="20" r="15" />
      <path d="M15.5 15.5a4.5 4.5 0 1 1 6.5 4c-1.4.8-2 1.6-2 3.2" className={styles.pictoAccent} />
      <circle cx="20" cy="28" r="0.8" />
    </svg>
  );
}

/** Pictogrammes des secteurs, dans l'ordre de `POUR_QUI.secteurs` (24 × 24, trait). */
const SECTEURS: string[] = [
  // Commerce : un sac.
  "M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0",
  // Industrie : une usine.
  "M3 20V10l5 3V10l5 3V6h4v14zM3 20h18M17 6h3v14",
  // Santé : une croix dans un cercle.
  "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8",
  // Bâtiment : une maison en construction.
  "M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5",
  // Services : une mallette.
  "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  // Associations : trois personnes.
  "M12 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5.5 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7.5 20a4.5 4.5 0 0 1 9 0M2 18a3.5 3.5 0 0 1 6-2.4M22 18a3.5 3.5 0 0 0-6-2.4",
  // Hôtellerie-restauration : une tasse fumante.
  "M4 10h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3",
  // Transport : un camion.
  "M2 7h11v10H2zM13 10h4l3 3v4h-7M6 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
];

export function PictoSecteur({ index }: { index: number }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className={styles.picto} {...DECORATIF}>
      <path d={SECTEURS[index] ?? SECTEURS[4]} />
    </svg>
  );
}

/** La flèche des boutons (glisse au survol, CSS seul). */
export function Fleche() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className={styles.fleche} {...DECORATIF}>
      <path d="M4 10h11M11 5.5l4.5 4.5-4.5 4.5" />
    </svg>
  );
}

/** La coche terracotta. `surSombre` : la teinte lisible sur fond sombre. */
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
    <svg className={className} width={taille} height={taille} viewBox="0 0 28 28" {...DECORATIF}>
      <circle
        cx="14"
        cy="14"
        r="13"
        fill={surSombre ? "var(--color-terracotta-on-mocha)" : "var(--color-terracotta)"}
      />
      <path
        d="M8.5 14.5l3.6 3.6 7.4-8"
        fill="none"
        stroke={surSombre ? "var(--color-ink)" : "var(--color-paper)"}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
