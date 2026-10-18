/** « 3 min 04 », « 45 s » — durée lisible d'une vidéo (cartes, llms.txt). Pure. */
export function libelleDuree(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  if (m === 0) return `${s} s`;
  return `${m} min ${String(s).padStart(2, "0")}`;
}
