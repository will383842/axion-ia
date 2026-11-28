import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./roles/strateg-brief", () => ({ strategeBrief: vi.fn() }));
vi.mock("./roles/collecteur-faits", () => ({ collecterFaits: vi.fn() }));
vi.mock("./roles/redacteur", () => ({ redigerArticle: vi.fn(), reecrireSections: vi.fn() }));
vi.mock("./roles/expert-critique", () => ({ critiquerArticle: vi.fn() }));
vi.mock("./roles/verificateur-faits", () => ({ verifierFaits: vi.fn() }));
vi.mock("./roles/editeur-forme", () => ({ editerForme: vi.fn() }));

import {
  lancerContenu,
  metaDescriptionDepuis,
  type Besoin,
  type PortsChaine,
} from "./orchestrateur";
import { PlafondAtteintError } from "./roles/commun";
import { strategeBrief } from "./roles/strateg-brief";
import { collecterFaits } from "./roles/collecteur-faits";
import { redigerArticle, reecrireSections } from "./roles/redacteur";
import { critiquerArticle } from "./roles/expert-critique";
import { verifierFaits } from "./roles/verificateur-faits";
import { editerForme } from "./roles/editeur-forme";
import type { ResultatAppelPorte, ResultatCritere, SortiePorte } from "./contrat-porte";
import { CRITERES_BLOQUANTS } from "./codes-refus";

const article = {
  directAnswer: "Réponse.",
  bodyHtml: "<h2>A</h2><p>x</p>",
  faq: [],
  h1DansSortieBrute: false,
};
const structure = {
  h1: "Titre",
  lecteur: { profil: "pme", metier: "services" },
  faitsACollecter: ["q"],
  planHn: [{ type: "reponse" }],
  gabaritCible: "guide",
};
const besoin = { contenuId: "c1", sujetSensible: false, strateg: {} } as unknown as Besoin;

function sortie(
  verdict: SortiePorte["verdict"],
  note: number,
  echecs: ResultatCritere[] = [],
): SortiePorte {
  const ids = new Set(echecs.map((e) => e.id));
  const criteres: ResultatCritere[] = [
    ...echecs,
    ...CRITERES_BLOQUANTS.filter((b) => !ids.has(b)).map(
      (id) => ({ id, etat: "ok", preuve: "", raison: "" }) as ResultatCritere,
    ),
  ];
  return { versionPorte: "v1", verdict, note, criteres };
}
const porteOk: ResultatAppelPorte = { etat: "ok", sortie: sortie("publiable", 90) };

function ports(porte: PortsChaine["appelerPorte"]) {
  const journal: string[] = [];
  const refus: Array<{ role: string; code: string }> = [];
  const deposes: unknown[] = [];
  const p: PortsChaine = {
    appel: vi.fn(),
    maintenant: () => new Date("2026-11-28T10:00:00Z"),
    urlSite: "https://axion-ia.com",
    urlCouvrante: () => null,
    pageProprietaire: () => null,
    testerLien: vi.fn(),
    appelerPorte: porte,
    enregistrerRefus: async (l) => void refus.push({ role: l.role, code: l.code }),
    journaliser: async (e) => void journal.push(e.etat),
    deposerEnRelecture: async (c) => void deposes.push(c),
  };
  return { p, journal, refus, deposes };
}

