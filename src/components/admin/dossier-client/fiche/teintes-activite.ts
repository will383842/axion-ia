/**
 * Teintes de la chronologie, tirées des variables d'`AdminBloc` (un seul sens par couleur).
 * Chaque chaîne est écrite en toutes lettres : Tailwind v4 ne génère que les noms qu'il lit
 * entiers dans les sources, une interpolation ne produirait aucune couleur.
 */
import type { NuanceActivite } from "@/features/dossier-client/fiche/chronologie";

const TERRACOTTA =
  "border-[color:var(--color-admin-bloc-terracotta-border)] bg-[color:var(--color-admin-bloc-terracotta-bg)] text-[color:var(--color-admin-bloc-terracotta-title)]";
const BLEU =
  "border-[color:var(--color-admin-bloc-bleu-border)] bg-[color:var(--color-admin-bloc-bleu-bg)] text-[color:var(--color-admin-bloc-bleu-title)]";
const VERT =
  "border-[color:var(--color-admin-bloc-vert-border)] bg-[color:var(--color-admin-bloc-vert-bg)] text-[color:var(--color-admin-bloc-vert-title)]";
const AMBRE =
  "border-[color:var(--color-admin-bloc-ambre-border)] bg-[color:var(--color-admin-bloc-ambre-bg)] text-[color:var(--color-admin-bloc-ambre-title)]";
const GRIS =
  "border-[color:var(--color-admin-bloc-gris-border)] bg-[color:var(--color-admin-bloc-gris-bg)] text-[color:var(--color-admin-bloc-gris-title)]";

export const TEINTE_NUANCE: Readonly<Record<NuanceActivite, string>> = {
  prevu: BLEU,
  fait: VERT,
  a_valider: TERRACOTTA,
  a_faire: TERRACOTTA,
  probleme: TERRACOTTA,
  en_retard: TERRACOTTA,
  neutre: GRIS,
  argent: AMBRE,
};
