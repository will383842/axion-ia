import { describe, it, expect, vi } from "vitest";
import {
  executerMiseAJour,
  htmlIdentique,
  decouperSections,
  type DemandeMiseAJour,
  type DependancesMiseAJour,
} from "./mise-a-jour";
import { PLAFOND_COUT_ARTICLE_USD } from "./redacteur-en-chef";

const ACTIF = { CONTENT_EQUIPE_EDITORIALE: "true" };
const URL = "https://axion-ia.com/fr/blog/automatiser-sa-facturation";
const HTML =
  "<p>Intro.</p><h2>Pourquoi ?</h2><p>Un chiffre faux de 87 %.</p><h2>Comment ?</h2><p>Texte sain.</p>";
const MAINTENANT = new Date("2026-11-27T10:00:00Z");

const demande = (o: Partial<DemandeMiseAJour> = {}): DemandeMiseAJour => ({
  article: {
    id: "a1",
    slug: "automatiser-sa-facturation",
    motCle: "automatiser sa facturation",
    html: HTML,
  },
  slugDemande: "automatiser-sa-facturation",
  brief: {
    motCle: "automatiser sa facturation",
    intention: "information",
    requetesSecondaires: [],
    champSemantique: [],
    entites: [],
    questions: [],
    urlCible: URL,
    cluster: "facturation",
    type: "mise-a-jour",
  },
  raisons: ["age-maximum"],
  ...o,
});

const deps = (o: Partial<DependancesMiseAJour> = {}): DependancesMiseAJour => ({
  env: ACTIF,
  maintenant: MAINTENANT,
  majAujourdhui: vi.fn().mockResolvedValue(0),
  consommerQuota: vi.fn().mockResolvedValue(undefined),
  gardien: vi.fn().mockResolvedValue({ decision: "feu_vert", raison: "ok" }),
  verifier: vi.fn().mockResolvedValue({ aRetirer: ["Un chiffre faux de 87 %."], coutUsd: 0.1 }),
  reecrire: vi.fn().mockResolvedValue({
    sections: ["<h2>Pourquoi ?</h2><p>Un constat sans chiffre.</p>"],
    coutUsd: 0.2,
  }),
  conformite: vi.fn().mockResolvedValue({ decision: "publier", constats: [] }),
  enChef: vi.fn().mockResolvedValue({ decision: { type: "publier" }, coutUsd: 0.1 }),
  enregistrer: vi.fn().mockResolvedValue(undefined),
  ...o,
});

