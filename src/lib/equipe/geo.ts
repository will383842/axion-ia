import { slugifier } from "./regles";
import type { Coordonnees, Lieu } from "./types";

/**
 * Chefs-lieux de département (lat, lon) : repli quand la ville est inconnue.
 * Table statique, sans nom de ville : seules les coordonnées comptent.
 */
const CHEFS_LIEUX: Readonly<Record<string, readonly [number, number]>> = {
  "01": [46.2056, 5.2289],
  "02": [49.564, 3.62],
  "03": [46.5667, 3.3333],
  "04": [44.0919, 6.2358],
  "05": [44.5594, 6.0786],
  "06": [43.7102, 7.262],
  "07": [44.7353, 4.599],
  "08": [49.7733, 4.7203],
  "09": [42.9639, 1.6053],
  "10": [48.2973, 4.0744],
  "11": [43.213, 2.3491],
  "12": [44.3506, 2.575],
  "13": [43.2965, 5.3698],
  "14": [49.1829, -0.3707],
  "15": [44.9261, 2.4393],
  "16": [45.6484, 0.1562],
  "17": [46.1603, -1.1511],
  "18": [47.081, 2.3987],
  "19": [45.2656, 1.7694],
  "21": [47.322, 5.0415],
  "22": [48.5136, -2.7603],
  "23": [46.1703, 1.8717],
  "24": [45.1844, 0.7211],
  "25": [47.2378, 6.0241],
  "26": [44.9334, 4.8924],
  "27": [49.0241, 1.1508],
  "28": [48.4469, 1.4891],
  "29": [47.996, -4.1025],
  "2A": [41.9228, 8.7058],
  "2B": [42.6861, 9.424],
  "30": [43.8367, 4.3601],
  "31": [43.6047, 1.4442],
  "32": [43.646, 0.5856],
  "33": [44.8378, -0.5792],
  "34": [43.6108, 3.8767],
  "35": [48.1173, -1.6778],
  "36": [46.8103, 1.6915],
  "37": [47.3941, 0.6848],
  "38": [45.1885, 5.7245],
  "39": [46.6754, 5.5556],
  "40": [43.8903, -0.5006],
  "41": [47.5861, 1.3359],
  "42": [45.4397, 4.3872],
  "43": [45.0428, 3.8855],
  "44": [47.2184, -1.5536],
  "45": [47.9029, 1.9093],
  "46": [44.4475, 1.4414],
  "47": [44.2033, 0.6167],
  "48": [44.518, 3.5009],
  "49": [47.4784, -0.5632],
  "50": [49.1157, -1.0912],
  "51": [48.9567, 4.3631],
  "52": [48.1113, 5.1394],
  "53": [48.0698, -0.7709],
  "54": [48.6921, 6.1844],
  "55": [48.7726, 5.1613],
  "56": [47.6582, -2.7608],
  "57": [49.1193, 6.1757],
  "58": [46.9896, 3.159],
  "59": [50.6292, 3.0573],
  "60": [49.4295, 2.0807],
  "61": [48.4326, 0.0933],
  "62": [50.291, 2.7775],
  "63": [45.7772, 3.087],
  "64": [43.2951, -0.3708],
  "65": [43.2328, 0.0781],
  "66": [42.6887, 2.8948],
  "67": [48.5734, 7.7521],
  "68": [48.0794, 7.3585],
  "69": [45.764, 4.8357],
  "70": [47.6197, 6.1556],
  "71": [46.3069, 4.8286],
  "72": [48.0061, 0.1996],
  "73": [45.5646, 5.9178],
  "74": [45.8992, 6.1294],
  "75": [48.8566, 2.3522],
  "76": [49.4432, 1.0993],
  "77": [48.54, 2.66],
  "78": [48.8049, 2.1204],
  "79": [46.324, -0.4588],
  "80": [49.8941, 2.2958],
  "81": [43.9298, 2.148],
  "82": [44.0176, 1.355],
  "83": [43.1242, 5.928],
  "84": [43.9493, 4.8055],
  "85": [46.6705, -1.426],
  "86": [46.5802, 0.3404],
  "87": [45.8336, 1.2611],
  "88": [48.1724, 6.4503],
  "89": [47.7982, 3.5672],
  "90": [47.638, 6.8628],
  "91": [48.6298, 2.4418],
  "92": [48.8924, 2.2071],
  "93": [48.9086, 2.4392],
  "94": [48.7904, 2.4556],
  "95": [49.0508, 2.1008],
  "971": [16.0, -61.73],
  "972": [14.6, -61.07],
  "973": [4.92, -52.31],
  "974": [-20.88, 55.45],
  "976": [-12.78, 45.23],
};

/** Ville connue d'un jeu de données (forme réduite de `VilleData`). */
export interface VilleConnue {
  nameFr: string;
  departement: string;
  geo: { lat: number; lon: number };
}

function codeDepartement(brut: string | null | undefined): string | null {
  const c = (brut ?? "").trim().toUpperCase();
  if (!c) return null;
  const code = /^\d$/.test(c) ? `0${c}` : c;
  return code in CHEFS_LIEUX ? code : null;
}

/**
 * Coordonnées d'un lieu : la ville si elle figure dans `villes` (même
 * département quand il est connu), sinon le chef-lieu du département, sinon
 * `null`. Jamais d'adresse : la précision s'arrête à la ville.
 */
