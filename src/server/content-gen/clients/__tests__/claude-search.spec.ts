/**
 * Fact-check par Claude : client simulé, aucun appel réseau. Chiffres FICTIFS.
 * Prouve : coût (jetons + recherches) réservé puis soldé, plafond refusé = aucun appel,
 * erreur = réservation maximale gardée, « vérifiée » sans source réelle = non vérifiée.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));

import {
  FactCheckClaudeError,
  MAX_AFFIRMATIONS,
  PRIX_RECHERCHE_USD,
  fraisFixesMaxUsd,
  verifierAffirmationsAvecClaude,
  type ReponseMessages,
} from "../claude-search";

const URL_OK = "https://www.insee.fr/fr/statistiques/1";

function reponse(texte: string, extra: Partial<ReponseMessages> = {}): ReponseMessages {
  return {
    content: [
      {
        type: "web_search_tool_result",
        content: [{ type: "web_search_result", url: URL_OK, title: "INSEE" }],
      },
      { type: "text", text: texte },
    ],
    stop_reason: "end_turn",
    usage: {
      input_tokens: 10_000,
      output_tokens: 500,
      server_tool_use: { web_search_requests: 2 },
    },
    ...extra,
  };
}

function deps(appeler: ReturnType<typeof vi.fn>, refus?: Error) {
  const reserver = vi.fn(async () => {
    if (refus) throw refus;
    return {
      model: "claude-sonnet-5-5",
      reservation: { id: "L1", cumulJourUsd: 0, cumulMoisBlogUsd: 0 },
    };
  });
  const solder = vi.fn(async () => undefined);
  return { appeler, reserver, solder };
}
const args = { jobId: "j1", contentType: "blog_article", affirmations: ["Le taux est de 12 %."] };

describe("verifierAffirmationsAvecClaude", () => {
  it("réserve AVANT l'appel, avec les frais de recherche, puis solde au coût réel (jetons + recherches)", async () => {
    const appeler = vi.fn(async () =>
      reponse(`[{"id":1,"statut":"verifiee","sources":["${URL_OK}"],"note":"ok"}]`),
    );
    const d = deps(appeler);
    const r = await verifierAffirmationsAvecClaude(args, d);
    expect(d.reserver).toHaveBeenCalledTimes(1);
    const [req, role, , frais] = d.reserver.mock.calls[0] as unknown as [
      { contentType: string },
      string,
      Date,
      number,
    ];
    expect(role).toBe("court"); // claude-sonnet-5-5
    expect(req.contentType).toBe("blog_article");
    expect(frais).toBeGreaterThanOrEqual(8 * PRIX_RECHERCHE_USD);
    expect(frais).toBe(fraisFixesMaxUsd());
    // 10 000 × 2 $/M + 500 × 10 $/M + 2 recherches × 0,01 $
    const attendu = 10_000 * (2 / 1e6) + 500 * (10 / 1e6) + 2 * PRIX_RECHERCHE_USD;
    expect(r.coutUsd).toBeCloseTo(attendu, 10);
    expect(d.solder).toHaveBeenCalledWith("L1", expect.closeTo(attendu, 10), {
      input: 10_000,
      output: 500,
    });
    expect(r.verdicts[0]).toMatchObject({ statut: "verifiee", sources: [URL_OK] });
    expect(r.sources).toEqual([{ url: URL_OK, title: "INSEE" }]);
    // le corps de la requête porte bien l'outil serveur et le bon modèle
    const corps = (appeler.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(corps["model"]).toBe("claude-sonnet-5-5");
    expect(JSON.stringify(corps["tools"])).toContain("web_search");
    expect(corps).not.toHaveProperty("temperature");
  });

  it("plafond refusé : AUCUN appel à l'API, erreur fail-closed", async () => {
    const appeler = vi.fn();
    const d = deps(appeler, new Error("Plafond du jour du blog atteint"));
    await expect(verifierAffirmationsAvecClaude(args, d)).rejects.toMatchObject({
      code: "plafond_ou_config",
    });
    expect(appeler).not.toHaveBeenCalled();
    expect(d.solder).not.toHaveBeenCalled();
  });

  it("erreur d'appel : la réservation reste au MAXIMUM (pas de solde), erreur levée", async () => {
    const d = deps(vi.fn(async () => Promise.reject(new Error("HTTP 529"))));
    await expect(verifierAffirmationsAvecClaude(args, d)).rejects.toBeInstanceOf(
      FactCheckClaudeError,
    );
    expect(d.solder).not.toHaveBeenCalled();
  });

  it("clé absente : rien n'est parti, réservation soldée à zéro", async () => {
    const d = deps(
      vi.fn(async () => Promise.reject(new FactCheckClaudeError("Clé absente", "cle_absente"))),
    );
    await expect(verifierAffirmationsAvecClaude(args, d)).rejects.toMatchObject({
      code: "cle_absente",
    });
    expect(d.solder).toHaveBeenCalledWith("L1", 0, { input: 0, output: 0 });
  });

  it("usage absent : coût non établi → erreur, réservation maximale gardée", async () => {
    const d = deps(vi.fn(async () => ({ content: [], stop_reason: "end_turn" })));
    await expect(verifierAffirmationsAvecClaude(args, d)).rejects.toMatchObject({
      code: "reponse_invalide",
    });
    expect(d.solder).not.toHaveBeenCalled();
  });

  it("« verifiee » avec une URL que la recherche n'a PAS renvoyée = non vérifiée", async () => {
    const d = deps(
      vi.fn(async () =>
        reponse(`[{"id":1,"statut":"verifiee","sources":["https://inventee.example/x"]}]`),
      ),
    );
    const r = await verifierAffirmationsAvecClaude(args, d);
    expect(r.verdicts[0]!.statut).toBe("non-verifiee");
  });

  it("« verifiee » sans aucune source = non vérifiée ; JSON illisible = non vérifiée", async () => {
    const d1 = deps(vi.fn(async () => reponse(`[{"id":1,"statut":"verifiee","sources":[]}]`)));
    expect((await verifierAffirmationsAvecClaude(args, d1)).verdicts[0]!.statut).toBe(
      "non-verifiee",
    );
    const d2 = deps(vi.fn(async () => reponse("pas du json")));
    expect((await verifierAffirmationsAvecClaude(args, d2)).verdicts[0]!.statut).toBe(
      "non-verifiee",
    );
  });

  it("affirmation contredite = « refutee »", async () => {
    const d = deps(
      vi.fn(async () =>
        reponse(`[{"id":1,"statut":"refutee","sources":["${URL_OK}"],"note":"c'est 8 %"}]`),
      ),
    );
    const r = await verifierAffirmationsAvecClaude(args, d);
    expect(r.verdicts[0]).toMatchObject({ statut: "refutee", note: "c'est 8 %" });
  });

  it("réponse coupée (pause_turn / max_tokens) : erreur, mais le coût est bien soldé", async () => {
    for (const stop of ["pause_turn", "max_tokens"]) {
      const d = deps(vi.fn(async () => reponse("[]", { stop_reason: stop })));
      await expect(verifierAffirmationsAvecClaude(args, d)).rejects.toMatchObject({
        code: "reponse_invalide",
      });
      expect(d.solder).toHaveBeenCalledTimes(1);
    }
  });

  it("recherche indisponible (erreur d'outil, aucune source) : erreur", async () => {
    const d = deps(
      vi.fn(async () => ({
        content: [
          { type: "web_search_tool_result", content: { type: "web_search_tool_result_error" } },
          { type: "text", text: `[{"id":1,"statut":"verifiee","sources":["${URL_OK}"]}]` },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 10, server_tool_use: { web_search_requests: 1 } },
      })),
    );
    await expect(verifierAffirmationsAvecClaude(args, d)).rejects.toMatchObject({ code: "appel" });
  });

  it("au-delà de la limite, les affirmations restantes sont NON vérifiées", async () => {
    const affirmations = Array.from({ length: MAX_AFFIRMATIONS + 3 }, (_, i) => `Phrase ${i} 5 %.`);
    const d = deps(vi.fn(async () => reponse("[]")));
    const r = await verifierAffirmationsAvecClaude({ ...args, affirmations }, d);
    expect(r.verdicts).toHaveLength(MAX_AFFIRMATIONS + 3);
    expect(r.verdicts.every((v) => v.statut === "non-verifiee")).toBe(true);
  });

  it("aucune affirmation : aucun appel, aucun coût", async () => {
    const d = deps(vi.fn());
    const r = await verifierAffirmationsAvecClaude({ ...args, affirmations: [] }, d);
    expect(r.coutUsd).toBe(0);
    expect(d.reserver).not.toHaveBeenCalled();
    expect(d.appeler).not.toHaveBeenCalled();
  });
});