describe("mise à jour de l'équipe éditoriale", () => {
  it("interrupteur éteint : rien n'est appelé, comportement d'avant", async () => {
    const d = deps({ env: {} });
    const r = await executerMiseAJour(demande(), d);
    expect(r.statut).toBe("desactive");
    expect(d.verifier).not.toHaveBeenCalled();
    expect(d.enregistrer).not.toHaveBeenCalled();
    expect(d.majAujourdhui).not.toHaveBeenCalled();
  });

  it("met à jour : seules les sections concernées sont réécrites, URL inchangée", async () => {
    const d = deps();
    const r = await executerMiseAJour(demande(), d);
    expect(r.statut).toBe("mis-a-jour");
    const ecrit = (d.enregistrer as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(ecrit.html).toBe(
      "<p>Intro.</p><h2>Pourquoi ?</h2><p>Un constat sans chiffre.</p><h2>Comment ?</h2><p>Texte sain.</p>",
    );
    expect(ecrit.dateModifiee).toEqual(MAINTENANT);
    expect(ecrit).not.toHaveProperty("slug");
    expect(r.slug).toBe("automatiser-sa-facturation");
    // la conformité porte sur le texte FINAL
    expect(d.conformite).toHaveBeenCalledWith(ecrit.html);
  });

  it("refuse un slug changé", async () => {
    const d = deps();
    const r = await executerMiseAJour(demande({ slugDemande: "autre-slug" }), d);
    expect(r.statut).toBe("refuse");
    expect(d.verifier).not.toHaveBeenCalled();
    expect(d.enregistrer).not.toHaveBeenCalled();
  });

  it("refuse un mot-clé principal changé", async () => {
    const d = deps();
    const base = demande();
    const r = await executerMiseAJour(
      demande({ brief: { ...base.brief, motCle: "logiciel de devis" } }),
      d,
    );
    expect(r.statut).toBe("refuse");
    expect(d.enregistrer).not.toHaveBeenCalled();
  });

  it("refuse si le gardien renvoie vers une autre URL", async () => {
    const d = deps({
      gardien: vi.fn().mockResolvedValue({
        decision: "mettre_a_jour",
        article: { url: "https://axion-ia.com/fr/blog/autre" },
        raison: "x",
      }),
    });
    expect((await executerMiseAJour(demande(), d)).statut).toBe("refuse");
    expect(d.enregistrer).not.toHaveBeenCalled();
  });

  it("date inchangée et rien écrit quand le contenu est identique (hors espaces)", async () => {
    const d = deps({
      reecrire: vi.fn().mockResolvedValue({
        sections: ["<h2>Pourquoi ?</h2>\n  <p>Un chiffre faux de 87 %.</p>"],
        coutUsd: 0.1,
      }),
    });
    const r = await executerMiseAJour(demande(), d);
    expect(r.statut).toBe("inchange");
    expect(d.enregistrer).not.toHaveBeenCalled();
  });

  it("rien à retirer : inchangé, aucune réécriture payée", async () => {
    const d = deps({ verifier: vi.fn().mockResolvedValue({ aRetirer: [], coutUsd: 0.1 }) });
    const r = await executerMiseAJour(demande(), d);
    expect(r.statut).toBe("inchange");
    expect(d.reecrire).not.toHaveBeenCalled();
    expect(d.enregistrer).not.toHaveBeenCalled();
  });

  it("quota du jour atteint (1 par défaut) : refus avant tout appel payant", async () => {
    const d = deps({ majAujourdhui: vi.fn().mockResolvedValue(1) });
    const r = await executerMiseAJour(demande(), d);
    expect(r.statut).toBe("quota");
    expect(d.verifier).not.toHaveBeenCalled();
    expect(d.consommerQuota).not.toHaveBeenCalled();
  });

  it("quota configuré à 2 : une deuxième mise à jour passe", async () => {
    const d = deps({
      majAujourdhui: vi.fn().mockResolvedValue(1),
      rythme: { articlesMaxJour: 3, majMaxJour: 2 },
    });
    expect((await executerMiseAJour(demande(), d)).statut).toBe("mis-a-jour");
    expect(d.consommerQuota).toHaveBeenCalledTimes(1);
  });

  it("conformité non conforme : relecture humaine, rien écrit", async () => {
    const d = deps({
      conformite: vi.fn().mockResolvedValue({
        decision: "relecture-humaine",
        constats: [{ code: "tutoiement", libelle: "x" }],
      }),
    });
    const r = await executerMiseAJour(demande(), d);
    expect(r.statut).toBe("relecture-humaine");
    expect(d.enChef).not.toHaveBeenCalled();
    expect(d.enregistrer).not.toHaveBeenCalled();
  });

  it("le rédacteur en chef tranche : pas « publier » = rien écrit", async () => {
    const d = deps({
      enChef: vi.fn().mockResolvedValue({
        decision: { type: "renvoi", renvois: [] },
        coutUsd: 0.1,
      }),
    });
    const r = await executerMiseAJour(demande(), d);
    expect(r.statut).toBe("relecture-humaine");
    expect(d.enregistrer).not.toHaveBeenCalled();
  });

  it("plafond de coût par article : arrêt avant la réécriture", async () => {
    const d = deps({
      verifier: vi.fn().mockResolvedValue({
        aRetirer: ["Un chiffre faux de 87 %."],
        coutUsd: PLAFOND_COUT_ARTICLE_USD,
      }),
    });
    const r = await executerMiseAJour(demande(), d);
    expect(r.statut).toBe("relecture-humaine");
    expect(d.reecrire).not.toHaveBeenCalled();
  });

  it("une section réécrite qui change de titre est refusée", async () => {
    const d = deps({
      reecrire: vi.fn().mockResolvedValue({
        sections: ["<h2>Autre titre</h2><p>Neuf.</p>"],
        coutUsd: 0.1,
      }),
    });
    expect((await executerMiseAJour(demande(), d)).statut).toBe("relecture-humaine");
    expect(d.enregistrer).not.toHaveBeenCalled();
  });

  it("une erreur du vérificateur ne publie rien", async () => {
    const d = deps({ verifier: vi.fn().mockRejectedValue(new Error("panne")) });
    expect((await executerMiseAJour(demande(), d)).statut).toBe("relecture-humaine");
    expect(d.enregistrer).not.toHaveBeenCalled();
  });
});

describe("garde-fous ajoutés après relecture", () => {
  it("phrase à retirer introuvable : relecture humaine, rien écrit", async () => {
    const d = deps({
      verifier: vi.fn().mockResolvedValue({ aRetirer: ["Phrase absente 12 %."], coutUsd: 0 }),
    });
    expect((await executerMiseAJour(demande(), d)).statut).toBe("relecture-humaine");
    expect(d.enregistrer).not.toHaveBeenCalled();
  });
  it("chiffre nouveau introduit par la réécriture : refusé", async () => {
    const d = deps({
      reecrire: vi.fn().mockResolvedValue({
        sections: ["<h2>Pourquoi ?</h2><p>Désormais 92 % des entreprises.</p>"],
        coutUsd: 0,
      }),
    });
    expect((await executerMiseAJour(demande(), d)).statut).toBe("relecture-humaine");
    expect(d.enregistrer).not.toHaveBeenCalled();
  });
  it("le coût de la conformité compte dans le plafond", async () => {
    const d = deps({
      conformite: vi.fn().mockResolvedValue({ decision: "publier", coutUsd: 5 }),
    });
    const r = await executerMiseAJour(demande(), d);
    expect(r.coutUsd).toBeGreaterThanOrEqual(5);
    expect(d.enChef).toHaveBeenCalledWith(expect.any(String), expect.any(Number));
    expect((d.enChef as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toBeGreaterThanOrEqual(5);
  });
});

describe("outils", () => {
  it("htmlIdentique ignore les espaces", () => {
    expect(htmlIdentique("<p>a  b</p>\n", "<p>a b</p>")).toBe(true);
    expect(htmlIdentique("<p>a</p>", "<p>b</p>")).toBe(false);
  });
  it("decouperSections garde l'introduction puis chaque h2", () => {
    const s = decouperSections(HTML);
    expect(s).toHaveLength(3);
    expect(s.join("")).toBe(HTML);
  });
});
