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
// point qui se remplit illustre le principe (5 places confirmées, l'étape se tient).

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
      {/* Décalage et animation sur deux <g> : l'animation CSS écraserait l'attribut `transform`. */}
      <g transform="translate(108 0)">
        <g className={styles.jaugeCoche}>
          <circle cx="12" cy="12" r="11" />
          <path d="M7 12.5l3.2 3.2 6.6-7" />
        </g>
      </g>
    </svg>
  );
}

// Contour de la France métropolitaine et de la Corse, d'après Natural Earth
// (1:10m, DOMAINE PUBLIC — naturalearthdata.com, via le paquet `world-atlas`,
// non installé : extrait une fois). Projection équirectangulaire corrigée à
// 46,5° N, simplifiée par Douglas-Peucker (tolérance 1,1 unité), arrondie à
// l'unité : fidèle à l'échelle du dessin, ~3 Ko.
const FRANCE =
  "M221 12 224 17 223 22 228 26 231 28 233 26 238 24 241 29 242 34 251 36 253 43 255 41 261 42 264 45 266 45 265 50 266 50 267 53 265 56 274 58 279 55 280 52 283 49 285 50 282 57 284 58 284 63 287 63 293 67 295 67 296 70 299 71 300 75 308 73 314 77 320 75 326 76 331 80 334 88 337 88 338 86 340 86 342 87 343 90 344 89 349 90 353 88 359 93 367 93 374 96 371 102 364 109 362 120 358 129 359 134 356 145 358 150 352 155 348 156 347 155 347 153 341 153 338 159 342 158 343 159 333 172 327 175 327 182 318 189 316 195 319 197 318 202 314 204 314 206 319 206 323 202 321 199 322 197 328 194 336 195 335 198 337 201 336 206 338 207 338 209 340 210 343 214 341 217 337 218 336 223 341 226 341 231 346 235 343 242 341 242 338 246 335 244 331 247 335 250 335 254 342 258 343 263 341 263 338 269 340 273 338 276 341 280 351 285 360 283 361 287 355 294 355 298 351 302 346 303 346 307 341 308 339 312 335 313 331 318 334 318 333 321 326 323 325 325 321 324 319 325 320 328 318 328 318 326 316 326 313 324 312 324 314 326 311 327 306 322 298 321 296 315 289 316 289 313 293 312 294 310 289 307 290 312 285 312 285 315 284 316 280 306 282 315 277 315 277 312 275 311 266 311 264 307 260 308 248 318 243 319 237 325 235 331 235 343 239 351 232 350 226 352 225 355 221 355 215 351 207 354 205 351 200 349 201 346 200 344 195 343 192 345 190 340 184 340 183 338 175 336 171 335 171 341 164 341 163 340 161 342 158 340 152 341 149 337 147 337 145 335 138 338 133 331 122 329 118 326 119 325 117 328 114 327 113 326 116 319 112 318 110 319 108 317 106 318 105 314 109 313 114 306 120 268 121 264 125 264 122 259 119 265 123 231 125 228 125 231 133 238 134 245 138 251 139 255 137 250 140 251 136 247 132 232 120 223 120 220 122 219 127 223 122 217 125 215 123 211 125 210 121 205 123 200 122 199 120 200 117 198 114 198 114 196 110 195 105 191 105 192 102 184 96 179 96 177 100 171 99 169 93 167 95 166 95 162 99 161 107 164 99 160 96 160 92 163 85 161 88 160 85 157 89 156 86 153 90 153 83 152 84 151 81 153 77 153 75 151 80 151 81 147 80 149 78 147 75 149 73 146 74 150 69 149 70 154 69 154 67 147 69 144 67 143 68 145 67 147 63 145 65 145 63 145 65 142 61 145 58 142 50 141 47 137 45 139 42 136 43 138 41 138 41 141 36 141 36 139 34 134 26 132 27 130 38 129 37 126 35 124 33 124 31 126 31 123 29 123 31 120 32 122 41 121 37 121 38 119 33 120 38 116 25 120 24 116 26 111 30 111 31 109 36 107 37 108 40 108 41 106 46 105 47 108 49 107 50 109 51 105 57 107 59 100 62 102 66 99 67 102 70 99 69 104 72 101 71 102 74 103 81 113 86 108 91 106 92 107 91 109 93 108 94 110 98 108 100 113 101 111 99 108 101 106 104 105 103 108 105 109 117 108 112 104 110 100 113 93 111 93 110 86 112 85 110 86 108 80 104 79 103 73 104 70 101 68 101 66 110 69 115 66 119 67 120 70 118 72 122 80 123 81 125 79 128 79 142 81 148 83 158 78 165 76 167 75 163 76 155 74 158 67 169 61 186 56 194 47 198 47 195 44 197 40 195 39 197 34 196 21 205 16Z";
const CORSE =
  "M384 360 384 359 387 357 384 353 387 351 388 345 390 346 399 339 404 342 405 329 407 328 409 335 408 343 410 346 411 362 407 370 407 380 403 383 405 384 402 390 402 393 398 391 398 388 397 389 390 385 390 382 394 380 387 378 390 375 391 372 389 371 385 372 385 369 389 366 384 362Z";

/**
 * Repères POSSIBLES, sans nom : un semis régulier à l'intérieur du contour,
 * volontairement hors des grandes villes. Aucun ne désigne une ville reconnaissable
 * et aucun n'est annoncé (cf. la légende).
 */
const POINTS = [
  { x: 183, y: 70 },
  { x: 160, y: 110 },
  { x: 290, y: 115 },
  { x: 332, y: 146 },
  { x: 240, y: 175 },
  { x: 160, y: 215 },
  { x: 196, y: 254 },
  { x: 301, y: 263 },
];
/** Le point qui illustre le principe : ses 5 places se confirment, puis l'étape se tient. */
const DEMO = { x: 240, y: 264 };
/** Le tracé en pointillé qui relie les repères (passe par le point de démonstration). */
const TRACE =
  "M183 70 C176 84 144 90 160 110 C172 125 262 106 290 115 C316 123 338 128 332 146 C326 164 262 168 240 175 C200 188 158 195 160 215 C162 235 181 244 196 254 C205 260 228 263 240 264 C252 265 294 263 301 263";

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
      <path className={styles.carteTrace} d={TRACE} />
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

/** Les illustrations de l’offre (48 × 48, trait) : 0 audit, 1 formation, 2 soirée réseau, 3 étape. */
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
  if (index === 3) {
    // L'étape : un repère posé sur une ville, et ses rues.
    return (
      <svg {...communs}>
        <path d="M24 40s-11-10.2-11-19a11 11 0 0 1 22 0c0 8.8-11 19-11 19z" />
        <circle cx="24" cy="21" r="4" className={styles.pictoAccent} />
        <path d="M6 44h36M10 44l4-6M38 44l-4-6" />
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
