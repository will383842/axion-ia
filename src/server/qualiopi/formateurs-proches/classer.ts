/**
 * « Formateurs proches » — classement PUR (lot L15c, ADR 0066 ; W6 D-W6-1 à 8).
 *
 * Groupes, dans cet ordre : même département, même région, ailleurs, lieu
 * inconnu ; dans chaque groupe, du plus proche au plus loin. Un formateur qui
 * « se déplace partout » garde sa vraie distance (il n'est pas remonté).
 * Distanciel : la distance ne compte pas, un seul groupe trié par activité.
 *
 * Usage INTERNE seulement : rien de ceci n'est montré aux formateurs.
 * Imports purs seulement (formule, seuil) : sûr partout.
 */

import { haversineKm } from "@/lib/geo-distance";

export interface Point {
  readonly lat: number;
  readonly lon: number;
  /** « 38 », « 2A », « 971 » ; `null` si inconnu. */
  readonly departement: string | null;
}

export type Depart =
  | { readonly sorte: "lieu"; readonly point: Point; readonly libelle: string }
  | { readonly sorte: "distanciel"; readonly libelle: string }
  | { readonly sorte: "inconnu" };

export interface StatsFormateur {
  readonly formationsRealisees: number;
  /** Moyenne sur 5 et nombre d'avis ; `null` sous le seuil (jamais « 0 »). */
  readonly satisfaction: { readonly moyenne: number; readonly avis: number } | null;
  readonly derniereFormation: Date | null;
}

export interface FormateurAClasser {
  readonly id: string;
  readonly nom: string;
  readonly statut: string;
  readonly point: Point | null;
  /** Commune affichée (jamais l'adresse). */
  readonly commune: string | null;
  readonly regionsIntervention: ReadonlyArray<string>;
  readonly franceEntiere: boolean;
  readonly stats: StatsFormateur;
}

export interface FormateurClasse extends FormateurAClasser {
  /** Arrondie au kilomètre ; `null` en distanciel ou lieu inconnu. */
  readonly distanceKm: number | null;
  readonly intervientDansLaRegion: boolean;
}

export type CleGroupe =
  "meme_departement" | "meme_region" | "ailleurs" | "lieu_inconnu" | "distanciel" | "sans_depart";

export const LIBELLE_GROUPE: Readonly<Record<CleGroupe, string>> = {
  meme_departement: "Même département",
  meme_region: "Même région",
  ailleurs: "Ailleurs",
  lieu_inconnu: "Lieu inconnu",
  distanciel: "Distanciel : la distance ne compte pas",
  sans_depart: "Tous les formateurs actifs (aucun lieu connu pour classer par distance)",
};

export interface Groupe {
  readonly cle: CleGroupe;
  readonly formateurs: ReadonlyArray<FormateurClasse>;
}

const ORDRE: ReadonlyArray<CleGroupe> = [
  "meme_departement",
  "meme_region",
  "ailleurs",
  "lieu_inconnu",
];

function parActivite(a: FormateurClasse, b: FormateurClasse): number {
  return (
    b.stats.formationsRealisees - a.stats.formationsRealisees || a.nom.localeCompare(b.nom, "fr")
  );
}

/**
 * Classe les formateurs depuis le point de départ. `regionDe` rend le slug de
 * région d'un département (ou `null` : outre-mer hors table, étranger).
 */
export function classerFormateursProches(
  depart: Depart,
  formateurs: ReadonlyArray<FormateurAClasser>,
  regionDe: (departement: string) => string | null,
): Groupe[] {
  if (depart.sorte !== "lieu") {
    const tous = formateurs.map((f): FormateurClasse => ({
      ...f,
      distanceKm: null,
      intervientDansLaRegion: false,
    }));
    const cle: CleGroupe = depart.sorte === "distanciel" ? "distanciel" : "sans_depart";
    return tous.length > 0 ? [{ cle, formateurs: tous.sort(parActivite) }] : [];
  }

  const depDepart = depart.point.departement;
  const regionDepart = depDepart ? regionDe(depDepart) : null;
  const groupes = new Map<CleGroupe, FormateurClasse[]>(ORDRE.map((c) => [c, []]));

  for (const f of formateurs) {
    const intervientDansLaRegion =
      regionDepart !== null && f.regionsIntervention.includes(regionDepart);
    if (!f.point) {
      groupes.get("lieu_inconnu")!.push({ ...f, distanceKm: null, intervientDansLaRegion });
      continue;
    }
    const distanceKm = Math.round(haversineKm(depart.point, f.point));
    const dep = f.point.departement;
    const cle: CleGroupe =
      depDepart !== null && dep === depDepart
        ? "meme_departement"
        : regionDepart !== null && dep !== null && regionDe(dep) === regionDepart
          ? "meme_region"
          : "ailleurs";
    groupes.get(cle)!.push({ ...f, distanceKm, intervientDansLaRegion });
  }

  return ORDRE.flatMap((cle): Groupe[] => {
    const liste = groupes.get(cle)!;
    if (liste.length === 0) return [];
    liste.sort(
      cle === "lieu_inconnu"
        ? parActivite
        : (a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || parActivite(a, b),
    );
    return [{ cle, formateurs: liste }];
  });
}

/** Seuil d'affichage de la satisfaction : celui des indicateurs Qualiopi (D-W6-3). */
export { SEUIL_FIABILITE as SEUIL_AVIS_SATISFACTION } from "@/server/qualiopi/indicateurs/calcul";
