import { describe, expect, it, vi } from "vitest";

import { BlogClaudeRefusError } from "../../../providers/blog-claude-ledger";
import {
  analyserSources,
  estDomaineAxion,
  questionsDuJour,
  tachePanelGeo,
  urlsCitees,
} from "../panel";
import { LISTE_PROPOSEE, listeValidee, NB_QUESTIONS_ATTENDUES } from "../panel-questions";

describe("liste proposée (à valider par Will)", () => {
  it("instantané figé : 30 questions, version non validée", () => {
    expect(LISTE_PROPOSEE.questions).toHaveLength(NB_QUESTIONS_ATTENDUES);
    expect(LISTE_PROPOSEE.validee).toBe(false);
    expect(LISTE_PROPOSEE.questions.map((q) => q.texte)).toMatchSnapshot();
  });

  it("aucune « Grenoble », aucun nom de personne, ids uniques, longueur bornée", () => {
    const textes = LISTE_PROPOSEE.questions.map((q) => q.texte);
    expect(textes.some((t) => /grenoble/i.test(t))).toBe(false);
    // Un prénom ou nom propre au milieu d'une phrase : aucune majuscule hors début et sigles connus.
    const sigles = new Set(["IA", "AI", "Act", "RGPD", "PME", "TPE", "ChatGPT", "Google", "Quels"]);
    for (const t of textes) {
      const mots = t.split(/[\s']+/).slice(1);
      const propres = mots.filter((m) => /^[A-ZÉ]/.test(m)).map((m) => m.replace(/[^\p{L}]/gu, ""));
      expect(propres.filter((m) => m && !sigles.has(m))).toEqual([]);
      expect(t.length).toBeLessThanOrEqual(300);
    }
    expect(new Set(LISTE_PROPOSEE.questions.map((q) => q.id)).size).toBe(30);
  });

  it("jamais utilisée tant que non validée : listeValidee refuse tout sauf validee === true", () => {
    const base = { version: "v1", questions: LISTE_PROPOSEE.questions };
    expect(listeValidee(undefined)).toBeNull();
    expect(listeValidee({ ...base })).toBeNull();
    expect(listeValidee({ ...base, validee: "true" })).toBeNull();
    expect(listeValidee({ ...base, validee: true })).not.toBeNull();
    expect(
      listeValidee({
        ...base,
        validee: true,
        questions: [{ id: "Q1", texte: "Où est Grenoble ici ?" }],
      }),
    ).toBeNull();
    expect(
      listeValidee({
        version: "v1",
        validee: true,
        questions: [
          { id: "Q1", texte: "Une question valable ici" },
          { id: "Q1", texte: "Une autre question valable" },
        ],
      }),
    ).toBeNull();
  });
});

describe("reconnaissance d'axion-ia.com", () => {
  it("le domaine et ses sous-domaines, jamais un domaine qui le contient", () => {
    for (const h of ["axion-ia.com", "www.axion-ia.com", "blog.axion-ia.com", "AXION-IA.COM"])
      expect(estDomaineAxion(h)).toBe(true);
    for (const h of ["notaxion-ia.com", "axion-ia.com.evil.fr", "axion-ia.fr", "evil.fr"])
      expect(estDomaineAxion(h)).toBe(false);
  });

  it("présence, rang parmi les URL, domaines distincts, doublons et URL invalides écartés", () => {
    const a = analyserSources([
      "https://example.fr/a",
      "pas une url",
      "https://example.fr/a#x",
      "https://www.axion-ia.com/fr/blog",
      "https://axion-ia.com.evil.fr/x",
    ]);
    expect(a.presente).toBe(true);
    expect(a.rang).toBe(2);
    expect(a.domaines).toEqual(["example.fr", "axion-ia.com", "axion-ia.com.evil.fr"]);
    expect(analyserSources(["https://example.fr/"]).presente).toBe(false);
    expect(analyserSources([]).rang).toBeNull();
  });
});

describe("citation et troncature", () => {
  it("seules les URL citées par le texte comptent, pas les résultats de recherche", () => {
    const rep = {
      content: [
        { type: "web_search_tool_result", content: [{ url: "https://www.axion-ia.com/x" }] },
        { type: "text", citations: [{ url: "https://example.fr/a" }] },
      ],
    };
    expect(urlsCitees(rep)).toEqual(["https://example.fr/a"]);
    expect(analyserSources(urlsCitees(rep)).presente).toBe(false);
  });
  it("un rang au-delà de la liste enregistrée n'est pas retenu (aucune contradiction)", () => {
    const urls = Array.from({ length: 17 }, (_, i) => `https://s${i}.fr/p`);
    const a = analyserSources([...urls, "https://axion-ia.com/z"]);
    expect(a.urls).toHaveLength(15);
    expect(a.presente).toBe(false);
    expect(a.rang).toBeNull();
  });
});

describe("rotation : 3 questions par jour ouvré", () => {
  const qs = LISTE_PROPOSEE.questions;
  it("trois questions un jour ouvré, aucune le week-end, déterministe", () => {
    expect(questionsDuJour(qs, "2026-11-30")).toHaveLength(3);
    expect(questionsDuJour(qs, "2026-11-30")).toEqual(questionsDuJour(qs, "2026-11-30"));
    expect(questionsDuJour(qs, "2026-11-28")).toHaveLength(0);
    expect(questionsDuJour(qs, "2026-11-29")).toHaveLength(0);
  });
  it("la liste entière est couverte en 10 jours ouvrés", () => {
    const vus = new Set<string>();
    for (const j of [
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-07",
      "2026-12-08",
      "2026-12-09",
      "2026-12-10",
      "2026-12-11",
    ])
      questionsDuJour(qs, j).forEach((q) => vus.add(q.id));
    expect(vus.size).toBe(30);
  });
});

// ── Tâche : tout est injecté, aucun réseau ───────────────────────────────────

const LUNDI = () => new Date("2026-11-30T08:17:00Z");
const VALIDEE = { version: "v1", validee: true, questions: LISTE_PROPOSEE.questions };

function prismaFactice(opts: { actif?: boolean; questions?: unknown; existantes?: string[] } = {}) {
  const create = vi.fn(async () => ({}));
  return {
    create,
    prisma: {
      contentGenConfig: {
        findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
          if (where.key === "geo_panel")
            return opts.actif === false ? null : { value: { actif: true } };
          return opts.questions === undefined ? { value: VALIDEE } : { value: opts.questions };
        }),
      },
      geoPanelReponse: {
        findMany: vi.fn(async () => (opts.existantes ?? []).map((questionId) => ({ questionId }))),
        create,
      },
    } as never,
  };
}

