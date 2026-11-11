/**
 * Pack « Journée IA » du 10/11/2026 — garde d'import dans la base de connaissance.
 * Tests écrits avant le module : contrat de tri, de doctrine et d'idempotence.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyserPack,
  controlerFiche,
  evaluerGardeCommit,
  importerBrouillons,
  lignesDepuisJsonl,
  versEntreeKnowledge,
  type ClientImport,
  type LignePack,
} from "./pack-journee-ia";

const CHEMIN = join(process.cwd(), "docs/knowledge/pack-journee-ia-2026-11-10/Base_RAG.jsonl");

function faq(over: Partial<LignePack> = {}): LignePack {
  return {
    id: "GEO-900",
    type: "faq_knowledge",
    question: "Que contient la Journée IA ?",
    answer_draft: "Un audit le matin et une formation des équipes l’après-midi.",
    source: "INT-03",
    status: "Fait de l’offre",
    publication_gate: "À valider / ne pas publier automatiquement",
    source_date: "2026-11-10",
    publish_directly: false,
    ...over,
  };
}

describe("controlerFiche — doctrine et décisions de Williams", () => {
  it("accepte une fiche propre", () => {
    expect(controlerFiche(faq()).ok).toBe(true);
  });
  it("accepte le seul prix autorisé : Journée IA 1 490 € HT", () => {
    expect(controlerFiche(faq({ answer_draft: "La Journée IA coûte 1 490 € HT." })).ok).toBe(true);
  });
  it("refuse tout autre prix ou remise", () => {
    for (const t of [
      "Remise à 990 € en échange d’un tournage.",
      "Tarif : 2 000 euros.",
      "990 EUR pour la journée.",
      "Seulement €990.",
      "Une remise de 10 %.",
    ]) {
      const r = controlerFiche(faq({ answer_draft: t }));
      expect(r.ok, t).toBe(false);
    }
  });
  it("refuse « Aucun gain garanti », Grenoble et « Will » seul", () => {
    for (const t of ["Aucun gain garanti.", "Depuis Grenoble.", "Contactez Will."]) {
      expect(controlerFiche(faq({ answer_draft: t })).ok, t).toBe(false);
    }
  });
  it("laisse passer Williams et la négation d’une garantie", () => {
    expect(
      controlerFiche(faq({ answer_draft: "Williams précise : le gain n’est pas garanti." })).ok,
    ).toBe(true);
  });
  it("refuse une fiche qui promet un gain ou un remboursement", () => {
    expect(controlerFiche(faq({ answer_draft: "Gain garanti ou remboursé." })).ok).toBe(false);
  });
  it("refuse les variantes d’une promesse de gain", () => {
    for (const t of [
      "Aucun gain n’est garanti.",
      "L’audit garantit un gain.",
      "Satisfait ou remboursé.",
    ]) {
      expect(controlerFiche(faq({ answer_draft: t })).ok, t).toBe(false);
    }
  });
  it("ne rejette pas un millésime suivi du prix autorisé", () => {
    expect(controlerFiche(faq({ answer_draft: "En 2026, 1 490 € HT." })).ok).toBe(true);
  });
  it("contrôle aussi les champs libres repris dans la note", () => {
    expect(controlerFiche(faq({ source: "Contact Will, Grenoble" })).ok).toBe(false);
  });
  it("refuse une fiche vide", () => {
    expect(controlerFiche(faq({ answer_draft: "" })).ok).toBe(false);
  });
});

describe("versEntreeKnowledge — jamais publié", () => {
  const e = versEntreeKnowledge(faq());
  it("brouillon interne, type faq, jamais public", () => {
    expect(e.entry.status).toBe("draft");
    expect(e.entry.type).toBe("faq");
    expect(e.entry.audience).toBe("team");
    expect(e.entry.confidentiality).toBe("internal");
    expect(e.entry.publishedAt).toBeNull();
  });
  it("slug stable dérivé de l’id, traduction FR seule", () => {
    expect(e.entry.slug).toBe("pack-journee-ia-geo-900");
    expect(e.translation.locale).toBe("fr");
    expect(e.translation.slug).toBe(e.entry.slug);
    expect(e.translation.title).toContain("Journée IA");
  });
  it("source, date et garde de publication conservées dans la note de relecture", () => {
    expect(e.entry.briefMarkdown).toContain("INT-03");
    expect(e.entry.briefMarkdown).toContain("2026-11-10");
    expect(e.entry.briefMarkdown).toContain("ne pas publier automatiquement");
  });
  it("échappe le HTML", () => {
    const x = versEntreeKnowledge(faq({ answer_draft: "a <b>b</b> & c" }));
    expect(x.translation.body).toBe("<p>a &lt;b&gt;b&lt;/b&gt; &amp; c</p>");
  });
});

describe("analyserPack — pack réel", () => {
  const rapport = analyserPack(lignesDepuisJsonl(readFileSync(CHEMIN, "utf-8")));

  it("compte tout le fichier et n’en perd aucune ligne", () => {
    const somme = Object.values(rapport.parType).reduce((a, b) => a + b, 0);
    expect(somme).toBe(rapport.total);
    expect(rapport.parType.search_query).toBe(623);
    expect(rapport.parType.faq_knowledge).toBe(63);
  });
  it("n’importe que les fiches questions/réponses, toutes en brouillon", () => {
    expect(rapport.aImporter.length + rapport.rejets.length).toBe(63);
    expect(rapport.aImporter.length).toBe(62);
    expect(rapport.rejets.map((r) => r.id)).toEqual(["GEO-033"]);
    for (const f of rapport.aImporter) {
      expect(f.entry.status).toBe("draft");
      expect(f.entry.publishedAt).toBeNull();
    }
  });
  it("les 623 expressions restent hors RAG (référentiel, jamais des faits)", () => {
    expect(rapport.horsRag.search_query).toBe(623);
  });
  it("une expression qui passerait la doctrine n’est jamais importée", () => {
    const propre = {
      id: "Q-900",
      type: "search_query",
      question: "Que contient la Journée IA ?",
      answer_draft: "Un audit le matin et une formation l’après-midi.",
    };
    expect(controlerFiche(propre).ok).toBe(true);
    const r = analyserPack([propre, faq()]);
    expect(r.horsRag.search_query).toBe(1);
    expect(r.aImporter.map((f) => f.entry.slug)).toEqual(["pack-journee-ia-geo-900"]);
  });
  it("signale la contradiction de remise D02 et la garantie D03", () => {
    expect(rapport.contradictions.map((c) => c.id)).toEqual(expect.arrayContaining(["D02", "D03"]));
  });
  it("slugs uniques", () => {
    const slugs = rapport.aImporter.map((f) => f.entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("lignesDepuisJsonl", () => {
  it("ignore les lignes vides et refuse un JSON invalide avec le numéro de ligne", () => {
    expect(lignesDepuisJsonl('{"id":"a","type":"x"}\n\n')).toHaveLength(1);
    expect(() => lignesDepuisJsonl('{"id":"a","type":"x"}\n{oops')).toThrow(/ligne 2/);
  });
});

describe("contrôle du prix — « HT » exigé et variantes refusées", () => {
  const ok = (t: string) => controlerFiche(faq({ answer_draft: t })).ok;
  it("accepte 1 490 HT avec espace, NBSP, espace fine et décimales", () => {
    for (const t of [
      "1 490 € HT.",
      "1\u00a0490\u00a0€\u00a0HT.",
      "1\u202f490 € HT.",
      "1490 € HT.",
      "1 490,00 € HT.",
      "1 490 euros HT.",
    ]) {
      expect(ok(t), t).toBe(true);
    }
  });
  it("refuse 1 490 sans HT ou en TTC", () => {
    for (const t of ["1 490 €.", "1 490 € TTC.", "1 490 € toutes taxes.", "1 490 € H.T."]) {
      expect(ok(t), t).toBe(false);
    }
  });
  it("refuse réduction, rabais, offert (accents compris)", () => {
    for (const t of [
      "Une réduction de la facture.",
      "Une reduction pour vous.",
      "Un rabais exceptionnel.",
      "La première heure est offerte, offert aux clients.",
    ]) {
      expect(ok(t), t).toBe(false);
    }
  });
  it("refuse les montants en k€ et les nombres sans devise suivis de HT", () => {
    for (const t of ["Budget de 5 k€ par an.", "Compter 2k€.", "Tarif 990 HT.", "Soit 1 490 HT."]) {
      expect(ok(t), t).toBe(false);
    }
  });
  it("ne confond pas « offre » avec « offert »", () => {
    expect(ok("L’offre comprend un audit.")).toBe(true);
  });
});

describe("Tour France IA exclu", () => {
  it("refuse toute mention, avec ou sans « de »", () => {
    for (const t of [
      "Le Tour France IA arrive.",
      "Le tour de France IA arrive.",
      "TOUR  FRANCE  IA",
    ]) {
      expect(controlerFiche(faq({ answer_draft: t })).ok, t).toBe(false);
    }
  });
});

describe("note de relecture — points non vérifiés", () => {
  const MARQUE = "NON VÉRIFIÉ — scénario ou point juridique à confirmer";
  it("scénario non constaté, à vérifier ou juridique : mention en tête, factual_check non repris", () => {
    for (const status of [
      "Exemple à vérifier",
      "Scénario non constaté",
      "À confirmer juridiquement",
      "À valider juridique",
    ]) {
      const e = versEntreeKnowledge(faq({ status }));
      expect(e.entry.briefMarkdown.startsWith(MARQUE), status).toBe(true);
      expect(e.entry.briefMarkdown, status).not.toContain("Donnée réelle ou exemple explicite");
    }
  });
  it("source « scénario non constaté » déclenche aussi la mention", () => {
    const e = versEntreeKnowledge(faq({ source: "Analyse éditoriale — scénario non constaté" }));
    expect(e.entry.briefMarkdown.startsWith(MARQUE)).toBe(true);
  });
  it("fiche factuelle : pas de mention, factual_check repris", () => {
    const e = versEntreeKnowledge(faq({ factual_check: "Donnée réelle ou exemple explicite" }));
    expect(e.entry.briefMarkdown).not.toContain("NON VÉRIFIÉ");
    expect(e.entry.briefMarkdown).toContain("Donnée réelle ou exemple explicite");
  });
  it("dans le pack réel, les 30 scénarios et les points juridiques sont marqués", () => {
    const r = analyserPack(lignesDepuisJsonl(readFileSync(CHEMIN, "utf-8")));
    const marques = r.aImporter.filter((f) => f.entry.briefMarkdown.startsWith(MARQUE));
    expect(marques.length).toBeGreaterThanOrEqual(33);
    for (const f of marques) expect(f.entry.briefMarkdown).not.toContain("Donnée réelle");
  });
});

/** Faux client : mémorise chaque appel ; toute méthode d’écriture autre que `create` est un piège. */
function fauxClient(existants: string[] = [], erreurs: Record<string, unknown> = {}) {
  const base = new Set(existants);
  const appels: string[] = [];
  const piege = (nom: string) => () => {
    appels.push(nom);
    throw new Error(`appel interdit : ${nom}`);
  };
  const client = {
    knowledgeEntry: {
      findUnique: async (a: { where: { slug: string } }) => {
        appels.push("findUnique");
        return base.has(a.where.slug) ? { id: a.where.slug } : null;
      },
      create: async (a: { data: { slug: string } }) => {
        appels.push("create");
        const e = erreurs[a.data.slug];
        if (e) throw e;
        base.add(a.data.slug);
        return { id: a.data.slug };
      },
      update: piege("update"),
      updateMany: piege("updateMany"),
      upsert: piege("upsert"),
      delete: piege("delete"),
      deleteMany: piege("deleteMany"),
    },
  } as unknown as ClientImport;
  return { client, appels, base };
}

