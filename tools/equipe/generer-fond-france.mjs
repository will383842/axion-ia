/**
 * Génère `src/components/equipe/fond-france.ts` : le contour de la France
 * métropolitaine (Corse comprise) en UN seul tracé SVG, projeté avec la même
 * conique que `projeter()` de `src/lib/equipe/geo.ts` (les points et le fond
 * restent donc superposés).
 *
 * Source : tracés de l'IGN (Admin Express COG, édition 2018), publiés au format
 * GeoJSON par Grégoire David (`gregoiredavid/france-geojson`, fichier
 * `metropole.geojson`).
 * Licence : Licence Ouverte / Open Licence (Etalab) : réutilisation libre,
 * y compris commerciale, avec mention de la source (IGN, Admin Express).
 *
 * Usage (une seule fois ; le résultat est commité) :
 *   pnpm exec tsx tools/equipe/generer-fond-france.mjs [chemin/metropole.geojson]
 * Sans argument, le fichier est téléchargé.
 *
 * Simplification : Douglas-Peucker, tolérance 1,5 unité du repère (≈ 1,5 km,
 * car 1 000 unités couvrent environ 1 000 km), îlots de moins de 40 unités²
 * écartés. Objectif : ≤ 6 Ko brut, ≤ 2,5 Ko gzip.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { projeter } from "../../src/lib/equipe/geo.ts";

const URL_SOURCE =
  "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/metropole.geojson";
const TOLERANCE = Number(process.env.TOLERANCE ?? 1.5);
const AIRE_MIN = 40;
const SORTIE = fileURLToPath(
  new URL("../../src/components/equipe/fond-france.ts", import.meta.url),
);

function distSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function douglasPeucker(pts, tol) {
  if (pts.length < 3) return pts;
  const garde = new Uint8Array(pts.length);
  garde[0] = garde[pts.length - 1] = 1;
  const pile = [[0, pts.length - 1]];
  while (pile.length) {
    const [i, j] = pile.pop();
    let max = 0;
    let k = -1;
    for (let m = i + 1; m < j; m++) {
      const d = distSegment(pts[m], pts[i], pts[j]);
      if (d > max) {
        max = d;
        k = m;
      }
    }
    if (max > tol && k > 0) {
      garde[k] = 1;
      pile.push([i, k], [k, j]);
    }
  }
  return pts.filter((_, i) => garde[i]);
}

const aire = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
};

const geojson = process.argv[2]
  ? JSON.parse(readFileSync(process.argv[2], "utf8"))
  : await (await fetch(URL_SOURCE)).json();
const geom = geojson.geometry ?? geojson.features[0].geometry;

// Anneaux extérieurs seulement (pas de trous : le fond est un aplat).
const anneaux = geom.coordinates
  .map((poly) => poly[0].map(([lon, lat]) => projeter(lat, lon)))
  .map((ring) => ring.filter(Boolean).map((p) => [p.x, p.y]))
  .filter((ring) => ring.length > 3 && aire(ring) >= AIRE_MIN)
  .map((ring) => douglasPeucker(ring, TOLERANCE))
  .filter((ring) => ring.length >= 4 && aire(ring) >= AIRE_MIN);

// Entiers + coordonnées relatives (l) : plus compact et plus compressible.
let d = "";
for (const ring of anneaux) {
  const r = ring.map(([x, y]) => [Math.round(x), Math.round(y)]);
  const pts = r.filter((p, i) => i === 0 || p[0] !== r[i - 1][0] || p[1] !== r[i - 1][1]);
  if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
  if (pts.length < 3) continue;
  let prec = pts[0];
  const sorties = [];
  for (const p of pts.slice(1)) {
    sorties.push(`${p[0] - prec[0]} ${p[1] - prec[1]}`);
    prec = p;
  }
  d += `M${pts[0][0]} ${pts[0][1]}l${sorties.join(" ").replace(/ -/g, "-")}z`;
}

const brut = Buffer.byteLength(d);
const gz = gzipSync(d).length;
console.warn(`anneaux : ${anneaux.length} · brut : ${brut} o · gzip : ${gz} o`);
if (brut > 6144 || gz > 2560) {
  console.error("Hors budget (≤ 6 Ko brut, ≤ 2,5 Ko gzip) : augmenter TOLERANCE.");
  process.exit(1);
}

writeFileSync(
  SORTIE,
  `/**
 * Contour de la France métropolitaine (Corse comprise), UN seul tracé.
 * GÉNÉRÉ par tools/equipe/generer-fond-france.mjs : ne pas modifier à la main.
 * Source : IGN, Admin Express COG 2018, via gregoiredavid/france-geojson.
 * Licence : Licence Ouverte / Open Licence (Etalab).
 * Repère : celui de \`projeter()\` (src/lib/equipe/geo.ts).
 */
export const FOND_FRANCE_PATH =
  ${JSON.stringify(d)};
`,
);
console.warn("écrit :", SORTIE);
