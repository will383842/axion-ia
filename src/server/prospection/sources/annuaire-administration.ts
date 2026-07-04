/**
 * Prospection — Connecteur Annuaire de l'administration (T5, gratuit, sans clé).
 *
 * Pour les organisations PUBLIQUES (mairies, préfectures, EPCI…), on privilégie
 * les coordonnées institutionnelles PUBLIÉES ici plutôt que le scraping de leur
 * site (plus loyal + meilleure donnée). Zod pour ne pas écrire de null silencieux.
 * `fetchImpl` injectable ; stub-aware.
 */

import { z } from "zod";
import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";
import { isBuildStub } from "./stock-source";

const API_BASE =
  "https://api-lannuaire.service-public.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records";

// Réponse simplifiée (on ne valide que ce qu'on consomme).
export const annuaireResponseSchema = z.object({
  total_count: z.number().int().nonnegative().optional(),
  results: z
    .array(
      z.object({
        nom: z.string().optional(),
        adresse_courriel: z.string().optional().nullable(),
        telephone: z.string().optional().nullable(),
      }),
    )
    .optional(),
});

export type AnnuaireResponse = z.infer<typeof annuaireResponseSchema>;

type FetchImpl = (
  url: string,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const defaultFetch: FetchImpl = (url) => ssrfSafeFetch(url);

export interface AnnuaireContact {
  email: string | null;
  telephone: string | null;
}

/**
 * Cherche les coordonnées institutionnelles d'une organisation par nom + commune.
 * Renvoie le meilleur contact public. Stub-aware (build → vide).
 */
export async function annuaireLookup(
  params: { nom: string; commune?: string | null },
  deps: { fetchImpl?: FetchImpl } = {},
): Promise<AnnuaireContact> {
  if (isBuildStub()) return { email: null, telephone: null };
  const fetchImpl = deps.fetchImpl ?? defaultFetch;
  const q = new URLSearchParams();
  const search = [params.nom, params.commune].filter(Boolean).join(" ");
  q.set("where", `search(nom,"${search.replace(/"/g, "")}")`);
  q.set("limit", "1");
  const res = await fetchImpl(`${API_BASE}?${q.toString()}`);
  if (!res.ok) throw new Error(`annuaire HTTP ${res.status}`);
  const parsed = annuaireResponseSchema.parse(await res.json());
  const first = parsed.results?.[0];
  return {
    email: first?.adresse_courriel ?? null,
    telephone: first?.telephone ?? null,
  };
}
