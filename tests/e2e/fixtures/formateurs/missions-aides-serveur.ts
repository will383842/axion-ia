// Banc @formateurs (missions) — AIDES côté serveur : lectures de registres écrits
// dans le code, qu'un spec ne peut pas lire lui-même (son chargeur ne charge pas
// la chaîne de modules serveur). Aucune écriture, aucune logique métier ici.

import { TEXTES_FORMATEURS_A_VALIDER } from "@/server/email/textes-formateurs-a-valider";

/** Les textes formateurs que l'écran des gabarits fait valider (gabarit, variante). */
export function textesFormateursAValider(): Array<{ gabarit: string; variante?: string }> {
  return TEXTES_FORMATEURS_A_VALIDER.map((t) => ({
    gabarit: t.gabarit,
    ...(t.variante !== undefined ? { variante: t.variante } : {}),
  }));
}
