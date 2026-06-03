/**
 * Backups & DR (ADR 0032) — helpers de formatage (server-only, FR).
 */

export function formatBytes(bytes: bigint | number | null): string {
  if (bytes == null) return "—";
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (!Number.isFinite(n) || n <= 0) return "—";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(sec: number | null): string {
  if (sec == null || sec < 0) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m}min ${s}s` : `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

export function formatDateFr(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("fr-FR");
}

/** Libellé court "âge vs RPO" : à l'heure / en retard de X. */
export function ageVsRpoLabel(ageVsRpoMin: number | null): string {
  if (ageVsRpoMin == null) return "jamais sauvegardé";
  if (ageVsRpoMin <= 0) return "dans la cible RPO";
  if (ageVsRpoMin < 60) return `en retard de ${ageVsRpoMin} min`;
  const h = Math.floor(ageVsRpoMin / 60);
  if (h < 24) return `en retard de ${h} h`;
  return `en retard de ${Math.floor(h / 24)} j`;
}
