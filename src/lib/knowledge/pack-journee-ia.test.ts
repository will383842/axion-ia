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
  planifierImport,
  slugDeLaFiche,
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
    expect(rapport.aImporter.length).toBe(61);
    expect(rapport.rejets.map((r) => r.id)).toEqual(["GEO-005", "GEO-033"]);
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
  it("GEO-010, 011, 019 et 021 (hypothèses ou analyses) sont marquées, sans « Donnée réelle »", () => {
    const r = analyserPack(
      lignesDepuisJsonl(
        readFileSync(
          join(process.cwd(), "docs/knowledge/pack-journee-ia-2026-11-25/Base_RAG.jsonl"),
          "utf-8",
        ),
      ),
    );
    for (const id of ["GEO-010", "GEO-011", "GEO-019", "GEO-021"]) {
      const f = r.aImporter.find((x) => x.entry.slug === slugDeLaFiche(id));
      expect(f, id).toBeDefined();
      expect(f!.entry.briefMarkdown.startsWith(MARQUE), id).toBe(true);
      expect(f!.entry.briefMarkdown, id).not.toContain("Donnée réelle");
    }
  });
  it("dans le pack réel, les 30 scénarios et les points juridiques sont marqués", () => {
    const r = analyserPack(lignesDepuisJsonl(readFileSync(CHEMIN, "utf-8")));
    const marques = r.aImporter.filter((f) => f.entry.briefMarkdown.startsWith(MARQUE));
    expect(marques.length).toBeGreaterThanOrEqual(32);
    for (const f of marques) expect(f.entry.briefMarkdown).not.toContain("Donnée réelle");
  });
});

/** Faux client : mémorise chaque appel ; toute méthode d’écriture autre que `create` est un piège. */
function fauxClient(existants: string[] = [], erreurs: Record<string, unknown> = {}) {
  const base = new Set(existants);
  const appels: string[] = [];
  const mises: Array<{ where: { id: string }; data: unknown }> = [];
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
      update: async (a: { where: { id: string }; data: unknown }) => {
        appels.push("update");
        mises.push(a);
        return { id: a.where.id };
      },
      updateMany: piege("updateMany"),
      upsert: piege("upsert"),
      delete: piege("delete"),
      deleteMany: piege("deleteMany"),
    },
  } as unknown as ClientImport;
  return { client, appels, base, mises };
}