describe("importerBrouillons — idempotence et non-écrasement", () => {
  const fiches = [faq({ id: "GEO-901" }), faq({ id: "GEO-902" }), faq({ id: "GEO-903" })].map(
    versEntreeKnowledge,
  );

  it("saute une fiche existante sans appeler create", async () => {
    const { client, appels } = fauxClient(["pack-journee-ia-geo-901"]);
    const r = await importerBrouillons(client, fiches);
    expect(r.crees).toBe(2);
    expect(r.dejaPresents).toBe(1);
    expect(appels.filter((a) => a === "create")).toHaveLength(2);
  });
  it("n’appelle jamais update, upsert, delete ni deleteMany", async () => {
    const { client, appels } = fauxClient(["pack-journee-ia-geo-902"]);
    await importerBrouillons(client, fiches);
    for (const interdit of ["update", "updateMany", "upsert", "delete", "deleteMany"]) {
      expect(appels).not.toContain(interdit);
    }
  });
  it("compte une erreur P2002 sans planter et continue", async () => {
    const { client } = fauxClient([], {
      "pack-journee-ia-geo-901": { code: "P2002", meta: { target: ["slug"] } },
    });
    const r = await importerBrouillons(client, fiches);
    expect(r.crees).toBe(2);
    expect(r.dejaPresents).toBe(1);
    expect(r.conflitsSlugTraduction).toEqual([]);
  });
  it("distingue un conflit de slug de traduction d’une fiche déjà présente", async () => {
    const { client } = fauxClient([], {
      "pack-journee-ia-geo-901": { code: "P2002", meta: { target: ["locale", "slug"] } },
      "pack-journee-ia-geo-902": {
        code: "P2002",
        meta: { target: "KnowledgeTranslation_locale_slug_key" },
      },
    });
    const r = await importerBrouillons(client, fiches);
    expect(r.crees).toBe(1);
    expect(r.dejaPresents).toBe(0);
    expect(r.conflitsSlugTraduction).toEqual([
      "pack-journee-ia-geo-901",
      "pack-journee-ia-geo-902",
    ]);
  });
  it("relance une erreur autre que P2002", async () => {
    const { client } = fauxClient([], { "pack-journee-ia-geo-901": new Error("réseau") });
    await expect(importerBrouillons(client, fiches)).rejects.toThrow("réseau");
  });
  it("la 2e exécution ne crée rien", async () => {
    const { client } = fauxClient();
    const premiere = await importerBrouillons(client, fiches);
    const seconde = await importerBrouillons(client, fiches);
    expect(premiere.crees).toBe(3);
    expect(seconde.crees).toBe(0);
    expect(seconde.dejaPresents).toBe(3);
  });
});

