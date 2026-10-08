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

import { checkSiretFormat, normalizeSiret, sirenDuSiret } from "@/lib/siret";

import { sirenValide, type StatutJuridique } from "./regles";

const URL = "https://recherche-entreprises.api.gouv.fr/search";
const DELAI_MS = 4_000;
/** Le registre limite les appels par adresse (429 + `Retry-After`) : on patiente, deux fois au plus. */
const TENTATIVES = 3;
const ATTENTE_MAX_MS = 5_000;

/** Attente avant une nouvelle tentative : `Retry-After` (secondes) borné, sinon 1 s. */
export function attenteAvantReessai(retryAfter: string | null): number {
  const s = Number(retryAfter);
  const ms = Number.isFinite(s) && s > 0 ? s * 1000 : 1000;
  return Math.min(ms, ATTENTE_MAX_MS);
}

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
  /** Lu par SIRET (2026-10-08) : l'établissement ; adresse, NAF et état sont les SIENS. */
  siret?: string;
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
  options: { fetch?: typeof fetch; attendre?: (ms: number) => Promise<void> } = {},
): Promise<ResultatRegistre> {
  const siren = brut.replace(/\s+/g, "");
  if (!sirenValide(siren)) return { ok: false, raison: "siren_invalide" };
  const f = options.fetch ?? ((u, init) => fetch(u, init));
  const attendre =
    options.attendre ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)));
  try {
    let r!: Response;
    for (let essai = 1; essai <= TENTATIVES; essai++) {
      const controleur = new AbortController();
      const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
      try {
        r = await f(`${URL}?q=${siren}&page=1&per_page=5`, {
          signal: controleur.signal,
          headers: { accept: "application/json" },
        });
      } finally {
        clearTimeout(minuteur);
      }
      if (r.status !== 429 || essai === TENTATIVES) break;
      await attendre(attenteAvantReessai(r.headers.get("retry-after")));
    }
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

/**
 * Lit l'ÉTABLISSEMENT d'un SIRET (2026-10-08) : plusieurs activités = un SIREN, plusieurs SIRET.
 * Adresse, code NAF et état sont ceux de l'établissement ; « actif » exige que l'unité légale ET
 * l'établissement le soient. Même registre et mêmes nouveaux essais que `lireEntrepriseParSiren`.
 */
export async function lireEtablissementParSiret(
  brut: string,
  options: { fetch?: typeof fetch; attendre?: (ms: number) => Promise<void> } = {},
): Promise<ResultatRegistre> {
  const siret = normalizeSiret(brut);
  if (!checkSiretFormat(siret).ok) return { ok: false, raison: "siren_invalide" };
  const siren = sirenDuSiret(siret);
  const f = options.fetch ?? ((u, init) => fetch(u, init));
  const attendre =
    options.attendre ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)));
  try {
    let r!: Response;
    for (let essai = 1; essai <= TENTATIVES; essai++) {
      const controleur = new AbortController();
      const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
      try {
        r = await f(`${URL}?q=${siret}&page=1&per_page=5`, {
          signal: controleur.signal,
          headers: { accept: "application/json" },
        });
      } finally {
        clearTimeout(minuteur);
      }
      if (r.status !== 429 || essai === TENTATIVES) break;
      await attendre(attenteAvantReessai(r.headers.get("retry-after")));
    }
    if (!r.ok) return { ok: false, raison: "indisponible" };
    const d = (await r.json()) as { results?: unknown[] };
    const res = (d.results ?? []).find(
      (x): x is Record<string, unknown> =>
        !!x && typeof x === "object" && (x as Record<string, unknown>).siren === siren,
    );
    if (!res) return { ok: false, raison: "introuvable" };
    const siege = (res.siege ?? {}) as Record<string, unknown>;
    const etablissements = Array.isArray(res.matching_etablissements)
      ? (res.matching_etablissements as Array<Record<string, unknown>>)
      : [];
    const etab =
      etablissements.find((e) => e && e.siret === siret) ?? (siege.siret === siret ? siege : null);
    if (!etab) return { ok: false, raison: "introuvable" };
    const complements = (res.complements ?? {}) as Record<string, unknown>;
    const denomination = texte(res.nom_complet) ?? texte(res.nom_raison_sociale);
    const adresse = texte(etab.adresse);
    return {
      ok: true,
      entreprise: {
        siren,
        siret,
        denomination,
        adresse,
        naf: texte(etab.activite_principale) ?? texte(res.activite_principale),
        active: res.etat_administratif === "A" && etab.etat_administratif === "A",
        francaise: !texte(etab.code_pays_etranger) && !texte(siege.code_pays_etranger),
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

/** Un SIREN (9 chiffres) OU un SIRET (14 chiffres) : lit l'entreprise ou l'établissement. */
export function lireRegistre(identifiant: string): Promise<ResultatRegistre> {
  const net = identifiant.replace(/\s+/g, "");
  return net.length === 14 ? lireEtablissementParSiret(net) : lireEntrepriseParSiren(net);
}