function cheminNominal() {
  vi.mocked(strategeBrief).mockResolvedValue({
    verdict: "brief_pret",
    brief: { motCle: "kw", intention: "information" },
    structure,
    relectureHumaineObligatoire: false,
  } as never);
  vi.mocked(collecterFaits).mockResolvedValue({
    verdict: "dossier_complet",
    faits: [],
    ecartes: [],
    raison: null,
  } as never);
  vi.mocked(redigerArticle).mockResolvedValue({
    verdict: "redige",
    article,
    problemes: [],
  } as never);
  vi.mocked(critiquerArticle).mockResolvedValue({
    verdict: "ok",
    notes: {},
    corrections: [],
    codeRefus: null,
  } as never);
  vi.mocked(verifierFaits).mockResolvedValue({
    verdict: "verifie",
    tableau: [],
    corrections: [],
    liensMorts: [],
    codeRefus: null,
  } as never);
  vi.mocked(editerForme).mockResolvedValue({
    verdict: "inchange",
    article,
    motifRejet: null,
    renvoiR4: [],
    problemesResiduels: [],
    avertissements: [],
  } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CONTENT_CHAINE_EDITORIALE", "true");
  for (const r of ["STRATEG", "COLLECTEUR", "REDACTEUR", "EXPERT", "VERIFICATEUR", "EDITEUR"]) {
    vi.stubEnv(`CONTENT_CHAINE_ROLE_${r}`, "true");
  }
  cheminNominal();
});
afterEach(() => vi.unstubAllEnvs());

describe("lancerContenu : interrupteur", () => {
  it("chaîne éteinte : lève avant tout appel", async () => {
    vi.stubEnv("CONTENT_CHAINE_EDITORIALE", "");
    const { p } = ports(async () => porteOk);
    await expect(lancerContenu(besoin, p)).rejects.toThrow(/éteinte/);
    expect(strategeBrief).not.toHaveBeenCalled();
  });
});

describe("lancerContenu : chemin nominal", () => {
  it("passe par tous les états et dépose en relecture humaine, jamais en publication", async () => {
    const { p, journal, deposes } = ports(async () => porteOk);
    const r = await lancerContenu(besoin, p);
    expect(r.issue).toBe("a_relire");
    expect(journal).toEqual([
      "brief",
      "faits",
      "redige",
      "critique",
      "verifie",
      "edite",
      "porte",
      "a_relire",
    ]);
    expect(deposes).toHaveLength(1);
  });
});

describe("lancerContenu : abandons", () => {
  it("pas de matière : abandon classé, refus enregistré, rien d'autre n'est appelé", async () => {
    vi.mocked(strategeBrief).mockResolvedValue({
      verdict: "pas_de_matiere",
      raison: "r",
      codeRefus: "pas_de_matiere",
    } as never);
    const { p, refus, deposes } = ports(async () => porteOk);
    const r = await lancerContenu(besoin, p);
    expect(r).toMatchObject({ issue: "abandonne", code: "pas_de_matiere", etatAtteint: "brief" });
    expect(refus).toEqual([{ role: "strateg", code: "pas_de_matiere" }]);
    expect(collecterFaits).not.toHaveBeenCalled();
    expect(deposes).toHaveLength(0);
  });

  it("dossier insuffisant : abandon", async () => {
    vi.mocked(collecterFaits).mockResolvedValue({
      verdict: "dossier_insuffisant",
      faits: [],
      ecartes: [],
      raison: "peu",
    } as never);
    const { p } = ports(async () => porteOk);
    expect(await lancerContenu(besoin, p)).toMatchObject({
      issue: "abandonne",
      code: "dossier_insuffisant",
    });
    expect(redigerArticle).not.toHaveBeenCalled();
  });

  it("plafond de coût levé par un rôle : abandon plafond_atteint", async () => {
    vi.mocked(redigerArticle).mockRejectedValue(new PlafondAtteintError("3 $", "redacteur"));
    const { p, refus } = ports(async () => porteOk);
    expect(await lancerContenu(besoin, p)).toMatchObject({
      issue: "abandonne",
      code: "plafond_atteint",
    });
    expect(refus[0]).toEqual({ role: "redacteur", code: "plafond_atteint" });
  });

  it("erreur inattendue d'un rôle : abandon « autre », jamais de publication", async () => {
    vi.mocked(critiquerArticle).mockRejectedValue(new Error("réseau"));
    const { p, deposes } = ports(async () => porteOk);
    expect(await lancerContenu(besoin, p)).toMatchObject({ issue: "abandonne", code: "autre" });
    expect(deposes).toHaveLength(0);
  });

  it("correction globale de l'expert : abandon immédiat sans réécriture", async () => {
    vi.mocked(critiquerArticle).mockResolvedValue({
      verdict: "reecrire",
      notes: {},
      codeRefus: null,
      corrections: [{ section: "global", probleme: "ordre", attendu: "x" }],
    } as never);
    const { p } = ports(async () => porteOk);
    expect(await lancerContenu(besoin, p)).toMatchObject({ issue: "abandonne", code: "autre" });
    expect(reecrireSections).not.toHaveBeenCalled();
  });

  it("l'expert demande toujours une réécriture : 2 réécritures puis abandon plafond_atteint", async () => {
    vi.mocked(critiquerArticle).mockResolvedValue({
      verdict: "reecrire",
      notes: {},
      codeRefus: null,
      corrections: [{ section: 0, probleme: "p", attendu: "a" }],
    } as never);
    vi.mocked(reecrireSections).mockResolvedValue({
      verdict: "redige",
      article,
      problemes: [],
    } as never);
    const { p } = ports(async () => porteOk);
    expect(await lancerContenu(besoin, p)).toMatchObject({
      issue: "abandonne",
      code: "plafond_atteint",
    });
    expect(reecrireSections).toHaveBeenCalledTimes(2);
  });

  it("l'expert abandonne : son code de refus est repris", async () => {
    vi.mocked(critiquerArticle).mockResolvedValue({
      verdict: "abandonner",
      notes: {},
      corrections: [],
      codeRefus: "generique",
    } as never);
    const { p } = ports(async () => porteOk);
    expect(await lancerContenu(besoin, p)).toMatchObject({ issue: "abandonne", code: "generique" });
  });
});

