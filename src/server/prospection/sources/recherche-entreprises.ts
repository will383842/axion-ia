/**
 * Prospection — Connecteur API recherche-entreprises (T4, gratuit, sans clé).
 *
 * Usage : dénombrement à la demande pour l'aperçu volume du wizard (§04-SPEC) +
 * ciblage résiduel. PAS la collecte de masse (= Stock Sirene, T3). ~7 req/s →
 * rate-limité en amont (token-bucket + limiter worker). Validation Zod : un
 * changement de schéma API ne doit pas produire des `null` silencieux.
 *
 * `fetchImpl` injectable (test = fixture JSON) ; défaut = `ssrfSafeFetch`.
 * Stub-aware : au build `stub.invalid`, renvoie 0 / [] sans I/O réseau.
 */

import { z } from "zod";
import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";
import { isBuildStub } from "./stock-source";

const API_BASE = "https://recherche-entreprises.api.gouv.fr/search";

export const rechercheResponseSchema = z.object({
  total_results: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative().optional(),
  results: z
    .array(
      z.object({
        siren: z.string(),
        nom_complet: z.string().optional(),
        siege: z
          .object({
            departement: z.string().nullable().optional(),
            code_postal: z.string().nullable().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export type RechercheResponse = z.infer<typeof rechercheResponseSchema>;

export interface RechercheParams {
  departement?: string;
  activitePrincipale?: string;
  trancheEffectif?: string;
  categorieEntreprise?: string;
  page?: number;
  perPage?: number;
}

type FetchImpl = (
  url: string,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function buildUrl(p: RechercheParams): string {
  const q = new URLSearchParams();
  if (p.departement) q.set("departement", p.departement);
  if (p.activitePrincipale) q.set("activite_principale", p.activitePrincipale);
  if (p.trancheEffectif) q.set("tranche_effectif_salarie", p.trancheEffectif);
  if (p.categorieEntreprise) q.set("categorie_entreprise", p.categorieEntreprise);
  q.set("page", String(p.page ?? 1));
  q.set("per_page", String(p.perPage ?? 25));
  return `${API_BASE}?${q.toString()}`;
}

const defaultFetch: FetchImpl = (url) => ssrfSafeFetch(url);

/** Requête validée. Jette si le schéma API a changé (pas de null silencieux). */
export async function rechercheEntreprises(
  params: RechercheParams,
  deps: { fetchImpl?: FetchImpl } = {},
): Promise<RechercheResponse> {
  if (isBuildStub()) return { total_results: 0, results: [] };
  const fetchImpl = deps.fetchImpl ?? defaultFetch;
  const res = await fetchImpl(buildUrl(params));
  if (!res.ok) {
    throw new Error(`recherche-entreprises HTTP ${res.status}`);
  }
  const raw = await res.json();
  return rechercheResponseSchema.parse(raw);
}

/** Dénombrement (aperçu volume wizard). Renvoie 0 au build stub. */
export async function rechercheEntreprisesCount(
  params: RechercheParams,
  deps: { fetchImpl?: FetchImpl } = {},
): Promise<number> {
  const r = await rechercheEntreprises({ ...params, perPage: 1, page: 1 }, deps);
  return r.total_results;
}
