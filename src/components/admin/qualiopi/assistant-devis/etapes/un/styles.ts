// Gabarits de classes de l'étape 1 (champs 44 px, jetons admin). Pas de `.admin-input` : sa hauteur
// fixe convient mal aux zones de texte et reste sous 44 px hors du ton « dossier ».
export const CHAMP =
  "min-h-[44px] w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] px-3 text-[length:var(--text-admin-base)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-ring)] focus-visible:outline-none";
export const ZONE = `${CHAMP} py-2`;
export const TITRE_BLOC =
  "m-0 text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]";
export const ETIQUETTE = "flex flex-col gap-1 font-medium";
export const AIDE = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";
