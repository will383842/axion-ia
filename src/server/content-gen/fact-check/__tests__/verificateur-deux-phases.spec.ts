/**
 * Vérificateur en deux phases : réseau simulé, aucun appel réel. Chiffres FICTIFS.
 * Prouve : plafond de 6 recherches par article, extrait obligatoire, phrase non confirmée
 * marquée à retirer, interrupteur éteint = comportement d'avant.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));

import type { ReponseMessages } from "../../clients/claude-search";
import { equipeEditorialeActive } from "../equipe-editoriale-drapeau";
import { decisionFactCheckClaude } from "../fact-check-claude";
import {
  MAX_LECTURES_PAGE,
  PLAFOND_RECHERCHES_ARTICLE,
  constituerDossierPreuves,
  verifierTexteFinal,
  type DossierPreuves,
} from "../verificateur-deux-phases";

const URL_A = "https://www.insee.fr/fr/statistiques/1";
const URL_B = "https://www.service-public.fr/page/2";
const MAINTENANT = new Date("2026-11-26T10:00:00Z");

function reponse(
  texte: string,
  opts: { recherches?: number; lectures?: number; urls?: string[]; lues?: string[] } = {},
): ReponseMessages {
  return {
    content: [
      {
        type: "web_search_tool_result",
        content: (opts.urls ?? [URL_A]).map((url) => ({
          type: "web_search_result",
          url,
          title: "Source",
        })),
      },
      ...(opts.lues ?? []).map((url) => ({
        type: "web_fetch_tool_result",
        content: { type: "web_fetch_result", url, retrieved_at: "2026-11-26T10:00:00Z" },
      })),
      { type: "text", text: texte },
    ],
    stop_reason: "end_turn",
    usage: {
      input_tokens: 5000,
      output_tokens: 300,
      server_tool_use: {
        web_search_requests: opts.recherches ?? 1,
        web_fetch_requests: opts.lectures ?? 0,
      },
    },
  };
}

function deps(appeler: ReturnType<typeof vi.fn>) {
  const reserver = vi.fn(async () => ({
    model: "claude-sonnet-5-5",
    reservation: { id: "L1", cumulJourUsd: 0, cumulMoisBlogUsd: 0 },
  }));
  const solder = vi.fn(async () => undefined);
  return { appeler, reserver, solder };
}

const preuveJson = (extra: Record<string, unknown> = {}) =>
  JSON.stringify([
    {
      affirmation: "Le taux est de 12 %.",
      chiffre: "12 %",
      url: URL_A,
      titre: "INSEE",
      extrait: "Le taux observé est de 12 % en 2025 selon l'enquête.",
      ...extra,
    },
  ]);

function outils(appeler: ReturnType<typeof vi.fn>, appel = 0) {
  const corps = appeler.mock.calls[appel]![0] as { tools: Array<Record<string, unknown>> };
  return corps.tools;
}

describe("phase A — dossier de preuves", () => {
  it("rend des preuves complètes, dates posées par le code, expiration à 90 jours", async () => {
    const appeler = vi.fn(async () => reponse(preuveJson()));
    const d = deps(appeler);
    const dossier = await constituerDossierPreuves(
      { jobId: "j", contentType: "blog_article", sujet: "taux" },
      d,
      MAINTENANT,
    );
    expect(dossier.preuves).toHaveLength(1);
    const p = dossier.preuves[0]!;
    expect(p.url).toBe(URL_A);
    expect(p.consulteLe).toBe("2026-11-26T10:00:00.000Z");
    expect(p.expireLe).toBe("2027-02-24T10:00:00.000Z");
    expect(d.reserver).toHaveBeenCalledTimes(1);
    expect(d.solder).toHaveBeenCalledTimes(1);
    // dernière version des outils du SDK, recherche bornée sous le plafond d'article
    const t = outils(appeler);
    expect(t[0]).toMatchObject({ type: "web_search_20260318", name: "web_search" });
    expect(t[0]!["max_uses"] as number).toBeLessThan(PLAFOND_RECHERCHES_ARTICLE);
  });

  it("refuse une preuve sans extrait", async () => {
    const appeler = vi.fn(async () => reponse(preuveJson({ extrait: "" })));
    const dossier = await constituerDossierPreuves(
      { jobId: "j", contentType: "blog_article", sujet: "taux" },
      deps(appeler),
      MAINTENANT,
    );
    expect(dossier.preuves).toHaveLength(0);
    expect(dossier.refusees).toBe(1);
  });

  it("refuse une URL que la recherche n'a pas renvoyée, et un chiffre absent de l'extrait", async () => {
    const appeler = vi.fn(async () =>
      reponse(
        JSON.stringify([
          {
            affirmation: "a",
            chiffre: null,
            url: "https://inventee.example/x",
            titre: "t",
            extrait: "Un extrait assez long pour passer.",
          },
          {
            affirmation: "b",
            chiffre: "99 %",
            url: URL_A,
            titre: "t",
            extrait: "Un extrait assez long sans le chiffre.",
          },
        ]),
      ),
    );
    const dossier = await constituerDossierPreuves(
      { jobId: "j", contentType: "blog_article", sujet: "taux" },
      deps(appeler),
      MAINTENANT,
    );
    expect(dossier.preuves).toHaveLength(0);
    expect(dossier.refusees).toBe(2);
  });
});

const dossier: DossierPreuves = {
  preuves: [
    {
      affirmation: "Le taux est de 12 %.",
      chiffre: "12 %",
      url: URL_A,
      titreSource: "INSEE",
      extrait: "Le taux observé est de 12 % en 2025.",
      consulteLe: "2026-11-26T10:00:00.000Z",
      expireLe: "2027-02-24T10:00:00.000Z",
    },
  ],
  refusees: 0,
  recherches: 4,
  coutUsd: 0.1,
  sources: [{ url: URL_A, title: "INSEE" }],
};
const phrases = ["Le taux est de 12 %.", "Le marché pèse 40 milliards d'euros."];

describe("phase B — vérification finale", () => {
  it("confirme par le dossier, lit la page sinon, marque à retirer le reste", async () => {
    const appeler = vi.fn(async () =>
      reponse(
        JSON.stringify([
          { id: 1, statut: "confirmee", preuve: 1, url: null },
          { id: 2, statut: "a_retirer", preuve: null, url: null },
        ]),
        { recherches: 1 },
      ),
    );
    const r = await verifierTexteFinal(
      { jobId: "j", contentType: "blog_article", phrases, dossier },
      deps(appeler),
      MAINTENANT,
    );
    expect(r.phrases[0]).toMatchObject({ statut: "confirmee", via: "dossier", url: URL_A });
    expect(r.phrases[1]).toMatchObject({ statut: "a_retirer" });
    expect(r.aRetirer).toEqual([phrases[1]]);
  });

  it("affirmation non confirmée retirée : « confirmee » sans preuve ni page lue = à retirer", async () => {
    const appeler = vi.fn(async () =>
      reponse(
        JSON.stringify([
          { id: 1, statut: "confirmee", preuve: 7, url: null },
          { id: 2, statut: "confirmee", preuve: null, url: URL_B },
        ]),
      ),
    );
    const r = await verifierTexteFinal(
      { jobId: "j", contentType: "blog_article", phrases, dossier },
      deps(appeler),
      MAINTENANT,
    );
    expect(r.aRetirer).toEqual(phrases);
  });

  it("accepte une page réellement lue par l'outil de lecture", async () => {
    const appeler = vi.fn(async () =>
      reponse(JSON.stringify([{ id: 2, statut: "confirmee", preuve: null, url: URL_B }]), {
        lectures: 1,
        lues: [URL_B],
      }),
    );
    const r = await verifierTexteFinal(
      { jobId: "j", contentType: "blog_article", phrases, dossier },
      deps(appeler),
      MAINTENANT,
    );
    expect(r.phrases[1]).toMatchObject({ statut: "confirmee", via: "lecture", url: URL_B });
    expect(r.phrases[0]!.statut).toBe("a_retirer"); // id 1 absent de la réponse
    expect(outils(appeler).some((t) => t["type"] === "web_fetch_20260318")).toBe(true);
  });

  it("une preuve expirée ne confirme plus rien", async () => {
    const appeler = vi.fn(async () =>
      reponse(JSON.stringify([{ id: 1, statut: "confirmee", preuve: 1, url: null }])),
    );
    const r = await verifierTexteFinal(
      { jobId: "j", contentType: "blog_article", phrases: [phrases[0]!], dossier },
      deps(appeler),
      new Date("2027-03-01T00:00:00Z"),
    );
    expect(r.aRetirer).toEqual([phrases[0]]);
  });

  it("plafond : phases A + B ≤ 6 recherches ; épuisé, B n'envoie plus l'outil de recherche", async () => {
    const appeler = vi.fn(async () =>
      reponse(JSON.stringify([{ id: 1, statut: "a_retirer", preuve: null, url: null }])),
    );
    await verifierTexteFinal(
      { jobId: "j", contentType: "blog_article", phrases, dossier },
      deps(appeler),
      MAINTENANT,
    );
    const rech = outils(appeler).find((t) => t["type"] === "web_search_20260318");
    expect(rech!["max_uses"]).toBe(PLAFOND_RECHERCHES_ARTICLE - dossier.recherches);

    const appeler2 = vi.fn(async () => reponse("[]", { recherches: 0 }));
    await verifierTexteFinal(
      { jobId: "j", contentType: "blog_article", phrases, dossier: { ...dossier, recherches: 6 } },
      deps(appeler2),
      MAINTENANT,
    );
    const t2 = outils(appeler2);
    expect(t2.some((t) => t["name"] === "web_search")).toBe(false);
    expect(t2.find((t) => t["name"] === "web_fetch")!["max_uses"]).toBe(MAX_LECTURES_PAGE);
  });

  it("recherches réellement consommées au-delà du plafond : erreur (fail-closed)", async () => {
    const appeler = vi.fn(async () => reponse("[]", { recherches: 5 }));
    await expect(
      verifierTexteFinal(
        { jobId: "j", contentType: "blog_article", phrases, dossier },
        deps(appeler),
        MAINTENANT,
      ),
    ).rejects.toThrow(/plafond/i);
  });

  it("réserve le coût avant l'appel (même porte que le fact-check existant)", async () => {
    const ordre: string[] = [];
    const appeler = vi.fn(async () => {
      ordre.push("appel");
      return reponse("[]");
    });
    const d = deps(appeler);
    d.reserver.mockImplementation(async () => {
      ordre.push("reserver");
      return { model: "m", reservation: { id: "L1", cumulJourUsd: 0, cumulMoisBlogUsd: 0 } };
    });
    await verifierTexteFinal(
      { jobId: "j", contentType: "blog_article", phrases, dossier },
      d,
      MAINTENANT,
    );
    expect(ordre).toEqual(["reserver", "appel"]);
    expect(d.solder).toHaveBeenCalledTimes(1);
  });
});

describe("interrupteur CONTENT_EQUIPE_EDITORIALE", () => {
  it("éteint par défaut ; seule la valeur exacte « true » allume", () => {
    expect(equipeEditorialeActive({})).toBe(false);
    expect(equipeEditorialeActive({ CONTENT_EQUIPE_EDITORIALE: "1" })).toBe(false);
    expect(equipeEditorialeActive({ CONTENT_EQUIPE_EDITORIALE: "TRUE" })).toBe(false);
    expect(equipeEditorialeActive({ CONTENT_EQUIPE_EDITORIALE: "true" })).toBe(true);
  });

  it("éteint : decisionFactCheckClaude utilise l'ancien vérificateur, inchangé", async () => {
    const verifier = vi.fn(async () => ({
      verdicts: [{ affirmation: "x", statut: "verifiee" as const, sources: [URL_A], note: "" }],
      sources: [{ url: URL_A, title: "INSEE" }],
      recherches: 1,
      coutUsd: 0.01,
    }));
    const deuxPhases = vi.fn();
    const d = await decisionFactCheckClaude(
      { jobId: "j", contentType: "blog_article", texte: "Le taux est de 12 % en 2025." },
      verifier,
      { env: {}, verifierFinal: deuxPhases },
    );
    expect(verifier).toHaveBeenCalledTimes(1);
    expect(deuxPhases).not.toHaveBeenCalled();
    expect(d.barriere).toBeNull();
  });

  it("allumé : la vérification finale décide, une phrase à retirer ajoute la barrière", async () => {
    const verifier = vi.fn();
    const verifierFinal = vi.fn(async () => ({
      phrases: [
        {
          phrase: "Le taux est de 12 % en 2025.",
          statut: "a_retirer" as const,
          url: null,
          via: null,
          note: "",
        },
      ],
      aRetirer: ["Le taux est de 12 % en 2025."],
      recherches: 1,
      lectures: 0,
      coutUsd: 0.02,
      sources: [],
    }));
    const d = await decisionFactCheckClaude(
      { jobId: "j", contentType: "blog_article", texte: "Le taux est de 12 % en 2025." },
      verifier,
      { env: { CONTENT_EQUIPE_EDITORIALE: "true" }, dossier, verifierFinal },
    );
    expect(verifier).not.toHaveBeenCalled();
    expect(d.barriere?.code).toBe("fact-check-claude");
    expect(d.phrasesARetirer).toEqual(["Le taux est de 12 % en 2025."]);
  });
});