describe("evaluerGardeCommit — garde-fou production", () => {
  const local = "postgresql://u:p@localhost:5432/axion";
  it("dry-run : jamais d’écriture", () => {
    expect(
      evaluerGardeCommit({ commit: false, nodeEnv: "development", databaseUrl: local }).autorise,
    ).toBe(false);
  });
  it("commit sur localhost hors production : autorisé, hôte affiché", () => {
    for (const url of [
      local,
      "postgresql://u:p@127.0.0.1:5432/x",
      "postgresql://u:p@[::1]:5432/x",
    ]) {
      const g = evaluerGardeCommit({ commit: true, nodeEnv: "development", databaseUrl: url });
      expect(g.autorise, url).toBe(true);
      expect(g.hote).toMatch(/localhost|127\.0\.0\.1|::1/);
    }
  });
  it("refuse NODE_ENV=production même sur localhost", () => {
    const g = evaluerGardeCommit({ commit: true, nodeEnv: "production", databaseUrl: local });
    expect(g.autorise).toBe(false);
    expect(g.raison).toMatch(/confirmer-prod/);
  });
  it("refuse une base distante", () => {
    const g = evaluerGardeCommit({
      commit: true,
      nodeEnv: "development",
      databaseUrl: "postgresql://u:p@db.exemple.fr:5432/x",
    });
    expect(g.autorise).toBe(false);
    expect(g.hote).toBe("db.exemple.fr");
  });
  it("ne se laisse pas tromper par un hôte qui contient « localhost »", () => {
    const g = evaluerGardeCommit({
      commit: true,
      nodeEnv: "development",
      databaseUrl: "postgresql://u:p@localhost.evil.fr:5432/x",
    });
    expect(g.autorise).toBe(false);
  });
  it("--confirmer-prod autorise une base distante ou la production", () => {
    const g = evaluerGardeCommit({
      commit: true,
      nodeEnv: "production",
      databaseUrl: "postgresql://u:p@db.exemple.fr:5432/x",
      confirmerProd: true,
    });
    expect(g.autorise).toBe(true);
  });
  it("refuse une URL absente ou illisible, même avec --confirmer-prod", () => {
    for (const databaseUrl of [undefined, "", "pas une url"]) {
      const g = evaluerGardeCommit({
        commit: true,
        nodeEnv: "development",
        databaseUrl,
        confirmerProd: true,
      });
      expect(g.autorise, String(databaseUrl)).toBe(false);
    }
  });
  it("ne divulgue ni identifiant ni mot de passe", () => {
    const g = evaluerGardeCommit({
      commit: true,
      nodeEnv: "production",
      databaseUrl: "postgresql://admin:secret@db.exemple.fr/x",
    });
    expect(JSON.stringify(g)).not.toContain("secret");
    expect(JSON.stringify(g)).not.toContain("admin");
  });
});
