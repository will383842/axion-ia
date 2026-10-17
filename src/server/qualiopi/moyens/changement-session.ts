/**
 * 🔴 CHANTIER QNC, LOT L07 — JOURNAL DES CHANGEMENTS DE MODALITÉ ET DE LIEU.
 *
 * Quand `qualiopi.moyens.actif` est allumé, tout changement de modalité ou de
 * lieu d'une session laisse une ligne de `sessions_changements_modalite_lieu`
 * (avant, après, motif ≥ 10 caractères, auteur ; ajout seul), écrite dans la
 * même transaction que le changement. Module pur + une écriture injectable.
 */

import {
  estLienZoom,
  lienVisioRequis,
  type Modalite,
} from "@/server/qualiopi/moyens/moyens-regles";

export const CHAMPS_LIEU = [
  "lieuType",
  "lieuIntitule",
  "lieuAdresse",
  "lieuCodePostal",
  "lieuVille",
  "lieuSalle",
  "lieuVisioUrl",
] as const;

export type ChampLieu = (typeof CHAMPS_LIEU)[number];

export type EtatModaliteLieu = { modalite: string } & Partial<Record<ChampLieu, string | null>>;

export interface ChangementModaliteLieu {
  readonly nature: "modalite" | "lieu";
  readonly avant: Record<string, string | null>;
  readonly apres: Record<string, string | null>;
}

/** `null`, `undefined` et chaîne vide disent la même chose : « non renseigné ». */
function norm(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

export function changementsModaliteLieu(
  avant: EtatModaliteLieu,
  apres: EtatModaliteLieu,
): ChangementModaliteLieu[] {
  const lignes: ChangementModaliteLieu[] = [];
  if (avant.modalite !== apres.modalite) {
    lignes.push({
      nature: "modalite",
      avant: { modalite: avant.modalite },
      apres: { modalite: apres.modalite },
    });
  }
  const a: Record<string, string | null> = {};
  const b: Record<string, string | null> = {};
  for (const c of CHAMPS_LIEU) {
    if (norm(avant[c]) !== norm(apres[c])) {
      a[c] = norm(avant[c]);
      b[c] = norm(apres[c]);
    }
  }
  if (Object.keys(b).length > 0) lignes.push({ nature: "lieu", avant: a, apres: b });
  return lignes;
}

/** Lien de visio d'une session : « ok », « manquant » ou « pas_zoom » (outil décidé : Zoom Pro). */
export function controlerLienDistanciel(
  modalite: string,
  lieuVisioUrl: string | null | undefined,
): "ok" | "manquant" | "pas_zoom" {
  if (!lienVisioRequis(modalite as Modalite)) return "ok";
  if (norm(lieuVisioUrl) === null) return "manquant";
  return estLienZoom(lieuVisioUrl) ? "ok" : "pas_zoom";
}

export interface TxChangements {
  sessionChangementModaliteLieu: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

export async function enregistrerChangements(
  tx: TxChangements,
  sessionId: string,
  changements: ReadonlyArray<ChangementModaliteLieu>,
  motif: string,
  auteur: { id: string | null; nom: string },
): Promise<void> {
  for (const c of changements) {
    await tx.sessionChangementModaliteLieu.create({
      data: {
        sessionId,
        nature: c.nature,
        avant: c.avant,
        apres: c.apres,
        motif,
        auteurId: auteur.id,
        auteurNom: auteur.nom,
      },
    });
  }
}