describe("importerBrouillons — idempotence et non-écrasement", () => {
  const fiches = [faq({ id: "GEO-901" }), faq({ id: "GEO-902" }), faq({ id: "GEO-903" })].map(
    versEntreeKnowledge,
  );

  it("met à jour une fiche existante (slug identique) au lieu de l’ignorer", async () => {
    const { client, appels, mises } = fauxClient(["pack-journee-ia-geo-901"]);
    const r = await importerBrouillons(client, fiches);
    expect(r.crees).toBe(2);
    expect(r.misAJour).toBe(1);
    expect(r.slugsMisAJour).toEqual(["pack-journee-ia-geo-901"]);
    expect(r.dejaPresents).toBe(0);
    expect(appels.filter((a) => a === "create")).toHaveLength(2);
    expect(mises).toHaveLength(1);
    const data = mises[0]!.data as {
      briefMarkdown: string;
      status: string;
      translations: {
        updateMany: { where: { locale: string }; data: { title: string; bodyText: string } };
      };
    };
    expect(mises[0]!.where.id).toBe("pack-journee-ia-geo-901");
    expect(data.status).toBe("draft");
    expect(data.briefMarkdown).toContain("GEO-901");
    expect(data.translations.updateMany.where).toEqual({ locale: "fr" });
    expect(data.translations.updateMany.data.title).toBe(fiches[0]!.translation.title);
    expect(data.translations.updateMany.data.bodyText).toBe(fiches[0]!.translation.bodyText);
    expect(data).not.toHaveProperty("slug");
  });
  it("n’appelle jamais upsert, delete, deleteMany ni updateMany", async () => {
    const { client, appels } = fauxClient(["pack-journee-ia-geo-902"]);
    await importerBrouillons(client, fiches);
    for (const interdit of ["updateMany", "upsert", "delete", "deleteMany"]) {
      expect(appels).not.toContain(interdit);
    }
  });
  it("le mode à sec liste les fiches qui seraient mises à jour, sans écrire", async () => {
    const { client, appels } = fauxClient(["pack-journee-ia-geo-901", "pack-journee-ia-geo-903"]);
    const plan = await planifierImport(client, fiches);
    expect(plan.aMettreAJour).toEqual(["pack-journee-ia-geo-901", "pack-journee-ia-geo-903"]);
    expect(plan.aCreer).toEqual(["pack-journee-ia-geo-902"]);
    expect(appels.every((a) => a === "findUnique")).toBe(true);
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
  it("la 2e exécution ne crée rien : elle met tout à jour", async () => {
    const { client } = fauxClient();
    const premiere = await importerBrouillons(client, fiches);
    const seconde = await importerBrouillons(client, fiches);
    expect(premiere.crees).toBe(3);
    expect(premiere.misAJour).toBe(0);
    expect(seconde.crees).toBe(0);
    expect(seconde.misAJour).toBe(3);
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

describe("porte de doctrine alignée sur le site (pack du 25/11/2026)", () => {
  const accepte = (t: string) => controlerFiche(faq({ answer_draft: t })).ok;
  it("accepte la garantie réelle : gains identifiés, 3 fois le prix HT, sans montant", () => {
    expect(
      accepte(
        "Si les gains identifiés dans votre rapport n’atteignent pas 3 fois le prix HT de la journée, vous êtes remboursé sur demande écrite.",
      ),
    ).toBe(true);
    expect(
      accepte(
        "Si les gains identifiés n’atteignent pas trois fois le prix de la journée, vous êtes remboursé sur demande écrite.",
      ),
    ).toBe(true);
  });
  it("refuse « 4 470 € » sous toutes ses formes, même dans la phrase de la garantie", () => {
    for (const t of [
      "Si les gains identifiés n’atteignent pas 3 fois le prix de la journée (4 470 € HT), vous êtes remboursé.",
      "4 470 euros HT, soit 3 fois le prix ; gains identifiés.",
      "Garantie à 4470 € HT.",
    ]) {
      expect(accepte(t), t).toBe(false);
    }
  });
  it("refuse tout multiple de garantie autre que 3 (« 5 fois », « cinq fois »…)", () => {
    for (const t of [
      "Si les gains identifiés n’atteignent pas 5 fois le prix de la journée, vous êtes remboursé sur demande écrite.",
      "Gains identifiés : garantie à 3 fois le prix, voire 5 fois le prix.",
      "Si les gains identifiés n’atteignent pas cinq fois le prix, vous êtes remboursé.",
      "Si les gains identifiés n’atteignent pas 10 fois la garantie, remboursé.",
    ]) {
      expect(accepte(t), t).toBe(false);
    }
  });
  it("accepte le seuil de déduction de 5 000 € HT dans une phrase sur le devis", () => {
    expect(
      accepte("Un devis d’au moins 5 000 € HT signé sous 60 jours déduit les 1 490 € HT."),
    ).toBe(true);
  });
  it("refuse 4 470 € ou 5 000 € hors de leur contexte, et tout autre prix", () => {
    for (const t of [
      "La journée coûte 4 470 € HT.",
      "Elle coûte 5 000 € HT.",
      "Elle coûte 990 € HT.",
      "Prix : 1 490 € HT, soit 4 470 € HT pour trois journées.",
    ]) {
      expect(accepte(t), t).toBe(false);
    }
  });
  it("refuse une garantie qui ne porte pas sur les gains identifiés", () => {
    for (const t of [
      "Garantie : vous êtes remboursé si vous n’êtes pas satisfait.",
      "Le gain est garanti et sinon remboursé, 3 fois le prix.",
      "Gains garantis à 3 fois le prix.",
    ]) {
      expect(accepte(t), t).toBe(false);
    }
  });
  it("refuse frais de déplacement, hébergement, repas, km et Auvergne", () => {
    for (const t of [
      "Les frais de déplacement sont offerts.",
      "Déplacement compris dans un rayon de 50 km.",
      "Nous prenons en charge l’hébergement.",
      "Le repas du midi est inclus.",
      "Gratuit en Auvergne.",
      "Dans un rayon de 80 km autour de nos bureaux.",
      "Nous nous déplaçons partout.",
    ]) {
      expect(accepte(t), t).toBe(false);
    }
  });
  it("refuse les autres façons de parler du déplacement et de la présence locale", () => {
    for (const t of [
      "Un forfait de 150 est ajouté au-delà de notre zone.",
      "Au-delà, un forfait s’applique selon la distance.",
      "Dans un rayon raisonnable autour de notre siège.",
      "Venue gratuite en Rhône-Alpes.",
      "Venue gratuite en AURA.",
      "Le trajet est facturé sur devis.",
      "La venue hors de notre zone se chiffre sur devis.",
      "Le transport de l’intervenant est en sus.",
      "Nous venons chez vous sans supplément.",
      "Nous sommes basés à Lyon et intervenons en Isère.",
    ]) {
      expect(accepte(t), t).toBe(false);
    }
  });
  it("refuse toute mention de financement", () => {
    for (const t of [
      "Un financement est possible.",
      "Vous pouvez faire financer la journée.",
      "La journée est finançable.",
    ]) {
      expect(accepte(t), t).toBe(false);
    }
  });
  it("n’accepte le seuil de 5 000 € HT que comme minimum d’un devis", () => {
    expect(accepte("Hors du devis, comptez 5 000 € HT.")).toBe(false);
  });
  it("accepte « forfaitaire » et « documents de transport » (usages légitimes)", () => {
    expect(accepte("Une estimation forfaitaire des gains.")).toBe(true);
    expect(accepte("Les documents de transport sont analysés.")).toBe(true);
  });
  it("ne rejette pas à tort « aura », « supplémentaire », « financier », « agence de communication »", () => {
    for (const t of [
      "Le rapport aura un plan d’action sur 90 jours.",
      "Il y aura une attestation de présence.",
      "Le temps supplémentaire passé sur les relances est chiffré.",
      "L’impact financier des tâches répétitives est chiffré.",
      "Une agence de communication peut participer.",
      "Les personnes présentes à la journée posent leurs questions.",
      "L’essence de la méthode : partir de vos tâches réelles.",
      "Les relances partent 2 fois par semaine : l’audit chiffre le gain de temps.",
      "La saisie est faite 4 fois par jour, ce qui coûte du temps.",
      "Le traitement est 10 fois plus rapide, un gain mesuré pendant l’audit.",
      "L’audit peut suivre la prise en charge des patients.",
      "Une IA locale garde les données chez vous.",
      "Une équipe présente à Paris peut suivre la formation.",
      "Les collaborateurs situés en Bretagne y participent.",
      "Une entreprise implantée en France.",
      "Nous sommes présents dans vos locaux toute la journée.",
      "Notre équipe est présente dans vos locaux.",
      "Nous sommes présents à chaque étape.",
      "Nous sommes installés dans votre salle de réunion.",
      "Le devis est relu 2 fois.",
      "Les données sont ressaisies 2 fois, dans le CRM puis dans la facture.",
      "La tâche est répétée 2 fois.",
      "Les montants sont ressaisis 2 fois, dans le CRM puis dans la facture.",
      "Une facture saisie 2 fois coûte cher.",
      "La mise en place est vérifiée 2 fois.",
      "Cette tâche prend 2 fois plus de temps.",
    ]) {
      expect(accepte(t), t).toBe(true);
    }
  });
  it("refuse les trous restants : multiples, 4 470 nu, présence locale, déplacement, financement, prix barré, délais", () => {
    for (const t of [
      "Si les gains identifiés n’atteignent pas 5 fois, vous êtes remboursé.",
      "Gains identifiés : garantie à 5x le prix.",
      "Les gains identifiés couvrent 3 fois le prix, et 5 fois le coût de la journée sinon remboursé.",
      "Soit 4 470, vous êtes remboursé.",
      "Nous sommes installés à Lyon.",
      "Nous sommes présents à Lyon et Annecy.",
      "Nous sommes installés en Savoie.",
      "Garantie : jusqu’à 5 fois les gains identifiés, sinon remboursé.",
      "Vous êtes remboursé 5 fois.",
      "Des gains 5 fois supérieurs au prix.",
      "Des gains jusqu’à 5 fois plus élevés que le prix.",
      "Gains identifiés : 5 fois l’investissement.",
      "Gains identifiés : 5 fois leur prix.",
      "Notre intervention locale suit vos besoins.",
      "Prise en charge de la journée par votre OPCO.",
      "Du carburant est facturé.",
      "Une intervention locale en Savoie, près de chez vous.",
      "Notre agence de Lyon vous reçoit.",
      "L’intervenant se rend chez vous, péage et essence compris.",
      "Sans surcoût dans toute la région.",
      "La journée est subventionnée.",
      "Une subvention est possible.",
      "Prise en charge par votre opérateur de compétences.",
      "Prix barré : 2 490.",
      "Le rapport arrive sous 5 jours ouvrés.",
      "La déduction est cumulable.",
    ]) {
      expect(accepte(t), t).toBe(false);
    }
  });
  it("refuse Grenoble et « Aucun gain garanti »", () => {
    expect(accepte("Notre agence de Grenoble.")).toBe(false);
    expect(accepte("Aucun gain garanti.")).toBe(false);
  });
  it("accepte « dans vos locaux, partout en France »", () => {
    expect(accepte("La Journée IA se déroule dans vos locaux, partout en France.")).toBe(true);
  });
  it("n’exempte pas le contrôle des champs libres", () => {
    expect(controlerFiche(faq({ source: "Rayon 50 km" })).ok).toBe(false);
  });
});

describe("pack final du 25/11/2026 — tout passe la porte", () => {
  const FINAL = join(process.cwd(), "docs/knowledge/pack-journee-ia-2026-11-25/Base_RAG.jsonl");
  const lignes = lignesDepuisJsonl(readFileSync(FINAL, "utf-8"));
  const rapport = analyserPack(lignes);
  it("53 fiches, 0 rejet", () => {
    expect(lignes).toHaveLength(53);
    expect(rapport.rejets).toEqual([]);
    expect(rapport.aImporter).toHaveLength(53);
  });
  it("aucune fiche retirée n’est exportée", () => {
    const ids = new Set(lignes.map((l) => l.id));
    for (const id of [
      "GEO-002",
      "GEO-030",
      "GEO-031",
      "GEO-032",
      "GEO-033",
      "GEO-034",
      "GEO-052",
      "GEO-054",
      "GEO-055",
    ])
      expect(ids.has(id), id).toBe(false);
  });
  it("les 26 pistes par métier portent la mention exacte", () => {
    const pistes = rapport.aImporter.filter((f) =>
      f.translation.bodyText.startsWith("Exemple de piste"),
    );
    expect(pistes).toHaveLength(26);
    for (const f of pistes)
      expect(f.translation.bodyText).toContain("Exemple de piste, pas un résultat constaté.");
  });
  it("délai du rapport : 10 jours ouvrés, déduction : 5 000 € HT sous 60 jours", () => {
    const corps = (id: string) =>
      rapport.aImporter.find((f) => f.entry.slug === `pack-journee-ia-${id.toLowerCase()}`)
        ?.translation.bodyText ?? "";
    expect(corps("GEO-005")).toContain("sous 10 jours ouvrés");
    expect(corps("GEO-006")).toContain("5 000 € HT");
    expect(corps("GEO-006")).toContain("60 jours");
    // GEO-016 (lieu) reprend à 91 % la FAQ du site : signalée dans la PR, non importée.
    expect(corps("GEO-016")).toBe("");
  });
  it("aucune fiche n’affiche de gain chiffré promis ni de prix barré", () => {
    for (const f of rapport.aImporter) {
      expect(f.translation.bodyText, f.entry.slug).not.toMatch(/prix barré|ancien prix/i);
    }
  });
  it("toutes en brouillon interne, jamais publiées", () => {
    for (const f of rapport.aImporter) {
      expect(f.entry.status).toBe("draft");
      expect(f.entry.publishedAt).toBeNull();
    }
  });
});

describe("porte de doctrine — présence locale en « situés » et majuscules", () => {
  const rejetee = (t: string) => controlerFiche(faq({ answer_draft: t })).ok;
  it("rejette « Nous sommes situés à / dans <lieu> »", () => {
    for (const t of [
      "Nous sommes situés à Lyon.",
      "Nous sommes situés dans Lyon.",
      "Nous sommes situés dans le Rhône.",
      "Nous sommes installés dans la Drôme.",
      "Notre équipe est située à Paris.",
      "Nos locaux sont situés à Villeurbanne.",
      "Axion est situé à Lyon.",
      "Notre siège est à Lyon.",
      "Nous sommes situés à proximité de Lyon.",
      "Nous sommes situés au cœur de Lyon.",
    ]) {
      expect(rejetee(t), t).toBe(false);
    }
  });
  it("rejette les interdits écrits en majuscules (insensible à la casse)", () => {
    for (const t of [
      "NOUS SOMMES SITUÉS À LYON.",
      "AGENCE À LYON.",
      "FRAIS DE DÉPLACEMENT en sus.",
      "GRENOBLE.",
      "REMISE de dix pour cent.",
      "PRIX BARRÉ.",
      "FINANCEMENT OPCO.",
      "SOUS 3 JOURS OUVRÉS.",
      "GARANTIE 5 FOIS LE PRIX.",
      "AUCUN GAIN GARANTI.",
      "TOUR FRANCE IA.",
    ]) {
      expect(rejetee(t), t).toBe(false);
    }
  });
  it("laisse passer les formules sans lieu", () => {
    for (const t of [
      "Nous sommes situés dans vos locaux, partout en France.",
      "Nous sommes présents dans vos locaux.",
      "Notre agence de communication travaille avec vous.",
    ]) {
      expect(rejetee(t), t).toBe(true);
    }
  });
});

describe("porte de doctrine — délai et remboursement", () => {
  const ok = (t: string) => controlerFiche(faq({ answer_draft: t })).ok;
  it("rejette tout délai de rapport autre que 10 jours ouvrés", () => {
    for (const t of [
      "Le rapport arrive en 5 jours ouvrés.",
      "Livré dans les 3 jours ouvrés.",
      "Sous 10 jours ouvrables.",
      "Sous 10 jours calendaires.",
    ])
      expect(ok(t), t).toBe(false);
    expect(ok("Le rapport est remis sous 10 jours ouvrés."), "10 ouvrés").toBe(true);
  });
  it("rejette une promesse de remboursement sans le mot « garanti »", () => {
    for (const t of [
      "Si vous n’êtes pas satisfait, vous êtes remboursé.",
      "Remboursement intégral si le chiffre d’affaires n’augmente pas.",
    ])
      expect(ok(t), t).toBe(false);
  });
});

describe("importerBrouillons — fiches non brouillon, bodyJson", () => {
  const fiches = [faq({ id: "GEO-911" }), faq({ id: "GEO-912" }), faq({ id: "GEO-913" })].map(
    versEntreeKnowledge,
  );
  function clientStatut(statuts: Record<string, { status: string; deletedAt?: Date }>) {
    const mises: Array<{ where: { id: string }; data: unknown }> = [];
    const client = {
      knowledgeEntry: {
        findUnique: async (a: { where: { slug: string } }) =>
          statuts[a.where.slug] ? { id: a.where.slug, ...statuts[a.where.slug] } : null,
        create: async () => ({}),
        update: async (a: { where: { id: string }; data: unknown }) => {
          mises.push(a);
          return {};
        },
      },
    } as unknown as ClientImport;
    return { client, mises };
  }
  it("ne touche jamais une fiche publiée, archivée ou supprimée, et la liste à part", async () => {
    const { client, mises } = clientStatut({
      "pack-journee-ia-geo-911": { status: "published" },
      "pack-journee-ia-geo-912": { status: "archived" },
      "pack-journee-ia-geo-913": { status: "draft", deletedAt: new Date() },
    });
    const r = await importerBrouillons(client, fiches);
    expect(mises).toHaveLength(0);
    expect(r.misAJour).toBe(0);
    expect(r.ignoreesNonBrouillon).toHaveLength(3);
    const plan = await planifierImport(client, fiches);
    expect(plan.ignorees).toHaveLength(3);
    expect(plan.aMettreAJour).toHaveLength(0);
  });
  it("met à jour un brouillon ou une fiche en relecture et efface bodyJson", async () => {
    const effacer = Symbol("DbNull");
    const { client, mises } = clientStatut({
      "pack-journee-ia-geo-911": { status: "draft" },
      "pack-journee-ia-geo-912": { status: "review" },
    });
    const r = await importerBrouillons(client, fiches, effacer);
    expect(r.misAJour).toBe(2);
    const d = mises[0]!.data as {
      translations: { updateMany: { data: { bodyJson: unknown } } };
    };
    expect(d.translations.updateMany.data.bodyJson).toBe(effacer);
  });
});
