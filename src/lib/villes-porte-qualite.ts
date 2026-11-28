// Porte de qualité des pages de villes : drapeau + liste générée des villes publiables.
// Edge-safe (aucun import de data villes). Décision de Will du 28/11/2026.
//
// DRAPEAU ÉTEINT PAR DÉFAUT : `VILLES_PORTE_QUALITE_ACTIVE=true` l'allume, toute autre valeur
// (absente, vide, « false », « 1 ») le laisse éteint. Éteint : aucune page par-ville n'est
// indexable, aucune n'entre au plan du site (règle du 18/11/2026). Allumé : seules les villes de
// `VILLES_PUBLIABLES_CAP` (verdict de `evaluerPageVille`, liste générée par
// le script `gen-villes-publiables` (voir `pnpm villes:rapport`)) deviennent indexables.
import { VILLES_PUBLIABLES_CAP } from "@/generated/villes-publiables";

const PUBLIABLES: ReadonlySet<string> = new Set(VILLES_PUBLIABLES_CAP);

export function porteQualiteVilleActive(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return env.VILLES_PORTE_QUALITE_ACTIVE === "true";
}

/** True si le drapeau est allumé ET que la ville a passé la porte. Éteint → toujours false. */
export function villeIndexableParPorte(
  slug: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return porteQualiteVilleActive(env) && PUBLIABLES.has(slug);
}
