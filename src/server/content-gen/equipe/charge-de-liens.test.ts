import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ChargeLiensError,
  MAX_OCCASIONS_PAR_ARTICLE,
  PLAFOND_COUT_ARTICLE_USD,
  changerEtatOccasion,
  proposerOccasions,
  type CandidatLien,
  type DependancesChargeLiens,
} from "./charge-de-liens";

const ON = { CONTENT_EQUIPE_EDITORIALE: "true" } as const;
const MAINTENANT = new Date("2026-11-27T10:00:00Z");
const ARTICLE = {
  jobId: "job1",
  articleUrl: "https://axion-ia.com/fr/blog/ia-pme",
  titre: "L'IA dans les PME",
  motsCles: ["ia", "pme"],
};

const cand = (i: number, extra: Partial<CandidatLien> = {}): CandidatLien => ({
  id: `c${i}`,
  type: "media-region",
  cible: `Média ${i}`,
  url: `https://media${i}.example.fr/`,
  ...extra,
});

function deps(
  candidats: CandidatLien[],
  over: Partial<DependancesChargeLiens> = {},
): DependancesChargeLiens & { generer: ReturnType<typeof vi.fn> } {
  const generer = vi.fn(async (req: { userPrompt: string }) => {
    const ids = [...req.userPrompt.matchAll(/"id":"(c\d+)"/g)].map((m) => m[1]);
    return {
      output: JSON.stringify({
        messages: ids.map((id) => ({
          id,
          message: `Bonjour, vous suivez l'actualité de l'IA en entreprise : notre article https://axion-ia.com/fr/blog/ia-pme pourrait intéresser vos lecteurs. Cordialement.`,
        })),
      }),
      costUsd: 0.05,
    };
  });
  return {
    candidats,
    generer: generer as never,
    coutDejaEngage: async () => 0,
    estOppose: async () => false,
    env: ON,
    maintenant: MAINTENANT,
    ...over,
  } as never;
}

