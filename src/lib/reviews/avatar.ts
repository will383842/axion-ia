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

/** Palettes duotone alignées sur les tokens de marque (globals.css @theme). */
const PALETTES: ReadonlyArray<{ from: string; to: string; accent: string }> = [
  { from: "#c24a1b", to: "#8c3010", accent: "#f5e3d8" }, // terracotta
  { from: "#1a4dd9", to: "#12379e", accent: "#dbe4ff" }, // bleu
  { from: "#5e6c54", to: "#3f4a38", accent: "#e4e8df" }, // sage
  { from: "#2a2520", to: "#4a4038", accent: "#e6dcc4" }, // mocha
  { from: "#a8431c", to: "#c24a1b", accent: "#f0e9da" }, // sable chaud
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
