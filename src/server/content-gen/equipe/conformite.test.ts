/**
 * Étape de conformité de l'équipe éditoriale (PR 10) : fail-closed, rejouée sur le texte final.
 * Aucun appel réseau : le juge de fidélité est simulé.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));

import { faitsReferenceOffre } from "../fact-check/faits-offre";
import type { DependancesFideliteLlm } from "../fact-check/fidelite-llm";
import { conformiteApresReecriture, controlerConformite } from "./conformite";

const ON = { CONTENT_EQUIPE_EDITORIALE: "true" } as const;
const OFF = {} as const;
const CONFORME = JSON.stringify({ statut: "conforme", citations: [] });
const PROPRE = {
  title: "Mieux cadrer un projet IA",
  bodyHtml: "<p>Vous cadrez votre projet avec méthode.</p>",
};

function deps(sortie: string | Error = CONFORME) {
  const juger = vi.fn(async (_a: { userPrompt: string }) => {
    if (sortie instanceof Error) throw sortie;
    return { output: sortie, costUsd: 0.05 };
  });
  return {
    d: {
      rechercherFiches: vi.fn(async () => []),
      faitsOffre: vi.fn(() => faitsReferenceOffre()),
      juger,
    } satisfies DependancesFideliteLlm,
    juger,
  };
}
const base = { jobId: "j1", contentType: "blog_article" };
const codes = async (output: unknown) => {
  const { d } = deps();
  const r = await controlerConformite({ ...base, output, env: ON }, d);
  return { r, codes: r.constats.map((c) => c.code) };
};

describe("interrupteur éteint", () => {
  it("aucun contrôle, aucun appel : comportement d'avant", async () => {
    const { d, juger } = deps();
    const r = await controlerConformite(
      { ...base, output: { title: "Qualiopi 3 500 € tu tu tu" }, env: OFF },
      d,
    );
    expect(r).toMatchObject({ actif: false, decision: "inchange", constats: [] });
    expect(juger).not.toHaveBeenCalled();
    expect(d.rechercherFiches).not.toHaveBeenCalled();
  });
  it("seule la valeur exacte « true » allume", async () => {
    const { d } = deps();
    const r = await controlerConformite(
      { ...base, output: PROPRE, env: { CONTENT_EQUIPE_EDITORIALE: "TRUE" } },
      d,
    );
    expect(r.actif).toBe(false);
  });
});

describe("texte propre", () => {
  it("publier, et la fidélité est exécutée même si CONTENT_FIDELITY_CHECK est éteint", async () => {
    const { d, juger } = deps();
    const r = await controlerConformite({ ...base, output: PROPRE, env: ON }, d);
    expect(r).toMatchObject({ actif: true, decision: "publier", constats: [] });
    expect(juger).toHaveBeenCalledTimes(1);
  });
});

describe("chaque barrière refuse", () => {
  it("barrières de code (interdits de publication)", async () => {
    const { r, codes: c } = await codes({
      ...PROPRE,
      bodyHtml: "<p>Notre centre est certifié Qualiopi.</p>",
    });
    expect(r.decision).toBe("relecture-humaine");
    expect(c).toContain("interdit:qualiopi");
  });
  it("interdit dans un champ hors corps (titre)", async () => {
    const { codes: c } = await codes({ ...PROPRE, title: "Formation éligible CPF" });
    expect(c).toContain("interdit:cpf");
  });
  it("garde de prix", async () => {
    const { r, codes: c } = await codes({
      ...PROPRE,
      bodyHtml: "<p>Comptez 3 500 € pour démarrer.</p>",
    });
    expect(r.decision).toBe("relecture-humaine");
    expect(c).toContain("prix-hors-ssot");
  });
  it("vouvoiement", async () => {
    const { r, codes: c } = await codes({
      ...PROPRE,
      bodyHtml: "<p>Tu dois agir. Ton équipe et toi gagnerez du temps.</p>",
    });
    expect(r.decision).toBe("relecture-humaine");
    expect(c).toContain("tutoiement");
  });
  it("fidélité : contradiction", async () => {
    const { d } = deps(
      JSON.stringify({
        statut: "contradiction",
        citations: [{ extrait_article: "x", fiche_id: null, extrait_fiche: "y", explication: "z" }],
      }),
    );
    const r = await controlerConformite({ ...base, output: PROPRE, env: ON }, d);
    expect(r.decision).toBe("relecture-humaine");
    expect(r.constats.map((c) => c.code)).toContain("fidelite-llm");
  });
});

describe("échec fermé", () => {
  it("erreur du modèle → relecture humaine, jamais publier", async () => {
    const { d } = deps(new Error("API indisponible"));
    const r = await controlerConformite({ ...base, output: PROPRE, env: ON }, d);
    expect(r.decision).toBe("relecture-humaine");
    expect(r.constats.map((c) => c.code)).toContain("fidelite-llm");
  });
  it("dépassement de plafond → relecture humaine", async () => {
    const { d } = deps(new Error("plafond mensuel atteint"));
    const r = await controlerConformite({ ...base, output: PROPRE, env: ON }, d);
    expect(r.decision).toBe("relecture-humaine");
  });
  it("réponse du modèle inexploitable → relecture humaine", async () => {
    const { d } = deps("pas du json");
    const r = await controlerConformite({ ...base, output: PROPRE, env: ON }, d);
    expect(r.decision).toBe("relecture-humaine");
  });
  it("faits de l'offre illisibles → relecture humaine", async () => {
    const { d } = deps();
    const r = await controlerConformite(
      {
        ...base,
        output: PROPRE,
        env: ON,
      },
      {
        ...d,
        faitsOffre: () => {
          throw new Error("illisible");
        },
      },
    );
    expect(r.decision).toBe("relecture-humaine");
  });
  it("une barrière de code qui lève → relecture humaine", async () => {
    const { d } = deps();
    // `tags` n'est lu que par le contrôle de surface : seule la barrière de code lève.
    const bizarre = {
      ...PROPRE,
      get tags(): string[] {
        throw new Error("boom");
      },
    };
    const r = await controlerConformite({ ...base, output: bizarre, env: ON }, d);
    expect(r.decision).toBe("relecture-humaine");
    expect(r.constats.map((c) => c.code)).toContain("erreur-conformite");
    expect(d.juger).not.toHaveBeenCalled();
  });
});

describe("rejeu sur le texte final", () => {
  it("le juge et les barrières lisent le texte RÉÉCRIT, pas l'original", async () => {
    const { d, juger } = deps();
    const r = await conformiteApresReecriture(
      {
        ...base,
        output: { ...PROPRE, bodyHtml: "<p>Texte propre d'origine.</p>" },
        env: ON,
        reecrire: async (o) => ({
          ...(o as object),
          bodyHtml: "<p>Réécrit : certifié Qualiopi.</p>",
        }),
      },
      d,
    );
    expect(r.decision).toBe("relecture-humaine");
    expect(r.constats.map((c) => c.code)).toContain("interdit:qualiopi");
    expect(juger.mock.calls[0]![0].userPrompt).toContain("Réécrit");
    expect(juger.mock.calls[0]![0].userPrompt).not.toContain("d'origine");
  });
  it("réécriture qui échoue → relecture humaine", async () => {
    const { d } = deps();
    const r = await conformiteApresReecriture(
      {
        ...base,
        output: PROPRE,
        env: ON,
        reecrire: async () => {
          throw new Error("échec");
        },
      },
      d,
    );
    expect(r.decision).toBe("relecture-humaine");
  });
  it("sans réécriture : contrôle le texte tel quel", async () => {
    const { d } = deps();
    const r = await conformiteApresReecriture({ ...base, output: PROPRE, env: ON }, d);
    expect(r.decision).toBe("publier");
  });
  it("éteint : la réécriture n'est pas appelée", async () => {
    const { d } = deps();
    const reecrire = vi.fn();
    const r = await conformiteApresReecriture({ ...base, output: PROPRE, env: OFF, reecrire }, d);
    expect(r.decision).toBe("inchange");
    expect(reecrire).not.toHaveBeenCalled();
  });
});

describe("texte final : HTML, sorties vides, montants", () => {
  it("le HTML publié prime sur un bodyText périmé (juge et barrières)", async () => {
    const { d, juger } = deps();
    const r = await controlerConformite(
      {
        ...base,
        output: {
          title: "t",
          bodyText: "Texte propre périmé.",
          bodyHtml: "<p>Vu chez nos partenaires, certifié Qualiopi.</p>",
        },
        env: ON,
      },
      d,
    );
    expect(r.decision).toBe("relecture-humaine");
    expect(r.constats.map((c) => c.code)).toContain("interdit:qualiopi");
    expect(juger.mock.calls[0]![0].userPrompt).toContain("certifié Qualiopi");
    expect(juger.mock.calls[0]![0].userPrompt).not.toContain("périmé");
  });
  it("un ancien bodyText fautif reste refusé", async () => {
    const { codes: c } = await codes({
      title: "t",
      bodyText: "Qualiopi partout.",
      bodyHtml: "<p>Propre.</p>",
    });
    expect(c).toContain("interdit:qualiopi");
  });
  it.each([undefined, null, "texte", {}, [], { title: "  " }])(
    "sortie vide ou non objet (%j) → relecture humaine, juge non appelé",
    async (sortie) => {
      const { d, juger } = deps();
      const r = await controlerConformite({ ...base, output: sortie, env: ON }, d);
      expect(r.decision).toBe("relecture-humaine");
      expect(juger).not.toHaveBeenCalled();
    },
  );
  it("réécriture qui rend undefined → relecture humaine", async () => {
    const { d } = deps();
    const r = await conformiteApresReecriture(
      { ...base, output: PROPRE, env: ON, reecrire: async () => undefined },
      d,
    );
    expect(r.decision).toBe("relecture-humaine");
  });
  it("tout montant en euros hors source unique est refusé, même non tarifaire (choix prudent)", async () => {
    const { codes: c } = await codes({
      ...PROPRE,
      bodyHtml: "<p>Amende de 35 000 euros.</p>",
    });
    expect(c).toContain("prix-hors-ssot");
  });
});

describe("HTML brut et entités", () => {
  it.each([
    "<p>Comptez 3&nbsp;500&nbsp;€.</p>",
    "<p>Comptez 3 500 &euro;.</p>",
    "<p>Comptez 3&#8239;500&#8239;€.</p>",
  ])("montant écrit avec entités (%s) → refusé", async (bodyHtml) => {
    const { codes: c } = await codes({ ...PROPRE, bodyHtml });
    expect(c).toContain("prix-hors-ssot");
  });
  it("tutoiement cité dans du code ou une citation : pas de faux positif", async () => {
    const { r } = await codes({
      ...PROPRE,
      bodyHtml:
        "<p>Vous rédigez vos consignes.</p><code>tu es un expert, tu réponds</code><blockquote>Tu dois, tu peux</blockquote>",
    });
    expect(r.decision).toBe("publier");
  });
});