describe("charge de liens", () => {
  it("interrupteur éteint : rien lu, aucun appel", async () => {
    const d = deps([cand(1)], { env: {} });
    const coutSpy = vi.fn(async () => 0);
    const r = await proposerOccasions(ARTICLE, { ...d, coutDejaEngage: coutSpy });
    expect(r).toEqual({ statut: "desactive" });
    expect(d.generer).not.toHaveBeenCalled();
    expect(coutSpy).not.toHaveBeenCalled();
  });

  it("au plus 5 occasions et un seul appel au modèle", async () => {
    const d = deps(Array.from({ length: 9 }, (_, i) => cand(i)));
    const r = await proposerOccasions(ARTICLE, d);
    expect(r.statut).toBe("occasions");
    if (r.statut !== "occasions") return;
    expect(r.occasions).toHaveLength(MAX_OCCASIONS_PAR_ARTICLE);
    expect(d.generer).toHaveBeenCalledTimes(1);
    expect(r.occasions.every((o) => o.etat === "proposee")).toBe(true);
    expect(r.coutUsd).toBeCloseTo(0.05);
  });

  it("aucune occasion inventée : adresses et cibles viennent des données", async () => {
    const d = deps([cand(1), cand(2)]);
    d.generer.mockResolvedValueOnce({
      output: JSON.stringify({
        messages: [
          {
            id: "c1",
            message: "Bonjour https://axion-ia.com/fr/blog/ia-pme",
            url: "https://faux.fr",
          },
          { id: "inconnu", message: "Bonjour" },
        ],
      }),
      costUsd: 0.01,
    });
    const r = await proposerOccasions(ARTICLE, d);
    if (r.statut !== "occasions") throw new Error("attendu : occasions");
    expect(r.occasions.map((o) => o.url).sort()).toEqual([
      "https://media1.example.fr/",
      "https://media2.example.fr/",
    ]);
    expect(JSON.stringify(r)).not.toContain("faux.fr");
    expect(r.occasions.map((o) => o.cible)).toEqual(["Média 1", "Média 2"]);
  });

  it("sans candidat : aucune occasion, aucun appel", async () => {
    const d = deps([]);
    const r = await proposerOccasions(ARTICLE, d);
    expect(r).toEqual({ statut: "aucune", coutUsd: 0 });
    expect(d.generer).not.toHaveBeenCalled();
  });

  it("ignore adresse non https, doublons et sujet sans rapport", async () => {
    const d = deps([
      cand(1, { url: "http://non-securise.fr" }),
      cand(2, { url: "javascript:alert(1)" }),
      cand(3),
      cand(4, { url: "https://media3.example.fr/" }),
      cand(5, { motsCles: ["jardinage"] }),
      cand(6, { motsCles: ["PME"] }),
    ]);
    const r = await proposerOccasions(ARTICLE, d);
    if (r.statut !== "occasions") throw new Error("attendu : occasions");
    expect(r.occasions.map((o) => o.id)).toEqual(["c3", "c6"]);
  });

  it("contact en opposition : jamais proposé (aucune suppression)", async () => {
    const estOppose = vi.fn(async (email: string) => email === "oppose@example.fr");
    const d = deps(
      [
        cand(1, { contactEmail: "oppose@example.fr" }),
        cand(2, { contactEmail: "ok@example.fr" }),
        cand(3),
      ],
      { estOppose },
    );
    const r = await proposerOccasions(ARTICLE, d);
    if (r.statut !== "occasions") throw new Error("attendu : occasions");
    expect(r.occasions.map((o) => o.id)).toEqual(["c2", "c3"]);
    expect(d.generer.mock.calls[0]![0].userPrompt).not.toContain("oppose@example.fr");
  });

  it("opposition illisible : on s'abstient de proposer ce contact", async () => {
    const d = deps([cand(1, { contactEmail: "a@example.fr" }), cand(2)], {
      estOppose: async () => {
        throw new Error("base indisponible");
      },
    });
    const r = await proposerOccasions(ARTICLE, d);
    if (r.statut !== "occasions") throw new Error("attendu : occasions");
    expect(r.occasions.map((o) => o.id)).toEqual(["c2"]);
  });

  it("plafond de coût : refus avant tout appel", async () => {
    const d = deps([cand(1)], { coutDejaEngage: async () => PLAFOND_COUT_ARTICLE_USD - 0.01 });
    const r = await proposerOccasions(ARTICLE, d);
    expect(r.statut).toBe("plafond");
    expect(d.generer).not.toHaveBeenCalled();
  });

  it("message refusé (prix, Grenoble, promesse, tutoiement, lien absent) : modèle écarté, texte sobre", async () => {
    const mauvais = [
      "Bonjour, notre offre à 990 € https://axion-ia.com/fr/blog/ia-pme",
      "Bonjour, de Grenoble https://axion-ia.com/fr/blog/ia-pme",
      "Bonjour, résultat garanti https://axion-ia.com/fr/blog/ia-pme",
      "Salut, tu peux regarder https://axion-ia.com/fr/blog/ia-pme",
      "Bonjour, sans lien",
    ];
    const d = deps(mauvais.map((_, i) => cand(i)));
    d.generer.mockResolvedValueOnce({
      output: JSON.stringify({ messages: mauvais.map((message, i) => ({ id: `c${i}`, message })) }),
      costUsd: 0.02,
    });
    const r = await proposerOccasions(ARTICLE, d);
    if (r.statut !== "occasions") throw new Error("attendu : occasions");
    for (const o of r.occasions) {
      expect(o.message).toContain(ARTICLE.articleUrl);
      expect(o.message).not.toMatch(/€|grenoble|garanti|\btu\b/i);
      expect(o.message).toMatch(/vous/i);
    }
    expect(d.generer).toHaveBeenCalledTimes(1);
  });

  it("message avec URL étrangère ou demande d'échange de liens : écarté", async () => {
    const mauvais = [
      "Bonjour https://axion-ia.com/fr/blog/ia-pme et https://autre.fr/x",
      "Bonjour, un échange de liens ? https://axion-ia.com/fr/blog/ia-pme",
    ];
    const d = deps(mauvais.map((_, i) => cand(i)));
    d.generer.mockResolvedValueOnce({
      output: JSON.stringify({ messages: mauvais.map((message, i) => ({ id: `c${i}`, message })) }),
      costUsd: 0.01,
    });
    const r = await proposerOccasions(ARTICLE, d);
    if (r.statut !== "occasions") throw new Error("attendu : occasions");
    for (const o of r.occasions) expect(o.message).not.toMatch(/autre\.fr|échange/);
  });

  it("texte sobre : un titre interdit n'entre pas dans le message", async () => {
    const d = deps([cand(1)]);
    d.generer.mockRejectedValueOnce(new Error("x"));
    const r = await proposerOccasions({ ...ARTICLE, titre: "Formation à Grenoble à 990 €" }, d);
    if (r.statut !== "occasions") throw new Error("attendu : occasions");
    expect(r.occasions[0]!.message).not.toMatch(/grenoble|€/i);
    expect(r.occasions[0]!.message).toContain(ARTICLE.articleUrl);
  });

  it("modèle en échec ou JSON illisible : textes sobres, pas de second appel, coût 0", async () => {
    const d = deps([cand(1)]);
    d.generer.mockRejectedValueOnce(new Error("réseau"));
    const r = await proposerOccasions(ARTICLE, d);
    if (r.statut !== "occasions") throw new Error("attendu : occasions");
    expect(r.occasions[0]!.message).toContain(ARTICLE.articleUrl);
    expect(r.coutUsd).toBe(0);
    expect(d.generer).toHaveBeenCalledTimes(1);
  });

  it("aucun envoi : ni le module, ni les données, ni l'action n'importent d'envoi d'e-mail", async () => {
    const { readFileSync } = await import("node:fs");
    const motif =
      /from\s+["'][^"']*(mailer|nodemailer|\/queue|verdict-envoi|zeptomail|server\/email\/)[^"']*["']/i;
    for (const f of [
      "src/server/content-gen/equipe/charge-de-liens.ts",
      "src/server/content-gen/equipe/charge-de-liens-donnees.ts",
      "src/server/actions/content-gen/charge-liens.ts",
    ]) {
      expect(readFileSync(resolve(process.cwd(), f), "utf8")).not.toMatch(motif);
    }
  });

  it("états : proposée → validée ou écartée, une seule fois", () => {
    const occ = [
      {
        id: "c1",
        type: "media-region" as const,
        cible: "M",
        url: "https://m.fr/",
        message: "x",
        etat: "proposee" as const,
        creeLe: "2026-11-27T10:00:00.000Z",
      },
    ];
    const v = changerEtatOccasion(occ, "c1", "validee", "u1", MAINTENANT);
    expect(v[0]).toMatchObject({ etat: "validee", decidePar: "u1" });
    expect(() => changerEtatOccasion(v, "c1", "ecartee", "u1", MAINTENANT)).toThrow(
      ChargeLiensError,
    );
    expect(() => changerEtatOccasion(occ, "zz", "validee", "u1", MAINTENANT)).toThrow(
      ChargeLiensError,
    );
    expect(occ[0]!.etat).toBe("proposee");
  });
});