export function coordonneesDe(
  lieu: Lieu,
  villes: ReadonlyArray<VilleConnue> = [],
): Coordonnees | null {
  const dep = codeDepartement(lieu.departement);
  // Un département renseigné mais inconnu : on ne devine pas (homonymes).
  if (dep === null && (lieu.departement ?? "").trim() !== "") return null;
  const cle = slugifier(lieu.ville);
  if (cle) {
    const trouvee = villes.find(
      (v) => slugifier(v.nameFr) === cle && (dep === null || v.departement.toUpperCase() === dep),
    );
    if (trouvee) return { lat: trouvee.geo.lat, lon: trouvee.geo.lon, precision: "ville" };
  }
  const chefLieu = dep ? CHEFS_LIEUX[dep] : undefined;
  if (chefLieu) return { lat: chefLieu[0], lon: chefLieu[1], precision: "departement" };
  return null;
}

/* ---------- Projection vers le SVG de la carte ---------- */

const RAD = Math.PI / 180;
const PHI1 = 44 * RAD;
const PHI2 = 49 * RAD;
const PHI0 = 46.5 * RAD;
const LAMBDA0 = 3 * RAD;

// Conique conforme de Lambert (sphère) calée sur la France métropolitaine.
const N =
  Math.log(Math.cos(PHI1) / Math.cos(PHI2)) /
  Math.log(Math.tan(Math.PI / 4 + PHI2 / 2) / Math.tan(Math.PI / 4 + PHI1 / 2));
const F = (Math.cos(PHI1) * Math.tan(Math.PI / 4 + PHI1 / 2) ** N) / N;
const rho = (phi: number) => F / Math.tan(Math.PI / 4 + phi / 2) ** N;
const RHO0 = rho(PHI0);

function conique(lat: number, lon: number): { x: number; y: number } {
  const r = rho(lat * RAD);
  const theta = N * (lon * RAD - LAMBDA0);
  return { x: r * Math.sin(theta), y: RHO0 - r * Math.cos(theta) };
}

/** Points extrêmes de la France métropolitaine (Corse comprise) : calage du cadre. */
const EXTREMES: ReadonlyArray<readonly [number, number]> = [
  [51.09, 2.54],
  [48.41, -4.79],
  [43.79, 7.52],
  [43.37, -1.78],
  [48.97, 8.23],
  [41.36, 9.16],
  [43.0, 9.55],
  [47.1, -2.3],
  [49.7, -1.9],
  [42.43, 3.17],
];
const MARGE = 0.03;

const bornes = (() => {
  const pts = EXTREMES.map(([lat, lon]) => conique(lat, lon));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const marge = (maxX - minX) * MARGE;
  return { minX: minX - marge, maxX: maxX + marge, minY: minY - marge, maxY: maxY + marge };
})();

/** Largeur du repère de la carte (viewBox). */
export const LARGEUR_CARTE = 1000;
const ECHELLE = LARGEUR_CARTE / (bornes.maxX - bornes.minX);
/** Hauteur du repère de la carte (viewBox), arrondie. */
export const HAUTEUR_CARTE = Math.round((bornes.maxY - bornes.minY) * ECHELLE);

export interface PointCarte {
  x: number;
  y: number;
}

/** Vrai si le point tombe dans le cadre de la France métropolitaine. */
export function estMetropole(lat: number, lon: number): boolean {
  return lat >= 41.2 && lat <= 51.2 && lon >= -5.3 && lon <= 9.8;
}

/**
 * Projette (lat, lon) dans le repère 0..LARGEUR_CARTE × 0..HAUTEUR_CARTE.
 * `null` hors France métropolitaine (outre-mer : encart à part) ou si la
 * valeur n'est pas finie. Résultat arrondi au dixième.
 */
export function projeter(lat: number, lon: number): PointCarte | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !estMetropole(lat, lon)) return null;
  const p = conique(lat, lon);
  const x = (p.x - bornes.minX) * ECHELLE;
  const y = (bornes.maxY - p.y) * ECHELLE;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

/** Position sur la carte d'un lieu. Williams n'a pas de point : l'appelant ne l'appelle pas pour lui. */
export function positionSurCarte(
  lieu: Lieu,
  villes: ReadonlyArray<VilleConnue> = [],
): PointCarte | null {
  const c = coordonneesDe(lieu, villes);
  return c ? projeter(c.lat, c.lon) : null;
}

/** Collaborateurs par ville au-delà de ce nombre : un seul point « +N ». */
export const COURONNE_MAX = 6;

/**
 * Décalages d'une couronne autour d'un point partagé par `n` personnes.
 * 1 → [(0,0)] ; 2 à COURONNE_MAX → points régulièrement répartis, le premier
 * au nord ; au-delà → `null` (un point « +N »).
 */
export function decalagesCouronne(n: number, rayon = 16): PointCarte[] | null {
  if (!Number.isInteger(n) || n < 1 || n > COURONNE_MAX) return null;
  if (n === 1) return [{ x: 0, y: 0 }];
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return {
      x: Math.round(rayon * Math.cos(a) * 10) / 10 || 0,
      y: Math.round(rayon * Math.sin(a) * 10) / 10 || 0,
    };
  });
}
