/**
 * L'entreprise d'un apporteur, lue dans le registre public À PARTIR DE SON SIREN.
 *
 * `recherche-entreprises.api.gouv.fr` : le service de l'État déjà utilisé par la fiche
 * client (`features/dossier-client/recherche-entreprises.ts`, qui cherche par nom et
 * ville). Ici on cherche par numéro, et l'on ne garde qu'une réponse dont le SIREN est
 * EXACTEMENT celui saisi.
 *
 * Un entrepreneur individuel peut avoir demandé la non-diffusion de ses données : le
 * registre ne rend alors ni nom ni adresse. Ce n'est pas un refus ; l'apporteur les
 * saisit lui-même et Williams les vérifie.
 */

import { sirenValide, type StatutJuridique } from "./regles";

const URL = "https://recherche-entreprises.api.gouv.fr/search";
const DELAI_MS = 4_000;

export interface EntrepriseRegistre {
  siren: string;
  denomination: string | null;
  adresse: string | null;
  naf: string | null;
  active: boolean;
  francaise: boolean;
  /** Suggestion déduite de la nature juridique ; l'apporteur choisit en dernier. */
  statutSuggere: StatutJuridique | null;
  diffusionPartielle: boolean;
}

export type ResultatRegistre =
  | { ok: true; entreprise: EntrepriseRegistre }
  | { ok: false; raison: "siren_invalide" | "introuvable" | "indisponible" };

/** Nature juridique INSEE → statut de la liste fermée (une suggestion). */
export function statutDepuisNature(
  nature: string | null,
  entrepreneurIndividuel: boolean,
): StatutJuridique | null {
  if (entrepreneurIndividuel || nature === "1000") return "micro_entrepreneur";
  switch (nature) {
    case "5498":
      return "eurl";
    case "5499":
      return "sarl";
    case "5720":
      return "sasu";
    case "5710":
      return "sas";
    case "5202":
      return "snc";
    default:
      return nature && /^5[56]\d\d$/.test(nature) ? "sa" : null;
  }
}

function texte(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" && !/NON-DIFFUSIBLE/i.test(v) ? v.trim() : null;
}

/** Lit l'entreprise d'un SIREN. Injectable (`fetch`) pour les tests. */
export async function lireEntrepriseParSiren(
  brut: string,
  options: { fetch?: typeof fetch } = {},
): Promise<ResultatRegistre> {
  const siren = brut.replace(/\s+/g, "");
  if (!sirenValide(siren)) return { ok: false, raison: "siren_invalide" };
  const f = options.fetch ?? fetch;
  try {
    const r = await f(`${URL}?q=${siren}&page=1&per_page=5`, {
      signal: AbortSignal.timeout(DELAI_MS),
      headers: { accept: "application/json" },
    });
    if (!r.ok) return { ok: false, raison: "indisponible" };
    const d = (await r.json()) as { results?: unknown[] };
    const res = (d.results ?? []).find(
      (x): x is Record<string, unknown> =>
        !!x && typeof x === "object" && (x as Record<string, unknown>).siren === siren,
    );
    if (!res) return { ok: false, raison: "introuvable" };
    const siege = (res.siege ?? {}) as Record<string, unknown>;
    const complements = (res.complements ?? {}) as Record<string, unknown>;
    const denomination = texte(res.nom_complet) ?? texte(res.nom_raison_sociale);
    const adresse = texte(siege.adresse);
    return {
      ok: true,
      entreprise: {
        siren,
        denomination,
        adresse,
        naf: texte(siege.activite_principale) ?? texte(res.activite_principale),
        active: res.etat_administratif === "A",
        francaise: !texte(siege.code_pays_etranger),
        statutSuggere: statutDepuisNature(
          texte(res.nature_juridique),
          complements.est_entrepreneur_individuel === true,
        ),
        diffusionPartielle: denomination === null || adresse === null,
      },
    };
  } catch {
    return { ok: false, raison: "indisponible" };
  }
}
