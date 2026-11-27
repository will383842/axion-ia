/** Intervalle de Wilson. z = 1,645 : intervalle bilatéral à 90 %. */
export const Z_90 = 1.645;

function wilson(clics: number, impressions: number, z: number): { bas: number; haut: number } {
  if (!(impressions > 0)) return { bas: 0, haut: 1 };
  const n = impressions;
  const p = Math.min(Math.max(clics, 0), n) / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const marge = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { bas: Math.max(0, centre - marge), haut: Math.min(1, centre + marge) };
}

export function borneBasseWilson(clics: number, impressions: number, z = Z_90): number {
  return wilson(clics, impressions, z).bas;
}

export function borneHauteWilson(clics: number, impressions: number, z = Z_90): number {
  return wilson(clics, impressions, z).haut;
}