describe("lancerContenu : porte fail-closed", () => {
  it("porte en erreur : le contenu attend, rien en relecture", async () => {
    const { p, deposes } = ports(async () => ({ etat: "erreur", message: "panne" }));
    expect(await lancerContenu(besoin, p)).toMatchObject({ issue: "en_attente" });
    expect(deposes).toHaveLength(0);
  });

  it("porte qui lève : le contenu attend", async () => {
    const { p, deposes } = ports(async () => {
      throw new Error("boom");
    });
    expect(await lancerContenu(besoin, p)).toMatchObject({ issue: "en_attente" });
    expect(deposes).toHaveLength(0);
  });

  it("critère bloquant absent de la sortie : jamais en relecture", async () => {
    const { p, deposes } = ports(async () => ({
      etat: "ok",
      sortie: { versionPorte: "v1", verdict: "publiable", note: 95, criteres: [] },
    }));
    const r = await lancerContenu(besoin, p);
    expect(r.issue).toBe("en_attente");
    expect(deposes).toHaveLength(0);
  });

  it("verdict bloque sur un échec dur : abandon avec le code du critère, refus enregistré par la porte", async () => {
    const dur: ResultatCritere = {
      id: "B01",
      etat: "echec",
      preuve: "p",
      raison: "r",
      section: "0",
    };
    const { p, refus } = ports(async () => ({ etat: "ok", sortie: sortie("bloque", 60, [dur]) }));
    const r = await lancerContenu(besoin, p);
    expect(r).toMatchObject({ issue: "abandonne" });
    expect(refus.some((x) => x.role === "porte" && x.code === "doctrine")).toBe(true);
  });

  it("échec corrigeable : une réécriture ciblée, puis relecture avec le compteur à 1", async () => {
    const corr: ResultatCritere = {
      id: "B08",
      etat: "echec",
      preuve: "p",
      raison: "r",
      section: "1",
    };
    const compteurs: number[] = [];
    const porte = vi.fn(async (e: { reecrituresFaites: number }): Promise<ResultatAppelPorte> => {
      compteurs.push(e.reecrituresFaites);
      return e.reecrituresFaites === 0
        ? { etat: "ok", sortie: sortie("a_corriger", 78, [corr]) }
        : porteOk;
    });
    vi.mocked(reecrireSections).mockResolvedValue({
      verdict: "redige",
      article,
      problemes: [],
    } as never);
    const { p } = ports(porte as PortsChaine["appelerPorte"]);
    const r = await lancerContenu(besoin, p);
    expect(r.issue).toBe("a_relire");
    expect(compteurs).toEqual([0, 1]);
    expect(vi.mocked(reecrireSections).mock.calls[0]![2]).toEqual([
      expect.objectContaining({ section: 1 }),
    ]);
  });

  it("B17 seul (plafond du jour) : reporté, ni réécriture ni abandon", async () => {
    const b17: ResultatCritere = { id: "B17", etat: "echec", preuve: "p", raison: "r" };
    const { p } = ports(async () => ({ etat: "ok", sortie: sortie("a_corriger", 88, [b17]) }));
    expect(await lancerContenu(besoin, p)).toMatchObject({ issue: "reporte" });
    expect(reecrireSections).not.toHaveBeenCalled();
  });

  it("dérogeable seul (B06) : à trancher par un humain", async () => {
    const b06: ResultatCritere = {
      id: "B06",
      etat: "echec",
      preuve: "p",
      raison: "r",
      section: "0",
    };
    const { p } = ports(async () => ({ etat: "ok", sortie: sortie("a_corriger", 80, [b06]) }));
    expect(await lancerContenu(besoin, p)).toMatchObject({
      issue: "a_trancher",
      criteres: ["B06"],
    });
  });
});

