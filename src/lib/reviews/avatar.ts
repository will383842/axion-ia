// Génération déterministe d'un avatar de marque (SVG) pour les avis sans photo.
// Motif « orbital » duotone dans la palette Axion-IA — jamais d'initiales.
// Déterministe : même seed (nom d'entreprise/auteur) → même avatar, stable.
//
// Fichier PUR — importable client ET serveur, testable.

export interface AvatarStyle {
  from: string;
  to: string;
  accent: string;
  /** Rotation du motif orbital en degrés. */
  rotation: number;
}

/** Palettes (aplats, sans dégradé) alignées sur les tokens de marque (globals.css @theme). */
const PALETTES: ReadonlyArray<{ from: string; to: string; accent: string }> = [
  { from: "#b23f16", to: "#b23f16", accent: "#faf9f5" }, // terracotta
  { from: "#141413", to: "#141413", accent: "#d97757" }, // noir, orange sur noir
  { from: "#5e7050", to: "#5e7050", accent: "#faf9f5" }, // sauge
  { from: "#8f3412", to: "#8f3412", accent: "#e8e6dc" }, // terracotta de survol
  { from: "#141413", to: "#141413", accent: "#b0aea5" }, // noir, gris sur noir
];

/** Hash FNV-1a 32 bits, stable et déterministe. */
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Style d'avatar déterministe à partir d'un seed (nom). */
export function avatarStyle(seed: string): AvatarStyle {
  const h = hashSeed(seed || "axion");
  const p = PALETTES[h % PALETTES.length]!;
  return { ...p, rotation: h % 360 };
}
