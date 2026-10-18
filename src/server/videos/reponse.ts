/** Réponses HTTP communes aux adresses `/api/interne/*` : jamais en cache, jamais indexées. */
export function reponseJson(
  statut: number,
  corps: unknown,
  entetesSupplementaires: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      ...entetesSupplementaires,
    },
  });
}

export function refus(
  statut: number,
  erreur: string,
  plus: Record<string, unknown> = {},
): Response {
  return reponseJson(statut, { ok: false, erreur, ...plus });
}