const REPONSE = {
  content: [
    {
      type: "web_search_tool_result",
      content: [
        { url: "https://example.fr/a", title: "A" },
        { url: "https://www.axion-ia.com/fr", title: "B" },
      ],
    },
    {
      type: "text",
      text: "TEXTE INTEGRAL A NE JAMAIS STOCKER",
      citations: [{ url: "https://example.fr/a" }, { url: "https://www.axion-ia.com/fr" }],
    },
  ],
  usage: { input_tokens: 1000, output_tokens: 200, server_tool_use: { web_search_requests: 1 } },
};

function deps(over: Record<string, unknown> = {}) {
  return {
    appeler: vi.fn(async () => REPONSE as never),
    reserver: vi.fn(async () => ({ model: "m", reservation: { id: "r1" } }) as never),
    solder: vi.fn(async () => undefined as never),
    creerPorteur: vi.fn(async () => ({ jobId: "j1", contentType: "blog_article" })),
    maintenant: LUNDI,
    blogClaudeActif: () => true,
    ...over,
  };
}

describe("tâche panel-geo", () => {
  it("éteint (réglage absent) : aucun appel, aucune réservation, aucune écriture", async () => {
    const { prisma, create } = prismaFactice({ actif: false });
    const d = deps();
    expect(await tachePanelGeo({ prisma, ...d })).toMatchObject({
      issue: "saute",
      motif: "panel_eteint",
    });
    expect(d.appeler).not.toHaveBeenCalled();
    expect(d.reserver).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("liste non validée : saute sans rien appeler", async () => {
    const { prisma } = prismaFactice({ questions: { ...VALIDEE, validee: false } });
    const d = deps();
    expect(await tachePanelGeo({ prisma, ...d })).toMatchObject({ motif: "liste_non_validee" });
    expect(d.appeler).not.toHaveBeenCalled();
  });

  it("réservation AVANT chaque appel ; solde au coût réel ; texte jamais stocké", async () => {
    const { prisma, create } = prismaFactice();
    const ordre: string[] = [];
    const d = deps({
      reserver: vi.fn(
        async () => (ordre.push("reserver"), { model: "m", reservation: { id: "r1" } }) as never,
      ),
      appeler: vi.fn(async () => (ordre.push("appeler"), REPONSE) as never),
    });
    const r = await tachePanelGeo({ prisma, ...d });
    expect(r).toMatchObject({ issue: "fait", posees: 3, arret: null });
    expect(ordre).toEqual(["reserver", "appeler", "reserver", "appeler", "reserver", "appeler"]);
    expect(d.solder).toHaveBeenCalledTimes(3);
    const corps = (d.appeler.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(corps).toMatchObject({
      model: "claude-sonnet-5-5",
      max_tokens: 1000,
      tools: [{ name: "web_search", max_uses: 2, user_location: { country: "FR" } }],
    });
    const ecrit = (create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(ecrit).toMatchObject({ presente: true, rang: 2, version: "v1" });
    expect(JSON.stringify(create.mock.calls)).not.toContain("TEXTE INTEGRAL");
  });

  it("plafond atteint : passe sautée (fail-closed), aucun appel, aucune écriture", async () => {
    const { prisma, create } = prismaFactice();
    const d = deps({
      reserver: vi.fn(async () => {
        throw new BlogClaudeRefusError("plafond", "plafond_jour");
      }),
    });
    const r = await tachePanelGeo({ prisma, ...d });
    expect(r).toMatchObject({ issue: "fait", posees: 0, arret: "porte_de_cout:plafond_jour" });
    expect(d.appeler).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(d.reserver).toHaveBeenCalledTimes(1);
  });

  it("Claude éteint ou porteur refusé : saute ; questions déjà posées aujourd'hui : non reposées", async () => {
    const a = prismaFactice();
    const d1 = deps({ blogClaudeActif: () => false });
    expect(await tachePanelGeo({ prisma: a.prisma, ...d1 })).toMatchObject({
      motif: "claude_eteint",
    });
    expect(d1.creerPorteur).not.toHaveBeenCalled();

    const dejaFaites = questionsDuJour(LISTE_PROPOSEE.questions, "2026-11-30").map((q) => q.id);
    const b = prismaFactice({ existantes: dejaFaites });
    const d2 = deps();
    expect(await tachePanelGeo({ prisma: b.prisma, ...d2 })).toMatchObject({
      posees: 0,
      dejaFaites: 3,
    });
    expect(d2.appeler).not.toHaveBeenCalled();
  });

  it("week-end : saute", async () => {
    const { prisma } = prismaFactice();
    const d = deps({ maintenant: () => new Date("2026-11-28T08:17:00Z") });
    expect(await tachePanelGeo({ prisma, ...d })).toMatchObject({ motif: "jour_non_ouvre" });
  });
});
