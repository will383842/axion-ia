// Carte de France de l’accueil : serveur pur, aucun JavaScript.
//
// Le contour (Natural Earth, déjà utilisé par le tour de France IA) est tracé UNE fois dans
// `<defs>` et réutilisé par `<use>` pour le fond, le motif de points, le contour et le clip.
// `viewBox` fixe + `height: auto` : le ratio est réservé, donc CLS 0.
// Les points pulsent 3 fois puis restent fixes ; `prefers-reduced-motion` les fige (voir le CSS).

import type { CSSProperties } from "react";

import styles from "./accueil.module.css";

const CONTOUR_METROPOLE =
  "M221 12 224 17 223 22 228 26 231 28 233 26 238 24 241 29 242 34 251 36 253 43 255 41 261 42 264 45 266 45 265 50 266 50 267 53 265 56 274 58 279 55 280 52 283 49 285 50 282 57 284 58 284 63 287 63 293 67 295 67 296 70 299 71 300 75 308 73 314 77 320 75 326 76 331 80 334 88 337 88 338 86 340 86 342 87 343 90 344 89 349 90 353 88 359 93 367 93 374 96 371 102 364 109 362 120 358 129 359 134 356 145 358 150 352 155 348 156 347 155 347 153 341 153 338 159 342 158 343 159 333 172 327 175 327 182 318 189 316 195 319 197 318 202 314 204 314 206 319 206 323 202 321 199 322 197 328 194 336 195 335 198 337 201 336 206 338 207 338 209 340 210 343 214 341 217 337 218 336 223 341 226 341 231 346 235 343 242 341 242 338 246 335 244 331 247 335 250 335 254 342 258 343 263 341 263 338 269 340 273 338 276 341 280 351 285 360 283 361 287 355 294 355 298 351 302 346 303 346 307 341 308 339 312 335 313 331 318 334 318 333 321 326 323 325 325 321 324 319 325 320 328 318 328 318 326 316 326 313 324 312 324 314 326 311 327 306 322 298 321 296 315 289 316 289 313 293 312 294 310 289 307 290 312 285 312 285 315 284 316 280 306 282 315 277 315 277 312 275 311 266 311 264 307 260 308 248 318 243 319 237 325 235 331 235 343 239 351 232 350 226 352 225 355 221 355 215 351 207 354 205 351 200 349 201 346 200 344 195 343 192 345 190 340 184 340 183 338 175 336 171 335 171 341 164 341 163 340 161 342 158 340 152 341 149 337 147 337 145 335 138 338 133 331 122 329 118 326 119 325 117 328 114 327 113 326 116 319 112 318 110 319 108 317 106 318 105 314 109 313 114 306 120 268 121 264 125 264 122 259 119 265 123 231 125 228 125 231 133 238 134 245 138 251 139 255 137 250 140 251 136 247 132 232 120 223 120 220 122 219 127 223 122 217 125 215 123 211 125 210 121 205 123 200 122 199 120 200 117 198 114 198 114 196 110 195 105 191 105 192 102 184 96 179 96 177 100 171 99 169 93 167 95 166 95 162 99 161 107 164 99 160 96 160 92 163 85 161 88 160 85 157 89 156 86 153 90 153 83 152 84 151 81 153 77 153 75 151 80 151 81 147 80 149 78 147 75 149 73 146 74 150 69 149 70 154 69 154 67 147 69 144 67 143 68 145 67 147 63 145 65 145 63 145 65 142 61 145 58 142 50 141 47 137 45 139 42 136 43 138 41 138 41 141 36 141 36 139 34 134 26 132 27 130 38 129 37 126 35 124 33 124 31 126 31 123 29 123 31 120 32 122 41 121 37 121 38 119 33 120 38 116 25 120 24 116 26 111 30 111 31 109 36 107 37 108 40 108 41 106 46 105 47 108 49 107 50 109 51 105 57 107 59 100 62 102 66 99 67 102 70 99 69 104 72 101 71 102 74 103 81 113 86 108 91 106 92 107 91 109 93 108 94 110 98 108 100 113 101 111 99 108 101 106 104 105 103 108 105 109 117 108 112 104 110 100 113 93 111 93 110 86 112 85 110 86 108 80 104 79 103 73 104 70 101 68 101 66 110 69 115 66 119 67 120 70 118 72 122 80 123 81 125 79 128 79 142 81 148 83 158 78 165 76 167 75 163 76 155 74 158 67 169 61 186 56 194 47 198 47 195 44 197 40 195 39 197 34 196 21 205 16Z";

const CONTOUR_CORSE =
  "M384 360 384 359 387 357 384 353 387 351 388 345 390 346 399 339 404 342 405 329 407 328 409 335 408 343 410 346 411 362 407 370 407 380 403 383 405 384 402 390 402 393 398 391 398 388 397 389 390 385 390 382 394 380 387 378 390 375 391 372 389 371 385 372 385 369 389 366 384 362Z";

/** [délai de pulsation en secondes, x, y] dans le repère du `viewBox` 430×410. */
const POINTS: ReadonlyArray<readonly [string, number, number]> = [
  ["0.00", 183, 70],
  ["0.45", 160, 110],
  ["0.90", 290, 115],
  ["1.35", 332, 146],
  ["1.80", 240, 175],
  ["2.25", 160, 215],
  ["2.70", 196, 254],
  ["3.15", 301, 263],
  ["3.60", 256, 60],
  ["4.05", 120, 160],
];

export function CarteFrance({ ariaLabel }: { ariaLabel: string }) {
  return (
    <svg
      className={styles.carteFrance}
      viewBox="0 0 430 410"
      width={430}
      height={410}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <path id="fr-metro" d={CONTOUR_METROPOLE} />
        <path id="fr-corse" d={CONTOUR_CORSE} />
        <clipPath id="clip-fr">
          <use href="#fr-metro" />
          <use href="#fr-corse" />
        </clipPath>
        <pattern id="pts-fr" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="1.5" className="fill-terracotta" opacity=".42" />
        </pattern>
        <linearGradient id="deg-fr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-terracotta-soft)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-terracotta)", stopOpacity: 0.2 }} />
        </linearGradient>
        <filter id="ombre-fr" x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow
            dx="0"
            dy="14"
            stdDeviation="14"
            style={{ floodColor: "var(--color-terracotta)" }}
            floodOpacity=".28"
          />
        </filter>
      </defs>
      <g filter="url(#ombre-fr)">
        <use href="#fr-metro" fill="url(#deg-fr)" />
        <use href="#fr-corse" fill="url(#deg-fr)" />
      </g>
      <g clipPath="url(#clip-fr)">
        <rect width="430" height="410" fill="url(#pts-fr)" />
      </g>
      <use
        href="#fr-metro"
        fill="none"
        className="stroke-terracotta"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <use
        href="#fr-corse"
        fill="none"
        className="stroke-terracotta"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {POINTS.map(([delai, x, y]) => (
        <g
          key={`${x}-${y}`}
          style={{ "--d": `${delai}s` } as CSSProperties}
          transform={`translate(${x} ${y})`}
        >
          <circle className={styles.halo} r="7" />
          <circle className={styles.coeur} r="4.5" />
        </g>
      ))}
    </svg>
  );
}