describe("lancerContenu : défauts relevés en relecture", () => {
  it("panne du journal après le dépôt : remonte, jamais d'abandon enregistré", async () => {
    const { p, refus } = ports(async () => porteOk);
    const q: PortsChaine = {
      ...p,
      journaliser: async (e) => {
        if (e.etat === "a_relire") throw new Error("journal en panne");
      },
    };
    await expect(lancerContenu(besoin, q)).rejects.toThrow(
      /Panne d.un port d.écriture.*journal en panne/,
    );
    expect(refus).toHaveLength(0);
  });

  it("abandon décidé par la porte : une seule ligne de refus par cause", async () => {
    const dur: ResultatCritere = {
      id: "B01",
      etat: "echec",
      preuve: "p",
      raison: "r",
      section: "0",
    };
    const { p, refus } = ports(async () => ({ etat: "ok", sortie: sortie("bloque", 60, [dur]) }));
    await lancerContenu(besoin, p);
    expect(refus.filter((x) => x.code === "doctrine")).toHaveLength(1);
  });

  it("section « intro » de la porte : réécrite comme réponse directe", async () => {
    const corr: ResultatCritere = {
      id: "B08",
      etat: "echec",
      preuve: "p",
      raison: "r",
      section: "intro",
    };
    vi.mocked(reecrireSections).mockResolvedValue({
      verdict: "redige",
      article,
      problemes: [],
    } as never);
    const porte = async (e: { reecrituresFaites: number }): Promise<ResultatAppelPorte> =>
      e.reecrituresFaites === 0
        ? { etat: "ok", sortie: sortie("a_corriger", 78, [corr]) }
        : porteOk;
    const { p } = ports(porte as PortsChaine["appelerPorte"]);
    expect((await lancerContenu(besoin, p)).issue).toBe("a_relire");
    expect(vi.mocked(reecrireSections).mock.calls[0]![2]).toEqual([
      expect.objectContaining({ section: "directAnswer" }),
    ]);
  });

  it("section inconnue de la porte : abandon avec le code du critère, pas « autre »", async () => {
    const corr: ResultatCritere = {
      id: "B08",
      etat: "echec",
      preuve: "p",
      raison: "r",
      section: "pied de page",
    };
    const { p } = ports(async () => ({ etat: "ok", sortie: sortie("a_corriger", 78, [corr]) }));
    expect(await lancerContenu(besoin, p)).toMatchObject({
      issue: "abandonne",
      code: "reponse_directe_absente",
    });
  });

  it("chaîne éteinte en cours de route : reporté, plus aucun appel payant", async () => {
    vi.mocked(strategeBrief).mockImplementation((async () => {
      vi.stubEnv("CONTENT_CHAINE_EDITORIALE", "");
      return {
        verdict: "brief_pret",
        brief: { motCle: "kw", intention: "information" },
        structure,
        relectureHumaineObligatoire: false,
      };
    }) as never);
    const { p, refus } = ports(async () => porteOk);
    expect(await lancerContenu(besoin, p)).toMatchObject({ issue: "reporte" });
    expect(collecterFaits).not.toHaveBeenCalled();
    expect(refus).toHaveLength(0);
  });

  it("interrupteur d'un rôle éteint : reporté avant son appel", async () => {
    vi.stubEnv("CONTENT_CHAINE_ROLE_EXPERT", "");
    const { p } = ports(async () => porteOk);
    expect(await lancerContenu(besoin, p)).toMatchObject({ issue: "reporte" });
    expect(critiquerArticle).not.toHaveBeenCalled();
  });

  it("le coût de la porte compte dans le plafond de 3 $ : abandon plutôt que relecture", async () => {
    const dur: ResultatCritere = {
      id: "B08",
      etat: "echec",
      preuve: "p",
      raison: "r",
      section: "1",
    };
    vi.mocked(reecrireSections).mockResolvedValue({
      verdict: "redige",
      article,
      problemes: [],
    } as never);
    const { p } = ports(async () => ({
      etat: "ok",
      sortie: sortie("a_corriger", 78, [dur]),
      coutUsd: 3.5,
    }));
    expect(await lancerContenu(besoin, p)).toMatchObject({
      issue: "abandonne",
      code: "plafond_atteint",
    });
  });

  it("coût de la porte vu par les rôles suivants : pas de réécriture au-delà de 3 $", async () => {
    const corr: ResultatCritere = {
      id: "B08",
      etat: "echec",
      preuve: "p",
      raison: "r",
      section: "1",
    };
    vi.mocked(reecrireSections).mockResolvedValue({
      verdict: "redige",
      article,
      problemes: [],
    } as never);
    const { p } = ports(async () => ({
      etat: "ok",
      sortie: sortie("a_corriger", 78, [corr]),
      coutUsd: 2.9,
    }));
    // Le plafond est atteint avant la 2e porte : abandon, pas de second appel à la porte.
    const porte = vi.fn(p.appelerPorte);
    const r = await lancerContenu(besoin, { ...p, appelerPorte: porte });
    expect(r).toMatchObject({ issue: "abandonne", code: "plafond_atteint" });
    expect(porte).toHaveBeenCalledTimes(1);
  });

  it("extinction après le verdict : l'issue réelle (à trancher) est conservée", async () => {
    const b06: ResultatCritere = {
      id: "B06",
      etat: "echec",
      preuve: "p",
      raison: "r",
      section: "0",
    };
    const { p } = ports(async () => {
      vi.stubEnv("CONTENT_CHAINE_EDITORIALE", "");
      return { etat: "ok", sortie: sortie("a_corriger", 80, [b06]) };
    });
    expect(await lancerContenu(besoin, p)).toMatchObject({ issue: "a_trancher" });
  });

  it("l'abandon pour plafond de réécritures est imputé au rôle demandeur (expert)", async () => {
    vi.mocked(critiquerArticle).mockResolvedValue({
      verdict: "reecrire",
      notes: {},
      codeRefus: null,
      corrections: [{ section: 0, probleme: "p", attendu: "a" }],
    } as never);
    vi.mocked(reecrireSections).mockResolvedValue({
      verdict: "redige",
      article,
      problemes: [],
    } as never);
    const { p, refus } = ports(async () => porteOk);
    await lancerContenu(besoin, p);
    expect(refus).toEqual([{ role: "expert", code: "plafond_atteint" }]);
  });
});

describe("metaDescriptionDepuis", () => {
  it("coupe à 155 caractères sur un mot entier", () => {
    const m = metaDescriptionDepuis("mot ".repeat(80));
    expect(m.length).toBeLessThanOrEqual(155);
    expect(m.endsWith("mot")).toBe(true);
  });
});
