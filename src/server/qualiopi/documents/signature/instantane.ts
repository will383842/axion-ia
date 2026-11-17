/**
 * Lecture de la PHOTO d'une pièce (`DocumentGenere.metadata.renderData`).
 *
 * Module léger, sans react-pdf : la page publique de signature le lit sans tirer
 * le moteur de rendu. `exemplaire-signe.ts` le réexporte.
 */

/**
 * Extrait l'instantané de rendu de `metadata`, ou `null`.
 *
 * ⚠️ Il porte `{ data, identite? }` — les formes de props ne sont PAS uniformes
 * d'un template à l'autre (voir `documents-service.ts`). Rendre seulement `data`
 * ferait planter quatre des six pièces sur `identite.raisonSociale`.
 *
 * 🔴 2026-09-05 — `gabaritVersion` DOIT être reconduit. Cette fonction
 * reconstruit un objet neuf champ par champ ; elle en énumérait deux. Le même
 * commit qui a introduit la garde de version (#639, 16/08) a commencé à écrire
 * `gabaritVersion` DANS `renderData` (`documents-service.ts`) sans l'ajouter
 * ici. Le champ était donc écrit à la génération, puis jeté à la relecture :
 * `versionGabaritInstantane()` ne trouvait jamais rien et retombait sur son
 * défaut prudent — 1 — face à `convention: 2`. Résultat, `gabarit_modifie`
 * sur TOUTE convention signée depuis le 16/08, y compris celles produites la
 * veille avec le gabarit courant.
 *
 * Le défaut a survécu trois semaines parce que les cinq autres pièces
 * signables sont restées en version 1 : `1 === 1` les laissait passer, et
 * seules les deux conventions — les seules bumpées à 2 — étaient refusées.
 * Vécu en production sur `AXI-DOC-2026-039` le 2026-09-05.
 *
 * ⚠️ Toute clé ajoutée à `renderData` doit être reconduite ici, sans quoi elle
 * n'existe que du côté de l'écriture.
 */
export function instantane(
  metadata: unknown,
): { data: Record<string, unknown>; identite?: unknown; gabaritVersion?: unknown } | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const rd = (metadata as Record<string, unknown>)["renderData"];
  if (typeof rd !== "object" || rd === null || Array.isArray(rd)) return null;
  const bloc = rd as Record<string, unknown>;
  const data = bloc["data"];
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  return {
    data: data as Record<string, unknown>,
    ...(bloc["identite"] !== undefined ? { identite: bloc["identite"] } : {}),
    ...(bloc["gabaritVersion"] !== undefined ? { gabaritVersion: bloc["gabaritVersion"] } : {}),
  };
}
